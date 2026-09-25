import { createHash } from "node:crypto";
import { canonicalizeExternalClaimValue, type ExternalClaimIngestionRecord } from "./external-claim-ingestion.js";

export const GOVERNED_EXTERNAL_CLAIM_REVIEW_VERSION = "1.0" as const;
export const GOVERNED_EXTERNAL_CLAIM_REVIEW_POLICY_VERSION = "1.0-provisional" as const;

export type ReviewDecisionState = "reviewed_accepted" | "reviewed_with_limitations" | "reviewed_rejected" | "reviewed_returned";
export type ReviewDimension = "claim" | "dependency" | "construct";
export type TrustedReviewer = { readonly id: string; readonly authority: "external_claim_reviewer" };

// The caller supplies a credential, not a reviewer type or a trusted identity.
export interface ExternalClaimReviewerAuthorizer {
  authorize(credential: unknown, dimension: ReviewDimension): Promise<TrustedReviewer | undefined>;
}

export type GovernedReviewLocator = {
  readonly ingestionIdempotencyKey: string;
  readonly ingestionSemanticFingerprint: string;
  readonly claimSlotKey: string;
  readonly sourceId: string;
};

export type GovernedReviewCase = {
  readonly record: ExternalClaimIngestionRecord;
  readonly dependencyAssessmentId: string;
  readonly dependencyType: string;
  readonly dependencyReviewed: boolean;
  readonly dependencySuperseded: boolean;
  readonly constructRelationshipId: string;
  readonly constructReviewed: boolean;
  readonly constructSuperseded: boolean;
  readonly qualificationSuperseded: boolean;
  readonly unresolvedConflictCount: number;
  readonly policyVersion: string;
};

export type GovernedReviewBinding = {
  readonly version: typeof GOVERNED_EXTERNAL_CLAIM_REVIEW_VERSION;
  readonly claimSlotKey: string;
  readonly sourceId: string;
  readonly documentId: string;
  readonly extractionRunId: string;
  readonly rawClaimId: string;
  readonly normalizedClaimId: string;
  readonly identityAssertionId: string;
  readonly equipmentId?: string;
  readonly equipmentVariantId?: string;
  readonly identityCertainty: string;
  readonly dependencyAssessmentId: string;
  readonly dependencyType: string;
  readonly constructRelationshipId: string;
  readonly qualificationDecisionId: string;
  readonly qualificationState: string;
  readonly qualificationSemanticFingerprint: string;
  readonly ingestionSemanticFingerprint: string;
  readonly sourceGovernanceRevisionId: string;
  readonly policyVersion: string;
};

export type GovernedReviewRow = {
  readonly id: string;
  readonly normalizedClaimId: string;
  readonly constructRelationshipId: string;
  readonly decision: ReviewDecisionState;
  readonly reviewerReference: string;
  readonly reason: string;
  readonly limitations: readonly string[];
  readonly reviewedBinding: GovernedReviewBinding;
  readonly reviewedStateFingerprint: string;
  readonly decisionFingerprint: string;
  readonly supersedesDecisionId?: string;
  readonly decidedAt: Date;
};

export type ClaimReviewCommand = GovernedReviewLocator & {
  readonly expectedStateFingerprint: string;
  readonly credential: unknown;
  readonly decision: ReviewDecisionState;
  readonly reason: string;
  readonly limitations?: readonly string[];
  readonly idempotencyKey: string;
  readonly expectedPriorDecisionId?: string;
};

export type DimensionReviewCommand = GovernedReviewLocator & {
  readonly expectedStateFingerprint: string;
  readonly credential: unknown;
  readonly decision: ReviewDecisionState;
  readonly reason: string;
  readonly limitations?: readonly string[];
  readonly idempotencyKey: string;
};

export type DependencyReviewCommand = DimensionReviewCommand & {
  readonly dependencyType: "independent_observation" | "unknown_dependency" | "syndicated_from" | "derived_from" | "copied_from" | "shared_upstream" | "original";
  readonly independenceGroupId?: string;
  readonly upstreamClaimId?: string;
};

export type ConstructReviewCommand = DimensionReviewCommand & {
  readonly role: "supporting_context" | "candidate_only" | "not_applicable";
  readonly mappingConfidence: "high" | "medium" | "low" | "unmapped";
};

