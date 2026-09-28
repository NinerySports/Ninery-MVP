import { Prisma, type PrismaClient } from "@prisma/client";
import { equipmentClaimReviewStateValues, type EquipmentClaimProvenanceGraph } from "@ninery/equipment-intelligence";
import { canonicalizeExternalClaimValue, type ExternalClaimIngestionRecord } from "./external-claim-ingestion.js";
import { requireDurableProposedEvidenceClass } from "./durable-proposed-evidence-class.js";
import { assessCurrentGovernance, PrismaExternalClaimIngestionRepository } from "./prisma-external-claim-ingestion-repository.js";
import { GOVERNED_EXTERNAL_CLAIM_REVIEW_POLICY_VERSION, GOVERNED_EXTERNAL_CLAIM_REVIEW_VERSION, type GovernedReviewLocator } from "./external-claim-review.js";
import { assessReviewedQualification, qualificationPersistenceMeaning, QualificationConvergenceError, type ReviewedQualification, type ReviewedQualificationRepository, type ReviewedQualificationState } from "./reviewed-dimension-qualification-convergence.js";

type Client = PrismaClient | Prisma.TransactionClient;
const accepted = ["reviewed_accepted", "reviewed_with_limitations"];

export class PrismaReviewedQualificationRepository implements ReviewedQualificationRepository {
  constructor(private readonly client: Client, private readonly inTransaction = false) {}

  transaction<T>(operation: (repository: ReviewedQualificationRepository) => Promise<T>): Promise<T> {
    if (this.inTransaction) return operation(this);
    return (this.client as PrismaClient).$transaction(tx => operation(new PrismaReviewedQualificationRepository(tx, true)), { isolationLevel: "ReadCommitted", timeout: 30000 });
  }

