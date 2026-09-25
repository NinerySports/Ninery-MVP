import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import {
  GovernedExternalClaimReviewService, GovernedReviewError, bindingForReview, fingerprintReviewState,
  type ClaimReviewCommand, type ConstructReviewCommand, type DependencyReviewCommand,
  type ExternalClaimReviewerAuthorizer, type GovernedReviewCase, type GovernedReviewLocator,
  type GovernedReviewRepository, type GovernedReviewRow
} from "../external-claim-review.js";

const authorizer: ExternalClaimReviewerAuthorizer = {
  async authorize(credential) { return credential === "trusted-session" ? { id: "reviewer-1", authority: "external_claim_reviewer" } : undefined; }
};

class MemoryRepository implements GovernedReviewRepository {
  rows: GovernedReviewRow[] = [];
  dependencyWrites = 0;
  constructWrites = 0;
  constructor(public current: GovernedReviewCase) {}
  async transaction<T>(operation: (repository: GovernedReviewRepository) => Promise<T>): Promise<T> { return operation(this); }
  async lockClaimSlot() {}
  async loadCase(locator: GovernedReviewLocator) { return locator.claimSlotKey === this.current.record.claimSlotKey ? this.current : undefined; }
  async listClaimReviews(claimSlotKey: string) { return this.rows.filter((row) => row.reviewedBinding.claimSlotKey === claimSlotKey); }
  async findClaimReviewByIdempotencyKey(key: string) { return this.rows.find((row) => row.id === key); }
  async createClaimReview(input: Omit<GovernedReviewRow, "id" | "decidedAt"> & { readonly idempotencyKey: string }) {
    const row: GovernedReviewRow = { ...input, id: input.idempotencyKey, decidedAt: new Date("2026-09-24") };
    this.rows.push(row);
    return row;
  }
  async replayDependencyReview() { return false; }
  async replayConstructReview() { return false; }
  async writeDependencyReview() { this.dependencyWrites += 1; }
  async writeConstructReview() { this.constructWrites += 1; }
}

function fixture(): GovernedReviewCase {
  const sourceId = randomUUID(), documentId = randomUUID(), extractionRunId = randomUUID(), rawClaimId = randomUUID();
  const normalizedClaimId = randomUUID(), dependencyAssessmentId = randomUUID(), constructRelationshipId = randomUUID(), qualificationDecisionId = randomUUID();
  const equipmentId = randomUUID(), equipmentVariantId = randomUUID(), governanceId = randomUUID();
  return {
    record: {
      idempotencyKey: `ingestion:${qualificationDecisionId}`, semanticFingerprint: "a".repeat(64), qualificationSemanticFingerprint: "b".repeat(64), claimSlotKey: "slot-1",
      sourceId, documentId, extractionRunId, identityAssertionId: randomUUID(), rawClaimId, normalizedClaimId, dependencyAssessmentId, constructRelationshipId, qualificationDecisionId,
      qualification: { contractVersion: "1.0", normalizedClaimId, state: "context_only", identity: { applicable: true }, reasons: [], gaps: [], blockers: [], warnings: [], limitations: [],
        firewalls: { canonicalValueCreated: false, synthesisEligibilityGranted: false, recommendationEligibilityGranted: false, persistencePerformed: false } },
      reviewReady: { normalizedClaimId, equipmentId, equipmentVariantId, sourceName: "Fixture", sourceStableKey: "fixture", sourceType: "independent_expert_review",
        documentId, documentReference: "internal-fixture", documentRevision: "v1", normalizedProposal: { claimKey: "startup_demand", value: "moderate", method: "manual_interpretation", version: "1.0", vocabularyKnown: true, evidenceClass: "unclassified" },
        extraction: { runId: extractionRunId, logicalRunKey: "run-1", method: "manual", extractorId: "fixture", extractorVersion: "1.0", executedAt: new Date("2026-09-24") },
        identityCertainty: "exact_variant_match", dependencyState: "unknown_dependency", suspectedSyndication: false, proposedConstruct: "startup_demand", mappingConfidence: "high", mappingVersion: "1.0",
        qualificationState: "context_only", historicalQualificationState: "context_only", historicalSourceGovernanceRevisionId: governanceId, currentSourceGovernanceRevisionId: governanceId,
        sourceGovernanceChanged: false, current: true, unresolvedConflictIds: [], reasons: [], blockers: [], quarantineReasons: [], nextDecision: "human_dependency_review",
        authority: { humanApproved: false, independenceEstablished: false, supportingRoleCreated: false, canonicalValueCreated: false, numericValueCreated: false, synthesisGranted: false, recommendationGranted: false } }
    },
    dependencyAssessmentId, dependencyType: "unknown_dependency", dependencyReviewed: false, dependencySuperseded: false,
    constructRelationshipId, constructReviewed: false, constructSuperseded: false, qualificationSuperseded: false, unresolvedConflictCount: 0, policyVersion: "1.0-provisional"
  };
}

