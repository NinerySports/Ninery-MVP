import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProtocolV11LearningReport,
  physicalEvaluationProtocolV11Questions,
  validateProtocolV11LearningReportPolicy,
  type ProtocolV11LearningEvidenceRecord,
  type ProtocolV11LearningReportInput
} from "../physical-evaluation/index.js";
import type { BehavioralEvidenceRecord } from "../behavioral/index.js";

const equipmentId = "6cf0f7fa-c8c2-4ce7-a36e-6ad1c52cc56c";
const variantId = "af5ff27c-aedd-4f56-88c3-c1ec4b70affa";

test("one genuine v1.1 session yields construct-specific learning, not population validation", () => {
  const report = buildProtocolV11LearningReport(input());
  assert.equal(report.currentLearningState, "construct_specific_support");
  assert.ok(report.constructs.every((construct) => construct.limitations.some((item) => item.includes("cannot establish population-level"))));
  assert.equal(report.nextProtocolStep.decision, "preserve_protocol_and_expand_pilot");
});

test("repeat evaluator session increases sessions but not independent sources", () => {
  const coverage = buildProtocolV11LearningReport(input()).evidenceCoverage;
  assert.equal(coverage.totalQualifyingPhysicalSessions, 6);
  assert.equal(coverage.uniqueEvaluatorCount, 5);
  assert.equal(coverage.independentEvaluatorSourceCount, 5);
  assert.equal(coverage.repeatEvaluatorSessionCount, 1);
  assert.equal(coverage.protocolV10Sessions, 5);
  assert.equal(coverage.protocolV11Sessions, 1);
});

test("same-evaluator cross-protocol comparison remains descriptive and noncausal", () => {
  const review = buildProtocolV11LearningReport(input()).sameEvaluatorReview;
  assert.equal(review.available, true);
  assert.equal(review.evaluatorId, "physical-evaluator-05");
  assert.deepEqual(review.v10SessionIds, ["v1-session-05"]);
  assert.equal(review.independentReplication, false);
  assert.equal(review.causalInterpretation, "prohibited");
  assert.equal(review.classification, "descriptive_within_evaluator_calibration_only");
});

test("high response degradation is protected as greater degradation and less forgiveness", () => {
  const forgiveness = construct(buildProtocolV11LearningReport(input()), "forgiveness");
  assert.equal(observation(forgiveness, "response_degradation"), "high");
  assert.equal(forgiveness.inverseDegradationProtected, true);
  assert.ok(forgiveness.interpretation.includes("high degradation is treated as less forgiveness"));
});

test("sweet spot breadth and response quality remain separate candidate subconstructs", () => {
  const sweetSpot = construct(buildProtocolV11LearningReport(input()), "sweet_spot");
  assert.equal(observation(sweetSpot, "usable_contact_region_breadth"), "low");
  assert.equal(observation(sweetSpot, "centered_response_consistency"), "moderate");
  assert.equal(sweetSpot.candidateSubconstructsOnly, true);
  assert.equal(sweetSpot.separationObserved, true);
  assert.ok(sweetSpot.limitations.some((item) => item.includes("contact locations actually tested")));
});

test("low breadth and high response consistency coexist without contradiction", () => {
  const fixture = input();
  const protocolV11Evidence = fixture.protocolV11Evidence.map((record) => {
    const raw = record.rawValue as Record<string, unknown>;
    return raw.dimensionKey === "centered_response_consistency"
      ? { ...record, rawValue: { ...raw, observation: "high" } }
      : record;
  });
  const sweetSpot = construct(buildProtocolV11LearningReport({ ...fixture, protocolV11Evidence }), "sweet_spot");
  assert.equal(observation(sweetSpot, "usable_contact_region_breadth"), "low");
  assert.equal(observation(sweetSpot, "centered_response_consistency"), "high");
  assert.equal(sweetSpot.informationGain, "meaningful_separation_observed");
  assert.equal(sweetSpot.candidateSubconstructsOnly, true);
});

test("historical semantics remain distinct and canonical firewall stays closed", () => {
  const fixture = input();
  const before = JSON.stringify(fixture.historicalV10Evidence);
  const report = buildProtocolV11LearningReport(fixture);
  assert.equal(JSON.stringify(fixture.historicalV10Evidence), before);
  assert.ok(report.historicalCohort.every((item) => item.limitation.includes("retain v1.0 semantics")));
  assert.deepEqual(report.canonicalFirewall, {
    canonicalEvaluationsCreated: 0,
    canonicalEvaluationsModified: 0,
    numericReferencesCreated: 0,
    recommendationScoringChanged: false,
    recommendationRankingChanged: false,
    liveEquipmentDNAChanged: false,
    historicalEvidenceModified: false,
    writesPerformed: false
  });
});

test("missing v1.1 evidence produces insufficient evidence without fabricated observations", () => {
  const fixture = input();
  const report = buildProtocolV11LearningReport({ ...fixture, protocolV11Evidence: [], qualifyingPhysicalEvidence: fixture.qualifyingPhysicalEvidence.filter((record) => record.protocolVersion === "1.0") });
  assert.equal(report.currentLearningState, "insufficient_evidence");
  assert.ok(report.constructs.every((construct) => construct.informationGain === "insufficient_evidence"));
  assert.ok(report.constructs.flatMap((construct) => construct.dimensions).every((dimension) => dimension.observation === undefined));
});

