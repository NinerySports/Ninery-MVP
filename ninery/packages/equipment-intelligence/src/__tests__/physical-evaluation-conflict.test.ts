import assert from "node:assert/strict";
import test from "node:test";
import {
  PHYSICAL_EVALUATION_CONFLICT_ADJUDICATION_VERSION,
  analyzePhysicalEvaluationConflicts,
  buildPhysicalEvaluationAdjudicationPlan,
  validatePhysicalEvaluationConflictAdjudicationPolicy,
  type BehavioralEvidenceRecord
} from "../behavioral/index.js";

test("exact agreement produces no unnecessary adjudication", () => {
  const report = analyzePhysicalEvaluationConflicts(baseInput([
    standalone("a", "bat_control_support", "eval-a", "moderate"),
    standalone("b", "bat_control_support", "eval-b", "moderate")
  ]));
  const control = attribute(report, "bat_control_support");
  assert.equal(report.version, PHYSICAL_EVALUATION_CONFLICT_ADJUDICATION_VERSION);
  assert.equal(control.conflictSeverity, "none");
  assert.deepEqual(control.conflictClassifications, ["resolved"]);
  assert.equal(control.adjudicationStatus, "no_adjudication_required");
  assert.equal(control.nextEvidence, undefined);
  assert.equal(report.canonicalEvaluationsCreated, 0);
  assert.equal(report.numericReferencesCreated, 0);
});

test("adjacent disagreement produces bounded targeted adjudication without stale third-evaluator wording", () => {
  const report = analyzePhysicalEvaluationConflicts(baseInput([
    standalone("a", "bat_control_support", "eval-a", "moderate"),
    standalone("b", "bat_control_support", "eval-b", "moderate"),
    standalone("c", "bat_control_support", "eval-c", "low", undefined, {
      directional_controllability: "low",
      barrel_path_manageability: "moderate",
      start_stop_controllability: "moderate"
    })
  ]));
  const control = attribute(report, "bat_control_support");
  assert.equal(control.conflictSeverity, "adjacent");
  assert.ok(control.conflictClassifications.includes("ordinal_disagreement"));
  assert.equal(control.adjudicationStatus, "targeted_retest_required");
  assert.ok(control.nextEvidence);
  assert.equal(JSON.stringify(control).includes("third evaluator required"), false);
});

test("material and severe disagreement block canonical resolution and cannot be averaged", () => {
  const report = analyzePhysicalEvaluationConflicts(baseInput([
    standalone("a", "forgiveness", "eval-a", "low"),
    standalone("b", "forgiveness", "eval-b", "low"),
    standalone("c", "forgiveness", "eval-c", "very_high", undefined, {
      off_center_response_consistency: "very_high",
      handle_side_miss_tolerance: "high",
      end_side_miss_tolerance: "very_high",
      response_degradation: "very_low"
    })
  ]));
  const forgiveness = attribute(report, "forgiveness");
  assert.equal(forgiveness.conflictSeverity, "severe");
  assert.ok(forgiveness.conflictClassifications.includes("possible_evaluator_outlier"));
  assert.equal(forgiveness.canonicalPromotionStatus, "not_allowed_by_conflict_analysis");
  assert.equal(forgiveness.resolutionCandidate, undefined);
  assert.notEqual(forgiveness.observedOrdinals.join(","), "moderate");
});

test("raw dimension disagreement is surfaced and response_degradation uses inverse semantics", () => {
  const report = analyzePhysicalEvaluationConflicts(baseInput([
    standalone("a", "forgiveness", "eval-a", "low", undefined, {
      off_center_response_consistency: "low",
      handle_side_miss_tolerance: "low",
      end_side_miss_tolerance: "low",
      response_degradation: "high"
    }),
    standalone("b", "forgiveness", "eval-b", "low", undefined, {
      off_center_response_consistency: "low",
      handle_side_miss_tolerance: "low",
      end_side_miss_tolerance: "low",
      response_degradation: "high"
    })
  ]));
  const degradation = attribute(report, "forgiveness").dimensionAnalysis.find((item) => item.dimensionKey === "response_degradation");
  assert.equal(degradation?.observations[0]?.rawObservation, "high");
  assert.equal(degradation?.observations[0]?.normalizedConstructValue, "low");
  assert.equal(degradation?.observations[0]?.inverseSemanticsApplied, true);
});

test("sweet spot internal divergence flags possible construct conflation", () => {
  const report = analyzePhysicalEvaluationConflicts(baseInput([
    standalone("a", "sweet_spot_support", "eval-a", "moderate"),
    standalone("b", "sweet_spot_support", "eval-b", "high", undefined, {
      usable_contact_region: "moderate",
      centered_response_consistency: "high",
      near_center_response_consistency: "high"
    }),
    standalone("c", "sweet_spot_support", "eval-c", "very_high", undefined, {
      usable_contact_region: "low",
      centered_response_consistency: "very_high",
      near_center_response_consistency: "very_high"
    })
  ]));
  const sweet = attribute(report, "sweet_spot_support");
  assert.ok(sweet.conflictClassifications.includes("possible_construct_conflation"));
  assert.equal(sweet.adjudicationStatus, "construct_review_required");
  assert.ok(sweet.nextEvidence?.instructions.some((item) => item.includes("usable contact region separately")));
});