function command(value: GovernedReviewCase): ClaimReviewCommand {
  return { ingestionIdempotencyKey: value.record.idempotencyKey, ingestionSemanticFingerprint: value.record.semanticFingerprint,
    claimSlotKey: value.record.claimSlotKey, sourceId: value.record.sourceId, expectedStateFingerprint: fingerprintReviewState(bindingForReview(value)), credential: "trusted-session",
    decision: "reviewed_accepted", reason: "Reviewed the bounded source claim.", idempotencyKey: "review-1" };
}

test("authorized exact-state review is durable, idempotent, and does not grant other authority", async () => {
  const repository = new MemoryRepository(fixture()); const service = new GovernedExternalClaimReviewService(repository, authorizer);
  const request = command(repository.current); const first = await service.reviewClaim(request); const replay = await service.reviewClaim(request);
  assert.equal(replay.id, first.id); assert.equal(repository.rows.length, 1);
  const status = await service.inspect(request);
  assert.equal(status.applicableDecision?.id, first.id);
  assert.deepEqual(status.unresolvedDimensions, ["dependency", "construct"]);
  assert.equal(repository.dependencyWrites, 0); assert.equal(repository.constructWrites, 0);
  assert.equal(repository.current.record.reviewReady.authority.supportingRoleCreated, false);
});

test("untrusted reviewer metadata, missing actor, and changed decisions fail closed", async () => {
  const repository = new MemoryRepository(fixture()); const service = new GovernedExternalClaimReviewService(repository, authorizer);
  await assert.rejects(() => service.reviewClaim({ ...command(repository.current), credential: { reviewerType: "human", reviewerReference: "forged" } }), (error: unknown) => error instanceof GovernedReviewError && error.code === "REVIEWER_NOT_AUTHORIZED");
  await assert.rejects(() => service.reviewClaim({ ...command(repository.current), credential: undefined }), GovernedReviewError);
  await service.reviewClaim(command(repository.current));
  await assert.rejects(() => service.reviewClaim({ ...command(repository.current), decision: "reviewed_rejected" }), (error: unknown) => error instanceof GovernedReviewError && error.code === "IDEMPOTENCY_CONFLICT");
});

test("re-review requires the exact prior decision and preserves its history", async () => {
  const repository = new MemoryRepository(fixture()); const service = new GovernedExternalClaimReviewService(repository, authorizer);
  const request = command(repository.current); const first = await service.reviewClaim(request);
  await assert.rejects(() => service.reviewClaim({ ...request, idempotencyKey: "review-2", decision: "reviewed_rejected" }),
    (error: unknown) => error instanceof GovernedReviewError && error.code === "PRIOR_REVIEW_CHANGED");
  const second = await service.reviewClaim({ ...request, idempotencyKey: "review-2", expectedPriorDecisionId: first.id, decision: "reviewed_rejected" });
  assert.equal(second.supersedesDecisionId, first.id); assert.equal(repository.rows.length, 2);
  const status = await service.inspect(request);
  assert.equal(status.applicableDecision?.id, second.id); assert.equal(status.historicalDecisions[0]?.decision.id, first.id);
});

test("a changed normalization, qualification, governance, dependency, construct, or policy stales prior approval", async () => {
  const changes: Array<(value: GovernedReviewCase) => GovernedReviewCase> = [
    (value) => ({ ...value, record: { ...value.record, normalizedClaimId: randomUUID(), reviewReady: { ...value.record.reviewReady, normalizedClaimId: randomUUID() } } }),
    (value) => ({ ...value, record: { ...value.record, qualificationSemanticFingerprint: "c".repeat(64) } }),
    (value) => ({ ...value, record: { ...value.record, reviewReady: { ...value.record.reviewReady, currentSourceGovernanceRevisionId: randomUUID() } } }),
    (value) => ({ ...value, dependencyAssessmentId: randomUUID(), dependencyType: "independent_observation" }),
    (value) => ({ ...value, constructRelationshipId: randomUUID() }),
    (value) => ({ ...value, policyVersion: "2.0" })
  ];
  for (const change of changes) {
    const repository = new MemoryRepository(fixture()); const service = new GovernedExternalClaimReviewService(repository, authorizer);
    const request = command(repository.current); await service.reviewClaim(request);
    repository.current = change(repository.current);
    const status = await service.inspect(request);
    assert.equal(status.applicableDecision, undefined);
    assert.equal(status.historicalDecisions.length, 1);
    await assert.rejects(() => service.reviewClaim({ ...request, idempotencyKey: randomUUID() }), (error: unknown) => error instanceof GovernedReviewError && error.code === "STALE_REVIEW_CASE");
  }
});

