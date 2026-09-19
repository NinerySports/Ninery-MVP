import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { canonicalizeExternalClaimValue, externalClaimUuid, identitySemantics, qualificationFingerprint, ExternalClaimIngestionError, type ExternalClaimIngestionInput, type ExternalClaimIngestionRecord, type ExternalClaimIngestionRepository, type ExternalClaimPersistenceUnit, type ExternalClaimProposal, type ExternalClaimTrustedResolution } from "./external-claim-ingestion.js";

type Client = PrismaClient | Prisma.TransactionClient;
export const SOURCE_GOVERNANCE_OPERATIONAL_POLICY_VERSION = "1.0";

export class PrismaExternalClaimIngestionRepository implements ExternalClaimIngestionRepository {
  constructor(private readonly client: Client, private readonly inTransaction = false) {}

  transaction<T>(operation: (repository: ExternalClaimIngestionRepository) => Promise<T>): Promise<T> {
    if (this.inTransaction) return operation(this);
    return (this.client as PrismaClient).$transaction((tx) => operation(new PrismaExternalClaimIngestionRepository(tx, true)), { isolationLevel: "Serializable" });
  }

  isRecognizedConcurrencyError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code);
  }

  async resolveTrustedContext(input: ExternalClaimIngestionInput, claim: ExternalClaimProposal): Promise<ExternalClaimTrustedResolution> {
    const blockers: string[] = [];
    const persistedSource = await this.client.externalEvidenceSource.findUnique({ where: { stableKey: input.source.stableKey }, include: { governanceRevisions: { include: { supersededBy: true } } } });
    const sourceMetadata = persistedSource?.metadata && typeof persistedSource.metadata === "object" && !Array.isArray(persistedSource.metadata) ? persistedSource.metadata : undefined;
    const source = persistedSource ? {
      stableKey: persistedSource.stableKey,
      displayName: persistedSource.displayName,
      sourceType: persistedSource.sourceType,
      publisherIdentity: persistedSource.publisherIdentity ?? undefined,
      sourceVersion: persistedSource.sourceVersion
    } : {
      stableKey: input.source.stableKey,
      displayName: input.source.displayName,
      sourceType: "derived_model_output" as const,
      sourceVersion: input.source.sourceVersion
    };
    const currentGovernance = persistedSource?.governanceRevisions.filter((revision) => revision.supersededBy.length === 0) ?? [];
    if (currentGovernance.length > 1) blockers.push("source_governance_ambiguous");
    const governance = currentGovernance.length === 1 ? currentGovernance[0] : undefined;
    if (!persistedSource || sourceMetadata?.sourceAuthorityResolved === false || (persistedSource.governanceRevisions.length > 0 && !governance)) blockers.push("source_authority_unresolved");
    const governedSourceType = governance?.sourceType ?? persistedSource?.sourceType;
    const governedPublisher = governance?.publisherIdentity ?? persistedSource?.publisherIdentity;
    if (persistedSource && (persistedSource.sourceType !== input.source.sourceType || persistedSource.publisherIdentity !== (input.source.publisherIdentity ?? null))) blockers.push("source_proposal_conflicts_with_registry");
    const governanceAssessment = governance && governedSourceType
      ? assessCurrentGovernance([governance], claim.claimType, authorityFor(governedSourceType, claim.claimType))
      : undefined;

    const requestedEquipmentId = claim.identity.equipmentId ?? input.targetIdentity.equipmentId;
    const requestedVariantId = claim.identity.equipmentVariantId ?? input.targetIdentity.equipmentVariantId;
    const equipment = requestedEquipmentId ? await this.client.equipment.findUnique({ where: { id: requestedEquipmentId } }) : null;
    const variant = requestedVariantId ? await this.client.equipmentVariant.findUnique({ where: { id: requestedVariantId } }) : null;
    if (!equipment) blockers.push("catalog_identity_unresolved");
    if (requestedVariantId && (!variant || variant.equipmentId !== equipment?.id)) blockers.push("catalog_variant_unresolved");
    const exactVariant = Boolean(equipment && variant && claim.identity.certainty === "exact_variant_match");
    const identity = equipment ? {
      ...claim.identity,
      certainty: exactVariant ? "exact_variant_match" as const : claim.identity.certainty === "family_only" ? "family_only" as const : "equipment_model_match" as const,
      manufacturer: equipment.manufacturer,
      model: equipment.model,
      modelYear: equipment.modelYear ?? undefined,
      certification: String(equipment.certification),
      lengthInches: exactVariant ? Number(variant!.lengthInches) : undefined,
      weightOunces: exactVariant ? Number(variant!.weightOunces) : undefined,
      drop: exactVariant ? variant!.dropWeight ?? undefined : undefined,
      sku: exactVariant ? variant!.sku ?? undefined : undefined,
      equipmentId: equipment.id,
      equipmentVariantId: exactVariant ? variant!.id : undefined,
      limitations: [...claim.identity.limitations, ...blockers.filter((blocker) => blocker.startsWith("catalog_"))]
    } : { ...claim.identity, certainty: "unresolved" as const, equipmentId: undefined, equipmentVariantId: undefined, limitations: [...claim.identity.limitations, ...blockers.filter((blocker) => blocker.startsWith("catalog_"))] };
    const authority = persistedSource && governanceStateAllowsAuthority(governance?.state) && (!governanceAssessment || governanceAssessment.blockers.length === 0) && !blockers.some((blocker) => blocker.startsWith("source_governance_") || blocker === "source_proposal_conflicts_with_registry")
      ? authorityFor(governedSourceType!, claim.claimType)
      : "unknown" as const;
    const governanceRevision = governance ? { id: governance.id, revisionNumber: governance.revisionNumber, version: governance.governanceVersion, effectiveAt: governance.effectiveAt } : initialGovernanceRevision(source, authority);
    return { source: { ...source, sourceType: governedSourceType ?? source.sourceType, publisherIdentity: governedPublisher ?? undefined }, identity, authority, governanceRevision, blockers: [...new Set(blockers)].sort() };
  }

  async findByIdempotencyKey(idempotencyKey: string, semanticFingerprint: string): Promise<ExternalClaimIngestionRecord | undefined> {
    const row = await this.client.externalEvidenceQualificationDecision.findUnique({
      where: { idempotencyKey },
      include: {
        normalizedClaim: { include: { rawClaim: { include: { document: { include: { source: true } }, extractionRun: true, identityAssertion: true, dependencyAssessments: { orderBy: { assessedAt: "desc" }, take: 1 } } } } },
        constructRelationship: true,
        sourceGovernanceRevision: true
      }
    });
    if (!row) return undefined;
    const normalized = row.normalizedClaim;
    const raw = normalized.rawClaim;
    const dependency = raw.dependencyAssessments[0];
    if (!dependency) throw new ExternalClaimIngestionError("PERSISTED_LINEAGE_INCOMPLETE", "Qualification exists without its dependency assessment.");
    const extractorIdentity = parseExtractorIdentity(raw.extractionRun.extractorId);
    const sourceExpected = externalClaimUuid(`source:${raw.document.source.stableKey}`);
    const documentExpected = externalClaimUuid(`document:${canonicalizeExternalClaimValue({ sourceId: raw.document.sourceId, sourceReference: raw.document.sourceReference, contentFingerprint: raw.document.contentFingerprint ?? undefined, documentType: raw.document.documentType, title: raw.document.title, publishedAt: raw.document.publishedAt?.toISOString(), modelYear: raw.document.modelYear ?? undefined, revision: raw.document.revision, availability: raw.document.availability })}`);
    const extractionExpected = externalClaimUuid(`extraction:${canonicalizeExternalClaimValue({ documentId: raw.documentId, logicalRunKey: extractorIdentity.logicalRunKey, method: raw.extractionRun.method, extractorType: raw.extractionRun.extractorType, extractorId: extractorIdentity.extractorId, extractorVersion: raw.extractionRun.extractorVersion, schemaVersion: raw.extractionRun.schemaVersion, providerModelId: extractorIdentity.providerModelId, executedAt: raw.extractionRun.executedAt.toISOString() })}`);
    const identityExpected = externalClaimUuid(`identity:${canonicalizeExternalClaimValue(identitySemantics({ id: raw.identityAssertion.id, certainty: raw.identityAssertion.certainty, manufacturer: raw.identityAssertion.manufacturer ?? undefined, model: raw.identityAssertion.model ?? undefined, modelYear: raw.identityAssertion.modelYear ?? undefined, certification: raw.identityAssertion.certification ?? undefined, constructionRevision: raw.identityAssertion.constructionRevision ?? undefined, lengthInches: raw.identityAssertion.lengthInches === null ? undefined : Number(raw.identityAssertion.lengthInches), weightOunces: raw.identityAssertion.weightOunces === null ? undefined : Number(raw.identityAssertion.weightOunces), drop: raw.identityAssertion.drop ?? undefined, sku: raw.identityAssertion.sku ?? undefined, manufacturerProductId: raw.identityAssertion.manufacturerProductId ?? undefined, upc: raw.identityAssertion.upc ?? undefined, equipmentId: raw.identityAssertion.equipmentId ?? undefined, equipmentVariantId: raw.identityAssertion.equipmentVariantId ?? undefined, limitations: strings(raw.identityAssertion.limitations) }))}`);
    if (!raw.claimSlotKey || !row.sourceGovernanceRevisionId || !row.sourceGovernanceRevision || !row.semanticFingerprint) throw new ExternalClaimIngestionError("PERSISTED_LINEAGE_INCOMPLETE", "Ticket #076 lineage lacks claim-slot, governance-revision, or qualification semantic metadata.");
    if (row.sourceId !== raw.document.sourceId || row.sourceGovernanceRevision.sourceId !== raw.document.sourceId) throw new ExternalClaimIngestionError("SOURCE_GOVERNANCE_LINEAGE_MISMATCH", "Qualification governance must belong to the claim's logical source.");
    const rawExpected = externalClaimUuid(`raw:${canonicalizeExternalClaimValue({ documentId: raw.documentId, extractionRunId: raw.extractionRunId, identityAssertionId: raw.identityAssertionId, claimSlotKey: raw.claimSlotKey, rawText: raw.rawText ?? undefined, rawStructuredValue: raw.rawStructuredValue ?? undefined, claimType: raw.claimType, sourceLocation: raw.sourceLocation ?? undefined })}`);
    const normalizedLimitationsForIdentity = strings(normalized.limitations).filter((item) => !item.startsWith("ingestion:vocabulary_")).sort();
    const normalizedExpected = externalClaimUuid(`normalized:${canonicalizeExternalClaimValue({ rawClaimId: normalized.rawClaimId, claimKey: normalized.claimKey, value: normalized.normalizedValue, unit: normalized.normalizedUnit ?? undefined, originalValue: normalized.originalValue ?? undefined, originalUnit: normalized.originalUnit ?? undefined, method: normalized.normalizationMethod, version: normalized.normalizationVersion, vocabularyKnown: !strings(normalized.limitations).includes("ingestion:vocabulary_unknown"), evidenceClass: normalized.evidenceClass, limitations: normalizedLimitationsForIdentity })}`);
    const dependencyExpected = externalClaimUuid(`dependency:${canonicalizeExternalClaimValue({ rawClaimId: raw.id, type: dependency.dependencyType, upstreamClaimId: dependency.upstreamClaimId ?? undefined, rationale: dependency.dependencyRationale, version: dependency.assessmentVersion })}`);
    const constructExpected = externalClaimUuid(`construct:${canonicalizeExternalClaimValue({ normalizedClaimId: normalized.id, constructName: row.constructRelationship.proposedConstruct, method: row.constructRelationship.mappingMethod, confidence: row.constructRelationship.mappingConfidence, version: row.constructRelationship.mappingVersion, rationale: row.constructRelationship.rationale, role: row.constructRelationship.role })}`);
    const qualificationExpected = externalClaimUuid(`qualification:${canonicalizeExternalClaimValue({ normalizedClaimId: normalized.id, identityAssertionId: raw.identityAssertionId, dependencyAssessmentId: dependency.id, constructRelationshipId: row.constructRelationshipId, contractVersion: row.contractVersion })}`);
    const mismatchedStage = [[raw.document.sourceId, sourceExpected], [raw.documentId, documentExpected], [raw.extractionRunId, extractionExpected], [raw.identityAssertionId, identityExpected], [raw.id, rawExpected], [normalized.id, normalizedExpected], [dependency.id, dependencyExpected], [row.constructRelationshipId, constructExpected], [row.id, qualificationExpected]].find(([actual, expected]) => actual !== expected);
    if (mismatchedStage) throw new ExternalClaimIngestionError("SEMANTIC_FINGERPRINT_MISMATCH", "Persisted stage semantics do not match their deterministic identities.");
    const persistedFingerprint = ingestionFingerprint(raw.document.sourceId, raw.documentId, raw.extractionRunId, raw.identityAssertionId, raw.id, normalized.id, dependency.id, row.constructRelationshipId, row.id);
    if (persistedFingerprint !== semanticFingerprint) throw new ExternalClaimIngestionError("SEMANTIC_FINGERPRINT_MISMATCH", "The persisted lineage does not match the requested semantic fingerprint.");
    const historicalQualification = {
      contractVersion: "1.0" as const,
      normalizedClaimId: normalized.id,
      rawClaimId: raw.id,
      state: String(row.state) as ExternalClaimIngestionRecord["qualification"]["state"],
      proposedEvidenceClass: row.proposedEvidenceClass as ExternalClaimIngestionRecord["qualification"]["proposedEvidenceClass"],
      proposedTarget: row.proposedTargetLevel ? { level: row.proposedTargetLevel as "equipment" | "variant", equipmentId: raw.identityAssertion.equipmentId ?? undefined, equipmentVariantId: raw.identityAssertion.equipmentVariantId ?? undefined } : undefined,
      identity: { certainty: String(raw.identityAssertion.certainty) as ExternalClaimIngestionRecord["qualification"]["identity"]["certainty"], applicable: !["ambiguous", "conflicting", "unresolved"].includes(String(raw.identityAssertion.certainty)) },
      authority: raw.authority as ExternalClaimIngestionRecord["qualification"]["authority"],
      verification: String(normalized.verificationState) as ExternalClaimIngestionRecord["qualification"]["verification"],
      review: String(normalized.reviewState) as ExternalClaimIngestionRecord["qualification"]["review"],
      dependency: String(dependency.dependencyType) as ExternalClaimIngestionRecord["qualification"]["dependency"],
      constructRelationship: { construct: row.constructRelationship.proposedConstruct, role: String(row.constructRelationship.role) as "candidate_only", reviewed: false },
      reasons: strings<ExternalClaimIngestionRecord["qualification"]["reasons"][number]>(row.reasons),
      gaps: strings<ExternalClaimIngestionRecord["qualification"]["gaps"][number]>(row.gaps),
      blockers: strings<ExternalClaimIngestionRecord["qualification"]["blockers"][number]>(row.blockers),
      warnings: strings(row.warnings), limitations: strings(row.limitations),
      firewalls: { canonicalValueCreated: false, synthesisEligibilityGranted: false, recommendationEligibilityGranted: false, persistencePerformed: false }
    } satisfies ExternalClaimIngestionRecord["qualification"];
    const persistedQualificationFingerprint = qualificationFingerprint({ qualification: { ...historicalQualification, proposedEvidenceInput: row.proposedEvidenceInput ?? undefined }, normalizedClaimId: normalized.id, rawClaimId: raw.id, identityAssertionId: raw.identityAssertionId, dependencyAssessmentId: dependency.id, constructRelationshipId: row.constructRelationshipId, sourceGovernanceRevisionId: row.sourceGovernanceRevisionId, authority: raw.authority as NonNullable<ExternalClaimIngestionRecord["qualification"]["authority"]> });
    if (persistedQualificationFingerprint !== row.semanticFingerprint) throw new ExternalClaimIngestionError("QUALIFICATION_SEMANTIC_MISMATCH", "Persisted qualification output does not match its durable semantic fingerprint.");
    const conflictMemberships = await this.client.externalEvidenceConflictMember.findMany({ where: { normalizedClaimId: normalized.id }, include: { conflictCase: { include: { resolutions: { orderBy: { decidedAt: "desc" }, take: 1 } } } } });
    const unresolvedConflictIds = conflictMemberships.filter((membership) => membership.conflictCase.resolutions.length === 0).map((membership) => membership.conflictCaseId).sort();
    const slotPeers = await this.client.externalEvidenceNormalizedClaim.findMany({ where: { rawClaim: { claimSlotKey: raw.claimSlotKey } }, include: { rawClaim: { include: { extractionRun: true, document: true, supersededBy: true } } } });
    const leaves = slotPeers.filter((peer) => peer.rawClaim.supersededBy.length === 0);
    const operational = leaves.sort((a, b) => b.rawClaim.extractionRun.executedAt.getTime() - a.rawClaim.extractionRun.executedAt.getTime() || b.rawClaim.extractionRun.id.localeCompare(a.rawClaim.extractionRun.id) || b.id.localeCompare(a.id))[0];
    const current = operational?.id === normalized.id;
    const governanceRevisions = await this.client.externalEvidenceSourceGovernanceRevision.findMany({ where: { sourceId: raw.document.sourceId }, include: { supersededBy: true } });
    const currentGovernanceCandidates = governanceRevisions.filter((revision) => revision.supersededBy.length === 0);
    const currentGovernance = currentGovernanceCandidates.length === 1 ? currentGovernanceCandidates[0] : undefined;
    const governanceChanged = currentGovernance?.id !== row.sourceGovernanceRevisionId;
    const governanceAssessment = assessCurrentGovernance(currentGovernanceCandidates, raw.claimType, historicalQualification.authority ?? "unknown");
    const governanceBlocked = governanceAssessment.blockers.length > 0;
    const conflictBlocked = unresolvedConflictIds.length > 0;
    const qualification: ExternalClaimIngestionRecord["qualification"] = conflictBlocked || governanceBlocked ? { ...historicalQualification, state: "review_required", proposedEvidenceClass: undefined, proposedEvidenceInput: undefined, blockers: [...new Set([...historicalQualification.blockers, ...(conflictBlocked ? ["claim_conflicting" as const] : [])])].sort() } : historicalQualification;
    const normalizedLimitations = strings(normalized.limitations);
    const rawLimitations = strings(raw.limitations);
    const quarantineReasons = deriveQuarantine({ identity: raw.identityAssertion.certainty, dependency: dependency.dependencyType, review: normalized.reviewState, qualification: qualification.state, confidence: row.constructRelationship.mappingConfidence, extractionMethod: raw.extractionRun.method, claimType: raw.claimType, vocabularyKnown: !normalizedLimitations.includes("ingestion:vocabulary_unknown"), evidenceClass: normalized.evidenceClass, suspectedSyndication: dependency.dependencyRationale.startsWith("Suspected syndication"), durableBlockers: rawLimitations.filter((item) => item.endsWith("_unresolved") || item.includes("_conflicts_")) });
    if (conflictBlocked) quarantineReasons.push("current_conflict");
    if (!current) quarantineReasons.push("superseded_extraction_lineage");
    if (governanceBlocked) quarantineReasons.push(...governanceAssessment.quarantineReasons);
    quarantineReasons.sort();
    const extractor = parseExtractorIdentity(raw.extractionRun.extractorId);
    return {
      idempotencyKey,
      semanticFingerprint,
      sourceId: raw.document.sourceId,
      documentId: raw.documentId,
      extractionRunId: raw.extractionRunId,
      identityAssertionId: raw.identityAssertionId,
      rawClaimId: raw.id,
      normalizedClaimId: normalized.id,
      dependencyAssessmentId: dependency.id,
      constructRelationshipId: row.constructRelationshipId,
      qualificationDecisionId: row.id,
      qualification,
      reviewReady: {
        normalizedClaimId: normalized.id,
        equipmentId: raw.identityAssertion.equipmentId ?? undefined,
        equipmentVariantId: raw.identityAssertion.equipmentVariantId ?? undefined,
        sourceName: raw.document.source.displayName,
        sourceStableKey: raw.document.source.stableKey,
        sourceType: currentGovernance?.sourceType ?? row.sourceGovernanceRevision.sourceType,
        publisherIdentity: currentGovernance?.publisherIdentity ?? row.sourceGovernanceRevision.publisherIdentity ?? undefined,
        documentId: raw.documentId,
        documentReference: raw.document.sourceReference,
        documentRevision: raw.document.revision,
        rawSourceWording: raw.rawText ?? undefined,
        sourceLocation: raw.sourceLocation ?? undefined,
        normalizedProposal: { claimKey: normalized.claimKey, value: normalized.normalizedValue, unit: normalized.normalizedUnit ?? undefined, method: normalized.normalizationMethod, version: normalized.normalizationVersion, vocabularyKnown: !normalizedLimitations.includes("ingestion:vocabulary_unknown"), evidenceClass: parseEvidenceClass(normalized.evidenceClass) },
        extraction: { runId: raw.extractionRunId, logicalRunKey: extractor.logicalRunKey, method: raw.extractionRun.method, extractorId: extractor.extractorId, extractorVersion: raw.extractionRun.extractorVersion, providerModelId: extractor.providerModelId, executedAt: raw.extractionRun.executedAt },
        identityCertainty: String(raw.identityAssertion.certainty) as ExternalClaimIngestionRecord["reviewReady"]["identityCertainty"],
        dependencyState: governanceAssessment.dependencyBlocked ? "unknown_dependency" : String(dependency.dependencyType) as ExternalClaimIngestionRecord["reviewReady"]["dependencyState"],
        suspectedSyndication: dependency.dependencyRationale.startsWith("Suspected syndication"),
        proposedConstruct: row.constructRelationship.proposedConstruct.startsWith("not_applicable:") ? undefined : row.constructRelationship.proposedConstruct,
        mappingConfidence: row.constructRelationship.mappingConfidence,
        mappingVersion: row.constructRelationship.mappingVersion,
        qualificationState: qualification.state,
        historicalQualificationState: historicalQualification.state,
        historicalSourceGovernanceRevisionId: row.sourceGovernanceRevisionId,
        currentSourceGovernanceRevisionId: currentGovernance?.id ?? row.sourceGovernanceRevisionId,
        sourceGovernanceChanged: governanceChanged || currentGovernanceCandidates.length !== 1,
        current,
        supersededByExtractionRunId: current || operational?.rawClaim.extractionRunId === raw.extractionRunId ? undefined : operational?.rawClaim.extractionRunId,
        supersessionReason: current ? undefined : operational?.rawClaim.documentId === raw.documentId ? "later_extraction" : "document_revision",
        unresolvedConflictIds,
        reasons: qualification.reasons,
        blockers: [...qualification.blockers, ...governanceAssessment.blockers].sort(),
        quarantineReasons,
        nextDecision: nextDecisionFor(quarantineReasons),
        authority: closedAuthority()
      }
    };
  }

  async persist(unit: ExternalClaimPersistenceUnit): Promise<ExternalClaimIngestionRecord> {
    await this.ensureSource(unit);
    await this.ensureSourceGovernance(unit);
    await this.ensureDocument(unit);
    await this.ensureExtraction(unit);
    await this.ensureIdentity(unit);
    await this.ensureRawClaim(unit);
    await this.ensureNormalizedClaim(unit);
    await this.ensureDependency(unit);
    await this.ensureConstructRelationship(unit);
    const conflict = await this.detectAndPersistConflict(unit);
    const qualification = conflict ? {
      ...unit.qualification,
      state: "review_required" as const,
      blockers: [...new Set([...unit.qualification.blockers, "claim_conflicting" as const])].sort(),
      proposedEvidenceClass: undefined,
      proposedEvidenceInput: undefined
    } : unit.qualification;
    const reviewReady = conflict ? {
      ...unit.reviewReady,
      qualificationState: "review_required" as const,
      blockers: qualification.blockers,
      quarantineReasons: [...new Set([...unit.reviewReady.quarantineReasons, "current_conflict"])].sort(),
      nextDecision: "human_qualification_review" as const
    } : unit.reviewReady;
    await this.client.externalEvidenceQualificationDecision.create({ data: {
      id: unit.qualificationDecisionId,
      normalizedClaimId: unit.normalizedClaimId,
      constructRelationshipId: unit.constructRelationshipId,
      sourceGovernanceRevisionId: unit.sourceGovernanceRevision.id,
      sourceId: unit.sourceId,
      contractVersion: qualification.contractVersion,
      state: qualification.state,
      proposedEvidenceClass: qualification.proposedEvidenceClass,
      proposedEvidenceInput: qualification.proposedEvidenceInput === undefined ? undefined : json(qualification.proposedEvidenceInput),
      proposedTargetLevel: qualification.proposedTarget?.level,
      reasons: json(qualification.reasons), gaps: json(qualification.gaps), blockers: json(qualification.blockers), warnings: json(qualification.warnings), limitations: json(qualification.limitations),
      idempotencyKey: unit.idempotencyKey,
      semanticFingerprint: qualificationFingerprint({ qualification, normalizedClaimId: unit.normalizedClaimId, rawClaimId: unit.rawClaimId, identityAssertionId: unit.identityAssertionId, dependencyAssessmentId: unit.dependencyAssessmentId, constructRelationshipId: unit.constructRelationshipId, sourceGovernanceRevisionId: unit.sourceGovernanceRevision.id, authority: unit.graph.rawClaims[0]!.authority })
    } });
    const durable = await this.findByIdempotencyKey(unit.idempotencyKey, unit.semanticFingerprint);
    if (!durable) throw new ExternalClaimIngestionError("DURABLE_PROJECTION_MISSING", "Persisted claim could not be reconstructed from durable state.");
    return durable;
  }

  private async ensureSource(unit: ExternalClaimPersistenceUnit) {
    const existing = await this.client.externalEvidenceSource.findUnique({ where: { stableKey: unit.input.source.stableKey } });
    if (existing) {
      if (existing.id !== unit.sourceId || existing.sourceType !== unit.input.source.sourceType || existing.publisherIdentity !== (unit.input.source.publisherIdentity ?? null)) throw new ExternalClaimIngestionError("SOURCE_IDENTITY_CONFLICT", "Stable source identity conflicts with the persisted publisher/source.");
      return;
    }
    await this.client.externalEvidenceSource.create({ data: { id: unit.sourceId, stableKey: unit.input.source.stableKey, displayName: unit.input.source.displayName, sourceType: unit.input.source.sourceType, publisherIdentity: unit.input.source.publisherIdentity, sourceVersion: unit.input.source.sourceVersion, metadata: json({ ingestionVersion: "1.0", sourceAuthorityResolved: !unit.reviewReady.quarantineReasons.includes("source_authority_unresolved") }) } });
  }

  private async ensureSourceGovernance(unit: ExternalClaimPersistenceUnit) {
    const existing = await this.client.externalEvidenceSourceGovernanceRevision.findUnique({ where: { id: unit.sourceGovernanceRevision.id } });
    if (existing) {
      if (existing.sourceId !== unit.sourceId) throw new ExternalClaimIngestionError("SOURCE_GOVERNANCE_LINEAGE_MISMATCH", "Governance revision belongs to a different logical source.");
      return;
    }
    await this.client.externalEvidenceSourceGovernanceRevision.create({ data: {
      id: unit.sourceGovernanceRevision.id, sourceId: unit.sourceId, revisionNumber: unit.sourceGovernanceRevision.revisionNumber,
      governanceVersion: unit.sourceGovernanceRevision.version, sourceType: unit.input.source.sourceType,
      publisherIdentity: unit.input.source.publisherIdentity, authorityScope: json({ claimAuthority: unit.graph.rawClaims[0]!.authority }),
      dependencyKnowledge: json({ state: "claim_level_assessment_required" }), state: "active",
      reviewerType: "system", reviewerReference: "ticket-076-source-governance-bootstrap",
      rationale: "Initial durable governance revision derived from the registered source state.", effectiveAt: unit.sourceGovernanceRevision.effectiveAt,
      idempotencyKey: `source-governance:${unit.sourceGovernanceRevision.id}`
    } });
  }

  private async ensureDocument(unit: ExternalClaimPersistenceUnit) {
    if (await this.client.externalEvidenceDocument.findUnique({ where: { id: unit.documentId } })) return;
    const previous = await this.client.externalEvidenceDocument.findFirst({ where: { sourceId: unit.sourceId, sourceReference: unit.input.document.sourceReference }, orderBy: [{ retrievedAt: "desc" }, { createdAt: "desc" }] });
    await this.client.externalEvidenceDocument.create({ data: { id: unit.documentId, sourceId: unit.sourceId, documentType: unit.input.document.documentType, sourceReference: unit.input.document.sourceReference, title: unit.input.document.title, publishedAt: unit.input.document.publishedAt, retrievedAt: unit.input.document.capturedAt, modelYear: unit.input.document.modelYear, revision: `${unit.input.document.revisionLabel ?? "captured"}-${unit.contentFingerprint.slice(0, 16)}`, contentFingerprint: unit.contentFingerprint, availability: unit.input.document.availability, supersedesDocumentId: previous?.id } });
  }

  private async ensureExtraction(unit: ExternalClaimPersistenceUnit) {
    if (await this.client.externalEvidenceExtractionRun.findUnique({ where: { id: unit.extractionRunId } })) return;
    await this.client.externalEvidenceExtractionRun.create({ data: { id: unit.extractionRunId, method: unit.input.extraction.method, extractorType: unit.input.extraction.extractorType, extractorId: canonicalizeExternalClaimValue({ logicalRunKey: unit.input.extraction.logicalRunKey, extractorId: unit.input.extraction.extractorId, providerModelId: unit.input.extraction.providerModelId }), extractorVersion: unit.input.extraction.extractorVersion, executedAt: unit.input.extraction.executedAt, schemaVersion: unit.input.extraction.schemaVersion, reviewState: unit.input.extraction.method === "ai_assisted" ? "review_pending" : "review_not_required" } });
  }

  private async ensureIdentity(unit: ExternalClaimPersistenceUnit) {
    if (await this.client.externalEvidenceIdentityAssertion.findUnique({ where: { id: unit.identityAssertionId } })) return;
    const identity = unit.identity;
    await this.client.externalEvidenceIdentityAssertion.create({ data: { id: unit.identityAssertionId, certainty: identity.certainty, manufacturer: identity.manufacturer, model: identity.model, modelYear: identity.modelYear, certification: identity.certification, constructionRevision: identity.constructionRevision, lengthInches: identity.lengthInches, weightOunces: identity.weightOunces, drop: identity.drop, sku: identity.sku, manufacturerProductId: identity.manufacturerProductId, upc: identity.upc, equipmentId: identity.equipmentId, equipmentVariantId: identity.equipmentVariantId, limitations: json(identity.limitations) } });
  }

  private async ensureRawClaim(unit: ExternalClaimPersistenceUnit) {
    if (await this.client.externalEvidenceClaim.findUnique({ where: { id: unit.rawClaimId } })) return;
    const raw = unit.graph.rawClaims[0]!;
    const document = await this.client.externalEvidenceDocument.findUnique({ where: { id: unit.documentId } });
    const superseded = document?.supersedesDocumentId ? await this.client.externalEvidenceClaim.findFirst({ where: { documentId: document.supersedesDocumentId, claimSlotKey: unit.claimSlotKey, supersededBy: { none: {} } }, orderBy: [{ extractionRun: { executedAt: "desc" } }, { id: "desc" }] }) : undefined;
    await this.client.externalEvidenceClaim.create({ data: { id: unit.rawClaimId, documentId: unit.documentId, identityAssertionId: unit.identityAssertionId, extractionRunId: unit.extractionRunId, sourceLocation: raw.sourceLocation, claimSlotKey: unit.claimSlotKey, rawText: raw.rawText, rawStructuredValue: raw.rawStructuredValue === undefined ? undefined : json(raw.rawStructuredValue), claimType: raw.claimType, verificationState: raw.verificationState, reviewState: raw.reviewState, authority: raw.authority, authorityRationale: raw.authorityRationale, limitations: json(raw.limitations), supersedesClaimId: superseded?.id } });
  }

  private async ensureNormalizedClaim(unit: ExternalClaimPersistenceUnit) {
    if (await this.client.externalEvidenceNormalizedClaim.findUnique({ where: { id: unit.normalizedClaimId } })) return;
    const normalized = unit.graph.normalizedClaims[0]!;
    await this.client.externalEvidenceNormalizedClaim.create({ data: { id: unit.normalizedClaimId, rawClaimId: unit.rawClaimId, claimKey: normalized.claimKey, normalizedValue: json(normalized.normalizedValue), normalizedUnit: normalized.normalizedUnit, originalValue: normalized.originalValue === undefined ? undefined : json(normalized.originalValue), originalUnit: normalized.originalUnit, normalizationMethod: normalized.normalizationMethod, normalizationVersion: normalized.normalizationVersion, evidenceClass: unit.persistedEvidenceClass, verificationState: normalized.verificationState, reviewState: normalized.reviewState, limitations: json(normalized.limitations) } });
  }

  private async ensureDependency(unit: ExternalClaimPersistenceUnit) {
    if (await this.client.externalEvidenceDependencyAssessment.findUnique({ where: { id: unit.dependencyAssessmentId } })) return;
    await this.client.externalEvidenceDependencyAssessment.create({ data: { id: unit.dependencyAssessmentId, claimId: unit.rawClaimId, upstreamClaimId: unit.dependency.upstreamClaimId, dependencyType: unit.dependency.type, independenceGroupId: unit.dependency.independenceGroupId, dependencyRationale: unit.dependency.rationale, reviewedState: "review_pending", reviewerType: "system", reviewerReference: "ticket-076-ingestion-unreviewed-proposal", reviewedAt: unit.input.extraction.executedAt, assessmentVersion: "1.0", idempotencyKey: `dependency:${unit.dependencyAssessmentId}` } });
  }

  private async ensureConstructRelationship(unit: ExternalClaimPersistenceUnit) {
    if (await this.client.externalEvidenceConstructRelationship.findUnique({ where: { id: unit.constructRelationshipId } })) return;
    const relationship = unit.graph.constructRelationships[0]!;
    await this.client.externalEvidenceConstructRelationship.create({ data: { id: unit.constructRelationshipId, normalizedClaimId: unit.normalizedClaimId, proposedConstruct: relationship.construct, mappingMethod: relationship.mappingMethod, mappingConfidence: unit.claim.construct?.confidence ?? "unmapped", mappingVersion: relationship.mappingVersion, policyVersion: "1.0-provisional", role: relationship.role, reviewState: "review_pending", rationale: relationship.rationale, limitations: json(relationship.limitations), constructValueCreated: false, idempotencyKey: `construct:${unit.constructRelationshipId}` } });
  }

  private async detectAndPersistConflict(unit: ExternalClaimPersistenceUnit): Promise<boolean> {
    const peers = await this.client.externalEvidenceNormalizedClaim.findMany({
      where: {
        id: { not: unit.normalizedClaimId },
        claimKey: unit.claim.normalization.claimKey,
        rawClaim: { identityAssertion: { equipmentId: unit.identity.equipmentId ?? null, equipmentVariantId: unit.identity.equipmentVariantId ?? null }, supersededBy: { none: {} } }
      },
      include: { rawClaim: true },
      orderBy: { createdAt: "asc" }
    });
    const conflicting = peers.find((peer) => stableJson({ value: peer.normalizedValue, unit: peer.normalizedUnit }) !== stableJson({ value: unit.claim.normalization.value, unit: unit.claim.normalization.unit ?? null }) && peer.verificationState !== "superseded" && peer.rawClaim.verificationState !== "superseded");
    if (!conflicting) return false;
    const members = [conflicting.id, unit.normalizedClaimId].sort();
    const conflictId = deterministicUuid(`conflict:${unit.claim.normalization.claimKey}:${unit.identity.equipmentId ?? "none"}:${unit.identity.equipmentVariantId ?? "none"}:${members.join(":")}`);
    if (!await this.client.externalEvidenceConflictCase.findUnique({ where: { id: conflictId } })) {
      await this.client.externalEvidenceConflictCase.create({ data: { id: conflictId, claimKey: unit.claim.normalization.claimKey, identityScopeKey: unit.identity.equipmentVariantId ? `variant:${unit.identity.equipmentVariantId}` : `equipment:${unit.identity.equipmentId}`, idempotencyKey: `conflict:${conflictId}`, members: { create: members.map((normalizedClaimId) => ({ normalizedClaimId })) } } });
    }
    return true;
  }
}

