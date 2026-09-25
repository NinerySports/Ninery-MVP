import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { canonicalizeExternalClaimValue, externalClaimUuid } from "./external-claim-ingestion.js";
import { PrismaExternalClaimIngestionRepository } from "./prisma-external-claim-ingestion-repository.js";
import {
  GOVERNED_EXTERNAL_CLAIM_REVIEW_VERSION,
  GOVERNED_EXTERNAL_CLAIM_REVIEW_POLICY_VERSION,
  GovernedReviewError,
  fingerprintReviewState,
  type ConstructReviewCommand,
  type DependencyReviewCommand,
  type GovernedReviewBinding,
  type GovernedReviewCase,
  type GovernedReviewLocator,
  type GovernedReviewRepository,
  type GovernedReviewRow,
  type ReviewDecisionState
} from "./external-claim-review.js";

type Client = PrismaClient | Prisma.TransactionClient;

export class PrismaGovernedReviewRepository implements GovernedReviewRepository {
  constructor(private readonly client: Client, private readonly inTransaction = false) {}

  transaction<T>(operation: (repository: GovernedReviewRepository) => Promise<T>): Promise<T> {
    if (this.inTransaction) return operation(this);
    return (this.client as PrismaClient).$transaction((tx) => operation(new PrismaGovernedReviewRepository(tx, true)), { isolationLevel: "ReadCommitted" });
  }

