import assert from "node:assert/strict";
import test from "node:test";
import {
  CURRENT_EQUIPMENT_FAMILIARITY_DEFINITION,
  CURRENT_EQUIPMENT_FAMILIARITY_EXCLUSIONS,
  CURRENT_EQUIPMENT_FAMILIARITY_MODEL_VERSION,
  evaluateCurrentEquipmentFamiliarity
} from "../index.js";

test("familiarity definition is equipment-specific and non-clinical", () => {
  assert.equal(CURRENT_EQUIPMENT_FAMILIARITY_MODEL_VERSION, "1.0");
  assert.match(CURRENT_EQUIPMENT_FAMILIARITY_DEFINITION, /normal practice or game conditions/i);
  assert.ok(CURRENT_EQUIPMENT_FAMILIARITY_EXCLUSIONS.includes("equipment ownership"));
  assert.ok(CURRENT_EQUIPMENT_FAMILIARITY_EXCLUSIONS.includes("psychological comfort"));
});

test("unknown and ownership-only familiarity avoid hidden midpoint defaults", () => {
  const result = evaluateCurrentEquipmentFamiliarity(base({ ownershipOnly: true }));
  assert.equal(result.level, "unknown");
  assert.equal(result.numericReference, undefined);
  assert.equal(result.confidence, "estimated");
  assert.ok(result.warnings.some((warning) => /ownership alone/i.test(warning)));
});

test("new, developing, established, and highly established familiarity are deterministic", () => {
  assert.equal(evaluateCurrentEquipmentFamiliarity(base({ estimatedSessionsUsed: 1, estimatedWeeksUsed: 1, directlyReportedFamiliarity: "not_familiar" })).level, "new_or_unfamiliar");
  assert.equal(evaluateCurrentEquipmentFamiliarity(base({ estimatedSessionsUsed: 10, estimatedWeeksUsed: 4, directlyReportedFamiliarity: "somewhat_familiar", currentlyPrimaryEquipment: true })).level, "developing_familiarity");
  assert.equal(evaluateCurrentEquipmentFamiliarity(base({ estimatedSessionsUsed: 24, estimatedWeeksUsed: 10, regularUseFrequency: "multiple_times_weekly", directlyReportedFamiliarity: "familiar", currentlyPrimaryEquipment: true })).level, "established_familiarity");
  const high = evaluateCurrentEquipmentFamiliarity(base({ estimatedSessionsUsed: 48, estimatedWeeksUsed: 20, regularUseFrequency: "daily_or_near_daily", directlyReportedFamiliarity: "very_familiar", currentlyPrimaryEquipment: true }));
  assert.equal(high.level, "highly_established_familiarity");
  assert.equal(high.confidence, "high");
});

test("conflicting reports lower confidence and preserve warning", () => {
  const result = evaluateCurrentEquipmentFamiliarity(base({
    estimatedSessionsUsed: 40,
    estimatedWeeksUsed: 18,
    regularUseFrequency: "multiple_times_weekly",
    directlyReportedFamiliarity: "very_familiar",
    currentlyPrimaryEquipment: true,
    conflictingReports: true
  }));
  assert.equal(result.confidence, "estimated");
  assert.ok(result.warnings.some((warning) => /conflicting/i.test(warning)));
});

function base(overrides: Partial<Parameters<typeof evaluateCurrentEquipmentFamiliarity>[0]> = {}): Parameters<typeof evaluateCurrentEquipmentFamiliarity>[0] {
  return {
    playerId: "player-1",
    equipmentId: "equipment-1",
    equipmentVariantId: "variant-1",
    source: "parent_or_guardian",
    capturedAt: new Date("2026-08-05T00:00:00.000Z"),
    ...overrides
  };
}