function json(value: unknown): Prisma.InputJsonValue { return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue; }
function strings<T extends string = string>(value: Prisma.JsonValue): T[] { return (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []) as T[]; }
function closedAuthority() { return { humanApproved: false, independenceEstablished: false, supportingRoleCreated: false, canonicalValueCreated: false, numericValueCreated: false, synthesisGranted: false, recommendationGranted: false } as const; }
type DurableQuarantineInput = {
  identity: unknown;
  dependency: unknown;
  review: unknown;
  qualification: unknown;
  confidence: string;
  extractionMethod: string;
  claimType: string;
  vocabularyKnown: boolean;
  evidenceClass: string;
  suspectedSyndication: boolean;
  durableBlockers: string[];
};

function deriveQuarantine(input: DurableQuarantineInput) {
  const reasons = [...input.durableBlockers];
  if (["ambiguous", "conflicting", "unresolved", "family_only"].includes(String(input.identity))) reasons.push(`identity_${input.identity}`);
  if (!input.vocabularyKnown) reasons.push("unknown_normalization_vocabulary");
  if (input.evidenceClass === "unclassified") reasons.push("evidence_class_unclassified");
  if (input.dependency === "unknown_dependency") reasons.push(input.suspectedSyndication ? "suspected_syndication" : "dependency_unknown");
  if (input.extractionMethod === "ai_assisted" && input.review === "review_pending") reasons.push("ai_extraction_requires_review");
  if (input.claimType === "marketing_claim") reasons.push("marketing_not_behavioral_authority");
  if (input.confidence !== "high" && input.confidence !== "unmapped") reasons.push("construct_mapping_uncertain");
  if (["review_required", "not_eligible"].includes(String(input.qualification))) reasons.push(`qualification_${input.qualification}`);
  return [...new Set(reasons)].sort();
}

