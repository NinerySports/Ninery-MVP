import { Prisma, type PrismaClient } from "@prisma/client";
import { PrismaGovernedSupportingContextBridgeRepository } from "./prisma-governed-supporting-context-bridge-repository.js";
import { PrismaExternalSupportingPersistenceRepository } from "./prisma-external-supporting-evidence-repository.js";
import { governedSupportingContextIdempotencyKey } from "./governed-supporting-context-bridge.js";
import { ExternalSupportingEvidencePersistenceService } from "./external-supporting-evidence-persistence.js";
import { PrismaExternalClaimIngestionRepository } from "./prisma-external-claim-ingestion-repository.js";
import type { GovernedSupportingContextEntry, GovernedSupportingContextExclusion, GovernedSupportingContextProjectionRepository, GovernedSupportingContextRequest } from "./governed-supporting-context-projection.js";

const rowArgs = Prisma.validator<Prisma.ExternalSupportingRoleDecisionFindManyArgs>()({
  include: {
    rawClaim: { include: { document: true, identityAssertion: true } },
    normalizedClaim: { include: { qualificationDecisions: true } },
    dependencyAssessment: true,
    constructRelationship: true,
    reviewDecision: true
  }
});
type Row = Prisma.ExternalSupportingRoleDecisionGetPayload<typeof rowArgs>;
type Client = PrismaClient | Prisma.TransactionClient;

export class PrismaGovernedSupportingContextProjectionRepository implements GovernedSupportingContextProjectionRepository {
  constructor(private readonly client: Client, private readonly inSnapshot = false) {}

