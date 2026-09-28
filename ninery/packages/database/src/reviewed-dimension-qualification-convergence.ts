import { createHash } from "node:crypto";
import { EQUIPMENT_CLAIM_QUALIFICATION_CONTRACT_VERSION, qualifyEquipmentClaim, type EquipmentClaimIdentityAssertion, type EquipmentClaimProvenanceGraph, type EquipmentClaimQualificationAssessment } from "@ninery/equipment-intelligence";
import { canonicalizeExternalClaimValue, externalClaimUuid } from "./external-claim-ingestion.js";
import type { GovernedReviewLocator } from "./external-claim-review.js";

export const REVIEWED_DIMENSION_QUALIFICATION_CONVERGENCE_VERSION = "1.0";

export class QualificationConvergenceError extends Error {
  constructor(readonly code: string) { super(code); this.name = "QualificationConvergenceError"; }
}

export type ReviewedQualificationState = {
  readonly graph: EquipmentClaimProvenanceGraph;
  readonly targetIdentity: EquipmentClaimIdentityAssertion;
  readonly normalizedClaimId: string;
  readonly dependencyAssessmentId: string;
  readonly constructRelationshipId: string;
  readonly sourceId: string;
  readonly sourceGovernanceRevisionId: string;
  // Includes durable review attestations and governance scope, not only their IDs.
  readonly governedMeaning: unknown;
};

export function assessReviewedQualification(state: ReviewedQualificationState) {
  const assessment = qualifyEquipmentClaim({ graph: state.graph, normalizedClaimId: state.normalizedClaimId, targetIdentity: state.targetIdentity });
  const semanticFingerprint = createHash("sha256").update(canonicalizeExternalClaimValue({
    version: REVIEWED_DIMENSION_QUALIFICATION_CONVERGENCE_VERSION,
    policyVersion: EQUIPMENT_CLAIM_QUALIFICATION_CONTRACT_VERSION,
    state, assessment
  })).digest("hex");
  return { id: externalClaimUuid(`reviewed-qualification:${semanticFingerprint}`), semanticFingerprint, assessment };
}

export type ReviewedQualification = ReturnType<typeof assessReviewedQualification>;
export type ConvergenceResult = ReviewedQualification & { readonly status: "created" | "existing" };

export interface ReviewedQualificationRepository {
  transaction<T>(operation: (repository: ReviewedQualificationRepository) => Promise<T>): Promise<T>;
  lock(locator: GovernedReviewLocator): Promise<void>;
  load(locator: GovernedReviewLocator): Promise<ReviewedQualificationState>;
  findCurrent(state: ReviewedQualificationState, expected: ReviewedQualification): Promise<boolean>;
  append(state: ReviewedQualificationState, expected: ReviewedQualification): Promise<void>;
}

export class ReviewedDimensionQualificationConvergenceService {
  constructor(private readonly repository: ReviewedQualificationRepository) {}

  inspect(locator: GovernedReviewLocator): Promise<ReviewedQualification & { readonly status: "current" | "needs_convergence" }> {
    return this.repository.transaction(async (repository) => {
      await repository.lock(locator);
      const state = await repository.load(locator);
      const expected = assessReviewedQualification(state);
      return { ...expected, status: await repository.findCurrent(state, expected) ? "current" : "needs_convergence" };
    });
  }

  converge(locator: GovernedReviewLocator): Promise<ConvergenceResult> {
    return this.repository.transaction(async (repository) => {
      await repository.lock(locator);
      const state = await repository.load(locator);
      const expected = assessReviewedQualification(state);
      if (await repository.findCurrent(state, expected)) return { ...expected, status: "existing" };
      await repository.append(state, expected);
      return { ...expected, status: "created" };
    });
  }
}

export function qualificationPersistenceMeaning(assessment: EquipmentClaimQualificationAssessment) {
  return {
    contractVersion: assessment.contractVersion, state: assessment.state,
    proposedEvidenceClass: assessment.proposedEvidenceClass ?? null,
    proposedEvidenceInput: assessment.proposedEvidenceInput ?? null,
    proposedTargetLevel: assessment.proposedTarget?.level ?? null,
    reasons: assessment.reasons, gaps: assessment.gaps, blockers: assessment.blockers,
    warnings: assessment.warnings, limitations: assessment.limitations
  };
}