function nextDecisionFor(reasons: string[]): ExternalClaimIngestionRecord["reviewReady"]["nextDecision"] {
  if (reasons.some((reason) => reason.startsWith("identity_") || reason.startsWith("catalog_"))) return "human_identity_review";
  if (reasons.includes("unknown_normalization_vocabulary") || reasons.includes("evidence_class_unclassified")) return "human_normalization_review";
  if (reasons.some((reason) => reason.includes("dependency") || reason === "suspected_syndication")) return "human_dependency_review";
  if (reasons.includes("construct_mapping_uncertain")) return "human_construct_review";
  if (reasons.length > 0) return "human_qualification_review";
  return "none_required_for_catalog_fact";
}

function parseExtractorIdentity(value: string): { logicalRunKey: string; extractorId: string; providerModelId?: string } {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (typeof parsed.logicalRunKey !== "string" || typeof parsed.extractorId !== "string") throw new Error("missing fields");
    if (parsed.providerModelId !== undefined && typeof parsed.providerModelId !== "string") throw new Error("invalid provider model");
    return { logicalRunKey: parsed.logicalRunKey, extractorId: parsed.extractorId, providerModelId: parsed.providerModelId as string | undefined };
  } catch {
    throw new ExternalClaimIngestionError("PERSISTED_LINEAGE_INCOMPLETE", "Extraction identity metadata is missing or invalid.");
  }
}

