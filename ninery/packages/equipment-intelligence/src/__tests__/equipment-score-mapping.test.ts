import assert from "node:assert/strict";
import test from "node:test";
import {
  EQUIPMENT_SCORE_TO_ORDINAL_MAPPING_VERSION,
  mapEquipmentScoreToSupportOrdinal,
  mapSwingWeightScoreToSwingEffort,
  normalizeEquipmentScore
} from "../index.js";

test("score-to-ordinal mapping version is exported", () => {
  assert.equal(EQUIPMENT_SCORE_TO_ORDINAL_MAPPING_VERSION, "1.0");
});

test("five-level support mapping handles boundaries", () => {
  assert.equal(mapEquipmentScoreToSupportOrdinal(0).ordinal, "very_low");
  assert.equal(mapEquipmentScoreToSupportOrdinal(19).ordinal, "very_low");
  assert.equal(mapEquipmentScoreToSupportOrdinal(20).ordinal, "low");
  assert.equal(mapEquipmentScoreToSupportOrdinal(39).ordinal, "low");
  assert.equal(mapEquipmentScoreToSupportOrdinal(40).ordinal, "moderate");
  assert.equal(mapEquipmentScoreToSupportOrdinal(59).ordinal, "moderate");
  assert.equal(mapEquipmentScoreToSupportOrdinal(60).ordinal, "high");
  assert.equal(mapEquipmentScoreToSupportOrdinal(79).ordinal, "high");
  assert.equal(mapEquipmentScoreToSupportOrdinal(80).ordinal, "very_high");
  assert.equal(mapEquipmentScoreToSupportOrdinal(100).ordinal, "very_high");
});

test("invalid score values are rejected", () => {
  assert.throws(() => normalizeEquipmentScore(-1), /between 0 and 100/);
  assert.throws(() => normalizeEquipmentScore(101), /between 0 and 100/);
  assert.throws(() => normalizeEquipmentScore(11, "one_to_ten"), /between 0 and 10/);
  assert.throws(() => normalizeEquipmentScore(Number.NaN), /finite/);
});

test("one-to-ten source scores are normalized and preserved", () => {
  const mapped = mapEquipmentScoreToSupportOrdinal(8.6, "one_to_ten");

  assert.equal(mapped.sourceScore, 8.6);
  assert.equal(mapped.normalizedScore, 86);
  assert.equal(mapped.scale, "one_to_ten");
  assert.equal(mapped.ordinal, "very_high");
  assert.equal(mapped.mappingVersion, EQUIPMENT_SCORE_TO_ORDINAL_MAPPING_VERSION);
});

test("mapping is deterministic and canonical", () => {
  assert.deepEqual(mapEquipmentScoreToSupportOrdinal(74), mapEquipmentScoreToSupportOrdinal(74));
  assert.equal(mapEquipmentScoreToSupportOrdinal(74).ordinal, "high");
});

test("swing-weight conversion maps lower scores to easier swing effort", () => {
  assert.equal(mapSwingWeightScoreToSwingEffort(0).ordinal, "very_easy");
  assert.equal(mapSwingWeightScoreToSwingEffort(20).ordinal, "easy");
  assert.equal(mapSwingWeightScoreToSwingEffort(40).ordinal, "moderate");
  assert.equal(mapSwingWeightScoreToSwingEffort(60).ordinal, "demanding");
  assert.equal(mapSwingWeightScoreToSwingEffort(80).ordinal, "very_demanding");
});

test("swing-weight conversion preserves source score metadata", () => {
  const mapped = mapSwingWeightScoreToSwingEffort(4.2, "one_to_ten");

  assert.equal(mapped.sourceScore, 4.2);
  assert.equal(mapped.normalizedScore, 42);
  assert.equal(mapped.ordinal, "moderate");
  assert.equal(mapped.mappingFunction, "swing_weight_to_swing_effort");
});
