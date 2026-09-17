import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { ExternalClaimIngestionError, type ExternalClaimIngestionInput, type ExternalClaimIngestionRecord, type ExternalClaimIngestionRepository, type ExternalClaimPersistenceUnit, type ExternalClaimProposal, type ExternalClaimTrustedResolution } from "./external-claim-ingestion.js";

type Client = PrismaClient | Prisma.TransactionClient;

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
    const persistedSource = await this.client.externalEvidenceSource.findUnique({ where: { stableKey: input.source.stableKey } });
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
    if (!persistedSource || sourceMetadata?.sourceAuthorityResolved === false) blockers.push("source_authority_unresolved");
    if (persistedSource && (persistedSource.sourceType !== input.source.sourceType || persistedSource.publisherIdentity !== (input.source.publisherIdentity ?? null))) blockers.push("source_proposal_conflicts_with_registry");

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
      limitations: [...claim.identity.limitations, ...blockers]
    } : { ...claim.identity, certainty: "unresolved" as const, equipmentId: undefined, equipmentVariantId: undefined, limitations: [...claim.identity.limitations, ...blockers] };
    const authority = persistedSource && !blockers.includes("source_proposal_conflicts_with_registry")
      ? authorityFor(persistedSource.sourceType, claim.claimType)
      : "unknown" as const;
    return { source, identity, authority, blockers: [...new Set(blockers)].sort() };
  }

  async findByIdempotencyKey(idempotencyKey: string, semanticFingerprint: string): Promise<ExternalClaimIngestionRecord | undefined> {
    const row = await this.client.externalEvidenceQualificationDecision.findUnique({
      where: { idempotencyKey },
      include: {
        normalizedClaim: { include: { rawClaim: { include: { document: { include: { source: true } }, extractionRun: true, identityAssertion: true, dependencyAssessments: { orderBy: { assessedAt: "desc" }, take: 1 } } } } },
        constructRelationship: true
      }
    });
    if (!row) return undefined;
    const normalized = row.normalizedClaim;
    const raw = normalized.rawClaim;
    const dependency = raw.dependencyAssessments[0];
    if (!dependency) throw new ExternalClaimIngestionError("PERSISTED_LINEAGE_INCOMPLETE", "Qualification exists without its dependency assessment.");
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
    const conflictMemberships = await this.client.externalEvidenceConflictMember.findMany({ where: { normalizedClaimId: normalized.id }, include: { conflictCase: { include: { resolutions: { orderBy: { decidedAt: "desc" }, take: 1 } } } } });
    const unresolvedConflictIds = conflictMemberships.filter((membership) => membership.conflictCase.resolutions.length === 0).map((membership) => membership.conflictCaseId).sort();
    const extractionPeers = await this.client.externalEvidenceClaim.findMany({ where: { documentId: raw.documentId, sourceLocation: raw.sourceLocation, claimType: raw.claimType }, include: { extractionRun: true } });
    const operational = extractionPeers.sort((a, b) => b.extractionRun.executedAt.getTime() - a.extractionRun.executedAt.getTime() || b.extractionRun.id.localeCompare(a.extractionRun.id))[0];
    const current = operational?.id === raw.id;
    const conflictBlocked = unresolvedConflictIds.length > 0;
    const qualification: ExternalClaimIngestionRecord["qualification"] = conflictBlocked ? { ...historicalQualification, state: "review_required", proposedEvidenceClass: undefined, proposedEvidenceInput: undefined, blockers: [...new Set([...historicalQualification.blockers, "claim_conflicting" as const])].sort() } : historicalQualification;
    const quarantineReasons = deriveQuarantine(raw.identityAssertion.certainty, dependency.dependencyType, normalized.reviewState, qualification.state, row.constructRelationship.mappingConfidence);
    if (conflictBlocked) quarantineReasons.push("current_conflict");
    if (!current) quarantineReasons.push("superseded_extraction_lineage");
    quarantineReasons.sort();
    const extractorParts = raw.extractionRun.extractorId.split(":");
    const extractorId = extractorParts.shift()!;
    const providerModelId = extractorParts.length ? extractorParts.join(":") : undefined;
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
        documentReference: raw.document.sourceReference,
        rawSourceWording: raw.rawText ?? undefined,
        normalizedProposal: { claimKey: normalized.claimKey, value: normalized.normalizedValue, unit: normalized.normalizedUnit ?? undefined },
        extraction: { method: raw.extractionRun.method, extractorId, extractorVersion: raw.extractionRun.extractorVersion, providerModelId },
        identityCertainty: String(raw.identityAssertion.certainty) as ExternalClaimIngestionRecord["reviewReady"]["identityCertainty"],
        dependencyState: String(dependency.dependencyType) as ExternalClaimIngestionRecord["reviewReady"]["dependencyState"],
        suspectedSyndication: dependency.dependencyRationale.startsWith("Suspected syndication"),
        proposedConstruct: row.constructRelationship.proposedConstruct.startsWith("not_applicable:") ? undefined : row.constructRelationship.proposedConstruct,
        mappingConfidence: row.constructRelationship.mappingConfidence,
        qualificationState: qualification.state,
        historicalQualificationState: historicalQualification.state,
        current,
        supersededByExtractionRunId: current ? undefined : operational?.extractionRunId,
        unresolvedConflictIds,
        reasons: qualification.reasons,
        blockers: qualification.blockers,
        quarantineReasons,
        nextDecision: quarantineReasons.some((reason) => reason.startsWith("identity_")) ? "human_identity_review" : quarantineReasons.some((reason) => reason.includes("dependency")) ? "human_dependency_review" : quarantineReasons.length ? "human_qualification_review" : "none_required_for_catalog_fact",
        authority: closedAuthority()
      }
    };
  }

  async persist(unit: ExternalClaimPersistenceUnit): Promise<ExternalClaimIngestionRecord> {
    await this.ensureSource(unit);
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
      contractVersion: qualification.contractVersion,
      state: qualification.state,
      proposedEvidenceClass: qualification.proposedEvidenceClass,
      proposedTargetLevel: qualification.proposedTarget?.level,
      reasons: json(qualification.reasons), gaps: json(qualification.gaps), blockers: json(qualification.blockers), warnings: json(qualification.warnings), limitations: json(qualification.limitations),
      idempotencyKey: unit.idempotencyKey
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

  private async ensureDocument(unit: ExternalClaimPersistenceUnit) {
    if (await this.client.externalEvidenceDocument.findUnique({ where: { id: unit.documentId } })) return;
    const previous = await this.client.externalEvidenceDocument.findFirst({ where: { sourceId: unit.sourceId, sourceReference: unit.input.document.sourceReference }, orderBy: [{ retrievedAt: "desc" }, { createdAt: "desc" }] });
    await this.client.externalEvidenceDocument.create({ data: { id: unit.documentId, sourceId: unit.sourceId, documentType: unit.input.document.documentType, sourceReference: unit.input.document.sourceReference, title: unit.input.document.title, publishedAt: unit.input.document.publishedAt, retrievedAt: unit.input.document.capturedAt, modelYear: unit.input.document.modelYear, revision: `${unit.input.document.revisionLabel ?? "captured"}-${unit.contentFingerprint.slice(0, 16)}`, contentFingerprint: unit.contentFingerprint, availability: unit.input.document.availability, supersedesDocumentId: previous?.id } });
  }

  private async ensureExtraction(unit: ExternalClaimPersistenceUnit) {
    if (await this.client.externalEvidenceExtractionRun.findUnique({ where: { id: unit.extractionRunId } })) return;
    await this.client.externalEvidenceExtractionRun.create({ data: { id: unit.extractionRunId, method: unit.input.extraction.method, extractorType: unit.input.extraction.extractorType, extractorId: unit.input.extraction.providerModelId ? `${unit.input.extraction.extractorId}:${unit.input.extraction.providerModelId}` : unit.input.extraction.extractorId, extractorVersion: unit.input.extraction.extractorVersion, executedAt: unit.input.extraction.executedAt, schemaVersion: unit.input.extraction.schemaVersion, reviewState: unit.input.extraction.method === "ai_assisted" ? "review_pending" : "review_not_required" } });
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
    const superseded = document?.supersedesDocumentId ? await this.client.externalEvidenceClaim.findFirst({ where: { documentId: document.supersedesDocumentId, sourceLocation: raw.sourceLocation, claimType: raw.claimType }, orderBy: { createdAt: "desc" } }) : undefined;
    await this.client.externalEvidenceClaim.create({ data: { id: unit.rawClaimId, documentId: unit.documentId, identityAssertionId: unit.identityAssertionId, extractionRunId: unit.extractionRunId, sourceLocation: raw.sourceLocation, rawText: raw.rawText, rawStructuredValue: raw.rawStructuredValue === undefined ? undefined : json(raw.rawStructuredValue), claimType: raw.claimType, verificationState: raw.verificationState, reviewState: raw.reviewState, authority: raw.authority, authorityRationale: raw.authorityRationale, limitations: json(raw.limitations), supersedesClaimId: superseded?.id } });
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
function deriveQuarantine(identity: unknown, dependency: unknown, review: unknown, qualification: unknown, confidence: string) { const reasons: string[] = []; if (["ambiguous", "conflicting", "unresolved", "family_only"].includes(String(identity))) reasons.push(`identity_${identity}`); if (dependency === "unknown_dependency") reasons.push("dependency_unknown"); if (review === "review_pending") reasons.push("processing_requires_review"); if (["review_required", "not_eligible"].includes(String(qualification))) reasons.push(`qualification_${qualification}`); if (confidence !== "high" && confidence !== "unmapped") reasons.push("construct_mapping_uncertain"); return reasons.sort(); }
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
