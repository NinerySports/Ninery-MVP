import assert from "node:assert/strict";
import test from "node:test";
import { buildSyntheticEquipmentClaimProvenanceFixture, qualifyEquipmentClaim } from "@ninery/equipment-intelligence";
import { assessReviewedQualification, ReviewedDimensionQualificationConvergenceService, type ReviewedQualificationRepository, type ReviewedQualificationState, type ReviewedQualification } from "../reviewed-dimension-qualification-convergence.js";

function state(): ReviewedQualificationState {
  const graph = buildSyntheticEquipmentClaimProvenanceFixture();
  const normalized = graph.normalizedClaims[0]!;
  const targetIdentity = graph.identities.find(identity => identity.id === normalized.identityAssertionId)!;
  return { graph, normalizedClaimId: normalized.id, targetIdentity, dependencyAssessmentId: "D2", constructRelationshipId: "C2", sourceId: "source", sourceGovernanceRevisionId: "G1", governedMeaning: { dependency: { decisionFingerprint: "D2-reviewed" }, construct: { decisionFingerprint: "C2-reviewed" }, governance: { policy: "1.0" } } };
}

test("Q2 executes unchanged #070 and fingerprints exact dimension governance and policy meaning", () => {
  const input = state();
  const actual = assessReviewedQualification(input);
  assert.deepEqual(actual.assessment, qualifyEquipmentClaim({ graph: input.graph, normalizedClaimId: input.normalizedClaimId, targetIdentity: input.targetIdentity }));
  assert.deepEqual(assessReviewedQualification(input), actual);
  for (const changed of [
    { ...input, dependencyAssessmentId: "D3" }, { ...input, constructRelationshipId: "C3" },
    { ...input, sourceGovernanceRevisionId: "G2" }, { ...input, governedMeaning: { policy: "future-policy" } },
    { ...input, graph: { ...input.graph, normalizedClaims: input.graph.normalizedClaims.map(row => row.id === input.normalizedClaimId ? { ...row, evidenceClass: "structured_human_evaluation" as const } : row) } }
  ]) assert.notEqual(assessReviewedQualification(changed).semanticFingerprint, actual.semanticFingerprint);
});

test("convergence appends once and never changes original graph or creates review decisions", async () => {
  const input = state(); const original = structuredClone(input);
  let stored: ReviewedQualification | undefined; let appendCount = 0; let locked = false;
  const repository: ReviewedQualificationRepository = {
    transaction: operation => operation(repository), async lock() { locked = true; },
    async load() { assert.ok(locked); return input; }, async findCurrent(_state, expected) { return stored?.semanticFingerprint === expected.semanticFingerprint; },
    async append(_state, expected) { stored = expected; appendCount++; }
  };
  const service = new ReviewedDimensionQualificationConvergenceService(repository);
  const locator = { ingestionIdempotencyKey: "original", ingestionSemanticFingerprint: "original", claimSlotKey: "slot", sourceId: "source" };
  assert.equal((await service.inspect(locator)).status, "needs_convergence");
  assert.equal((await service.converge(locator)).status, "created");
  assert.equal((await service.converge(locator)).status, "existing");
  assert.equal((await service.inspect(locator)).status, "current");
  assert.equal(appendCount, 1); assert.deepEqual(input, original);
});