export type ReviewStatus = {
  readonly binding: GovernedReviewBinding;
  readonly stateFingerprint: string;
  readonly applicableDecision?: GovernedReviewRow;
  readonly historicalDecisions: readonly { readonly decision: GovernedReviewRow; readonly reason: "changed_meaning" | "superseded_decision" | "no_longer_current" }[];
  readonly unresolvedDimensions: readonly ReviewDimension[];
};

export interface GovernedReviewRepository {
  transaction<T>(operation: (repository: GovernedReviewRepository) => Promise<T>): Promise<T>;
  lockClaimSlot(locator: GovernedReviewLocator): Promise<void>;
  loadCase(locator: GovernedReviewLocator): Promise<GovernedReviewCase | undefined>;
  listClaimReviews(claimSlotKey: string): Promise<readonly GovernedReviewRow[]>;
  findClaimReviewByIdempotencyKey(key: string): Promise<GovernedReviewRow | undefined>;
  replayDependencyReview(command: DependencyReviewCommand, reviewerId: string): Promise<boolean>;
  replayConstructReview(command: ConstructReviewCommand, reviewerId: string): Promise<boolean>;
  createClaimReview(input: Omit<GovernedReviewRow, "id" | "decidedAt"> & { readonly idempotencyKey: string }): Promise<GovernedReviewRow>;
  writeDependencyReview(input: DependencyReviewCommand & { readonly reviewerId: string; readonly claim: GovernedReviewCase }): Promise<void>;
  writeConstructReview(input: ConstructReviewCommand & { readonly reviewerId: string; readonly claim: GovernedReviewCase }): Promise<void>;
}

export class GovernedReviewError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = "GovernedReviewError"; }
}

export function bindingForReview(reviewCase: GovernedReviewCase): GovernedReviewBinding {
  const { record, dependencyAssessmentId, dependencyType, constructRelationshipId, policyVersion } = reviewCase;
  return {
    version: GOVERNED_EXTERNAL_CLAIM_REVIEW_VERSION,
    claimSlotKey: record.claimSlotKey,
    sourceId: record.sourceId,
    documentId: record.documentId,
    extractionRunId: record.extractionRunId,
    rawClaimId: record.rawClaimId,
    normalizedClaimId: record.normalizedClaimId,
    identityAssertionId: record.identityAssertionId,
    equipmentId: record.reviewReady.equipmentId,
    equipmentVariantId: record.reviewReady.equipmentVariantId,
    identityCertainty: record.reviewReady.identityCertainty,
    dependencyAssessmentId,
    dependencyType,
    constructRelationshipId,
    qualificationDecisionId: record.qualificationDecisionId,
    qualificationState: record.reviewReady.historicalQualificationState,
    qualificationSemanticFingerprint: record.qualificationSemanticFingerprint,
    ingestionSemanticFingerprint: record.semanticFingerprint,
    sourceGovernanceRevisionId: record.reviewReady.currentSourceGovernanceRevisionId,
    policyVersion
  };
}

export function fingerprintReviewState(binding: GovernedReviewBinding): string {
  return createHash("sha256").update(canonicalizeExternalClaimValue(binding)).digest("hex");
}

function fingerprintDecision(input: { binding: GovernedReviewBinding; decision: ReviewDecisionState; reviewerId: string; reason: string; limitations: readonly string[] }): string {
  return createHash("sha256").update(canonicalizeExternalClaimValue(input)).digest("hex");
}

export class GovernedExternalClaimReviewService {
  constructor(private readonly repository: GovernedReviewRepository, private readonly authorizer: ExternalClaimReviewerAuthorizer) {}

