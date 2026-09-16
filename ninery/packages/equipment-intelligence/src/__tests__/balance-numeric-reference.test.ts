import assert from "node:assert/strict";
import test from "node:test";
import {
  auditLegacyBalanceSemantics,
  BALANCE_PROFILE_NUMERIC_DIRECTION,
  BALANCE_PROFILE_NUMERIC_REFERENCE_VERSION,
  convertLegacyBalanceToCanonical,
  createLegacyDerivedBalanceNumericReference,
  LEGACY_BALANCE_TO_CANONICAL_MAPPING_VERSION,
  mapBalanceNumericValueToOrdinal,
  toEquipmentDNANumericReferenceCandidate,
  validateBalanceNumericReference,
  validateEquipmentDNANumericReference
} from "../index.js";

test("semantic audit confirms inverse legacy balance conversion with current engine usage", () => {
  const audit = auditLegacyBalanceSemantics();
  assert.equal(audit.version, "1.0");
  assert.equal(audit.legacyField, "balance");
  assert.equal(audit.characteristicCode, "SWING_BALANCE");
  assert.equal(audit.semanticMeaning, "balance_support");
  assert.equal(audit.canonicalDirection, "inverse");
  assert.equal(audit.intrinsicEnoughForMigration, true);
  assert.deepEqual(audit.engineUsage.scoringDimensions, ["SWING_FEEL_BALANCE_FIT"]);
  assert.equal(audit.engineUsage.directScoring, true);
  assert.equal(audit.engineUsage.inverseScoring, false);
  assert.equal(audit.engineUsage.confidenceUse, true);
});

test("legacy balance conversion supports inverse, direct, boundaries, and unsupported strategy", () => {
  assert.equal(convertLegacyBalanceToCanonical(72, "inverse").canonicalValue, 28);
  assert.equal(convertLegacyBalanceToCanonical(72, "direct").canonicalValue, 72);
  assert.equal(convertLegacyBalanceToCanonical(0, "inverse").canonicalValue, 100);
  assert.equal(convertLegacyBalanceToCanonical(100, "inverse").canonicalValue, 0);
  assert.equal(convertLegacyBalanceToCanonical(50, "inverse").canonicalValue, 50);
  assert.equal(convertLegacyBalanceToCanonical(72, "unsupported").canonicalValue, undefined);
  assert.throws(() => convertLegacyBalanceToCanonical(-1, "inverse"), /between 0 and 100/);
  assert.throws(() => convertLegacyBalanceToCanonical(101, "inverse"), /between 0 and 100/);
  assert.throws(() => convertLegacyBalanceToCanonical(Number.NaN, "inverse"), /finite/);
});

test("balance ordinal ranges are stable at boundaries", () => {
  assert.equal(mapBalanceNumericValueToOrdinal(0), "very_balanced");
  assert.equal(mapBalanceNumericValueToOrdinal(19), "very_balanced");
  assert.equal(mapBalanceNumericValueToOrdinal(20), "balanced");
  assert.equal(mapBalanceNumericValueToOrdinal(39), "balanced");
  assert.equal(mapBalanceNumericValueToOrdinal(40), "slightly_end_loaded");
  assert.equal(mapBalanceNumericValueToOrdinal(59), "slightly_end_loaded");
  assert.equal(mapBalanceNumericValueToOrdinal(60), "end_loaded");
  assert.equal(mapBalanceNumericValueToOrdinal(79), "end_loaded");
  assert.equal(mapBalanceNumericValueToOrdinal(80), "very_end_loaded");
  assert.equal(mapBalanceNumericValueToOrdinal(100), "very_end_loaded");
});

test("legacy-derived balance reference preserves provenance and validates", () => {
  const reference = createLegacyDerivedBalanceNumericReference({
    sourceValue: 89,
    equipmentId: "eq-icon",
    equipmentVariantId: "var-icon"
  });
  const runtime = toEquipmentDNANumericReferenceCandidate(reference);
  const validation = validateBalanceNumericReference({
    ordinal: reference.ordinal,
    numericReference: runtime,
    conversionExplanation: reference.rationale,
    sourceValue: reference.sourceValue
  });

  assert.equal(reference.referenceVersion, BALANCE_PROFILE_NUMERIC_REFERENCE_VERSION);
  assert.equal(reference.mappingVersion, LEGACY_BALANCE_TO_CANONICAL_MAPPING_VERSION);
  assert.equal(reference.direction, BALANCE_PROFILE_NUMERIC_DIRECTION);
  assert.equal(reference.sourceValue, 89);
  assert.equal(reference.canonicalValue, 11);
  assert.equal(reference.ordinal, "very_balanced");
  assert.equal(reference.conversionStrategy, "inverse");
  assert.equal(reference.confidence, "moderate");
  assert.equal(runtime.sourceScore, 89);
  assert.equal(validation.valid, true);
  assert.equal(validateEquipmentDNANumericReference({
    attributeKey: "balance_profile",
    ordinalValue: reference.ordinal,
    numericReference: runtime
  }).valid, true);
});

test("balance reference validation blocks inconsistent ordinal and estimated confidence", () => {
  const reference = createLegacyDerivedBalanceNumericReference({
    sourceValue: 16,
    equipmentId: "eq",
    equipmentVariantId: "var"
  });
  const runtime = toEquipmentDNANumericReferenceCandidate(reference);
  const inconsistent = validateBalanceNumericReference({
    ordinal: "balanced",
    numericReference: runtime,
    conversionExplanation: reference.rationale,
    sourceValue: reference.sourceValue
  });
  const lowConfidence = validateBalanceNumericReference({
    ordinal: reference.ordinal,
    numericReference: { ...runtime, confidence: "estimated" },
    conversionExplanation: reference.rationale,
    sourceValue: reference.sourceValue
  });

  assert.equal(inconsistent.valid, false);
  assert.ok(inconsistent.findings.includes("ORDINAL_INCONSISTENT"));
  assert.equal(lowConfidence.valid, false);
  assert.ok(lowConfidence.findings.includes("CONFIDENCE_INSUFFICIENT"));
});
