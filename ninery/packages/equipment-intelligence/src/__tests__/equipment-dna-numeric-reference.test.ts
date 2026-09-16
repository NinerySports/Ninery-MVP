import assert from "node:assert/strict";
import test from "node:test";
import {
  EQUIPMENT_DNA_NUMERIC_REFERENCE_MAPPING_VERSION,
  EQUIPMENT_DNA_NUMERIC_REFERENCE_MODEL_VERSION,
  EquipmentDNANumericReferenceUnsupportedAttributeError,
  loadAttributeNumericReference,
  loadEquipmentDNANumericReferenceProfile,
  requireSupportedEquipmentDNANumericReferenceAttribute,
  supportedNumericReferenceAttributes,
  unsupportedNumericReferenceAttributes,
  validateEquipmentDNANumericReference,
  type CanonicalEquipmentDNAAttributeValue,
  type CanonicalEquipmentDNAProfile,
  type EquipmentDNANumericReference
} from "../index.js";

const evaluatedAt = new Date("2026-07-15T12:00:00.000Z");
const generatedAt = new Date("2026-07-20T00:00:00.000Z");

test("numeric reference constants and supported attributes are versioned and explicit", () => {
  assert.equal(EQUIPMENT_DNA_NUMERIC_REFERENCE_MODEL_VERSION, "1.0");
  assert.equal(EQUIPMENT_DNA_NUMERIC_REFERENCE_MAPPING_VERSION, "1.0");
  assert.deepEqual(supportedNumericReferenceAttributes, [
    "bat_control_support",
    "swing_effort",
    "forgiveness",
    "sweet_spot_support",
    "power_potential",
    "balance_profile",
    "predictability_support"
  ]);
  assert.deepEqual(unsupportedNumericReferenceAttributes, [
    "transition_difficulty",
    "confidence_building_potential"
  ]);
});

test("validation enforces ordinal consistency boundaries for five-level support", () => {
  assert.equal(validate("very_low", 0).valid, true);
  assert.equal(validate("very_low", 19).valid, true);
  assert.equal(validate("low", 20).valid, true);
  assert.equal(validate("low", 39).valid, true);
  assert.equal(validate("moderate", 40).valid, true);
  assert.equal(validate("moderate", 59).valid, true);
  assert.equal(validate("high", 60).valid, true);
  assert.equal(validate("high", 79).valid, true);
  assert.equal(validate("very_high", 80).valid, true);
  assert.equal(validate("very_high", 100).valid, true);
  assert.equal(validate("high", 91).valid, false);
});

test("validation enforces swing effort direction and rejects invalid numbers", () => {
  assert.equal(validate("very_easy", 19, "swing_effort").valid, true);
  assert.equal(validate("easy", 20, "swing_effort").valid, true);
  assert.equal(validate("moderate", 59, "swing_effort").valid, true);
  assert.equal(validate("demanding", 60, "swing_effort").valid, true);
  assert.equal(validate("very_demanding", 100, "swing_effort").valid, true);
  assert.equal(validate("very_easy", 80, "swing_effort").valid, false);
  assert.equal(validate("high", Number.NaN).valid, false);
  assert.equal(validate("high", Number.POSITIVE_INFINITY).valid, false);
  assert.equal(validate("high", -1).valid, false);
  assert.equal(validate("high", 101).valid, false);
});

test("validation enforces balance profile balanced-to-end-loaded direction", () => {
  assert.equal(validate("very_balanced", 0, "balance_profile").valid, true);
  assert.equal(validate("very_balanced", 19, "balance_profile").valid, true);
  assert.equal(validate("balanced", 20, "balance_profile").valid, true);
  assert.equal(validate("balanced", 39, "balance_profile").valid, true);
  assert.equal(validate("slightly_end_loaded", 40, "balance_profile").valid, true);
  assert.equal(validate("slightly_end_loaded", 59, "balance_profile").valid, true);
  assert.equal(validate("end_loaded", 60, "balance_profile").valid, true);
  assert.equal(validate("end_loaded", 79, "balance_profile").valid, true);
  assert.equal(validate("very_end_loaded", 80, "balance_profile").valid, true);
  assert.equal(validate("very_end_loaded", 100, "balance_profile").valid, true);
  assert.equal(validate("balanced", 84, "balance_profile").valid, false);
});