function parseEvidenceClass(value: string): ExternalClaimIngestionRecord["reviewReady"]["normalizedProposal"]["evidenceClass"] {
  switch (value) {
    case "verified_catalog_fact":
    case "direct_physical_measurement":
    case "controlled_mechanical_test":
    case "structured_human_evaluation":
    case "structured_field_observation":
    case "modeled_estimate":
    case "unclassified":
      return value;
    default:
      throw new ExternalClaimIngestionError("PERSISTED_LINEAGE_INCOMPLETE", `Unsupported persisted evidence-class proposal: ${value}`);
  }
}
function stableJson(value: unknown): string { if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`; if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`; return JSON.stringify(value); }
function deterministicUuid(seed: string) { const hex = createHash("sha256").update(seed).digest("hex"); return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`; }
function ingestionFingerprint(sourceId: string, documentId: string, extractionRunId: string, identityAssertionId: string, rawClaimId: string, normalizedClaimId: string, dependencyAssessmentId: string, constructRelationshipId: string, qualificationDecisionId: string) {
  return createHash("sha256").update(stableJson({ version: "1.0", sourceId, documentId, extractionRunId, identityAssertionId, rawClaimId, normalizedClaimId, dependencyAssessmentId, constructRelationshipId, qualificationDecisionId })).digest("hex");
}
function authorityFor(sourceType: string, claimType: string) {
  if (sourceType === "manufacturer_primary" && ["factual_specification", "certification_claim", "identity_claim"].includes(claimType)) return "authoritative" as const;
  if (["certification_authority", "official_product_documentation"].includes(sourceType) && ["factual_specification", "certification_claim", "identity_claim"].includes(claimType)) return "primary" as const;
  if (sourceType === "retailer") return "secondary" as const;
  if (["independent_expert_review", "user_review", "community_discussion"].includes(sourceType)) return "observational" as const;
  return "not_authoritative_for_claim" as const;
}

type GovernanceRevisionForAssessment = {
  sourceType: string;
  state: string;
  authorityScope: Prisma.JsonValue;
  dependencyKnowledge: Prisma.JsonValue;
};

export function assessCurrentGovernance(
  candidates: readonly GovernanceRevisionForAssessment[],
  claimType: string,
  historicalAuthority: string
): { policyVersion: string; blockers: string[]; quarantineReasons: string[]; dependencyBlocked: boolean } {
  if (candidates.length !== 1) return {
    policyVersion: SOURCE_GOVERNANCE_OPERATIONAL_POLICY_VERSION,
    blockers: ["source_governance_ambiguous"],
    quarantineReasons: ["source_governance_ambiguous"],
    dependencyBlocked: true
  };
  const governance = candidates[0]!;
  const blockers: string[] = [];
  const quarantineReasons: string[] = [];
  if (!governanceStateAllowsAuthority(governance.state)) {
    blockers.push("source_governance_state_inactive");
    quarantineReasons.push("source_governance_state_inactive");
  }

  const scope = record(governance.authorityScope);
  const scopedAuthority = typeof scope?.claimAuthority === "string" ? scope.claimAuthority : undefined;
  const authorizedClaimTypes = stringArray(scope?.authorizedClaimTypes);
  const claimTypesMalformed = scope !== undefined && Object.hasOwn(scope, "authorizedClaimTypes") && authorizedClaimTypes === undefined;
  const typeCovered = !claimTypesMalformed && (authorizedClaimTypes === undefined || authorizedClaimTypes.includes(claimType));
  const classifiedAuthority = authorityFor(governance.sourceType, claimType);
  const effectiveAuthority = typeCovered && scopedAuthority && authorityRank(scopedAuthority) <= authorityRank(classifiedAuthority)
    ? scopedAuthority
    : "not_authoritative_for_claim";
  if (!scopedAuthority || !typeCovered || effectiveAuthority !== historicalAuthority) {
    blockers.push("source_governance_authority_scope_changed");
    quarantineReasons.push("source_governance_authority_scope_changed");
  }

  const dependency = record(governance.dependencyKnowledge);
  const dependencyState = typeof dependency?.state === "string" ? dependency.state : "unknown";
  const dependencyBlocked = dependencyState !== "claim_level_assessment_required";
  if (dependencyBlocked) {
    blockers.push("source_governance_dependency_unresolved");
    quarantineReasons.push("source_governance_dependency_unresolved");
  }
  return {
    policyVersion: SOURCE_GOVERNANCE_OPERATIONAL_POLICY_VERSION,
    blockers: [...new Set(blockers)].sort(),
    quarantineReasons: [...new Set(quarantineReasons)].sort(),
    dependencyBlocked
  };
}

function record(value: Prisma.JsonValue): Record<string, Prisma.JsonValue> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, Prisma.JsonValue> : undefined;
}
function stringArray(value: Prisma.JsonValue | undefined): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value as string[] : undefined;
}
function authorityRank(value: string) {
  switch (value) {
    case "authoritative": return 4;
    case "primary": return 3;
    case "secondary": return 2;
    case "observational": return 1;
    default: return 0;
  }
}

function governanceStateAllowsAuthority(state: string | undefined) {
  return state === undefined || state === "active";
}

function initialGovernanceRevision(source: ExternalClaimIngestionInput["source"], authority: string) {
  const semantics = canonicalizeExternalClaimValue({ sourceStableKey: source.stableKey, revisionNumber: 1, governanceVersion: "1.0", sourceType: source.sourceType, publisherIdentity: source.publisherIdentity, authorityScope: { claimAuthority: authority }, state: "active" });
  return { id: deterministicUuid(`source-governance:${semantics}`), revisionNumber: 1, version: "1.0", effectiveAt: new Date(0) };
}