test("comparative unanchored evidence remains corroborating and non-dispositive", () => {
  const report = analyzePhysicalEvaluationConflicts({
    ...baseInput([
      standalone("a", "swing_effort", "eval-a", "moderate"),
      standalone("b", "swing_effort", "eval-b", "demanding"),
      standalone("c", "swing_effort", "eval-c", "very_demanding")
    ]),
    comparativeAttributes: [{
      attributeKey: "swing_effort",
      evidenceCount: 2,
      sessionCount: 2,
      independentSourceCount: 2,
      dimensionResults: [],
      comparativeDirection: "clearly_more_demand",
      consensusStrength: "strong",
      materialConflict: false,
      conflictingDimensions: [],
      supportingDimensions: ["startup_demand"],
      referenceContext: { referenceAnchored: false, limitations: [] },
      confidence: "moderate",
      canonicalInterpretationStatus: "deferred_reference_unanchored",
      limitations: [],
      nextEvidenceAction: "onboard_and_anchor_reference_equipment",
      synthesisVersion: "1.0",
      consensusPolicyVersion: "1.0",
      canonicalGateVersion: "1.0"
    }]
  });
  const swing = attribute(report, "swing_effort");
  assert.equal(swing.comparativeCorroboration?.nonDispositive, true);
  assert.equal(swing.comparativeCorroboration?.canonicalInterpretationStatus, "deferred_reference_unanchored");
  assert.equal(swing.canonicalPromotionStatus, "not_allowed_by_conflict_analysis");
});

test("adjudication plan preserves evaluator blinding and performs no writes", () => {
  const report = analyzePhysicalEvaluationConflicts(baseInput([
    standalone("a", "swing_effort", "eval-a", "moderate"),
    standalone("b", "swing_effort", "eval-b", "demanding")
  ]));
  const plan = buildPhysicalEvaluationAdjudicationPlan(report);
  assert.equal(plan.blindingPolicy.priorEvaluatorCanonicalInterpretations, "hidden_before_evaluation");
  assert.equal(plan.blindingPolicy.priorEvaluatorRawObservations, "hidden_before_evaluation");
  assert.equal(plan.blindingPolicy.comparativeSynthesisResult, "hidden_before_evaluation");
  assert.equal(plan.canonicalPromotionAllowedAfterCollection, false);
  assert.equal(plan.writesPerformed, false);
  assert.ok(plan.attributes.every((item) => item.canonicalPromotionAllowedAfterCollection === false));
});

test("policy validation keeps recommendation and persistence boundaries closed", () => {
  const validation = validatePhysicalEvaluationConflictAdjudicationPolicy();
  assert.equal(validation.verdict, "pass");
  assert.ok(validation.checks.some((check) => check.name === "majority vote is not a promotion rule" && check.passed));
});

function baseInput(evidence: readonly BehavioralEvidenceRecord[]) {
  return {
    equipmentId: "6cf0f7fa-c8c2-4ce7-a36e-6ad1c52cc56c",
    equipmentLabel: "2023 DeMarini The Goods",
    variantLabel: "DEM-THE-GOODS-USA-30-20",
    evidence
  };
}

function attribute(report: ReturnType<typeof analyzePhysicalEvaluationConflicts>, key: BehavioralEvidenceRecord["attributeKey"]) {
  const result = report.attributes.find((item) => item.attributeKey === key);
  assert.ok(result);
  return result;
}

function standalone(
  id: string,
  attributeKey: BehavioralEvidenceRecord["attributeKey"],
  evaluatorId: string,
  ordinalValue: string,
  sessionId = id,
  dimensions?: Record<string, string>
): BehavioralEvidenceRecord {
  const rawDimensions = dimensions ?? defaultDimensions(attributeKey);
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
      evaluationMode: "standalone",
      interpretationMode: "standalone_absolute",
      canonicalInterpretationStatus: "available",
      evaluatorConfidence: "medium",
      dimensions: Object.entries(rawDimensions).map(([key, observation]) => ({ key, observation }))
    },
    ordinalValue,
    confidence: "estimated",
    notes: "test standalone evidence"
  };
}

function defaultDimensions(attributeKey: BehavioralEvidenceRecord["attributeKey"]): Record<string, string> {
  if (attributeKey === "swing_effort") {
    return {
      startup_demand: "moderate",
      rotational_demand: "moderate",
      barrel_redirect_demand: "moderate"
    };
  }
  if (attributeKey === "bat_control_support") {
    return {
      directional_controllability: "moderate",
      barrel_path_manageability: "moderate",
      start_stop_controllability: "moderate"
    };
  }
  if (attributeKey === "forgiveness") {
    return {
      off_center_response_consistency: "low",
      handle_side_miss_tolerance: "low",
      end_side_miss_tolerance: "low",
      response_degradation: "high"
    };
  }
  return {
    usable_contact_region: "moderate",
    centered_response_consistency: "moderate",
    near_center_response_consistency: "moderate"
  };
}
