import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzePhysicalEvaluationProtocolCalibration,
  validatePhysicalEvaluationProtocolCalibrationPolicy,
  type BehavioralEvidenceRecord
} from "../behavioral/index.js";

test("narrow usable region and strong centered response are construct divergence", () => {
  const report = analyzePhysicalEvaluationProtocolCalibration(input(five("sweet_spot_support", "moderate", {
    usable_contact_region: "low",
    centered_response_consistency: "high",
    near_center_response_consistency: "high"
  })));
  const result = attribute(report, "sweet_spot_support");
  assert.equal(result.disagreementType, "construct_divergence");
  assert.equal(result.constructCoherence, "possible_construct_conflation");
  assert.equal(result.collectionDecision, "construct_review_required");
  assert.equal(result.evaluationSixRecommended, false);
});

test("same-dimension disagreement remains evaluator disagreement", () => {
  const evidence = ["low", "low", "moderate", "high", "very_high"].map((value, index) => standalone(
    `e${index + 1}`,
    "swing_effort",
    value,
    { startup_demand: value, rotational_demand: "moderate", barrel_redirect_demand: "moderate" }
  ));
  const result = attribute(analyzePhysicalEvaluationProtocolCalibration(input(evidence)), "swing_effort");
  assert.equal(result.disagreementType, "evaluator_disagreement");
  assert.equal(result.constructCoherence, "protocol_sensitive");
  assert.equal(result.collectionDecision, "pause_for_protocol_review");
});

test("response degradation is inverted without changing historical evidence", () => {
  const evidence = five("forgiveness", "low", {
    off_center_response_consistency: "low",
    handle_side_miss_tolerance: "low",
    end_side_miss_tolerance: "low",
    response_degradation: "high"
  });
  const before = JSON.stringify(evidence);
  const result = attribute(analyzePhysicalEvaluationProtocolCalibration(input(evidence)), "forgiveness");
  const degradation = result.dimensions.find((item) => item.dimensionKey === "response_degradation");
  assert.equal(degradation?.inverseDimensionHandling, true);
  assert.equal(degradation?.modalOrdinal, "low");
  assert.equal(JSON.stringify(evidence), before);
});

test("possible outliers are diagnostic only and do not authorize writes", () => {
  const evidence = ["moderate", "moderate", "moderate", "moderate", "very_high"].map((value, index) => standalone(
    `e${index + 1}`,
    "bat_control_support",
    value,
    { directional_controllability: value, barrel_path_manageability: "moderate", start_stop_controllability: "moderate" }
  ));
  const report = analyzePhysicalEvaluationProtocolCalibration(input(evidence));
  const outlier = attribute(report, "bat_control_support").dimensions[0]?.possibleOutliers[0];
  assert.equal(outlier?.classification, "possible_outlier_observation");
  assert.equal(outlier?.diagnosticOnly, true);
  assert.equal(report.canonicalEvaluationsCreated, 0);
  assert.equal(report.numericReferencesCreated, 0);
  assert.equal(report.recommendationBehaviorChanged, false);
  assert.equal(report.writesPerformed, false);
});

test("comparative evidence remains corroborating and non-dispositive", () => {
  const report = analyzePhysicalEvaluationProtocolCalibration({
    ...input(five("bat_control_support", "low", control("low"))),
    comparativeAttributes: [{
      attributeKey: "bat_control_support", evidenceCount: 2, sessionCount: 2, independentSourceCount: 2,
      dimensionResults: [], comparativeDirection: "clearly_less_support", consensusStrength: "strong",
      materialConflict: false, conflictingDimensions: [], supportingDimensions: ["directional_controllability"],
      referenceContext: { referenceAnchored: false, limitations: [] }, confidence: "moderate",
      canonicalInterpretationStatus: "deferred_reference_unanchored", limitations: [],
      nextEvidenceAction: "onboard_and_anchor_reference_equipment", synthesisVersion: "1.0",
      consensusPolicyVersion: "1.0", canonicalGateVersion: "1.0"
    }]
  });
  assert.equal(attribute(report, "bat_control_support").comparativeEvidenceRole, "corroborating_non_dispositive");
});

test("repeated calibration is deterministic and policy validates", () => {
  const fixture = input(five("swing_effort", "moderate", swing("moderate")));
  assert.deepEqual(analyzePhysicalEvaluationProtocolCalibration(fixture), analyzePhysicalEvaluationProtocolCalibration(fixture));
  assert.equal(validatePhysicalEvaluationProtocolCalibrationPolicy().verdict, "pass");
});

function input(evidence: readonly BehavioralEvidenceRecord[]) {
  return { equipmentId: "6cf0f7fa-c8c2-4ce7-a36e-6ad1c52cc56c", equipmentLabel: "2023 DeMarini The Goods", evidence };
}
function attribute(report: ReturnType<typeof analyzePhysicalEvaluationProtocolCalibration>, key: string) {
  const value = report.attributes.find((item) => item.attributeKey === key); assert.ok(value); return value;
}
function five(key: BehavioralEvidenceRecord["attributeKey"], ordinal: string, dimensions: Record<string, string>) {
  return Array.from({ length: 5 }, (_, index) => standalone(`e${index + 1}`, key, ordinal, dimensions));
}
function standalone(evaluator: string, key: BehavioralEvidenceRecord["attributeKey"], ordinal: string, dimensions: Record<string, string>): BehavioralEvidenceRecord {
  return { id: `${evaluator}-${key}`, attributeKey: key, category: "structured_internal_equipment_evaluation", timing: "prospective_equipment_evidence",
    sourceName: "Ninery Physical Evaluation", sourceReference: `physical-bat-evaluation:1.0:${evaluator}:${key}`, independenceGroup: evaluator,
    rawValue: { sessionId: evaluator, evaluationMode: "standalone", interpretationMode: "standalone_absolute", dimensions: Object.entries(dimensions).map(([dimensionKey, observation]) => ({ key: dimensionKey, observation })) },
    ordinalValue: ordinal, notes: "immutable fixture" };
}
function swing(value: string) { return { startup_demand: value, rotational_demand: value, barrel_redirect_demand: value }; }
function control(value: string) { return { directional_controllability: value, barrel_path_manageability: value, start_stop_controllability: value }; }

