import assert from "node:assert/strict";
import test from "node:test";
import { GovernedSupportingContextProjectionService, toGovernedSupportingContextOverlay, type GovernedSupportingContextEntry, type GovernedSupportingContextProjectionRepository } from "../governed-supporting-context-projection.js";

const request = { equipmentId: "equipment", equipmentVariantId: "variant", construct: "startup_demand" as const };
function entry(id: string, status: "current" | "historical", decidedAt: string): GovernedSupportingContextEntry {
  return { decisionId: id, status, exclusions: status === "historical" ? ["review_not_current"] : [], decidedAt,
    construct: "startup_demand", direction: "lower", identityScope: "exact_variant",
    provenance: { sourceId: "source", documentId: "document", extractionRunId: "extraction", rawClaimId: "raw",
      normalizedClaimId: "normalized", identityAssertionId: "identity", dependencyAssessmentId: "dependency",
      dependencyType: "independent_observation", independenceGroupId: "group", independence: "reviewed_independent",
      constructRelationshipId: "construct", qualificationDecisionId: "q2", reviewDecisionId: "r2",
      equipmentId: "equipment", equipmentVariantId: "variant" },
    authority: { role: "supporting_context", directEvidenceContribution: 0, canonicalValueCreated: false,
      numericValueCreated: false, synthesisEligibilityGranted: false, recommendationAuthorityGranted: false } };
}

test("projection deterministically separates current and historical without granting evidence authority", async () => {
  let snapshots = 0;
  const repository: GovernedSupportingContextProjectionRepository = {
    async readSnapshot(operation) { snapshots++; return operation(this); },
    async load() { return [entry("later", "historical", "2026-09-02T00:00:00.000Z"), entry("earlier", "current", "2026-09-01T00:00:00.000Z")]; }
  };
  const service = new GovernedSupportingContextProjectionService(repository);
  const first = await service.loadGovernedSupportingContext(request);
  const second = await service.loadGovernedSupportingContext(request);
  assert.deepEqual(first, second);
  assert.equal(snapshots, 2);
  assert.deepEqual(first.current.map(item => item.decisionId), ["earlier"]);
  assert.deepEqual(first.historical.map(item => item.decisionId), ["later"]);
  assert.deepEqual(first.exclusions, [{ decisionId: "later", reasons: ["review_not_current"] }]);
  const overlay = toGovernedSupportingContextOverlay(first);
  assert.equal(overlay.role, "supporting_context");
  assert.equal(overlay.directEvidenceCountContribution, 0);
  assert.equal(overlay.canonicalValueCreated, false);
  assert.equal(overlay.numericValueCreated, false);
  assert.equal(overlay.synthesisEligibilityGranted, false);
  assert.equal(overlay.recommendationAuthorityGranted, false);
  assert.equal("evidenceClass" in overlay.entries[0]!, false);
});
