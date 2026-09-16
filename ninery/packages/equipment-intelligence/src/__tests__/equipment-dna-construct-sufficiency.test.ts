import assert from "node:assert/strict";
import test from "node:test";
import { assessEquipmentDNAConstructSynthesisReadiness, buildEquipmentDNAEvidenceReadModel, equipmentDNAConstructSufficiencyProfiles, type EquipmentDNAConstructSufficiencyProfile, type EquipmentDNAEvidenceRecordInput } from "../index.js";

const equipmentId = "equipment-01"; const variantId = "variant-01";

test("support availability remains separate from synthesis readiness", () => {
  const result = assess(model([human("startup_demand", "evaluator-1", "session-1")]));
  const item = get(result, "startup_demand");
  assert.equal(item.supportState, "single_source_support");
  assert.equal(item.readiness, "emerging_evidence");
  assert.equal(item.synthesisPolicyState, "not_established");
  assert.ok(item.blockers.some((blocker) => blocker.code === "synthesis_policy_not_established"));
});

test("no evidence and supporting-only evidence cannot become synthesis eligible", () => {
  const empty = assess(model([]));
  assert.equal(get(empty, "startup_demand").readiness, "insufficient_evidence");
  const supporting = assess(model([human("center_response_baseline", "evaluator-1", "session-1")]));
  assert.equal(get(supporting, "center_response_baseline").supportState, "single_source_support");
  assert.equal(get(supporting, "center_response_baseline").readiness, "insufficient_evidence");
});

test("record and session counts do not inflate same-evaluator independence", () => {
  const result = assess(model([human("startup_demand", "same", "one"), human("startup_demand", "same", "two")]));
  const item = get(result, "startup_demand");
  assert.equal(item.recordCount, 2);
  assert.equal(item.sessionCount, 2);
  assert.equal(item.sourceOrEvaluatorCount, 1);
  assert.equal(item.independentSourceCount, 1);
  assert.equal(item.corroboration, "same_source_repeat");
  assert.equal(item.readiness, "emerging_evidence");
});

test("persisted repeat-evaluator contribution does not add an independent source", () => {
  const record = human("startup_demand", "repeat", "repeat-session");
  const repeat = { ...record, rawValue: { ...(record.rawValue as Record<string, unknown>), independentSourceContribution: 0, evaluatorRelationship: "repeat_evaluator" } };
  const item = get(assess(model([repeat])), "startup_demand");
  assert.equal(item.sourceOrEvaluatorCount, 1);
  assert.equal(item.independentSourceCount, 0);
  assert.equal(item.readiness, "emerging_evidence");
});

test("multiple independent support does not override an unestablished policy", () => {
  const result = assess(model([human("startup_demand", "one", "one"), human("startup_demand", "two", "two")]));
  const item = get(result, "startup_demand");
  assert.equal(item.supportState, "multiple_source_support");
  assert.equal(item.independentSourceCount, 2);
  assert.equal(item.readiness, "emerging_evidence");
});

test("physical and catalog context never satisfy behavioral constructs", () => {
  const result = assess(model([physical("actual_mass"), physical("balance_point"), physical("barrel_diameter")]));
  assert.equal(get(result, "startup_demand").readiness, "insufficient_evidence");
  assert.equal(get(result, "rotational_demand").readiness, "insufficient_evidence");
  assert.equal(get(result, "usable_contact_region_breadth").readiness, "insufficient_evidence");
  assert.equal(get(result, "startup_demand").independentSourceCount, 0);
});

test("candidate contact-region and centered-response constructs remain separate", () => {
  const result = assess(model([human("usable_contact_region_breadth", "one", "one", "low"), human("centered_response_consistency", "one", "one", "high")]));
  assert.notEqual(get(result, "usable_contact_region_breadth").construct, get(result, "centered_response_consistency").construct);
  assert.equal(result.constructs.some((item) => item.construct === "sweet_spot_score"), false);
});

test("response degradation retains inverse semantics without synthesis", () => {
  const item = get(assess(model([human("response_degradation", "one", "one", "high")])), "response_degradation");
  assert.ok(item.explanation.some((line) => line.includes("Higher degradation means less forgiveness")));
  assert.equal("synthesizedValue" in item, false);
});

