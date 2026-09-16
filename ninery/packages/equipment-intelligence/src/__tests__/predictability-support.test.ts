import assert from "node:assert/strict";
import test from "node:test";
import {
  PREDICTABILITY_SUPPORT_ATTRIBUTE_VERSION,
  PREDICTABILITY_SUPPORT_COMPOSITE_VERSION,
  PREDICTABILITY_SUPPORT_EVALUATION_VERSION,
  PREDICTABILITY_SUPPORT_EXCLUSIONS,
  PREDICTABILITY_SUPPORT_PARENT_DEFINITION,
  PREDICTABILITY_SUPPORT_TECHNICAL_DEFINITION,
  evaluatePredictabilitySupport,
  mapPredictabilityNumericValueToOrdinal,
  predictabilityExcludedComponentRationales,
  predictabilitySupportCompositePolicy,
  validatePredictabilitySupportCompositePolicy
} from "../index.js";

test("predictability support definition is equipment-side and avoids confidence guarantees", () => {
  assert.equal(PREDICTABILITY_SUPPORT_ATTRIBUTE_VERSION, "1.0");
  assert.equal(PREDICTABILITY_SUPPORT_EVALUATION_VERSION, "1.0");
  assert.equal(PREDICTABILITY_SUPPORT_COMPOSITE_VERSION, "1.0");
  assert.match(PREDICTABILITY_SUPPORT_TECHNICAL_DEFINITION, /stable, understandable, and repeatable/);
  assert.match(PREDICTABILITY_SUPPORT_PARENT_DEFINITION, /consistent and understandable/);
  assert.ok(PREDICTABILITY_SUPPORT_EXCLUSIONS.includes("player confidence"));
  assert.doesNotMatch(PREDICTABILITY_SUPPORT_PARENT_DEFINITION, /guarantee|make.*confident/i);
});

test("component policy is fixed-weight, deterministic, and excludes relational signals", () => {
  assert.deepEqual(validatePredictabilitySupportCompositePolicy(), []);
  assert.equal(predictabilitySupportCompositePolicy.normalizationStrategy, "fixed_weight");
  assert.equal(predictabilitySupportCompositePolicy.recommendationUsePolicy, "profile_only");
  assert.equal(predictabilitySupportCompositePolicy.bridgeStrategy, "profile_only");
  assert.equal(predictabilitySupportCompositePolicy.components.reduce((sum, component) => sum + component.weight, 0), 1);
  assert.deepEqual(
    predictabilitySupportCompositePolicy.components.map((component) => component.attributeKey),
    ["forgiveness", "sweet_spot_support", "swing_effort"]
  );
  assert.match(predictabilityExcludedComponentRationales.balance_profile, /not universally more predictable/);
  assert.match(predictabilityExcludedComponentRationales.confidence_building_potential, /legacy mixed/);
});

test("composite evaluation uses lower-level equipment evidence and inverts swing effort demand", () => {
  const result = evaluatePredictabilitySupport({
    components: [
      { attributeKey: "forgiveness", sourceValue: "very_high", numericValue: 86, confidence: "high" },
      { attributeKey: "sweet_spot_support", sourceValue: "very_high", numericValue: 88, confidence: "high" },
      { attributeKey: "swing_effort", sourceValue: "moderate", numericValue: 42, confidence: "high" }
    ],
    sourceReference: "fixture:predictability"
  });

  assert.equal(result.ordinalValue, "very_high");
  assert.equal(result.numericReference?.numericValue, 80);
  assert.equal(result.numericReference?.referenceMethod, "derived_from_evaluation");
  assert.equal(result.confidence, "moderate");
  assert.equal(result.componentCoverage, 1);
  assert.equal(result.componentResults.find((component) => component.attributeKey === "swing_effort")?.transformedValue, 58);
  assert.ok(result.findings.includes("LEGACY_CONFIDENCE_BUILDING_NOT_DIRECTLY_MIGRATABLE"));
  assert.ok(result.findings.includes("SHADOW_BRIDGE_BLOCKED"));
});

test("composite blocks missing required components and never fabricates zeroes", () => {
  const result = evaluatePredictabilitySupport({
    components: [
      { attributeKey: "forgiveness", sourceValue: "very_high", numericValue: 86, confidence: "high" }
    ]
  });

  assert.equal(result.numericReference, undefined);
  assert.equal(result.confidence, "estimated");
  assert.ok(result.findings.includes("COMPONENT_COVERAGE_INSUFFICIENT"));
  assert.ok(result.warnings.some((warning) => warning.includes("sweet_spot_support")));
});

test("predictability ordinal boundaries are stable", () => {
  assert.equal(mapPredictabilityNumericValueToOrdinal(0), "very_low");
  assert.equal(mapPredictabilityNumericValueToOrdinal(19), "very_low");
  assert.equal(mapPredictabilityNumericValueToOrdinal(20), "low");
  assert.equal(mapPredictabilityNumericValueToOrdinal(40), "moderate");
  assert.equal(mapPredictabilityNumericValueToOrdinal(60), "high");
  assert.equal(mapPredictabilityNumericValueToOrdinal(80), "very_high");
  assert.throws(() => mapPredictabilityNumericValueToOrdinal(101));
});
