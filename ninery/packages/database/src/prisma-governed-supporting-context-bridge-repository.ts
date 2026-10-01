import { Prisma, type PrismaClient } from "@prisma/client";
import { bindingForReview, fingerprintReviewState, type GovernedReviewLocator } from "./external-claim-review.js";
import { PrismaGovernedReviewRepository } from "./prisma-external-claim-review-repository.js";
import { PrismaExternalClaimIngestionRepository } from "./prisma-external-claim-ingestion-repository.js";
import { PrismaReviewedQualificationRepository } from "./prisma-reviewed-dimension-qualification-convergence-repository.js";
import { assessReviewedQualification } from "./reviewed-dimension-qualification-convergence.js";
import { PrismaExternalSupportingPersistenceRepository } from "./prisma-external-supporting-evidence-repository.js";
import { GovernedSupportingContextBridgeError, type CurrentGovernedSupportingLineage, type GovernedSupportingContextBridgeRepository } from "./governed-supporting-context-bridge.js";

type Client = PrismaClient | Prisma.TransactionClient;

export class PrismaGovernedSupportingContextBridgeRepository implements GovernedSupportingContextBridgeRepository {
  constructor(private readonly client: Client, private readonly inTransaction = false, private readonly readOnly = false) {}

  transaction<T>(operation: (repository: GovernedSupportingContextBridgeRepository) => Promise<T>): Promise<T> {
    if (this.inTransaction) return operation(this);
    // A fresh statement snapshot after the slot lock is essential when a successor
    // committed while this transaction waited for that lock.
    return (this.client as PrismaClient).$transaction(
      tx => operation(new PrismaGovernedSupportingContextBridgeRepository(tx, true)),
      { isolationLevel: "ReadCommitted", maxWait: 30000, timeout: 30000 }
    );
  }

  async lock(locator: GovernedReviewLocator): Promise<void> {
    if (!this.inTransaction) throw new GovernedSupportingContextBridgeError("TRANSACTION_REQUIRED");
    await new PrismaGovernedReviewRepository(this.client, true).lockClaimSlot(locator);
    const record = await new PrismaExternalClaimIngestionRepository(this.client, true).findByIdempotencyKey(locator.ingestionIdempotencyKey, locator.ingestionSemanticFingerprint);
    if (!record || record.claimSlotKey !== locator.claimSlotKey || record.sourceId !== locator.sourceId) throw new GovernedSupportingContextBridgeError("CASE_NOT_FOUND");
    await this.client.$queryRaw`SELECT "id" FROM "external_evidence_normalized_claims" WHERE "id"=${record.normalizedClaimId}::uuid FOR UPDATE`;
    await this.client.$queryRaw`SELECT c."id" FROM "external_evidence_conflict_cases" c JOIN "external_evidence_conflict_members" m ON m."conflictCaseId"=c."id" WHERE m."normalizedClaimId"=${record.normalizedClaimId}::uuid ORDER BY c."id" FOR UPDATE OF c`;
  }