  async lockClaimSlot(locator: GovernedReviewLocator): Promise<void> {
    await this.client.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${locator.claimSlotKey}, 0))::text AS locked`;
    const rows = await this.client.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "external_evidence_sources" WHERE "id" = ${locator.sourceId}::uuid FOR UPDATE`;
    if (rows.length !== 1) throw new GovernedReviewError("SOURCE_NOT_FOUND", "The governed source does not exist.");
  }

  async loadCase(locator: GovernedReviewLocator): Promise<GovernedReviewCase | undefined> {
    const record = await new PrismaExternalClaimIngestionRepository(this.client, this.inTransaction).findByIdempotencyKey(locator.ingestionIdempotencyKey, locator.ingestionSemanticFingerprint);
    if (!record) return undefined;
    if (record.claimSlotKey !== locator.claimSlotKey || record.sourceId !== locator.sourceId) throw new GovernedReviewError("CLAIM_SCOPE_MISMATCH", "The requested source and claim slot do not match durable lineage.");
    const [dependencies, constructs, qualifications, conflicts] = await Promise.all([
      this.client.externalEvidenceDependencyAssessment.findMany({ where: { claimId: record.rawClaimId }, include: { supersededBy: { select: { id: true } } } }),
      this.client.externalEvidenceConstructRelationship.findMany({ where: { normalizedClaimId: record.normalizedClaimId }, include: { supersededBy: { select: { id: true } } } }),
      this.client.externalEvidenceQualificationDecision.findMany({ where: { normalizedClaimId: record.normalizedClaimId }, orderBy: [{ decidedAt: "desc" }, { id: "desc" }], select: { id: true } }),
      this.client.$queryRaw<Array<{ count: bigint }>>`SELECT count(*)::bigint AS count FROM "external_evidence_conflict_members" m WHERE m."normalizedClaimId"=${record.normalizedClaimId}::uuid AND COALESCE((SELECT x."outcome"::text IN ('resolved_no_material_conflict','resolved_claim_superseded','resolved_with_limitations') FROM "external_evidence_conflict_resolutions" x WHERE x."conflictCaseId"=m."conflictCaseId" ORDER BY x."decidedAt" DESC, x."id" DESC LIMIT 1), false)=false`
    ]);
    const dependencyLeaves = dependencies.filter((item) => item.supersededBy.length === 0);
    const constructLeaves = constructs.filter((item) => item.supersededBy.length === 0);
    if (dependencyLeaves.length !== 1 || constructLeaves.length !== 1) throw new GovernedReviewError("AMBIGUOUS_REVIEW_CASE", "The current dependency or construct interpretation is ambiguous.");
    const dependency = dependencyLeaves[0]!;
    const construct = constructLeaves[0]!;
    return { record, dependencyAssessmentId: dependency.id, dependencyType: String(dependency.dependencyType),
      dependencyReviewed: !!dependency.decisionFingerprint && dependency.reviewerType === "human" && ["reviewed_accepted", "reviewed_with_limitations"].includes(dependency.reviewedState),
      dependencySuperseded: dependency.id !== record.dependencyAssessmentId,
      constructRelationshipId: construct.id,
      constructReviewed: !!construct.decisionFingerprint && !!construct.reviewerReference && ["reviewed_accepted", "reviewed_with_limitations"].includes(construct.reviewState),
      constructSuperseded: construct.id !== record.constructRelationshipId,
      qualificationSuperseded: qualifications[0]?.id !== record.qualificationDecisionId,
      unresolvedConflictCount: Number(conflicts[0]?.count ?? 0n),
      policyVersion: GOVERNED_EXTERNAL_CLAIM_REVIEW_POLICY_VERSION };
  }

  async listClaimReviews(claimSlotKey: string): Promise<readonly GovernedReviewRow[]> {
    const rows = await this.client.externalEvidenceReviewDecision.findMany({ where: { governedReviewVersion: GOVERNED_EXTERNAL_CLAIM_REVIEW_VERSION,
      normalizedClaim: { rawClaim: { claimSlotKey } } }, orderBy: [{ decidedAt: "asc" }, { id: "asc" }] });
    return rows.map(parseReviewRow);
  }

  async findClaimReviewByIdempotencyKey(key: string): Promise<GovernedReviewRow | undefined> {
    const row = await this.client.externalEvidenceReviewDecision.findUnique({ where: { idempotencyKey: key } });
    if (!row) return undefined;
    if (row.governedReviewVersion !== GOVERNED_EXTERNAL_CLAIM_REVIEW_VERSION) throw new GovernedReviewError("LEGACY_REVIEW_KEY_COLLISION", "The key belongs to an earlier review contract.");
    return parseReviewRow(row);
  }

  async replayDependencyReview(command: DependencyReviewCommand, reviewerId: string): Promise<boolean> {
    const row = await this.client.externalEvidenceDependencyAssessment.findUnique({ where: { idempotencyKey: command.idempotencyKey } });
    if (!row) return false;
    const raw = await this.client.externalEvidenceClaim.findUnique({ where: { id: row.claimId }, select: { claimSlotKey: true, document: { select: { sourceId: true } } } });
    if (raw?.claimSlotKey !== command.claimSlotKey || raw.document.sourceId !== command.sourceId) throw new GovernedReviewError("IDEMPOTENCY_CONFLICT", "The dependency review key belongs to a different claim scope.");
    if (!row.supersedesAssessmentId || row.reviewedStateFingerprint !== command.expectedStateFingerprint || row.decisionFingerprint !== dimensionFingerprint(command, reviewerId)) {
      throw new GovernedReviewError("IDEMPOTENCY_CONFLICT", "The dependency review key is not governed.");
    }
    if (row.dependencyType !== command.dependencyType || row.dependencyRationale !== command.reason.trim() ||
      row.reviewedState !== command.decision || row.reviewerReference !== reviewerId ||
      row.independenceGroupId !== (command.dependencyType === "independent_observation" ? command.independenceGroupId ?? null : null) ||
      row.upstreamClaimId !== (command.upstreamClaimId ?? null) ||
      JSON.stringify(row.limitations) !== JSON.stringify([...new Set(command.limitations ?? [])].sort())) throw new GovernedReviewError("IDEMPOTENCY_CONFLICT", "The key belongs to a different dependency review.");
    return true;
  }

  async replayConstructReview(command: ConstructReviewCommand, reviewerId: string): Promise<boolean> {
    const row = await this.client.externalEvidenceConstructRelationship.findUnique({ where: { idempotencyKey: command.idempotencyKey } });
    if (!row) return false;
    const normalized = await this.client.externalEvidenceNormalizedClaim.findUnique({ where: { id: row.normalizedClaimId }, select: { rawClaim: { select: { claimSlotKey: true, document: { select: { sourceId: true } } } } } });
    if (normalized?.rawClaim.claimSlotKey !== command.claimSlotKey || normalized.rawClaim.document.sourceId !== command.sourceId) throw new GovernedReviewError("IDEMPOTENCY_CONFLICT", "The construct review key belongs to a different claim scope.");
    if (!row.supersedesRelationshipId || row.reviewedStateFingerprint !== command.expectedStateFingerprint || row.decisionFingerprint !== dimensionFingerprint(command, reviewerId) || row.role !== command.role || row.mappingConfidence !== command.mappingConfidence ||
      row.reviewState !== command.decision || row.reviewerReference !== reviewerId || row.rationale !== command.reason.trim() ||
      JSON.stringify(row.limitations) !== JSON.stringify([...new Set(command.limitations ?? [])].sort())) {
      throw new GovernedReviewError("IDEMPOTENCY_CONFLICT", "The key belongs to a different construct review.");
    }
    return true;
  }

  async createClaimReview(input: Omit<GovernedReviewRow, "id" | "decidedAt"> & { readonly idempotencyKey: string }): Promise<GovernedReviewRow> {
    const binding = input.reviewedBinding;
    const reviewedBinding: Prisma.JsonObject = {
      version: binding.version, claimSlotKey: binding.claimSlotKey, sourceId: binding.sourceId,
      documentId: binding.documentId, extractionRunId: binding.extractionRunId, rawClaimId: binding.rawClaimId,
      normalizedClaimId: binding.normalizedClaimId, identityAssertionId: binding.identityAssertionId,
      identityCertainty: binding.identityCertainty, dependencyAssessmentId: binding.dependencyAssessmentId,
      dependencyType: binding.dependencyType, constructRelationshipId: binding.constructRelationshipId,
      qualificationDecisionId: binding.qualificationDecisionId, qualificationState: binding.qualificationState,
      qualificationSemanticFingerprint: binding.qualificationSemanticFingerprint,
      ingestionSemanticFingerprint: binding.ingestionSemanticFingerprint,
      sourceGovernanceRevisionId: binding.sourceGovernanceRevisionId, policyVersion: binding.policyVersion,
      ...(binding.equipmentId ? { equipmentId: binding.equipmentId } : {}),
      ...(binding.equipmentVariantId ? { equipmentVariantId: binding.equipmentVariantId } : {})
    };
    const row = await this.client.externalEvidenceReviewDecision.create({ data: {
      normalizedClaimId: input.normalizedClaimId, constructRelationshipId: input.constructRelationshipId,
      decision: input.decision, reviewerType: "human", reviewerReference: input.reviewerReference,
      reason: input.reason, limitations: [...input.limitations], idempotencyKey: input.idempotencyKey,
      governedReviewVersion: GOVERNED_EXTERNAL_CLAIM_REVIEW_VERSION, reviewedBinding,
      reviewedStateFingerprint: input.reviewedStateFingerprint, decisionFingerprint: input.decisionFingerprint,
      supersedesDecisionId: input.supersedesDecisionId
    } });
    return parseReviewRow(row);
  }

  async writeDependencyReview(input: DependencyReviewCommand & { readonly reviewerId: string; readonly claim: GovernedReviewCase }): Promise<void> {
    const prior = await this.client.externalEvidenceDependencyAssessment.findUnique({ where: { id: input.claim.dependencyAssessmentId } });
    if (!prior) throw new GovernedReviewError("DEPENDENCY_NOT_FOUND", "The dependency assessment was not found.");
    await this.client.externalEvidenceDependencyAssessment.create({ data: {
      id: externalClaimUuid(`governed-dependency-review:${input.idempotencyKey}`), claimId: prior.claimId,
      upstreamClaimId: input.upstreamClaimId, dependencyType: input.dependencyType,
      limitations: [...new Set(input.limitations ?? [])].sort(),
      independenceGroupId: input.dependencyType === "independent_observation" ? input.independenceGroupId : undefined,
      dependencyRationale: input.reason.trim(), reviewedState: input.decision, reviewerType: "human",
      reviewerReference: input.reviewerId, reviewedAt: new Date(), assessmentVersion: GOVERNED_EXTERNAL_CLAIM_REVIEW_VERSION,
      reviewedStateFingerprint: input.expectedStateFingerprint, decisionFingerprint: dimensionFingerprint(input, input.reviewerId),
      supersedesAssessmentId: prior.id, idempotencyKey: input.idempotencyKey
    } });
  }

  async writeConstructReview(input: ConstructReviewCommand & { readonly reviewerId: string; readonly claim: GovernedReviewCase }): Promise<void> {
    const prior = await this.client.externalEvidenceConstructRelationship.findUnique({ where: { id: input.claim.constructRelationshipId } });
    if (!prior) throw new GovernedReviewError("CONSTRUCT_NOT_FOUND", "The construct proposal was not found.");
    if (input.role === "supporting_context" && !["startup_demand", "rotational_demand"].includes(prior.proposedConstruct)) throw new GovernedReviewError("CONSTRUCT_OUTSIDE_POLICY", "The provisional supporting policy does not cover this construct.");
    await this.client.externalEvidenceConstructRelationship.create({ data: {
      id: externalClaimUuid(`governed-construct-review:${input.idempotencyKey}`), normalizedClaimId: prior.normalizedClaimId,
      proposedConstruct: prior.proposedConstruct, mappingMethod: "manual_review", mappingConfidence: input.mappingConfidence,
      mappingVersion: prior.mappingVersion, policyVersion: GOVERNED_EXTERNAL_CLAIM_REVIEW_POLICY_VERSION,
      role: input.role, reviewState: input.decision, reviewerReference: input.reviewerId, reviewedAt: new Date(),
      reviewedStateFingerprint: input.expectedStateFingerprint, decisionFingerprint: dimensionFingerprint(input, input.reviewerId),
      rationale: input.reason.trim(), limitations: [...new Set(input.limitations ?? [])].sort(), constructValueCreated: false,
      supersedesRelationshipId: prior.id, idempotencyKey: input.idempotencyKey
    } });
  }
}