test("document and extraction successors make approval historical; old exact replay stays idempotent", async () => {
  for (const field of ["documentId", "extractionRunId"] as const) {
    const repository = new MemoryRepository(fixture()); const service = new GovernedExternalClaimReviewService(repository, authorizer);
    const request = command(repository.current); const first = await service.reviewClaim(request);
    repository.current = { ...repository.current, record: { ...repository.current.record, [field]: randomUUID(), reviewReady: { ...repository.current.record.reviewReady, current: false } } };
    const status = await service.inspect(request);
    assert.equal(status.applicableDecision, undefined); assert.equal(status.historicalDecisions[0]?.reason, "no_longer_current");
    assert.equal((await service.reviewClaim(request)).id, first.id); assert.equal(repository.rows.length, 1);
  }
});

test("wrong equipment scope is rejected without changing the current review", async () => {
  const repository = new MemoryRepository(fixture()); const service = new GovernedExternalClaimReviewService(repository, authorizer);
  const request = command(repository.current); await service.reviewClaim(request);
  await assert.rejects(() => service.reviewClaim({ ...request, idempotencyKey: "other-scope", expectedStateFingerprint: "0".repeat(64) }),
    (error: unknown) => error instanceof GovernedReviewError && error.code === "STALE_REVIEW_CASE");
  assert.equal((await service.inspect(request)).applicableDecision?.id, request.idempotencyKey);
});

test("a current unresolved conflict blocks approval even when the ingestion projection is otherwise current", async () => {
  const repository = new MemoryRepository({ ...fixture(), unresolvedConflictCount: 1 });
  const service = new GovernedExternalClaimReviewService(repository, authorizer);
  await assert.rejects(() => service.reviewClaim(command(repository.current)),
    (error: unknown) => error instanceof GovernedReviewError && error.code === "CASE_NOT_CURRENT");
});

test("rejected, returned, and accepted-with-limitations are distinct immutable outcomes", async () => {
  for (const decision of ["reviewed_rejected", "reviewed_returned", "reviewed_with_limitations"] as const) {
    const repository = new MemoryRepository(fixture()); const service = new GovernedExternalClaimReviewService(repository, authorizer);
    const row = await service.reviewClaim({ ...command(repository.current), decision, limitations: decision === "reviewed_with_limitations" ? ["Scope is equipment model only."] : [] });
    assert.equal(row.decision, decision);
    assert.equal((await service.inspect(command(repository.current))).unresolvedDimensions.includes("claim"), decision !== "reviewed_with_limitations");
    if (decision === "reviewed_with_limitations") assert.deepEqual(row.limitations, ["Scope is equipment model only."]);
  }
});

test("dependency and construct reviews are separate from claim approval", async () => {
  const repository = new MemoryRepository(fixture()); const service = new GovernedExternalClaimReviewService(repository, authorizer);
  const base = command(repository.current);
  const dependency: DependencyReviewCommand = { ...base, dependencyType: "independent_observation", independenceGroupId: "documented-independent-group", idempotencyKey: "dependency-1" };
  await service.reviewDependency(dependency);
  assert.equal(repository.dependencyWrites, 1); assert.equal(repository.rows.length, 0);
  const construct: ConstructReviewCommand = { ...base, role: "supporting_context", mappingConfidence: "high", idempotencyKey: "construct-1" };
  await service.reviewConstruct(construct);
  assert.equal(repository.constructWrites, 1); assert.equal(repository.rows.length, 0);
  await assert.rejects(() => service.reviewDependency({ ...dependency, independenceGroupId: "" }), GovernedReviewError);
  await assert.rejects(() => service.reviewConstruct({ ...construct, mappingConfidence: "low" }), GovernedReviewError);
});