test("cross-equipment generalization is blocked and no immediate independent evaluator is demanded", () => {
  const report = buildProtocolV11LearningReport(input());
  assert.equal(report.crossEquipmentGeneralization.allowed, false);
  assert.equal(report.crossEquipmentGeneralization.equipmentModelCount, 1);
  assert.equal(report.nextProtocolStep.independentEvaluatorRequiredImmediately, false);
  assert.ok(report.nextProtocolStep.additionalEvidenceNeeded.some((item) => item.includes("second equipment archetype")));
});

test("learning report is deterministic and its policy validates all dimensions", () => {
  const fixture = input();
  assert.deepEqual(buildProtocolV11LearningReport(fixture), buildProtocolV11LearningReport(fixture));
  assert.equal(validateProtocolV11LearningReportPolicy().verdict, "pass");
});

function input(): ProtocolV11LearningReportInput {
  const historicalV10Evidence = historicalEvidence();
  const protocolV11Evidence = v11Evidence();
  return {
    equipmentId,
    equipmentLabel: "2023 DeMarini The Goods USA",
    variantLabels: ["DEM-THE-GOODS-USA-30-20 30/20/-10"],
    historicalV10Evidence,
    protocolV11Evidence,
    qualifyingPhysicalEvidence: [
      ...historicalV10Evidence.map((record) => ({
        evidenceRecordId: record.id,
        equipmentId,
        evaluatorId: record.independenceGroup,
        sessionId: String((record.rawValue as Record<string, unknown>).sessionId),
        protocolVersion: "1.0",
        sourceReference: record.sourceReference,
        evaluatedAt: `2026-08-${String(Number(record.independenceGroup.slice(-2)) + 10).padStart(2, "0")}`
      })),
      ...protocolV11Evidence.map((record) => ({
        evidenceRecordId: record.id,
        equipmentId,
        evaluatorId: record.evaluatorId,
        sessionId: "v1-1-session-01",
        protocolVersion: "1.1",
        sourceReference: record.sourceReference,
        evaluatedAt: record.evaluatedAt,
        declaredRelationship: "repeat_evaluator" as const
      }))
    ]
  };
}

function historicalEvidence(): BehavioralEvidenceRecord[] {
  const attributes = {
    swing_effort: { startup_demand: "moderate", rotational_demand: "moderate", barrel_redirect_demand: "moderate" },
    bat_control_support: { directional_controllability: "moderate", barrel_path_manageability: "moderate", start_stop_controllability: "moderate" },
    forgiveness: { off_center_response_consistency: "moderate", handle_side_miss_tolerance: "moderate", end_side_miss_tolerance: "moderate", response_degradation: "high" },
    sweet_spot_support: { usable_contact_region: "low", centered_response_consistency: "high", near_center_response_consistency: "high" }
  } as const;
  return Array.from({ length: 5 }, (_, index) => Object.entries(attributes).map(([attributeKey, dimensions]) => ({
    id: `v10-${index + 1}-${attributeKey}`,
    attributeKey: attributeKey as BehavioralEvidenceRecord["attributeKey"],
    category: "structured_internal_equipment_evaluation" as const,
    timing: "prospective_equipment_evidence" as const,
    sourceName: "Ninery Structured Physical Bat Evaluation Protocol",
    sourceReference: `physical-bat-evaluation:1.0:v1-session-0${index + 1}:${attributeKey}`,
    independenceGroup: `physical-evaluator-0${index + 1}`,
    rawValue: {
      protocolVersion: "1.0",
      evaluationMode: "standalone",
      interpretationMode: "standalone_absolute",
      sessionId: `v1-session-0${index + 1}`,
      dimensions: Object.entries(dimensions).map(([key, observation]) => ({ key, observation }))
    },
    ordinalValue: "moderate",
    confidence: "moderate" as const,
    notes: "Immutable v1.0 test evidence."
  }))).flat();
}

function v11Evidence(): ProtocolV11LearningEvidenceRecord[] {
  const observations: Record<string, string> = {
    startup_demand: "moderate", rotational_demand: "high", barrel_redirect_demand: "moderate",
    directional_adjustment_control: "moderate", barrel_path_repeatability: "moderate", start_stop_redirect_control: "high",
    center_response_baseline: "high", handle_side_miss_tolerance: "moderate", end_side_miss_tolerance: "moderate", response_degradation: "high",
    usable_contact_region_breadth: "low", centered_response_consistency: "moderate", near_center_response_consistency: "moderate"
  };
  return physicalEvaluationProtocolV11Questions.map((question) => ({
    id: `v11-${question.dimensionKey}`,
    equipmentId,
    equipmentVariantId: variantId,
    sourceReference: `physical-bat-evaluation:1.1:v1-1-session-01:${question.dimensionKey}`,
    evaluatorId: "physical-evaluator-05",
    evaluatedAt: "2026-08-29",
    rawValue: {
      protocolVersion: "1.1",
      questionnaireVersion: "1.1",
      studyClassification: "protocol_calibration_evidence",
      provenanceClassification: "real_protocol_calibration_observation",
      sessionId: "v1-1-session-01",
      dimensionKey: question.dimensionKey,
      observation: observations[question.dimensionKey],
      evaluator: { evaluatorId: "physical-evaluator-05", confidence: "medium", relationship: "repeat_evaluator" },
      canonicalEligible: false,
      numericReferenceEligible: false,
      recommendationEligible: false
    }
  }));
}

function construct(report: ReturnType<typeof buildProtocolV11LearningReport>, key: string) {
  const value = report.constructs.find((item) => item.construct === key);
  assert.ok(value);
  return value;
}
function observation(value: ReturnType<typeof construct>, key: string) { return value.dimensions.find((dimension) => dimension.key === key)?.observation; }