function parseReviewRow(row: { id: string; normalizedClaimId: string; constructRelationshipId: string; decision: string; reviewerReference: string; reason: string; limitations: Prisma.JsonValue; reviewedBinding: Prisma.JsonValue | null; reviewedStateFingerprint: string | null; decisionFingerprint: string | null; supersedesDecisionId: string | null; decidedAt: Date }): GovernedReviewRow {
  if (!isGovernedBinding(row.reviewedBinding) || !row.reviewedStateFingerprint || !row.decisionFingerprint ||
    fingerprintReviewState(row.reviewedBinding) !== row.reviewedStateFingerprint ||
    !["reviewed_accepted", "reviewed_with_limitations", "reviewed_rejected", "reviewed_returned"].includes(row.decision) ||
    !Array.isArray(row.limitations) || !row.limitations.every((item) => typeof item === "string")) {
    throw new GovernedReviewError("REVIEW_BINDING_INVALID", "The stored governed review lacks a valid exact-state binding.");
  }
  return { id: row.id, normalizedClaimId: row.normalizedClaimId, constructRelationshipId: row.constructRelationshipId,
    decision: row.decision as ReviewDecisionState, reviewerReference: row.reviewerReference, reason: row.reason,
    limitations: row.limitations as string[],
    reviewedBinding: row.reviewedBinding, reviewedStateFingerprint: row.reviewedStateFingerprint,
    decisionFingerprint: row.decisionFingerprint, supersedesDecisionId: row.supersedesDecisionId ?? undefined, decidedAt: row.decidedAt };
}