  async inspect(locator: GovernedReviewLocator): Promise<ReviewStatus> {
    const reviewCase = await this.repository.loadCase(locator);
    if (!reviewCase) throw new GovernedReviewError("CASE_NOT_FOUND", "The governed claim case was not found.");
    const binding = bindingForReview(reviewCase);
    const stateFingerprint = fingerprintReviewState(binding);
    const rows = await this.repository.listClaimReviews(binding.claimSlotKey);
    const current = reviewCase.record.reviewReady.current && !reviewCase.record.reviewReady.sourceGovernanceChanged &&
      reviewCase.record.reviewReady.qualificationState === reviewCase.record.reviewReady.historicalQualificationState &&
      reviewCase.record.reviewReady.unresolvedConflictIds.length === 0 && reviewCase.unresolvedConflictCount === 0 && !reviewCase.qualificationSuperseded;
    const applicable = current ? rows.filter((row) => row.reviewedStateFingerprint === stateFingerprint) : [];
    const applicableDecision = applicable.find((row) => !applicable.some((candidate) => candidate.supersedesDecisionId === row.id));
    if (applicable.filter((row) => !applicable.some((candidate) => candidate.supersedesDecisionId === row.id)).length > 1) {
      throw new GovernedReviewError("AMBIGUOUS_REVIEW_HISTORY", "Multiple current governed review decisions exist for this meaning.");
    }
    return {
      binding, stateFingerprint, applicableDecision,
      historicalDecisions: rows.filter((row) => row.id !== applicableDecision?.id).map((decision) => ({ decision,
        reason: !current ? "no_longer_current" as const : decision.reviewedStateFingerprint !== stateFingerprint ? "changed_meaning" as const : "superseded_decision" as const })),
      unresolvedDimensions: [
        ...(!applicableDecision || !["reviewed_accepted", "reviewed_with_limitations"].includes(applicableDecision.decision) ? ["claim" as const] : []),
        ...(!reviewCase.dependencyReviewed || reviewCase.dependencyType === "unknown_dependency" ? ["dependency" as const] : []),
        ...(!reviewCase.constructReviewed ? ["construct" as const] : [])
      ]
    };
  }

  async reviewClaim(command: ClaimReviewCommand): Promise<GovernedReviewRow> {
    const reviewer = await this.authorize(command.credential, "claim");
    this.validateDecision(command);
    return this.repository.transaction(async (repository) => {
      await repository.lockClaimSlot(command);
      const existing = await repository.findClaimReviewByIdempotencyKey(command.idempotencyKey);
      if (existing) {
        const limitations = [...new Set(command.limitations ?? [])].sort();
        const expected = fingerprintDecision({ binding: existing.reviewedBinding, decision: command.decision, reviewerId: reviewer.id, reason: command.reason.trim(), limitations });
        if (existing.reviewedStateFingerprint !== command.expectedStateFingerprint || existing.decisionFingerprint !== expected ||
          existing.reviewedBinding.sourceId !== command.sourceId ||
          existing.supersedesDecisionId !== command.expectedPriorDecisionId ||
          existing.reviewedBinding.ingestionSemanticFingerprint !== command.ingestionSemanticFingerprint || existing.reviewedBinding.claimSlotKey !== command.claimSlotKey) {
          throw new GovernedReviewError("IDEMPOTENCY_CONFLICT", "This review key belongs to a different decision.");
        }
        return existing;
      }
      const reviewCase = await repository.loadCase(command);
      if (!reviewCase) throw new GovernedReviewError("CASE_NOT_FOUND", "The governed claim case was not found.");
      this.requireCurrentCase(reviewCase);
      const binding = bindingForReview(reviewCase);
      const reviewedStateFingerprint = fingerprintReviewState(binding);
      if (reviewedStateFingerprint !== command.expectedStateFingerprint) throw new GovernedReviewError("STALE_REVIEW_CASE", "The reviewed case changed before the decision was submitted.");
      const limitations = [...new Set(command.limitations ?? [])].sort();
      const decisionFingerprint = fingerprintDecision({ binding, decision: command.decision, reviewerId: reviewer.id, reason: command.reason.trim(), limitations });
      const rows = (await repository.listClaimReviews(binding.claimSlotKey)).filter((row) => row.normalizedClaimId === binding.normalizedClaimId && row.constructRelationshipId === binding.constructRelationshipId);
      const leaves = rows.filter((row) => !rows.some((candidate) => candidate.supersedesDecisionId === row.id));
      if (leaves.length > 1) throw new GovernedReviewError("AMBIGUOUS_REVIEW_HISTORY", "Review history has multiple current leaves.");
      if (leaves[0]?.id !== command.expectedPriorDecisionId) throw new GovernedReviewError("PRIOR_REVIEW_CHANGED", "Another governed decision was recorded after this case was inspected.");
      return repository.createClaimReview({ normalizedClaimId: binding.normalizedClaimId, constructRelationshipId: binding.constructRelationshipId,
        decision: command.decision, reviewerReference: reviewer.id, reason: command.reason.trim(), limitations, reviewedBinding: binding,
        reviewedStateFingerprint, decisionFingerprint, supersedesDecisionId: leaves[0]?.id, idempotencyKey: command.idempotencyKey });
    });
  }

