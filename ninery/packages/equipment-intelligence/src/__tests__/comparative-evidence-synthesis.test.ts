import assert from "node:assert/strict";
import test from "node:test";
import {
  COMPARATIVE_EVIDENCE_SYNTHESIS_VERSION,
  synthesizeComparativeBehavioralEvidence,
  validateComparativeEvidenceSynthesisPolicy,
  type BehavioralEvidenceRecord
} from "../behavioral/index.js";

test("two agreeing independent sources produce strong directional consensus without canonical promotion", () => {
  const report = synthesizeComparativeBehavioralEvidence(baseInput([
    evidence("a", "swing_effort", "eval-a", [["startup_demand", "somewhat_more"]]),
    evidence("b", "swing_effort", "eval-b", [["startup_demand", "somewhat_more"]])
  ]));
  const swing = report.attributes.find((item) => item.attributeKey === "swing_effort");
  assert.equal(report.version, COMPARATIVE_EVIDENCE_SYNTHESIS_VERSION);
  assert.equal(swing?.comparativeDirection, "clearly_more_demand");
  assert.equal(swing?.consensusStrength, "strong");
  assert.equal(swing?.canonicalInterpretationStatus, "deferred_reference_unanchored");
  assert.equal(swing?.canonicalOrdinal, undefined);
  assert.equal(swing?.numericReference, undefined);
});

test("same evaluator twice does not count as two independent sources", () => {
  const report = synthesizeComparativeBehavioralEvidence(baseInput([
    evidence("a", "bat_control_support", "eval-a", [["path_consistency", "somewhat_less"]]),
    evidence("b", "bat_control_support", "eval-a", [["path_consistency", "somewhat_less"]])
  ]));
  const control = report.attributes.find((item) => item.attributeKey === "bat_control_support");
  assert.equal(control?.independentSourceCount, 1);
  assert.equal(control?.consensusStrength, "weak");
  assert.equal(control?.nextEvidenceAction, "collect_third_independent_comparative_evaluation");
});

test("similar plus somewhat_more is directional but not material conflict", () => {
  const report = synthesizeComparativeBehavioralEvidence(baseInput([
    evidence("a", "swing_effort", "eval-a", [["rotational_demand", "somewhat_more"]]),
    evidence("b", "swing_effort", "eval-b", [["rotational_demand", "similar"]])
  ]));
  const dimension = report.attributes.find((item) => item.attributeKey === "swing_effort")?.dimensionResults[0];
  assert.equal(dimension?.direction, "more_or_similar");
  assert.equal(dimension?.materialConflict, false);
});

test("opposing directions are preserved and clearly opposite directions are material", () => {
  const minor = synthesizeComparativeBehavioralEvidence(baseInput([
    evidence("a", "forgiveness", "eval-a", [["vibration_feedback", "somewhat_more"]]),
    evidence("b", "forgiveness", "eval-b", [["vibration_feedback", "somewhat_less"]])
  ])).attributes.find((item) => item.attributeKey === "forgiveness");
  assert.deepEqual(minor?.conflictingDimensions, ["vibration_feedback"]);
  assert.equal(minor?.materialConflict, false);

  const material = synthesizeComparativeBehavioralEvidence(baseInput([
    evidence("a", "forgiveness", "eval-a", [["vibration_feedback", "clearly_more"]]),
    evidence("b", "forgiveness", "eval-b", [["vibration_feedback", "clearly_less"]])
  ])).attributes.find((item) => item.attributeKey === "forgiveness");
  assert.equal(material?.materialConflict, true);
  assert.equal(material?.canonicalInterpretationStatus, "deferred_material_conflict");
});

test("real DeMarini two-session pattern synthesizes directional evidence while staying canonical-deferred", () => {
  const report = synthesizeComparativeBehavioralEvidence(baseInput(realDemariniEvidence()));
  assert.equal(report.physicalSessionCount, 2);
  assert.equal(report.independentEvaluatorCount, 2);
  assert.equal(report.evidenceCount, 8);

  const swing = report.attributes.find((item) => item.attributeKey === "swing_effort");
  assert.equal(swing?.comparativeDirection, "clearly_more_demand");
  assert.equal(swing?.consensusStrength, "strong");
  assert.equal(swing?.canonicalInterpretationStatus, "deferred_reference_unanchored");
  assert.equal(swing?.nextEvidenceAction, "onboard_and_anchor_reference_equipment");

  const control = report.attributes.find((item) => item.attributeKey === "bat_control_support");
  assert.equal(control?.comparativeDirection, "clearly_less_support");
  assert.equal(control?.consensusStrength, "strong");

  const forgiveness = report.attributes.find((item) => item.attributeKey === "forgiveness");
  assert.deepEqual(forgiveness?.conflictingDimensions, ["vibration_feedback"]);
  assert.equal(forgiveness?.canonicalInterpretationStatus, "deferred_reference_unanchored");

  const sweetSpot = report.attributes.find((item) => item.attributeKey === "sweet_spot_support");
  assert.deepEqual(sweetSpot?.conflictingDimensions, ["barrel_response_consistency"]);
  assert.equal(sweetSpot?.numericReference, undefined);
  assert.equal(report.liveRecommendationActivationAllowed, false);
});