  async lock(locator: GovernedReviewLocator): Promise<void> {
    await this.client.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${locator.claimSlotKey}, 0))::text AS locked`;
    const sources = await this.client.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "external_evidence_sources" WHERE "id"=${locator.sourceId}::uuid FOR UPDATE`;
    if (sources.length !== 1) throw new QualificationConvergenceError("source_not_found");
  }

  async load(locator: GovernedReviewLocator, anchoredRecord?: ExternalClaimIngestionRecord): Promise<ReviewedQualificationState> {
    const record = anchoredRecord ?? await new PrismaExternalClaimIngestionRepository(this.client, this.inTransaction).findByIdempotencyKey(locator.ingestionIdempotencyKey, locator.ingestionSemanticFingerprint);
    if (!record) throw new QualificationConvergenceError("case_not_found");
    if (record.sourceId !== locator.sourceId || record.claimSlotKey !== locator.claimSlotKey) throw new QualificationConvergenceError("claim_scope_mismatch");
    if (!record.reviewReady.current || record.reviewReady.unresolvedConflictIds.length) throw new QualificationConvergenceError("claim_not_current");
    const normalized = await this.client.externalEvidenceNormalizedClaim.findUniqueOrThrow({ where: { id: record.normalizedClaimId }, include: {
      rawClaim: { include: { document: { include: { source: true } }, identityAssertion: true, extractionRun: true } },
      constructRelationships: { include: { supersededBy: { select: { id: true } } } }
    } });
    const proposal = requireDurableProposedEvidenceClass(normalized.proposedEvidenceClass);
    const raw = normalized.rawClaim;
    const dependencies = await this.client.externalEvidenceDependencyAssessment.findMany({ where: { claimId: raw.id }, include: { supersededBy: { select: { id: true } } } });
    const dependency = oneLeaf(dependencies);
    const construct = oneLeaf(normalized.constructRelationships);
    if (!dependency.decisionFingerprint || !dependency.reviewedStateFingerprint || dependency.reviewerType !== "human" || !dependency.reviewerReference || !accepted.includes(dependency.reviewedState)) throw new QualificationConvergenceError("dependency_not_governed_reviewed");
    if (dependency.dependencyType === "unknown_dependency") throw new QualificationConvergenceError("dependency_unknown");
    if (!construct.decisionFingerprint || !construct.reviewedStateFingerprint || !construct.reviewerReference || !accepted.includes(construct.reviewState)) throw new QualificationConvergenceError("construct_not_governed_reviewed");
    if (dependency.assessmentVersion !== GOVERNED_EXTERNAL_CLAIM_REVIEW_VERSION || construct.policyVersion !== GOVERNED_EXTERNAL_CLAIM_REVIEW_POLICY_VERSION) throw new QualificationConvergenceError("dimension_policy_not_current");
    const governances = await this.client.externalEvidenceSourceGovernanceRevision.findMany({ where: { sourceId: locator.sourceId, supersededBy: { none: {} } } });
    if (governances.length !== 1) throw new QualificationConvergenceError("source_governance_ambiguous");
    const governance = governances[0]!;
    const assessment = assessCurrentGovernance(governances, raw.claimType, raw.authority);
    if (assessment.blockers.length) throw new QualificationConvergenceError(assessment.blockers.join(","));
    if (strings(normalized.limitations).includes("ingestion:vocabulary_unknown")) throw new QualificationConvergenceError("unknown_normalization_vocabulary");
    const identity = raw.identityAssertion;
    const targetIdentity = { id: identity.id, certainty: identity.certainty,
      manufacturer: identity.manufacturer ?? undefined, model: identity.model ?? undefined, modelYear: identity.modelYear ?? undefined,
      certification: identity.certification ?? undefined, constructionRevision: identity.constructionRevision ?? undefined,
      lengthInches: identity.lengthInches?.toNumber(), weightOunces: identity.weightOunces?.toNumber(), drop: identity.drop ?? undefined,
      sku: identity.sku ?? undefined, manufacturerProductId: identity.manufacturerProductId ?? undefined, upc: identity.upc ?? undefined,
      equipmentId: identity.equipmentId ?? undefined, equipmentVariantId: identity.equipmentVariantId ?? undefined, limitations: strings(identity.limitations) };
    const document = raw.document;
    const extraction = raw.extractionRun;
    const parsedExtractor: unknown = JSON.parse(extraction.extractorId);
    if (!parsedExtractor || typeof parsedExtractor !== "object" || !("extractorId" in parsedExtractor) || typeof parsedExtractor.extractorId !== "string") throw new QualificationConvergenceError("extraction_provenance_invalid");
    const group = await this.dependencyGroup(dependency, new Set());
    const graph: EquipmentClaimProvenanceGraph = { version: "1.0",
      sources: [{ id: document.sourceId, displayName: document.source.displayName, sourceType: governance.sourceType,
        publisherIdentity: governance.publisherIdentity ?? undefined, operatorIdentity: document.source.operatorIdentity ?? undefined, state: "active", version: document.source.sourceVersion }],
      documents: [{ id: document.id, sourceId: document.sourceId, documentType: member(document.documentType, ["product_page", "specification_sheet", "retailer_page", "review_article", "review_video_transcript", "certification_listing", "measurement_packet", "survey_response", "model_output"]),
        sourceReference: document.sourceReference, title: document.title, publishedAt: document.publishedAt?.toISOString(), retrievedAt: document.retrievedAt.toISOString(), modelYear: document.modelYear ?? undefined, revision: document.revision, contentFingerprint: document.contentFingerprint ?? undefined,
        availability: member(document.availability, ["available", "unavailable", "historical", "unknown"]) }],
      extractionRuns: [{ id: extraction.id, method: member(extraction.method, ["manual", "deterministic_parser", "ai_assisted"]), extractorType: member(extraction.extractorType, ["human", "software", "ai_model"]), extractorId: parsedExtractor.extractorId, extractorVersion: extraction.extractorVersion, executedAt: extraction.executedAt.toISOString(), schemaVersion: extraction.schemaVersion, reviewState: member(extraction.reviewState, equipmentClaimReviewStateValues) }],
      identities: [targetIdentity],
      rawClaims: [{ id: raw.id, sourceId: document.sourceId, documentId: document.id, identityAssertionId: identity.id, extractionRunId: extraction.id,
        sourceLocation: raw.sourceLocation ?? undefined, rawText: raw.rawText ?? undefined, rawStructuredValue: raw.rawStructuredValue ?? undefined,
        claimType: raw.claimType, verificationState: raw.verificationState, reviewState: member(raw.reviewState, equipmentClaimReviewStateValues),
        independenceGroupId: group, authority: member(raw.authority, ["authoritative", "primary", "secondary", "observational", "unknown", "not_authoritative_for_claim"]), authorityRationale: raw.authorityRationale, limitations: strings(raw.limitations) }],
      normalizedClaims: [{ id: normalized.id, rawClaimId: raw.id, claimKey: normalized.claimKey, normalizedValue: normalized.normalizedValue, normalizedUnit: normalized.normalizedUnit ?? undefined,
        originalValue: normalized.originalValue ?? undefined, originalUnit: normalized.originalUnit ?? undefined,
        normalizationMethod: member(normalized.normalizationMethod, ["identity", "unit_conversion", "controlled_vocabulary", "manual_interpretation", "model_output"]), normalizationVersion: normalized.normalizationVersion,
        evidenceClass: proposal, verificationState: normalized.verificationState, reviewState: member(normalized.reviewState, equipmentClaimReviewStateValues), identityAssertionId: identity.id, limitations: strings(normalized.limitations) }],
      dependencies: [{ id: dependency.id, claimId: raw.id, upstreamClaimId: dependency.upstreamClaimId ?? undefined, dependencyType: dependency.dependencyType, dependencyRationale: dependency.dependencyRationale, reviewedState: member(dependency.reviewedState, equipmentClaimReviewStateValues) }],
      constructRelationships: [{ id: construct.id, normalizedClaimId: normalized.id, construct: construct.proposedConstruct, role: construct.role,
        mappingMethod: member(construct.mappingMethod, ["manual_review", "controlled_vocabulary", "policy_mapping", "keyword_candidate"]), mappingVersion: construct.mappingVersion,
        reviewState: member(construct.reviewState, equipmentClaimReviewStateValues), rationale: construct.rationale, limitations: strings(construct.limitations), constructValueCreated: false }], modeledLineages: [] };
    // Dependency ancestry is context only; it cannot become a second supporting claim.
    const composed = dependency.upstreamClaimId ? await this.addUpstream(graph, dependency.upstreamClaimId, group, new Set([raw.id])) : graph;
    return { graph: composed, targetIdentity, normalizedClaimId: normalized.id, dependencyAssessmentId: dependency.id, constructRelationshipId: construct.id,
      sourceId: locator.sourceId, sourceGovernanceRevisionId: governance.id,
      governedMeaning: { dependency: dimensionMeaning(dependency), construct: dimensionMeaning(construct), governance: dimensionMeaning(governance), operationalPolicy: assessment.policyVersion } };
  }

  private async dependencyGroup(dependency: { claimId: string; upstreamClaimId: string | null; dependencyType: string; independenceGroupId: string | null }, visited: Set<string>): Promise<string> {
    if (visited.has(dependency.claimId)) throw new QualificationConvergenceError("dependency_cycle");
    visited.add(dependency.claimId);
    if (dependency.dependencyType === "original") {
      const raw = await this.client.externalEvidenceClaim.findUniqueOrThrow({ where: { id: dependency.claimId }, select: { documentId: true } });
      return `document:${raw.documentId}`;
    }
    if (dependency.dependencyType === "independent_observation") {
      if (!dependency.independenceGroupId) throw new QualificationConvergenceError("dependency_group_missing");
      return dependency.independenceGroupId;
    }
    if (!dependency.upstreamClaimId) throw new QualificationConvergenceError("dependency_upstream_missing");
    await this.lockUpstream(dependency.upstreamClaimId);
    const parents = await this.client.externalEvidenceDependencyAssessment.findMany({ where: { claimId: dependency.upstreamClaimId }, include: { supersededBy: { select: { id: true } } } });
    return this.dependencyGroup(oneLeaf(parents), visited);
  }

  private async addUpstream(graph: EquipmentClaimProvenanceGraph, id: string, group: string, visited: Set<string>): Promise<EquipmentClaimProvenanceGraph> {
    if (visited.has(id)) throw new QualificationConvergenceError("dependency_cycle");
    visited.add(id);
    const raw = await this.client.externalEvidenceClaim.findUniqueOrThrow({ where: { id }, include: { document: { include: { source: true } }, identityAssertion: true, extractionRun: true } });
    const dependencies = await this.client.externalEvidenceDependencyAssessment.findMany({ where: { claimId: id }, include: { supersededBy: { select: { id: true } } } });
    const dependency = oneLeaf(dependencies);
    const document = raw.document;
    const run = raw.extractionRun;
    const identity = raw.identityAssertion;
    const next: EquipmentClaimProvenanceGraph = { ...graph,
      sources: unique([...graph.sources, { id: document.sourceId, displayName: document.source.displayName, sourceType: document.source.sourceType, state: "active" as const, version: document.source.sourceVersion }]),
      documents: unique([...graph.documents, { id: document.id, sourceId: document.sourceId, documentType: member(document.documentType, ["product_page", "specification_sheet", "retailer_page", "review_article", "review_video_transcript", "certification_listing", "measurement_packet", "survey_response", "model_output"]), sourceReference: document.sourceReference, title: document.title, retrievedAt: document.retrievedAt.toISOString(), availability: member(document.availability, ["available", "unavailable", "historical", "unknown"]) }]),
      extractionRuns: unique([...graph.extractionRuns, { id: run.id, method: member(run.method, ["manual", "deterministic_parser", "ai_assisted"]), extractorType: member(run.extractorType, ["human", "software", "ai_model"]), extractorId: run.extractorId, extractorVersion: run.extractorVersion, schemaVersion: run.schemaVersion, executedAt: run.executedAt.toISOString(), reviewState: member(run.reviewState, equipmentClaimReviewStateValues) }]),
      identities: unique([...graph.identities, { id: identity.id, certainty: identity.certainty, equipmentId: identity.equipmentId ?? undefined, equipmentVariantId: identity.equipmentVariantId ?? undefined, limitations: strings(identity.limitations) }]),
      rawClaims: [...graph.rawClaims, { id: raw.id, sourceId: document.sourceId, documentId: document.id, identityAssertionId: identity.id, extractionRunId: run.id, claimType: raw.claimType, verificationState: raw.verificationState, reviewState: member(raw.reviewState, equipmentClaimReviewStateValues), independenceGroupId: group, authority: member(raw.authority, ["authoritative", "primary", "secondary", "observational", "unknown", "not_authoritative_for_claim"]), authorityRationale: raw.authorityRationale, limitations: strings(raw.limitations) }],
      dependencies: [...graph.dependencies, { id: dependency.id, claimId: id, upstreamClaimId: dependency.upstreamClaimId ?? undefined, dependencyType: dependency.dependencyType, dependencyRationale: dependency.dependencyRationale, reviewedState: member(dependency.reviewedState, equipmentClaimReviewStateValues) }] };
    return dependency.upstreamClaimId ? this.addUpstream(next, dependency.upstreamClaimId, group, visited) : next;
  }

  private async lockUpstream(id: string): Promise<void> {
    if (!this.inTransaction) return;
    const raw = await this.client.externalEvidenceClaim.findUniqueOrThrow({ where: { id }, select: { claimSlotKey: true, document: { select: { sourceId: true } } } });
    if (!raw.claimSlotKey) throw new QualificationConvergenceError("upstream_slot_provenance_missing");
    await this.lock({ claimSlotKey: raw.claimSlotKey, sourceId: raw.document.sourceId, ingestionIdempotencyKey: "", ingestionSemanticFingerprint: "" });
  }

  async findCurrent(state: ReviewedQualificationState, expected: ReviewedQualification): Promise<boolean> {
    const rows = await this.client.externalEvidenceQualificationDecision.findMany({ where: { normalizedClaimId: state.normalizedClaimId, OR: [{ id: expected.id }, { semanticFingerprint: expected.semanticFingerprint }] } });
    if (!rows.length) return false;
    if (rows.length !== 1) throw new QualificationConvergenceError("qualification_ambiguous");
    const row = rows[0]!;
    const persisted = qualificationPersistenceMeaning(expected.assessment);
    if (row.id !== expected.id || row.semanticFingerprint !== expected.semanticFingerprint || row.constructRelationshipId !== state.constructRelationshipId || row.sourceGovernanceRevisionId !== state.sourceGovernanceRevisionId || row.sourceId !== state.sourceId || row.idempotencyKey !== `reviewed-qualification:${expected.semanticFingerprint}` ||
      canonicalizeExternalClaimValue(persisted) !== canonicalizeExternalClaimValue({ contractVersion: row.contractVersion, state: row.state, proposedEvidenceClass: row.proposedEvidenceClass, proposedEvidenceInput: row.proposedEvidenceInput, proposedTargetLevel: row.proposedTargetLevel, reasons: row.reasons, gaps: row.gaps, blockers: row.blockers, warnings: row.warnings, limitations: row.limitations })) throw new QualificationConvergenceError("qualification_meaning_inconsistent");
    return true;
  }

  async append(state: ReviewedQualificationState, expected: ReviewedQualification): Promise<void> {
    if (!this.inTransaction) throw new QualificationConvergenceError("transaction_required");
    const meaning = qualificationPersistenceMeaning(expected.assessment);
    await this.client.externalEvidenceQualificationDecision.create({ data: { ...meaning,
      proposedEvidenceInput: meaning.proposedEvidenceInput ? json(meaning.proposedEvidenceInput) : Prisma.DbNull,
      reasons: json(meaning.reasons), gaps: json(meaning.gaps), blockers: json(meaning.blockers), warnings: json(meaning.warnings), limitations: json(meaning.limitations),
      id: expected.id, normalizedClaimId: state.normalizedClaimId, constructRelationshipId: state.constructRelationshipId, sourceId: state.sourceId,
      sourceGovernanceRevisionId: state.sourceGovernanceRevisionId, semanticFingerprint: expected.semanticFingerprint, idempotencyKey: `reviewed-qualification:${expected.semanticFingerprint}` } });
  }
}