  readSnapshot<T>(operation: (repository: GovernedSupportingContextProjectionRepository) => Promise<T>): Promise<T> {
    if (this.inSnapshot) return operation(this);
    return (this.client as PrismaClient).$transaction(async tx => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      return operation(new PrismaGovernedSupportingContextProjectionRepository(tx, true));
    }, { isolationLevel: "RepeatableRead", maxWait: 30000, timeout: 30000 });
  }

  async load(request: GovernedSupportingContextRequest): Promise<readonly GovernedSupportingContextEntry[]> {
    if (!this.inSnapshot) throw new Error("PROJECTION_SNAPSHOT_REQUIRED");
    const variantFilter: Prisma.ExternalEvidenceIdentityAssertionWhereInput = request.equipmentVariantId
      ? { OR: [{ equipmentVariantId: null }, { equipmentVariantId: request.equipmentVariantId }] }
      : { equipmentVariantId: null };
    const rows = await this.client.externalSupportingRoleDecision.findMany({ ...rowArgs,
      where: { rawClaim: { identityAssertion: { equipmentId: request.equipmentId, ...variantFilter } },
        constructRelationship: { proposedConstruct: request.construct } },
      orderBy: [{ decidedAt: "asc" }, { id: "asc" }] });
    return Promise.all(rows.map(row => this.project(row)));
  }

  private async project(row: Row): Promise<GovernedSupportingContextEntry> {
    const identity = row.rawClaim.identityAssertion;
    const binding = jsonObject(row.reviewDecision.reviewedBinding);
    const initial = row.normalizedClaim.qualificationDecisions.filter(qualification => qualification.idempotencyKey === `ingestion:${qualification.id}`);
    const fingerprint = string(binding.ingestionSemanticFingerprint);
    const sourceId = row.rawClaim.document.sourceId;
    const exclusions: GovernedSupportingContextExclusion[] = [];
    if (initial.length !== 1 || !fingerprint || string(binding.claimSlotKey) !== row.rawClaim.claimSlotKey || string(binding.sourceId) !== sourceId) {
      exclusions.push("ingestion_lineage_unavailable");
    } else {
      const locator = { ingestionIdempotencyKey: initial[0]!.idempotencyKey, ingestionSemanticFingerprint: fingerprint,
        claimSlotKey: row.rawClaim.claimSlotKey!, sourceId };
      try {
        const bridge = new PrismaGovernedSupportingContextBridgeRepository(this.client, true, true);
        const lineage = await bridge.loadCurrent(locator);
        const interpretation = lineage.interpretation;
        if (lineage.rawClaimId !== row.rawClaimId || lineage.normalizedClaimId !== row.normalizedClaimId ||
          lineage.dependencyAssessmentId !== row.dependencyAssessmentId || lineage.constructRelationshipId !== row.constructRelationshipId ||
          lineage.qualificationDecisionId !== row.qualificationDecisionId || lineage.reviewDecisionId !== row.reviewDecisionId) {
          exclusions.push("review_not_current");
        } else if (interpretation.construct !== row.constructRelationship.proposedConstruct ||
          interpretation.role !== row.role || interpretation.identityScope !== row.identityScope ||
          interpretation.direction !== row.direction || (interpretation.comparisonTarget ?? null) !== row.comparisonTarget) {
          exclusions.push("interpretation_not_current");
        } else if (row.idempotencyKey !== governedSupportingContextIdempotencyKey(lineage, interpretation)) {
          exclusions.push("durable_lineage_invalid");
        } else {
          const { interpretation: _reviewedInterpretation, ...ids } = lineage;
          const command = { ...ids, identityScope: interpretation.identityScope, direction: interpretation.direction,
            comparisonTarget: interpretation.comparisonTarget, idempotencyKey: row.idempotencyKey };
          const supporting = new PrismaExternalSupportingPersistenceRepository(this.client, true);
          const context = await supporting.loadContext(command);
          if (!context) exclusions.push("durable_lineage_invalid");
          else {
            const decision = new ExternalSupportingEvidencePersistenceService(supporting).assessCurrentEligibility(command, context);
            if (!decision.eligible || !row.eligible || row.policy !== "external_expert_supporting_role" ||
              row.policyVersion !== "1.0-provisional" || row.role !== "supporting_context" ||
              row.directEvidenceContribution !== 0 || row.structuredContribution !== 0 ||
              row.physicalContribution !== 0 || row.controlledContribution !== 0 ||
              row.canonicalValueCreated || row.numericValueCreated || row.synthesisEligibilityGranted ||
              row.compatibilityAuthorityGranted || row.recommendationAuthorityGranted || row.decisionBookAuthorityGranted) {
              exclusions.push("policy_ineligible");
            }
          }
        }
      } catch (error) {
        const reason = classify(error);
        if (reason === "claim_not_current" || reason === "review_not_current") {
          try {
            const conflicts = await this.client.$queryRaw<Array<{ count: bigint }>>`SELECT count(*)::bigint AS count FROM "external_evidence_conflict_members" m WHERE m."normalizedClaimId"=${row.normalizedClaimId}::uuid AND COALESCE((SELECT x."outcome"::text IN ('resolved_no_material_conflict','resolved_claim_superseded','resolved_with_limitations') FROM "external_evidence_conflict_resolutions" x WHERE x."conflictCaseId"=m."conflictCaseId" ORDER BY x."decidedAt" DESC, x."id" DESC LIMIT 1), false)=false`;
            if (conflicts[0]?.count && conflicts[0].count > 0n) exclusions.push("conflict_unresolved");
            else {
              const record = await new PrismaExternalClaimIngestionRepository(this.client).findByIdempotencyKey(locator.ingestionIdempotencyKey, locator.ingestionSemanticFingerprint);
              if (record?.reviewReady.unresolvedConflictIds.length) exclusions.push("conflict_unresolved");
              else if (record?.reviewReady.supersessionReason === "document_revision") exclusions.push("source_or_document_not_current");
              else exclusions.push(reason);
            }
          } catch { exclusions.push("durable_lineage_invalid"); }
        } else exclusions.push(reason);
      }
    }
    const dependency = row.dependencyAssessment;
    return {
      decisionId: row.id, status: exclusions.length ? "historical" : "current", exclusions: [...new Set(exclusions)].sort(),
      decidedAt: row.decidedAt.toISOString(), construct: row.constructRelationship.proposedConstruct,
      direction: row.direction, comparisonTarget: row.comparisonTarget ?? undefined, identityScope: row.identityScope,
      provenance: { sourceId, documentId: row.rawClaim.documentId, extractionRunId: row.rawClaim.extractionRunId,
        rawClaimId: row.rawClaimId, normalizedClaimId: row.normalizedClaimId, identityAssertionId: row.identityAssertionId,
        dependencyAssessmentId: dependency.id, dependencyType: dependency.dependencyType,
        upstreamClaimId: dependency.upstreamClaimId ?? undefined, independenceGroupId: dependency.independenceGroupId ?? undefined,
        independence: dependency.dependencyType === "independent_observation" && dependency.independenceGroupId &&
          dependency.reviewerType === "human" && dependency.decisionFingerprint &&
          ["reviewed_accepted", "reviewed_with_limitations"].includes(dependency.reviewedState)
          ? "reviewed_independent" : dependency.upstreamClaimId ? "dependent" : "unestablished",
        constructRelationshipId: row.constructRelationshipId, qualificationDecisionId: row.qualificationDecisionId,
        reviewDecisionId: row.reviewDecisionId, equipmentId: identity.equipmentId!, equipmentVariantId: identity.equipmentVariantId ?? undefined },
      authority: { role: "supporting_context", directEvidenceContribution: 0, canonicalValueCreated: false,
        numericValueCreated: false, synthesisEligibilityGranted: false, recommendationAuthorityGranted: false }
    };
  }
}

function jsonObject(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function string(value: unknown): string | undefined { return typeof value === "string" && value.length ? value : undefined; }
function classify(error: unknown): GovernedSupportingContextExclusion {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  const message = error instanceof Error ? error.message : "";
  if (code.includes("governance") || message.includes("governance")) return "governance_not_current";
  if (code.includes("conflict") || message.includes("conflict")) return "conflict_unresolved";
  if (code.includes("dependency") || message.includes("dependency")) return "dependency_not_current";
  if (code.includes("construct") || message.includes("construct")) return "construct_not_current";
  if (code.includes("QUALIFICATION") || code.includes("qualification")) return "qualification_not_current";
  if (code.includes("REVIEW") || code.includes("review")) return "review_not_current";
  if (code.includes("INTERPRETATION")) return "interpretation_not_current";
  if (code.includes("CATALOG") || code.includes("identity")) return "identity_not_current";
  if (code.includes("claim_not_current") || code.includes("CASE_NOT_CURRENT")) return "claim_not_current";
  return "durable_lineage_invalid";
}