  async reviewDependency(command: DependencyReviewCommand): Promise<void> {
    const reviewer = await this.authorize(command.credential, "dependency");
    this.validateDecision(command);
    if (command.dependencyType === "independent_observation" && (!command.independenceGroupId?.trim() || command.decision === "reviewed_rejected" || command.decision === "reviewed_returned")) {
      throw new GovernedReviewError("INDEPENDENCE_ATTESTATION_REQUIRED", "Independence requires an accepted human finding and a justified independence group.");
    }
    await this.repository.transaction(async (repository) => {
      await repository.lockClaimSlot(command);
      if (await repository.replayDependencyReview(command, reviewer.id)) return;
      const reviewCase = await repository.loadCase(command);
      if (!reviewCase) throw new GovernedReviewError("CASE_NOT_FOUND", "The governed claim case was not found.");
      this.requireCurrentCase(reviewCase);
      if (fingerprintReviewState(bindingForReview(reviewCase)) !== command.expectedStateFingerprint) throw new GovernedReviewError("STALE_REVIEW_CASE", "Dependency context changed before review.");
      await repository.writeDependencyReview({ ...command, reviewerId: reviewer.id, claim: reviewCase });
    });
  }

  async reviewConstruct(command: ConstructReviewCommand): Promise<void> {
    const reviewer = await this.authorize(command.credential, "construct");
    this.validateDecision(command);
    if (command.role === "supporting_context" && (command.mappingConfidence !== "high" || !["reviewed_accepted", "reviewed_with_limitations"].includes(command.decision))) {
      throw new GovernedReviewError("CONSTRUCT_REVIEW_INCOMPLETE", "Supporting context requires an accepted high-confidence human mapping.");
    }
    await this.repository.transaction(async (repository) => {
      await repository.lockClaimSlot(command);
      if (await repository.replayConstructReview(command, reviewer.id)) return;
      const reviewCase = await repository.loadCase(command);
      if (!reviewCase) throw new GovernedReviewError("CASE_NOT_FOUND", "The governed claim case was not found.");
      this.requireCurrentCase(reviewCase);
      if (fingerprintReviewState(bindingForReview(reviewCase)) !== command.expectedStateFingerprint) throw new GovernedReviewError("STALE_REVIEW_CASE", "Construct context changed before review.");
      await repository.writeConstructReview({ ...command, reviewerId: reviewer.id, claim: reviewCase });
    });
  }

  private async authorize(credential: unknown, dimension: ReviewDimension): Promise<TrustedReviewer> {
    const reviewer = await this.authorizer.authorize(credential, dimension);
    if (!reviewer || reviewer.authority !== "external_claim_reviewer" || !reviewer.id.trim()) throw new GovernedReviewError("REVIEWER_NOT_AUTHORIZED", "A trusted authorized human reviewer is required.");
    return reviewer;
  }

  private validateDecision(command: ClaimReviewCommand) {
    if (!command.idempotencyKey.trim() || !command.reason.trim()) throw new GovernedReviewError("REVIEW_INCOMPLETE", "An idempotency key and a reason are required.");
    if (command.decision === "reviewed_with_limitations" && !command.limitations?.length) throw new GovernedReviewError("LIMITATIONS_REQUIRED", "Accepted-with-limitations requires explicit limitations.");
  }

  private requireCurrentCase(reviewCase: GovernedReviewCase) {
    if (!reviewCase.record.reviewReady.current || reviewCase.record.reviewReady.sourceGovernanceChanged ||
      reviewCase.record.reviewReady.qualificationState !== reviewCase.record.reviewReady.historicalQualificationState ||
      reviewCase.record.reviewReady.unresolvedConflictIds.length || reviewCase.unresolvedConflictCount || reviewCase.qualificationSuperseded) {
      throw new GovernedReviewError("CASE_NOT_CURRENT", "This claim is no longer the current governed review case.");
    }
  }
}