export async function projectReviewedQualification(client: Client, locator: GovernedReviewLocator, record: ExternalClaimIngestionRecord, inTransaction: boolean) {
  const repository = new PrismaReviewedQualificationRepository(client, inTransaction);
  const state = await repository.load(locator, record);
  const expected = assessReviewedQualification(state);
  return { state, expected, current: await repository.findCurrent(state, expected) };
}

function oneLeaf<T extends { supersededBy: readonly { id: string }[] }>(rows: readonly T[]): T {
  const leaves = rows.filter(row => !row.supersededBy.length);
  if (leaves.length !== 1) throw new QualificationConvergenceError("dimension_lineage_ambiguous");
  return leaves[0]!;
}
function member<const T extends readonly string[]>(value: string, values: T): T[number] {
  const found = values.find(candidate => candidate === value);
  if (found === undefined) throw new QualificationConvergenceError("durable_domain_value_invalid");
  return found;
}
function strings(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value) || !value.every(item => typeof item === "string")) throw new QualificationConvergenceError("durable_metadata_invalid");
  return value;
}
function json(value: unknown): Prisma.InputJsonValue { return JSON.parse(JSON.stringify(value)); }
function dimensionMeaning(row: object): unknown {
  return Object.fromEntries(Object.entries(row).filter(([key]) => !["createdAt", "reviewedAt", "effectiveAt", "supersededBy"].includes(key)));
}
function unique<T extends { id: string }>(rows: readonly T[]): T[] { return [...new Map(rows.map(row => [row.id, row])).values()].sort((a, b) => a.id.localeCompare(b.id)); }