test("synthesis validation keeps live and numeric boundaries explicit", () => {
  const validation = validateComparativeEvidenceSynthesisPolicy();
  assert.equal(validation.verdict, "pass");
  assert.ok(validation.checks.some((check) => check.name === "numeric references are not synthesized" && check.passed));
});

function baseInput(evidence: readonly BehavioralEvidenceRecord[]) {
  return {
    equipmentId: "6cf0f7fa-c8c2-4ce7-a36e-6ad1c52cc56c",
    equipmentLabel: "2023 DeMarini The Goods",
    variantLabel: "DEM-THE-GOODS-USA-30-20",
    evidence
  };
}

function realDemariniEvidence(): BehavioralEvidenceRecord[] {
  return [
    evidence("s1-swing", "swing_effort", "internal-equipment-evaluator", [
      ["startup_demand", "somewhat_more"],
      ["rotational_demand", "somewhat_more"],
      ["barrel_redirect", "clearly_more"]
    ], "demarini-omaha-physical-evaluation-01"),
    evidence("s1-control", "bat_control_support", "internal-equipment-evaluator", [
      ["direction_changes", "somewhat_less"],
      ["start_stop_manageability", "somewhat_less"],
      ["path_consistency", "somewhat_less"]
    ], "demarini-omaha-physical-evaluation-01"),
    evidence("s1-forgiveness", "forgiveness", "internal-equipment-evaluator", [
      ["varied_contact_regions", "somewhat_less"],
      ["mishit_response", "somewhat_less"],
      ["vibration_feedback", "somewhat_more"]
    ], "demarini-omaha-physical-evaluation-01"),
    evidence("s1-sweet", "sweet_spot_support", "internal-equipment-evaluator", [
      ["usable_response_region", "somewhat_less"],
      ["barrel_response_consistency", "somewhat_less"],
      ["contact_location_variation", "somewhat_less"]
    ], "demarini-omaha-physical-evaluation-01"),
    evidence("s2-swing", "swing_effort", "experienced-player-evaluator", [
      ["startup_demand", "somewhat_more"],
      ["rotational_demand", "similar"],
      ["barrel_redirect", "clearly_more"]
    ], "demarini-omaha-physical-evaluation-02"),
    evidence("s2-control", "bat_control_support", "experienced-player-evaluator", [
      ["direction_changes", "similar"],
      ["start_stop_manageability", "somewhat_less"],
      ["path_consistency", "somewhat_less"]
    ], "demarini-omaha-physical-evaluation-02"),
    evidence("s2-forgiveness", "forgiveness", "experienced-player-evaluator", [
      ["varied_contact_regions", "similar"],
      ["mishit_response", "somewhat_less"],
      ["vibration_feedback", "somewhat_less"]
    ], "demarini-omaha-physical-evaluation-02"),
    evidence("s2-sweet", "sweet_spot_support", "experienced-player-evaluator", [
      ["usable_response_region", "clearly_less"],
      ["barrel_response_consistency", "somewhat_more"],
      ["contact_location_variation", "somewhat_less"]
    ], "demarini-omaha-physical-evaluation-02")
  ];
}

function evidence(
  id: string,
  attributeKey: BehavioralEvidenceRecord["attributeKey"],
  evaluatorId: string,
  dimensions: readonly (readonly [string, "clearly_less" | "somewhat_less" | "similar" | "somewhat_more" | "clearly_more"])[],
  sessionId = id
): BehavioralEvidenceRecord {
  return {
    id,
    attributeKey,
    category: "structured_internal_equipment_evaluation",
    timing: "prospective_equipment_evidence",
    sourceName: "Ninery Structured Physical Bat Evaluation Protocol",
    sourceReference: `physical-bat-evaluation:1.0:${sessionId}:${attributeKey}`,
    independenceGroup: evaluatorId,
    rawValue: {
      sessionId,
      interpretationMode: "relative_only",
      canonicalInterpretationStatus: "deferred",
      evaluatorConfidence: "medium",
      references: [
        {
          referenceType: "verified_external_reference",
          label: "2023 Louisville Slugger Omaha USA 30/19/-11",
          limitations: [
            "Reference differs by 1 oz and one drop unit from target equipment.",
            "Reference is an evaluation instrument only and has no recommendation/catalog authority."
          ]
        }
      ],
      comparisonObservations: dimensions.map(([key, observation]) => ({ key, observation }))
    },
    notes: "test evidence"
  };
}
