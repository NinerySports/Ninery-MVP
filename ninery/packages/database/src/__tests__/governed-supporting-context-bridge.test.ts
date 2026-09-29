import assert from "node:assert/strict";
import test from "node:test";
import { governedSupportingContextIdempotencyKey } from "../governed-supporting-context-bridge.js";

const lineage = {
  rawClaimId: "raw", normalizedClaimId: "normalized", dependencyAssessmentId: "d2",
  constructRelationshipId: "c2", qualificationDecisionId: "q2", reviewDecisionId: "r2",
  interpretation: { version: "1.0" as const, policyVersion: "1.0-provisional" as const, construct: "startup_demand", role: "supporting_context" as const,
    identityScope: "exact_variant" as const, direction: "lower" as const }
};
const options = { identityScope: "exact_variant" as const, direction: "lower" as const };

test("bridge idempotency identity is deterministic and binds every governed decision", () => {
  const key = governedSupportingContextIdempotencyKey(lineage, options);
  assert.equal(key, governedSupportingContextIdempotencyKey({ ...lineage }, { ...options }));
  assert.match(key, /^governed-supporting:[a-f0-9]{64}$/);
  for (const field of ["rawClaimId", "normalizedClaimId", "dependencyAssessmentId", "constructRelationshipId", "qualificationDecisionId", "reviewDecisionId"] as const) {
    assert.notEqual(key, governedSupportingContextIdempotencyKey({ ...lineage, [field]: "successor" }, options));
  }
  assert.notEqual(key, governedSupportingContextIdempotencyKey(lineage, { ...options, direction: "higher" }));
  assert.notEqual(key, governedSupportingContextIdempotencyKey(lineage, { ...options, identityScope: "drop_family" }));
  assert.notEqual(key, governedSupportingContextIdempotencyKey(lineage, { ...options, comparisonTarget: "other bat" }));
});