function isGovernedBinding(value: unknown): value is GovernedReviewBinding {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record: Record<string, unknown> = Object.fromEntries(Object.entries(value));
  const fields = ["claimSlotKey", "sourceId", "documentId", "extractionRunId", "rawClaimId", "normalizedClaimId", "identityAssertionId",
    "identityCertainty", "dependencyAssessmentId", "dependencyType", "constructRelationshipId", "qualificationDecisionId", "qualificationState",
    "qualificationSemanticFingerprint", "ingestionSemanticFingerprint", "sourceGovernanceRevisionId", "policyVersion"];
  return record.version === GOVERNED_EXTERNAL_CLAIM_REVIEW_VERSION && fields.every((field) => typeof record[field] === "string" && !!record[field]) &&
    (record.equipmentId === undefined || typeof record.equipmentId === "string") &&
    (record.equipmentVariantId === undefined || typeof record.equipmentVariantId === "string");
}

function dimensionFingerprint(command: DependencyReviewCommand | ConstructReviewCommand, reviewerId: string): string {
  const semantics = { version: GOVERNED_EXTERNAL_CLAIM_REVIEW_VERSION, ingestionIdempotencyKey: command.ingestionIdempotencyKey,
    ingestionSemanticFingerprint: command.ingestionSemanticFingerprint, claimSlotKey: command.claimSlotKey, sourceId: command.sourceId,
    expectedStateFingerprint: command.expectedStateFingerprint, reviewerId, decision: command.decision, reason: command.reason.trim(),
    limitations: [...new Set(command.limitations ?? [])].sort(),
    ...("dependencyType" in command ? { dependencyType: command.dependencyType, independenceGroupId: command.independenceGroupId, upstreamClaimId: command.upstreamClaimId } :
      { role: command.role, mappingConfidence: command.mappingConfidence }) };
  return createHash("sha256").update(canonicalizeExternalClaimValue(semantics)).digest("hex");
}
