import type { Prisma, PrismaClient } from "@prisma/client";
import type { ExternalSupportingDecisionInsert, ExternalSupportingPersistenceCommand, ExternalSupportingPersistenceContext, ExternalSupportingPersistenceRepository, PersistedExternalSupportingDecision } from "./external-supporting-evidence-persistence.js";

type Client = PrismaClient | Prisma.TransactionClient;

export class PrismaExternalSupportingPersistenceRepository implements ExternalSupportingPersistenceRepository {
  constructor(private readonly client: Client, private readonly inTransaction = false) {}

  transaction<T>(operation: (repository: ExternalSupportingPersistenceRepository) => Promise<T>): Promise<T> {
    if (this.inTransaction) return operation(this);
    return (this.client as PrismaClient).$transaction((tx) => operation(new PrismaExternalSupportingPersistenceRepository(tx, true)), { isolationLevel: "Serializable" });
  }

  async findDecisionByIdempotencyKey(idempotencyKey: string): Promise<PersistedExternalSupportingDecision | undefined> {
    const row = await this.client.externalSupportingRoleDecision.findUnique({ where: { idempotencyKey }, select: { id: true, idempotencyKey: true, decisionFingerprint: true, eligible: true, role: true } });
    return row ? { ...row, role: String(row.role) } : undefined;
  }

  async loadContext(command: ExternalSupportingPersistenceCommand): Promise<ExternalSupportingPersistenceContext | undefined> {
    const raw = await this.client.externalEvidenceClaim.findUnique({ where: { id: command.rawClaimId }, include: { document: { include: { source: true } }, identityAssertion: { include: { equipmentVariant: true } }, supersededBy: { select: { id: true } } } });
    const normalized = await this.client.externalEvidenceNormalizedClaim.findUnique({ where: { id: command.normalizedClaimId } });
    const dependency = await this.client.externalEvidenceDependencyAssessment.findUnique({ where: { id: command.dependencyAssessmentId }, include: { supersededBy: { select: { id: true } } } });
    const relationship = await this.client.externalEvidenceConstructRelationship.findUnique({ where: { id: command.constructRelationshipId }, include: { supersededBy: { select: { id: true } } } });
    const qualification = await this.client.externalEvidenceQualificationDecision.findUnique({ where: { id: command.qualificationDecisionId } });
    const review = await this.client.externalEvidenceReviewDecision.findUnique({ where: { id: command.reviewDecisionId } });
    if (!raw || !normalized || !dependency || !relationship || !qualification || !review) return undefined;
    const conflicts = await this.client.$queryRaw<Array<{ count: bigint }>>`SELECT count(*)::bigint AS count FROM "external_evidence_conflict_members" m WHERE m."normalizedClaimId"=${command.normalizedClaimId}::uuid AND COALESCE((SELECT x."outcome"::text IN ('resolved_no_material_conflict','resolved_claim_superseded','resolved_with_limitations') FROM "external_evidence_conflict_resolutions" x WHERE x."conflictCaseId"=m."conflictCaseId" ORDER BY x."decidedAt" DESC, x."id" DESC LIMIT 1), false)=false`;
    const identity = raw.identityAssertion;
    return {
      rawClaim: { id: raw.id, claimType: String(raw.claimType), verificationState: String(raw.verificationState), supersededByCount: raw.supersededBy.length,
        document: { sourceId: raw.document.sourceId, source: { id: raw.document.source.id, sourceType: String(raw.document.source.sourceType) } },
        identity: { id: identity.id, certainty: String(identity.certainty), equipmentId: identity.equipmentId ?? undefined, equipmentVariantId: identity.equipmentVariantId ?? undefined, variantEquipmentId: identity.equipmentVariant?.equipmentId,
          manufacturerMatches: !!identity.manufacturer, modelMatches: !!identity.model, modelYearMatches: identity.modelYear !== null, certificationMatches: !!identity.certification,
          productFamilyMatches: !!identity.equipmentId, dropMatches: identity.drop !== null, sizeMatches: identity.lengthInches !== null && identity.weightOunces !== null, variantMatches: !!identity.equipmentVariantId } },
      normalizedClaim: { id: normalized.id, rawClaimId: normalized.rawClaimId, verificationState: String(normalized.verificationState) },
      dependencyAssessment: { id: dependency.id, claimId: dependency.claimId, dependencyType: String(dependency.dependencyType), independenceGroupId: dependency.independenceGroupId ?? undefined, reviewedState: String(dependency.reviewedState), reviewerType: String(dependency.reviewerType), reviewerReference: dependency.reviewerReference, supersededByCount: dependency.supersededBy.length },
      constructRelationship: { id: relationship.id, normalizedClaimId: relationship.normalizedClaimId, proposedConstruct: relationship.proposedConstruct, mappingConfidence: relationship.mappingConfidence, mappingVersion: relationship.mappingVersion, policyVersion: relationship.policyVersion, role: String(relationship.role), reviewState: String(relationship.reviewState), constructValueCreated: relationship.constructValueCreated, supersededByCount: relationship.supersededBy.length },
      qualification: { id: qualification.id, normalizedClaimId: qualification.normalizedClaimId, constructRelationshipId: qualification.constructRelationshipId, contractVersion: qualification.contractVersion, state: String(qualification.state) },
      review: { id: review.id, normalizedClaimId: review.normalizedClaimId, constructRelationshipId: review.constructRelationshipId, decision: String(review.decision), reviewerType: String(review.reviewerType), reviewerReference: review.reviewerReference },
      unresolvedConflictCount: Number(conflicts[0]?.count ?? 0n)
    };
  }

  async createDecision(data: ExternalSupportingDecisionInsert): Promise<PersistedExternalSupportingDecision> {
    const row = await this.client.externalSupportingRoleDecision.create({ data: { ...data, reasons: [...data.reasons], blockers: [...data.blockers] }, select: { id: true, idempotencyKey: true, decisionFingerprint: true, eligible: true, role: true } });
    return { ...row, role: String(row.role) };
  }
}
