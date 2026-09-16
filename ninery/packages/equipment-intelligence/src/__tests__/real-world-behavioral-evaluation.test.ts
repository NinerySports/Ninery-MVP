import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateRealWorldBehavioralEquipmentDNA,
  type BehavioralEvidenceRecord
} from "../behavioral/index.js";

const base = {
  equipmentId: "6cf0f7fa-c8c2-4ce7-a36e-6ad1c52cc56c",
  equipmentLabel: "2023 DeMarini The Goods (-10) USA",
  variantLabel: "DEM-THE-GOODS-USA-30-20"
};

test("manufacturer marketing claim alone cannot create high numeric reference", () => {
  const report = evaluateRealWorldBehavioralEquipmentDNA({
    ...base,
    evidence: [
      evidence("claim-1", "sweet_spot_support", "marketing_claim", {
        rawValue: "massive sweet spot",
        ordinalValue: "high"
      })
    ]
  });
  const sweetSpot = report.attributes.find((item) => item.attributeKey === "sweet_spot_support");
  assert.equal(sweetSpot?.evaluationStatus, "resolved_ordinal");
  assert.equal(sweetSpot?.numericReference, undefined);
  assert.equal(sweetSpot?.confidence, "estimated");
});

test("objective measured evidence gets numeric treatment", () => {
  const report = evaluateRealWorldBehavioralEquipmentDNA({
    ...base,
    evidence: [
      evidence("moi-1", "swing_effort", "objective_measured", {
        rawValue: "measured MOI and swing demand",
        ordinalValue: "moderate",
        numericReference: 52,
        confidence: "high"
      })
    ]
  });
  const swing = report.attributes.find((item) => item.attributeKey === "swing_effort");
  assert.equal(swing?.evaluationStatus, "resolved_numeric");
  assert.equal(swing?.numericReference, 52);
  assert.equal(swing?.confidence, "moderate");
});

test("independent evidence can increase support without creating fake numeric precision", () => {
  const report = evaluateRealWorldBehavioralEquipmentDNA({
    ...base,
    evidence: [
      evidence("independent-1", "forgiveness", "independent_expert", { ordinalValue: "moderate", independenceGroup: "reviewer-a" }),
      evidence("structured-1", "forgiveness", "structured_internal_equipment_evaluation", { ordinalValue: "moderate", independenceGroup: "ninery-lab" })
    ]
  });
  const forgiveness = report.attributes.find((item) => item.attributeKey === "forgiveness");
  assert.equal(forgiveness?.evaluationStatus, "resolved_ordinal");
  assert.equal(forgiveness?.confidence, "high");
  assert.equal(forgiveness?.numericReference, undefined);
});

test("correlated duplicate claims do not falsely increase confidence", () => {
  const report = evaluateRealWorldBehavioralEquipmentDNA({
    ...base,
    evidence: [
      evidence("claim-1", "bat_control_support", "marketing_claim", { ordinalValue: "high", independenceGroup: "manufacturer-copy" }),
      evidence("claim-2", "bat_control_support", "marketing_claim", { ordinalValue: "high", independenceGroup: "manufacturer-copy" })
    ]
  });
  const control = report.attributes.find((item) => item.attributeKey === "bat_control_support");
  assert.equal(control?.confidence, "estimated");
  assert.equal(control?.numericReference, undefined);
});

test("conflicting evidence blocks readiness and preserves both records", () => {
  const report = evaluateRealWorldBehavioralEquipmentDNA({
    ...base,
    evidence: [
      evidence("reviewer-a", "swing_effort", "independent_expert", { ordinalValue: "easy", independenceGroup: "reviewer-a" }),
      evidence("reviewer-b", "swing_effort", "independent_expert", { ordinalValue: "demanding", independenceGroup: "reviewer-b" })
    ]
  });
  const swing = report.attributes.find((item) => item.attributeKey === "swing_effort");
  assert.equal(swing?.evaluationStatus, "blocked_conflict");
  assert.equal(swing?.conflictingEvidence.length, 2);
  assert.deepEqual(report.readiness.materialConflicts, ["swing_effort"]);
});

test("missing evidence remains missing without hidden zero or neutral 50", () => {
  const report = evaluateRealWorldBehavioralEquipmentDNA({ ...base, evidence: [] });
  for (const attribute of report.attributes) {
    assert.equal(attribute.evaluationStatus, "insufficient_evidence");
    assert.notEqual(attribute.numericReference, 0);
    assert.notEqual(attribute.numericReference, 50);
  }
  assert.deepEqual(report.readiness.requiredBehavioralAttributesUnresolved, [
    "swing_effort",
    "forgiveness",
    "sweet_spot_support",
    "bat_control_support"
  ]);
});

test("player-specific transition and Pilot Study evidence are rejected for prospective intrinsic DNA", () => {
  const report = evaluateRealWorldBehavioralEquipmentDNA({
    ...base,
    evidence: [
      evidence("jackson-1", "swing_effort", "anecdotal_player_specific", {
        ordinalValue: "easy",
        playerSpecific: true,
        pilotStudyReference: "pilot-study-01"
      })
    ]
  });
  const swing = report.attributes.find((item) => item.attributeKey === "swing_effort");
  assert.equal(swing?.evaluationStatus, "rejected_contaminated");
  assert.equal(swing?.provenance.pilotStudyEvidenceUsed, true);
  assert.equal(report.validation.verdict, "fail");
});

test("retrospective validation evidence is excluded", () => {
  const report = evaluateRealWorldBehavioralEquipmentDNA({
    ...base,
    evidence: [
      evidence("outcome-1", "forgiveness", "independent_expert", {
        ordinalValue: "high",
        timing: "retrospective_validation_evidence"
      })
    ]
  });
  const forgiveness = report.attributes.find((item) => item.attributeKey === "forgiveness");
  assert.equal(forgiveness?.evaluationStatus, "rejected_contaminated");
});

test("ordinal evaluation can exist without numeric reference and numeric requires sufficient evidence", () => {
  const report = evaluateRealWorldBehavioralEquipmentDNA({
    ...base,
    evidence: [
      evidence("independent-1", "sweet_spot_support", "independent_expert", { ordinalValue: "moderate" })
    ]
  });
  const sweetSpot = report.attributes.find((item) => item.attributeKey === "sweet_spot_support");
  assert.equal(sweetSpot?.evaluationStatus, "resolved_ordinal");
  assert.equal(sweetSpot?.numericReference, undefined);
});

test("DeMarini evaluation is deterministic and keeps live activation blocked", () => {
  const first = evaluateRealWorldBehavioralEquipmentDNA({ ...base, evidence: [] });
  const second = evaluateRealWorldBehavioralEquipmentDNA({ ...base, evidence: [] });
  assert.deepEqual(first.gaps, second.gaps);
  assert.equal(first.readiness.canonicalProfileReady, false);
  assert.equal(first.readiness.genuineStudyReady, false);
  assert.equal(first.readiness.liveActivationAllowed, false);
  assert.equal(first.validation.verdict, "pass");
});

function evidence(
  id: string,
  attributeKey: BehavioralEvidenceRecord["attributeKey"],
  category: BehavioralEvidenceRecord["category"],
  overrides: Partial<BehavioralEvidenceRecord> = {}
): BehavioralEvidenceRecord {
  return {
    id,
    attributeKey,
    category,
    timing: "prospective_equipment_evidence",
    sourceName: "test source",
    sourceReference: `test:${id}`,
    independenceGroup: overrides.independenceGroup ?? id,
    rawValue: overrides.rawValue ?? String(overrides.ordinalValue ?? "raw"),
    notes: "test evidence",
    ...overrides
  };
}
