import test from "node:test";
import assert from "node:assert/strict";
import { calculateProfileConfidence } from "../scoring/confidence-calculator.js";
import { createDemoPlayerDNAInput } from "../demo-fixture.js";

test("complete player profile with completed BatMatch produces high but not validated confidence", () => {
  const confidence = calculateProfileConfidence(createDemoPlayerDNAInput());

  assert.equal(confidence.level, "high");
  assert.ok(confidence.score < 95);
});

test("missing growth information lowers profile confidence", () => {
  const complete = calculateProfileConfidence(createDemoPlayerDNAInput());
  const missingGrowth = calculateProfileConfidence(createDemoPlayerDNAInput({ growthMeasurements: [] }));

  assert.ok(missingGrowth.score < complete.score);
  assert.ok(missingGrowth.missingInformation.includes("Growth measurements"));
});

test("incomplete BatMatch session lowers confidence", () => {
  const confidence = calculateProfileConfidence(
    createDemoPlayerDNAInput({ batMatchSession: { status: "started" }, answers: [] })
  );

  assert.equal(confidence.level, "low");
  assert.ok(confidence.missingInformation.includes("Completed BatMatch session"));
});
