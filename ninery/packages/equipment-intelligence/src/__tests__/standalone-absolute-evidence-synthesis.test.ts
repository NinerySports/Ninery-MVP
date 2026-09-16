import assert from "node:assert/strict";
import test from "node:test";
import {
  CANONICAL_ORDINAL_PROMOTION_POLICY_VERSION,
  STANDALONE_ABSOLUTE_EVIDENCE_SYNTHESIS_VERSION,
  buildCanonicalOrdinalPromotionPreview,
  synthesizeStandaloneAbsoluteEvidence,
  validateStandaloneAbsoluteEvidencePolicy,
  type BehavioralEvidenceRecord
} from "../behavioral/index.js";

test("exact independent standalone agreement supports a single canonical ordinal", () => {
  const report = synthesizeStandaloneAbsoluteEvidence(baseInput([
    standalone("a", "bat_control_support", "eval-a", "moderate"),
    standalone("b", "bat_control_support", "eval-b", "moderate")
  ]));
  const control = report.attributes.find((item) => item.attributeKey === "bat_control_support");
  assert.equal(report.version, STANDALONE_ABSOLUTE_EVIDENCE_SYNTHESIS_VERSION);
  assert.equal(control?.classification, "exact_agreement");
  assert.equal(control?.synthesisStatus, "single_ordinal_supported");
  assert.equal(control?.supportedCanonicalOrdinal, "moderate");
  assert.equal(control?.confidence, "moderate");
  assert.equal(report.numericReferenceCreated, false);
});

test("adjacent standalone evidence remains bounded and requires another evaluator", () => {
  const report = synthesizeStandaloneAbsoluteEvidence(baseInput([
    standalone("a", "swing_effort", "eval-a", "moderate"),
    standalone("b", "swing_effort", "eval-b", "demanding")
  ]));
  const swing = report.attributes.find((item) => item.attributeKey === "swing_effort");
  assert.equal(swing?.classification, "adjacent_agreement");
  assert.equal(swing?.synthesisStatus, "bounded_only");
  assert.deepEqual(swing?.supportedOrdinalRange, ["moderate", "demanding"]);
  assert.equal(swing?.supportedCanonicalOrdinal, undefined);
  assert.equal(swing?.additionalEvaluationRequired, true);
});

test("material standalone disagreement blocks promotion", () => {
  const report = synthesizeStandaloneAbsoluteEvidence(baseInput([
    standalone("a", "forgiveness", "eval-a", "very_low"),
    standalone("b", "forgiveness", "eval-b", "high")
  ]));
  const forgiveness = report.attributes.find((item) => item.attributeKey === "forgiveness");
  assert.equal(forgiveness?.classification, "material_disagreement");
  assert.equal(forgiveness?.synthesisStatus, "promotion_blocked_conflict");
  assert.equal(forgiveness?.materialConflict, true);
});

test("same evaluator and duplicate session do not inflate independence", () => {
  const report = synthesizeStandaloneAbsoluteEvidence(baseInput([
    standalone("a", "forgiveness", "eval-a", "low", "session-1"),
    standalone("b", "forgiveness", "eval-a", "low", "session-1")
  ]));
  const forgiveness = report.attributes.find((item) => item.attributeKey === "forgiveness");
  assert.equal(forgiveness?.evidenceCount, 1);
  assert.equal(forgiveness?.independentSourceCount, 1);
  assert.equal(forgiveness?.synthesisStatus, "insufficient_independent_evidence");
});

test("comparative Omaha evidence can corroborate a bound but cannot create an absolute ordinal", () => {
  const report = synthesizeStandaloneAbsoluteEvidence({
    ...baseInput([
      standalone("a", "sweet_spot_support", "eval-a", "moderate"),
      standalone("b", "sweet_spot_support", "eval-b", "high")
    ]),
    comparativeAttributes: [{
      attributeKey: "sweet_spot_support",
      dimensionResults: [],
      evidenceCount: 2,
      sessionCount: 2,
      independentSourceCount: 2,
      comparativeDirection: "clearly_less_support",
      consensusStrength: "strong",
      materialConflict: false,
      conflictingDimensions: [],
      supportingDimensions: [],
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
  const sweet = report.attributes.find((item) => item.attributeKey === "sweet_spot_support");
  assert.equal(sweet?.comparativeCorroboration, "supports_lower_bound");
  assert.equal(sweet?.supportedCanonicalOrdinal, undefined);
  assert.equal(report.numericReferenceCreated, false);
});

test("invalid, retrospective, player-specific, and pilot evidence are excluded", () => {
  const report = synthesizeStandaloneAbsoluteEvidence(baseInput([
    standalone("a", "bat_control_support", "eval-a", "moderate", "session-a", { timing: "retrospective_validation_evidence" }),
    standalone("b", "bat_control_support", "eval-b", "moderate", "session-b", { playerSpecific: true }),
    standalone("c", "bat_control_support", "eval-c", "moderate", "session-c", { pilotStudyReference: "Pilot Study #1" }),
    standalone("d", "bat_control_support", "eval-d", "not_a_value")
  ]));
  const control = report.attributes.find((item) => item.attributeKey === "bat_control_support");
  assert.equal(control?.evidenceCount, 0);
  assert.equal(control?.excludedEvidence.length, 4);
});

test("promotion preview permits only exact agreement attributes", () => {
  const preview = buildCanonicalOrdinalPromotionPreview(synthesizeStandaloneAbsoluteEvidence(baseInput([
    standalone("a", "bat_control_support", "eval-a", "moderate"),
    standalone("b", "bat_control_support", "eval-b", "moderate"),
    standalone("c", "swing_effort", "eval-a", "moderate"),
    standalone("d", "swing_effort", "eval-b", "demanding")
  ])));
  assert.equal(preview.version, CANONICAL_ORDINAL_PROMOTION_POLICY_VERSION);
  assert.equal(preview.promotionPermitted, true);
  assert.equal(preview.promotedAttributeCount, 1);
  assert.equal(preview.boundedAttributeCount, 1);
  assert.equal(preview.numericReferenceCreated, false);
  assert.equal(preview.liveRecommendationActivationAllowed, false);
  assert.equal(preview.attributes.find((item) => item.attributeKey === "bat_control_support")?.gateStatus, "single_ordinal_ready");
  assert.equal(preview.attributes.find((item) => item.attributeKey === "swing_effort")?.gateStatus, "bounded_only");
});

test("policy validation keeps numeric and live-activation boundaries explicit", () => {
  const validation = validateStandaloneAbsoluteEvidencePolicy();
  assert.equal(validation.verdict, "pass");
  assert.ok(validation.checks.some((check) => check.name === "exact agreement is not validated confidence" && check.passed));
});

function baseInput(evidence: readonly BehavioralEvidenceRecord[]) {
  return {
    equipmentId: "6cf0f7fa-c8c2-4ce7-a36e-6ad1c52cc56c",
    equipmentLabel: "2023 DeMarini The Goods",
    variantLabel: "DEM-THE-GOODS-USA-30-20",
    evidence
  };
}

function standalone(
  id: string,
  attributeKey: BehavioralEvidenceRecord["attributeKey"],
  evaluatorId: string,
  ordinalValue: string,
  sessionId = id,
  overrides: Partial<BehavioralEvidenceRecord> = {}
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
      evaluationMode: "standalone",
      interpretationMode: "standalone_absolute",
      canonicalInterpretationStatus: "available",
      evaluatorConfidence: "medium"
    },
    ordinalValue,
    confidence: "estimated",
    notes: "test standalone evidence",
    ...overrides
  };
}
