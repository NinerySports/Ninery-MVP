import assert from "node:assert/strict";
import test from "node:test";
import {
  equipmentCertificationValues,
  EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION,
  getActiveEquipmentDNAAttributeDefinitions,
  getEquipmentDNAAttributeDefinition,
  getEquipmentDNAAttributeDefinitions,
  getEquipmentDNAAttributesByDomain,
  getRequiredEquipmentDNAAttributeDefinitions,
  isEquipmentDNAAttributeKey,
  validateEquipmentDNAAttributeRegistry,
  validateEquipmentDNAAttributeValue
} from "../index.js";

test("registry exposes the MVP version and unique ordered definitions", () => {
  const definitions = getEquipmentDNAAttributeDefinitions();

  assert.equal(EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION, "1.0");
  assert.equal(definitions.length, 16);
  assert.deepEqual(validateEquipmentDNAAttributeRegistry(), []);
  assert.deepEqual(
    definitions.map((definition) => definition.order),
    [...definitions].map((definition) => definition.order).sort((left, right) => left - right)
  );
  assert.equal(new Set(definitions.map((definition) => definition.key)).size, definitions.length);
});

test("registry contains the canonical MVP bat attribute keys", () => {
  assert.deepEqual(
    getEquipmentDNAAttributeDefinitions().map((definition) => definition.key),
    [
      "length",
      "weight",
      "drop",
      "certification",
      "barrel_diameter",
      "construction",
      "material",
      "balance_profile",
      "swing_effort",
      "forgiveness",
      "sweet_spot_support",
      "power_potential",
      "barrel_stability",
      "transition_difficulty",
      "confidence_building_potential",
      "bat_control_support"
    ]
  );
});

test("required recommendation-ready attributes are focused and active", () => {
  const required = getRequiredEquipmentDNAAttributeDefinitions();

  assert.deepEqual(
    required.map((definition) => definition.key),
    [
      "length",
      "weight",
      "drop",
      "certification",
      "barrel_diameter",
      "swing_effort",
      "forgiveness",
      "sweet_spot_support",
      "bat_control_support"
    ]
  );
  assert.ok(required.every((definition) => definition.status === "active"));
});

test("active helper excludes experimental compatibility candidates", () => {
  const activeKeys = getActiveEquipmentDNAAttributeDefinitions().map((definition) => definition.key);

  assert.ok(!activeKeys.includes("transition_difficulty"));
  assert.ok(!activeKeys.includes("confidence_building_potential"));
});

test("domain lookup returns domain-specific attributes", () => {
  assert.deepEqual(
    getEquipmentDNAAttributesByDomain("compatibility").map((definition) => definition.key),
    ["transition_difficulty", "confidence_building_potential"]
  );
  assert.ok(getEquipmentDNAAttributesByDomain("physical").every((definition) => definition.domain === "physical"));
});

test("key guard and lookup are safe for unknown values", () => {
  assert.equal(isEquipmentDNAAttributeKey("swing_effort"), true);
  assert.equal(isEquipmentDNAAttributeKey("missing_key"), false);
  assert.equal(getEquipmentDNAAttributeDefinition("missing_key"), undefined);
});

test("certification reuses the existing Equipment DNA vocabulary", () => {
  const certification = getEquipmentDNAAttributeDefinition("certification");

  assert.equal(certification?.dataType, "enum");
  if (certification?.dataType === "enum") {
    assert.deepEqual(certification.allowedValues, equipmentCertificationValues);
  }
});

test("current score compatibility mappings are explicit", () => {
  assert.equal(getEquipmentDNAAttributeDefinition("bat_control_support")?.compatibility?.existingScoreAttribute, "batControl");
  assert.equal(getEquipmentDNAAttributeDefinition("swing_effort")?.compatibility?.existingScoreAttribute, "swingWeight");
  assert.equal(getEquipmentDNAAttributeDefinition("sweet_spot_support")?.compatibility?.seededCharacteristicCode, "sweet-spot-size");
});

test("transition difficulty is a non-required relational candidate", () => {
  const transitionDifficulty = getEquipmentDNAAttributeDefinition("transition_difficulty");

  assert.equal(transitionDifficulty?.status, "experimental");
  assert.equal(transitionDifficulty?.attributeNature, "relational_candidate");
  assert.equal(transitionDifficulty?.requiredForRecommendationReady, false);
  assert.match(transitionDifficulty?.parentExplanation ?? "", /player/i);
});

test("numeric validation enforces bounds, types, and integer rules", () => {
  assert.deepEqual(validateEquipmentDNAAttributeValue("length", 30), {
    valid: true,
    normalizedValue: 30
  });
  assert.equal(validateEquipmentDNAAttributeValue("length", "30").valid, false);
  assert.equal(validateEquipmentDNAAttributeValue("length", 10).valid, false);
  assert.equal(validateEquipmentDNAAttributeValue("drop", -8.5).valid, false);
});

test("enum validation normalizes only allowed values", () => {
  assert.deepEqual(validateEquipmentDNAAttributeValue("certification", " usa "), {
    valid: true,
    normalizedValue: "USA"
  });
  assert.deepEqual(validateEquipmentDNAAttributeValue("certification", "none"), {
    valid: true,
    normalizedValue: "none"
  });
  assert.equal(validateEquipmentDNAAttributeValue("certification", "USA Baseball").valid, false);
});

test("ordinal validation preserves allowed value order and rejects labels", () => {
  const swingEffort = getEquipmentDNAAttributeDefinition("swing_effort");

  assert.equal(swingEffort?.dataType, "ordinal");
  if (swingEffort?.dataType === "ordinal") {
    assert.deepEqual(swingEffort.allowedValues, ["very_easy", "easy", "moderate", "demanding", "very_demanding"]);
  }
  assert.deepEqual(validateEquipmentDNAAttributeValue("swing_effort", "DEMANDING"), {
    valid: true,
    normalizedValue: "demanding"
  });
  assert.equal(validateEquipmentDNAAttributeValue("swing_effort", "pretty easy").valid, false);
});

test("validation rejects unknown and empty values cleanly", () => {
  assert.equal(validateEquipmentDNAAttributeValue("not_real", "value").valid, false);
  assert.equal(validateEquipmentDNAAttributeValue("material", undefined).valid, false);
  assert.equal(validateEquipmentDNAAttributeValue("material", " ").valid, false);
});
