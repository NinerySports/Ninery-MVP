import assert from "node:assert/strict";
import test from "node:test";
import { attachExternalExpertSupportingCoverage, buildEquipmentDNAEvidenceReadModel, buildExternalExpertSupportingRoleSimulation, evaluateExternalExpertSupportingRole, externalExpertSupportingRoleEligibleConstructs, multiSourceEvidenceClassValues, summarizeExternalExpertSupportingCoverage } from "../index.js";
import type { ExternalExpertSupportingRoleInput } from "../index.js";

const valid: ExternalExpertSupportingRoleInput = { observationId: "synthetic-approved-01", sourceType: "independent_expert_review", claimType: "subjective_observation", dependencyType: "independent_observation", independenceGroupId: "synthetic-independent-lineage", identityCertainty: "equipment_model_match", identityScope: "drop_family", identityApplicable: true, identityChecks: { manufacturer: true, model: true, modelYear: true, certification: true, productFamily: true, drop: true }, construct: "startup_demand", mappingConfidence: "high", qualificationState: "context_only", verificationState: "active", reviewState: "reviewed_accepted", approvalActor: "human", direction: "lower" };

test("keeps the six evidence classes unchanged and role separate", () => {
  assert.deepEqual(multiSourceEvidenceClassValues, ["verified_catalog_fact", "direct_physical_measurement", "controlled_mechanical_test", "structured_human_evaluation", "structured_field_observation", "modeled_estimate"]);
  const result = evaluateExternalExpertSupportingRole(valid);
  assert.equal(result.role, "supporting_context"); assert.equal(result.directEvidenceContribution, 0); assert.equal(result.canonicalValueCreated, false); assert.equal(result.numericValueCreated, false);
});

test("only the two calibrated constructs are eligible", () => {
  assert.deepEqual(externalExpertSupportingRoleEligibleConstructs, ["startup_demand", "rotational_demand"]);
  for (const construct of externalExpertSupportingRoleEligibleConstructs) assert.equal(evaluateExternalExpertSupportingRole({ ...valid, construct }).eligible, true);
  for (const construct of ["barrel_redirect_demand", "directional_adjustment_control", "barrel_path_repeatability", "start_stop_redirect_control", "center_response_baseline", "handle_side_miss_tolerance", "end_side_miss_tolerance", "response_degradation", "usable_contact_region_breadth", "centered_response_consistency", "near_center_response_consistency"]) assert.ok(evaluateExternalExpertSupportingRole({ ...valid, construct }).blockers.includes("CONSTRUCT_NOT_ELIGIBLE"));
});

test("fails closed across provenance, identity, mapping, qualification, and review gates", () => {
  const cases: readonly [Partial<ExternalExpertSupportingRoleInput>, string][] = [
    [{ sourceType: "manufacturer_primary" }, "SOURCE_NOT_EXTERNAL_EXPERT"], [{ claimType: "marketing_claim" }, "MARKETING_CONTENT"], [{ claimType: "factual_specification" }, "NOT_BEHAVIORAL_OBSERVATION"],
    [{ dependencyType: "unknown_dependency" }, "SOURCE_DEPENDENCY_UNKNOWN"], [{ dependencyType: "shared_upstream" }, "SOURCE_DEPENDENT"], [{ identityCertainty: "ambiguous" }, "IDENTITY_UNRESOLVED"],
    [{ identityApplicable: false }, "IDENTITY_SCOPE_INSUFFICIENT"], [{ identityChecks: { ...valid.identityChecks, certification: false } }, "IDENTITY_SCOPE_INSUFFICIENT"], [{ identityChecks: { ...valid.identityChecks, modelYear: false } }, "IDENTITY_SCOPE_INSUFFICIENT"], [{ identityChecks: { ...valid.identityChecks, variant: false } }, "IDENTITY_SCOPE_INSUFFICIENT"],
    [{ mappingConfidence: "medium" }, "MAPPING_NOT_HIGH_CONFIDENCE"], [{ mappingConfidence: "low" }, "MAPPING_NOT_HIGH_CONFIDENCE"],
    [{ qualificationState: "not_eligible" }, "QUALIFICATION_NOT_ELIGIBLE"], [{ reviewState: "review_pending", approvalActor: undefined }, "HUMAN_REVIEW_REQUIRED"],
    [{ reviewState: "reviewed_rejected" }, "HUMAN_REVIEW_REJECTED"], [{ approvalActor: "ai" }, "HUMAN_REVIEW_REQUIRED"], [{ verificationState: "superseded" }, "CLAIM_SUPERSEDED"], [{ verificationState: "conflicting" }, "CLAIM_CONFLICT_REQUIRES_REVIEW"]
  ];
  for (const [change, blocker] of cases) { const result = evaluateExternalExpertSupportingRole({ ...valid, ...change }); assert.equal(result.eligible, false); assert.ok(result.blockers.includes(blocker as never)); }
});

test("preserves direction, comparison scope, policy version, and all firewalls", () => {
  const result = evaluateExternalExpertSupportingRole({ ...valid, claimType: "comparative_observation", direction: "comparative_only", comparisonTarget: "Bat X", identityScope: "equipment_family" });
  assert.equal(result.comparisonTarget, "Bat X"); assert.equal(result.direction, "comparative_only"); assert.equal(result.identityScope, "equipment_family");
  assert.equal(result.policyVersion, "1.0-provisional"); assert.equal(result.policyStatus, "PROVISIONAL_CONSTRUCT_SPECIFIC_POLICY"); assert.equal(result.synthesisEligibilityGranted, false); assert.equal(result.recommendationInputCreated, false);
});

test("counts supporting lineages without inflating direct evidence or synthesis", () => {
  const decisions = [evaluateExternalExpertSupportingRole(valid), evaluateExternalExpertSupportingRole({ ...valid, observationId: "synthetic-approved-02" }), evaluateExternalExpertSupportingRole({ ...valid, observationId: "synthetic-approved-03", independenceGroupId: "second-lineage", construct: "rotational_demand" })];
  const coverage = summarizeExternalExpertSupportingCoverage(decisions);
  assert.equal(coverage.supportingRecordCount, 3); assert.equal(coverage.independentSupportingSourceCount, 2); assert.equal(coverage.directEvidenceCountContribution, 0); assert.equal(coverage.synthesisEligibilityGranted, false);
  const base = buildEquipmentDNAEvidenceReadModel({ identity: { equipmentId: "equipment-1", manufacturer: "Test", model: "Bat" }, catalogFacts: [], records: [] });
  const decorated = attachExternalExpertSupportingCoverage(base, decisions);
  assert.deepEqual(decorated.evidenceClassCounts, base.evidenceClassCounts); assert.equal(decorated.supportingRoleCoverage.supportingRecordCount, 3);
});

test("Atlas and DeMarini simulations use pending and hypothetical approval without persistence", () => {
  const first = buildExternalExpertSupportingRoleSimulation(); const second = buildExternalExpertSupportingRoleSimulation();
  assert.deepEqual(first, second); assert.equal(first.firewalls.persisted, false); assert.equal(first.firewalls.realApprovalCreated, false);
  assert.ok(first.atlas.totalExternalObservations > 0); assert.ok(first.demarini.totalExternalObservations > 0);
  assert.equal(first.atlas.pendingDecisions.some((item) => item.eligible), false); assert.equal(first.demarini.pendingDecisions.some((item) => item.eligible), false);
});