test("validation rejects unsupported scales and methods", () => {
  assert.equal(
    validateEquipmentDNANumericReference({
      attributeKey: "bat_control_support",
      ordinalValue: "high",
      numericReference: { ...reference(70), scale: "bad_scale" }
    }).valid,
    false
  );

  assert.equal(
    validateEquipmentDNANumericReference({
      attributeKey: "bat_control_support",
      ordinalValue: "high",
      numericReference: { ...reference(70), referenceMethod: "unsupported" }
    }).valid,
    false
  );
});

test("validation rejects confidence downgrade without explanation", () => {
  const result = validateEquipmentDNANumericReference({
    attributeKey: "forgiveness",
    ordinalValue: "high",
    previousConfidence: "high",
    numericReference: { ...reference(70), confidence: "moderate" }
  });

  assert.equal(result.valid, false);
  assert.match(result.reasons.join(" "), /downgrade/);

  const explained = validateEquipmentDNANumericReference({
    attributeKey: "forgiveness",
    ordinalValue: "high",
    previousConfidence: "high",
    confidenceChangeExplanation: "A newer derived source has lower confidence.",
    numericReference: { ...reference(70), confidence: "moderate" }
  });
  assert.equal(explained.valid, true);
});

test("loader preserves source score, provenance, confidence, and evaluator metadata", () => {
  const result = loadAttributeNumericReference(attribute("bat_control_support", "high", 76, 7.6));

  assert.equal(result.supported, "supported");
  assert.equal(result.validationStatus, "pass");
  assert.equal(result.numericReference?.numericValue, 76);
  assert.equal(result.numericReference?.sourceScore, 7.6);
  assert.equal(result.numericReference?.referenceMethod, "legacy_preserved");
  assert.equal(result.numericReference?.confidence, "high");
  assert.equal(result.numericReference?.evaluatorType, "internal");
  assert.equal(result.numericReference?.sourceReference, "fixture:score:BAT_CONTROL");
});

test("loader preserves derived-from-evaluation method for predictability support", () => {
  const result = loadAttributeNumericReference(attribute("predictability_support", "high", 72, 72, "derived_from_evaluation"));

  assert.equal(result.supported, "supported");
  assert.equal(result.validationStatus, "pass");
  assert.equal(result.numericReference?.numericValue, 72);
  assert.equal(result.numericReference?.referenceMethod, "derived_from_evaluation");
});

test("loader reports missing references without fabricating values", () => {
  const result = loadAttributeNumericReference({
    ...attribute("forgiveness", "high", 70),
    evidence: []
  });

  assert.equal(result.supported, "supported");
  assert.equal(result.validationStatus, "missing");
  assert.equal(result.numericReference, undefined);
});

test("unsupported relational attributes are rejected cleanly", () => {
  const unsupported = loadAttributeNumericReference(attribute("transition_difficulty", "moderate", 50));

  assert.equal(unsupported.supported, "unsupported");
  assert.equal(unsupported.validationStatus, "unsupported");
  assert.throws(
    () => requireSupportedEquipmentDNANumericReferenceAttribute("transition_difficulty"),
    EquipmentDNANumericReferenceUnsupportedAttributeError
  );
});