  async loadCurrent(locator: GovernedReviewLocator): Promise<CurrentGovernedSupportingLineage> {
    if (!this.inTransaction) throw new GovernedSupportingContextBridgeError("TRANSACTION_REQUIRED");
    const qualificationRepository = new PrismaReviewedQualificationRepository(this.client, !this.readOnly);
    const state = await qualificationRepository.load(locator);
    const expected = assessReviewedQualification(state);
    if (!await qualificationRepository.findCurrent(state, expected)) throw new GovernedSupportingContextBridgeError("QUALIFICATION_NOT_CURRENT");

    const reviewRepository = new PrismaGovernedReviewRepository(this.client, true, this.readOnly);
    const reviewCase = await reviewRepository.loadCase(locator);
    if (!reviewCase || reviewCase.qualificationConvergence !== "current" || reviewCase.qualificationSuperseded ||
      !reviewCase.record.reviewReady.current || reviewCase.record.reviewReady.sourceGovernanceChanged ||
      reviewCase.record.reviewReady.unresolvedConflictIds.length || reviewCase.unresolvedConflictCount ||
      !reviewCase.dependencyReviewed || !reviewCase.constructReviewed) {
      throw new GovernedSupportingContextBridgeError("REVIEW_CASE_NOT_CURRENT");
    }
    const binding = bindingForReview(reviewCase);
    if (binding.qualificationDecisionId !== expected.id || binding.qualificationSemanticFingerprint !== expected.semanticFingerprint ||
      binding.dependencyAssessmentId !== state.dependencyAssessmentId || binding.constructRelationshipId !== state.constructRelationshipId ||
      binding.sourceGovernanceRevisionId !== state.sourceGovernanceRevisionId || binding.normalizedClaimId !== state.normalizedClaimId ||
      binding.sourceId !== locator.sourceId || binding.claimSlotKey !== locator.claimSlotKey) {
      throw new GovernedSupportingContextBridgeError("REVIEW_QUALIFICATION_LINEAGE_MISMATCH");
    }
    const rows = (await reviewRepository.listClaimReviews(locator.claimSlotKey)).filter(row =>
      row.normalizedClaimId === binding.normalizedClaimId && row.constructRelationshipId === binding.constructRelationshipId);
    const leaves = rows.filter(row => !rows.some(candidate => candidate.supersedesDecisionId === row.id));
    if (leaves.length !== 1) throw new GovernedSupportingContextBridgeError("REVIEW_LINEAGE_AMBIGUOUS");
    const review = leaves[0]!;
    const interpretation = review.reviewedBinding.supportingInterpretation;
    if (!interpretation) throw new GovernedSupportingContextBridgeError("INTERPRETATION_REVIEW_REQUIRED");
    const interpretedBinding = bindingForReview(reviewCase, interpretation);
    if (review.reviewedStateFingerprint !== fingerprintReviewState(interpretedBinding) ||
      review.decision !== "reviewed_accepted" || !review.reviewerReference.trim()) {
      throw new GovernedSupportingContextBridgeError("ACCEPTED_CURRENT_HUMAN_REVIEW_REQUIRED");
    }
    const durableReview = await this.client.externalEvidenceReviewDecision.findUniqueOrThrow({ where: { id: review.id }, select: { reviewerType: true } });
    if (durableReview.reviewerType !== "human") throw new GovernedSupportingContextBridgeError("ACCEPTED_CURRENT_HUMAN_REVIEW_REQUIRED");
    await this.assertCatalogIdentity(binding.rawClaimId);
    return {
      rawClaimId: binding.rawClaimId, normalizedClaimId: binding.normalizedClaimId,
      dependencyAssessmentId: binding.dependencyAssessmentId, constructRelationshipId: binding.constructRelationshipId,
      qualificationDecisionId: binding.qualificationDecisionId, reviewDecisionId: review.id, interpretation
    };
  }

  supportingRepository() {
    if (!this.inTransaction) throw new GovernedSupportingContextBridgeError("TRANSACTION_REQUIRED");
    return new PrismaExternalSupportingPersistenceRepository(this.client, true);
  }

  private async assertCatalogIdentity(rawClaimId: string): Promise<void> {
    const raw = await this.client.externalEvidenceClaim.findUniqueOrThrow({ where: { id: rawClaimId },
      include: { identityAssertion: true } });
    const identity = raw.identityAssertion;
    if (!identity.equipmentId) throw new GovernedSupportingContextBridgeError("CATALOG_IDENTITY_MISMATCH");
    if (!this.readOnly) await this.client.$queryRaw`SELECT "id" FROM "equipment" WHERE "id" = ${identity.equipmentId}::uuid FOR SHARE`;
    if (identity.equipmentVariantId) {
      if (!this.readOnly) await this.client.$queryRaw`SELECT "id" FROM "equipment_variants" WHERE "id" = ${identity.equipmentVariantId}::uuid FOR SHARE`;
    }
    const equipment = await this.client.equipment.findUnique({ where: { id: identity.equipmentId } });
    const variant = identity.equipmentVariantId
      ? await this.client.equipmentVariant.findUnique({ where: { id: identity.equipmentVariantId } }) : null;
    if (!equipment || identity.manufacturer !== equipment.manufacturer || identity.model !== equipment.model ||
      identity.modelYear !== equipment.modelYear || identity.certification !== equipment.certification ||
      (identity.equipmentVariantId && !variant) ||
      (variant && (variant.equipmentId !== equipment.id ||
        (identity.lengthInches && (!variant.lengthInches || !identity.lengthInches.equals(variant.lengthInches))) ||
        (identity.weightOunces && (!variant.weightOunces || !identity.weightOunces.equals(variant.weightOunces))) ||
        (identity.drop !== null && identity.drop !== variant.dropWeight) ||
        (identity.sku && identity.sku !== variant.sku)))) {
      throw new GovernedSupportingContextBridgeError("CATALOG_IDENTITY_MISMATCH");
    }
  }
}