test("provisional and established policies qualify only through explicit requirements", () => {
  const base = equipmentDNAConstructSufficiencyProfiles.find((item) => item.construct === "startup_demand")!;
  const provisional: EquipmentDNAConstructSufficiencyProfile = { ...base, synthesisPolicyState: "provisional", synthesisCurrentlyPermitted: true, requiredEvidenceClasses: ["structured_human_evaluation"], minimumIndependentSources: 1, requiredProtocolVersions: ["1.1"], crossEquipmentRequirement: "none" };
  assert.equal(get(assess(model([human("startup_demand", "one", "one")]), [provisional]), "startup_demand").readiness, "synthesis_eligible");
  const established: EquipmentDNAConstructSufficiencyProfile = { ...provisional, synthesisPolicyState: "established", crossEquipmentRequirement: "cross_equipment_started" };
  const blocked = get(assess(model([human("startup_demand", "one", "one")]), [established]), "startup_demand");
  assert.equal(blocked.readiness, "emerging_evidence");
  assert.ok(blocked.gaps.some((gap) => gap.code === "cross_equipment_calibration_not_started"));
  const eligible = assessEquipmentDNAConstructSynthesisReadiness({ readModel: model([human("startup_demand", "one", "one")]), profiles: [established], crossEquipmentCalibrationState: "cross_equipment_started", equipmentCoverageCount: 2 });
  assert.equal(get(eligible, "startup_demand").readiness, "synthesis_eligible");
  assert.notEqual(eligible.crossEquipmentCalibrationState, "validated");
});

test("unresolved evidence status requires review while ordinary gaps do not", () => {
  const disputed = { ...human("startup_demand", "one", "one"), status: "disputed" };
  assert.equal(get(assess(model([disputed])), "startup_demand").readiness, "review_required");
  assert.notEqual(get(assess(model([])), "startup_demand").readiness, "review_required");
});

test("protocol provenance and safety firewalls remain intact", () => {
  const result = assess(model([human("startup_demand", "one", "v10", "moderate", "1.0"), human("startup_demand", "one", "v11", "moderate", "1.1")]));
  assert.deepEqual(get(result, "startup_demand").protocolVersions, ["1.0", "1.1"]);
  assert.equal(get(result, "startup_demand").independentSourceCount, 1);
  assert.deepEqual(result.firewalls, { canonicalChanges: false, numericReferenceChanges: false, modeledEstimatesCreated: false, recommendationImpact: "none", writesPerformed: false, behavioralSynthesisPerformed: false });
  assert.equal(JSON.stringify(result).includes(":50"), false);
});

function assess(readModel: ReturnType<typeof model>, profiles?: readonly EquipmentDNAConstructSufficiencyProfile[]) { return assessEquipmentDNAConstructSynthesisReadiness({ readModel, profiles, crossEquipmentCalibrationState: "single_equipment_only", equipmentCoverageCount: 1 }); }
function get(result: ReturnType<typeof assessEquipmentDNAConstructSynthesisReadiness>, construct: string) { return result.constructs.find((item) => item.construct === construct)!; }
function model(records: readonly EquipmentDNAEvidenceRecordInput[]) { return buildEquipmentDNAEvidenceReadModel({ identity: { equipmentId, manufacturer: "Test", model: "Bat", variant: { id: variantId, lengthInches: 30, weightOunces: 20, dropWeight: -10 } }, catalogFacts: [{ key: "construction", value: "hybrid", level: "equipment", sourceName: "catalog" }], records }); }
function human(dimensionKey: string, evaluatorReference: string, sessionId: string, observation = "moderate", protocolVersion = "1.1"): EquipmentDNAEvidenceRecordInput { return { id: `${dimensionKey}:${sessionId}`, equipmentId, equipmentVariantId: variantId, targetLevel: "equipment", attributeKey: dimensionKey.includes("demand") ? "swing_effort" : "sweet_spot_support", sourceType: "structured_expert_evaluation", sourceName: "protocol", sourceReference: `physical-bat-evaluation:${protocolVersion}:${sessionId}:${dimensionKey}`, sourceDate: "2026-09-01", method: "standardized_rubric", rawValue: { dimensionKey, sessionId, protocolVersion, observation, studyClassification: "protocol_calibration_evidence" }, status: "active", evaluatorReference }; }
function physical(attributeKey: string): EquipmentDNAEvidenceRecordInput { return { id: attributeKey, equipmentId, equipmentVariantId: variantId, targetLevel: "variant", attributeKey, sourceType: "objective_measurement", sourceName: "physical protocol", sourceReference: `physical-measurement:session:${attributeKey}`, sourceDate: "2026-09-01", method: "instrument_measurement", rawValue: { specimenReference: "specimen", measurementSessionId: "session", aggregate: 1 }, normalizedValue: { value: 1, unit: "grams" }, status: "active", evaluatorReference: "operator" }; }
