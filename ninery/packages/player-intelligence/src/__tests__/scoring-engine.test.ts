import test from "node:test";
import assert from "node:assert/strict";
import { createDemoPlayerDNAInput } from "../demo-fixture.js";
import { runScoringEngine } from "../scoring/scoring-engine.js";
import { getPlayerDNAScoringRules } from "../scoring/scoring-rule-registry.js";

test("rapid recent growth lowers growth stability", () => {
  const result = runScoringEngine(
    createDemoPlayerDNAInput({
      growthMeasurements: [
        { heightCm: 140, weightKg: 39, measuredAt: "2026-01-01" },
        { heightCm: 148, weightKg: 43, measuredAt: "2026-05-01" }
      ]
    }),
    getPlayerDNAScoringRules()
  );

  assert.equal(result.categories.growthStatus, "rapid_growth");
  assert.ok(result.scores.growthStability < 50);
});

test("current bat reported as too heavy reduces bat control and transition readiness", () => {
  const result = runScoringEngine(
    createDemoPlayerDNAInput({
      answers: [
        { questionCode: "PRIMARY_GOAL", answer: { value: "improve_contact" } },
        { questionCode: "CURRENT_BAT_FEEL", answer: { value: "too_heavy" } }
      ]
    }),
    getPlayerDNAScoringRules()
  );

  assert.ok(result.scores.batControl < 50);
  assert.ok(result.scores.transitionReadiness < 50);
  assert.equal(result.categories.preferredSwingFeel, "light");
});

test("player prioritizing bat control increases bat control", () => {
  const result = runScoringEngine(
    createDemoPlayerDNAInput({
      answers: [{ questionCode: "PRIMARY_GOAL", answer: { value: "better bat control" } }]
    }),
    getPlayerDNAScoringRules()
  );

  assert.ok(result.scores.batControl > 50);
  assert.equal(result.categories.primaryHittingGoal, "improve_bat_control");
});

test("player prioritizing power increases power potential", () => {
  const result = runScoringEngine(
    createDemoPlayerDNAInput({
      answers: [{ questionCode: "PRIMARY_GOAL", answer: { value: "more power" } }]
    }),
    getPlayerDNAScoringRules()
  );

  assert.ok(result.scores.powerPotential > 50);
  assert.equal(result.categories.primaryHittingGoal, "improve_power");
});

test("low plate confidence lowers confidence score", () => {
  const result = runScoringEngine(
    createDemoPlayerDNAInput({
      answers: [{ questionCode: "PLATE_CONFIDENCE", answer: { value: 1 } }]
    }),
    getPlayerDNAScoringRules()
  );

  assert.ok(result.scores.confidence < 50);
});

test("BBCOR transition goal increases transition readiness without forcing maximum readiness", () => {
  const result = runScoringEngine(
    createDemoPlayerDNAInput({
      answers: [{ questionCode: "PRIMARY_GOAL", answer: { value: "prepare for BBCOR" } }]
    }),
    getPlayerDNAScoringRules()
  );

  assert.ok(result.scores.transitionReadiness > 50);
  assert.ok(result.scores.transitionReadiness < 90);
  assert.equal(result.categories.primaryHittingGoal, "prepare_for_transition");
});

test("conflicting BatMatch answers retain bounded scores", () => {
  const result = runScoringEngine(
    createDemoPlayerDNAInput({
      answers: [
        { questionCode: "PRIMARY_GOAL", answer: { value: "more power" } },
        { questionCode: "CURRENT_BAT_FEEL", answer: { value: "too_heavy" } },
        { questionCode: "PLATE_CONFIDENCE", answer: { value: 1 } }
      ]
    }),
    getPlayerDNAScoringRules()
  );

  assert.ok(result.scores.powerPotential > 50);
  assert.ok(result.scores.confidence < 50);
  assert.ok(Object.values(result.scores).every((score) => score >= 0 && score <= 100));
});

test("all scores remain between 0 and 100", () => {
  const result = runScoringEngine(createDemoPlayerDNAInput(), getPlayerDNAScoringRules());

  assert.ok(Object.values(result.scores).every((score) => score >= 0 && score <= 100));
});