test("numeric reference profile loads deterministically and serializes without secrets", () => {
  const profile = loadEquipmentDNANumericReferenceProfile(canonicalProfile());
  const second = loadEquipmentDNANumericReferenceProfile(canonicalProfile());

  assert.equal(profile.version, "1.0");
  assert.equal(profile.availableCount, 7);
  assert.equal(profile.supportedCount, 7);
  assert.equal(profile.validCount, 7);
  assert.equal(profile.invalidCount, 0);
  assert.equal(profile.missingCount, 0);
  assert.deepEqual(
    profile.references.map((item) => item.attributeKey),
    ["bat_control_support", "swing_effort", "forgiveness", "sweet_spot_support", "power_potential", "balance_profile", "predictability_support"]
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(profile)),
    JSON.parse(JSON.stringify(second))
  );
  assert.doesNotMatch(JSON.stringify(profile), /DATABASE_URL|postgres:\/\//i);
});

function validate(
  ordinalValue: string,
  numericValue: number,
  attributeKey: "bat_control_support" | "swing_effort" | "balance_profile" = "bat_control_support"
) {
  return validateEquipmentDNANumericReference({
    attributeKey,
    ordinalValue,
    numericReference: reference(numericValue)
  });
}

function reference(numericValue: number): EquipmentDNANumericReference {
  return {
    numericValue,
    scale: "0_100",
    referenceMethod: "legacy_preserved",
    confidence: "high",
    evaluatorType: "internal",
    mappingVersion: "1.0",
    generatedAt: evaluatedAt,
    sourceEvidenceRecordId: "evidence-1",
    sourceReference: "fixture:score",
    sourceScore: numericValue / 10
  };
}

function canonicalProfile(): CanonicalEquipmentDNAProfile {
  return {
    version: "1.0",
    equipmentId: "equipment-1",
    equipmentVariantId: "variant-1",
    equipmentName: "Rawlings ICON 2026",
    variantLabel: "RAW-ICON-USA-30-22",
    registryVersion: "1.0",
    confidenceModelVersion: "1.0",
    readinessModelVersion: "1.0",
    scoreMappingVersion: "1.0",
    readiness: {
      ready: true,
      missingRequiredAttributes: [],
      insufficientConfidenceAttributes: [],
      invalidAttributes: [],
      experimentalAttributesIgnored: [],
      reasons: []
    },
    maturity: "evaluated",
    attributes: [
      attribute("bat_control_support", "high", 76, 7.6),
      attribute("swing_effort", "moderate", 42, 4.2),
      attribute("forgiveness", "high", 74, 7.4),
      attribute("sweet_spot_support", "very_high", 88, 8.8),
      attribute("power_potential", "very_high", 91, 9.1),
      attribute("balance_profile", "balanced", 31, 69),
      attribute("predictability_support", "high", 72, 72, "derived_from_evaluation")
    ],
    missingAttributes: [],
    invalidAttributes: [],
    conflicts: [],
    generatedAt
  };
}

function attribute(
  key: CanonicalEquipmentDNAAttributeValue["key"],
  value: CanonicalEquipmentDNAAttributeValue["value"],
  normalizedScore: number,
  sourceScore = normalizedScore / 10,
  referenceMethod = "legacy_preserved"
): CanonicalEquipmentDNAAttributeValue {
  return {
    key,
    definitionVersion: "1.0",
    domain: key === "bat_control_support" ? "development" : "performance",
    targetLevel: "equipment",
    value,
    confidence: "high",
    evaluationMethod: "derived_mapping",
    evaluationVersion: 1,
    rationale: `${key} fixture rationale.`,
    evaluatedAt,
    evidence: [
      {
        evidenceRecordId: `evidence-${key}`,
        sourceType: "internal_derived",
        sourceName: "Existing seeded Equipment DNA score",
        method: "derived_mapping",
        status: "active",
        sourceReference: `fixture:score:${key === "bat_control_support" ? "BAT_CONTROL" : key.toUpperCase()}`,
        rawValue: {
          sourceScore,
          normalizedScore,
          referenceMethod,
          mappingVersion: "1.0"
        },
        normalizedValue: value,
        evaluatorType: "system",
        evaluatorReference: "seed:test"
      }
    ],
    status: "active"
  };
}
