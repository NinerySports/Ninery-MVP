import assert from "node:assert/strict";
import test from "node:test";
import {
  CANONICAL_EQUIPMENT_DNA_PROFILE_VERSION,
  EQUIPMENT_DNA_SHADOW_COMPARISON_VERSION,
  EQUIPMENT_DNA_SHADOW_DIFFERENCE_THRESHOLDS,
  EQUIPMENT_ORDINAL_TO_NUMERIC_COMPARISON_VERSION,
  CanonicalEquipmentDNAProfileLoader,
  CanonicalEquipmentDNADuplicateActiveEvaluationError,
  adaptLegacyEquipmentDNAProfile,
  compareCanonicalAndLegacyEquipmentDNA,
  ordinalToNumericComparisonValue,
  type CanonicalEquipmentDNAProfile,
  type CanonicalEquipmentDNAProfileLoaderRepository,
  type CanonicalEquipmentDNALoaderEvaluationRow,
  type EquipmentDNAEvidenceRecord,
  type EquipmentDNAProfile
} from "../index.js";

const equipmentId = "equipment-1";
const variantId = "variant-1";

const repository: CanonicalEquipmentDNAProfileLoaderRepository = {
  async getEquipmentForCanonicalProfile() {
    return { id: equipmentId, manufacturer: "Rawlings", model: "ICON", modelYear: 2026 };
  },
  async getVariantForCanonicalProfile() {
    return { id: variantId, equipmentId, sku: "RAW-ICON-USA-30-22" };
  },
  async listActiveCanonicalEvaluations() {
    return completeEvaluations();
  }
};

test("canonical loader combines equipment and variant evaluations deterministically", async () => {
  const profile = await new CanonicalEquipmentDNAProfileLoader(repository).loadCanonicalEquipmentDNAProfile({
    equipmentId,
    equipmentVariantId: variantId,
    generatedAt: new Date("2026-07-20T00:00:00.000Z")
  });

  assert.equal(profile.version, CANONICAL_EQUIPMENT_DNA_PROFILE_VERSION);
  assert.equal(profile.registryVersion, "1.0");
  assert.equal(profile.confidenceModelVersion, "1.0");
  assert.equal(profile.readinessModelVersion, "1.0");
  assert.equal(profile.scoreMappingVersion, "1.0");
  assert.equal(profile.readiness.ready, true);
  assert.equal(profile.maturity, "evaluated");
  assert.equal(profile.attributes.length, 9);
  assert.deepEqual(profile.attributes.slice(0, 3).map((attribute) => attribute.key), ["length", "weight", "drop"]);
  assert.equal(profile.attributes.find((attribute) => attribute.key === "length")?.targetLevel, "variant");
  assert.equal(profile.attributes.find((attribute) => attribute.key === "certification")?.targetLevel, "equipment");
  assert.equal(profile.attributes.every((attribute) => attribute.evidence.length > 0), true);
  assert.equal(profile.attributes.every((attribute) => attribute.rationale.length > 0), true);
});

test("canonical loader reports missing required attributes", async () => {
  const missingRepository: CanonicalEquipmentDNAProfileLoaderRepository = {
    ...repository,
    async listActiveCanonicalEvaluations() {
      return completeEvaluations().filter((evaluation) => evaluation.attributeKey !== "length");
    }
  };

  const profile = await new CanonicalEquipmentDNAProfileLoader(missingRepository).loadCanonicalEquipmentDNAProfile({ equipmentId, equipmentVariantId: variantId });

  assert.equal(profile.readiness.ready, false);
  assert.ok(profile.missingAttributes.includes("length"));
});

test("canonical loader detects wrong target levels and duplicate active evaluations", async () => {
  const wrongTargetRepository: CanonicalEquipmentDNAProfileLoaderRepository = {
    ...repository,
    async listActiveCanonicalEvaluations() {
      return [evaluation("length", 30, "equipment", equipmentId)];
    }
  };
  const wrongTarget = await new CanonicalEquipmentDNAProfileLoader(wrongTargetRepository).loadCanonicalEquipmentDNAProfile({ equipmentId });
  assert.ok(wrongTarget.invalidAttributes.includes("length"));

  const duplicateRepository: CanonicalEquipmentDNAProfileLoaderRepository = {
    ...repository,
    async listActiveCanonicalEvaluations() {
      const duplicate = evaluation("length", 30, "variant", variantId);
      return [duplicate, { ...duplicate, id: "eval-duplicate" }];
    }
  };
  await assert.rejects(
    () => new CanonicalEquipmentDNAProfileLoader(duplicateRepository).loadCanonicalEquipmentDNAProfile({ equipmentId, equipmentVariantId: variantId }),
    CanonicalEquipmentDNADuplicateActiveEvaluationError
  );
});

test("legacy adapter preserves missing values and source identifiers", () => {
  const legacy = legacyProfile({ scores: { batControl: 90, swingWeight: undefined } });
  const adapted = adaptLegacyEquipmentDNAProfile(legacy);

  assert.equal(adapted.scores.batControl, 90);
  assert.equal(adapted.scores.swingWeight, undefined);
  assert.equal(legacy.scores.swingWeight, undefined);
  assert.equal(adapted.sourceProfileId, "legacy-profile-1");
});

test("ordinal-to-numeric comparison mapping is versioned and deterministic", () => {
  assert.equal(EQUIPMENT_ORDINAL_TO_NUMERIC_COMPARISON_VERSION, "1.0");
  assert.equal(ordinalToNumericComparisonValue("forgiveness", "very_low"), 10);
  assert.equal(ordinalToNumericComparisonValue("forgiveness", "low"), 30);
  assert.equal(ordinalToNumericComparisonValue("forgiveness", "moderate"), 50);
  assert.equal(ordinalToNumericComparisonValue("forgiveness", "high"), 70);
  assert.equal(ordinalToNumericComparisonValue("forgiveness", "very_high"), 90);
  assert.equal(ordinalToNumericComparisonValue("swing_effort", "very_easy"), 10);
  assert.equal(ordinalToNumericComparisonValue("swing_effort", "very_demanding"), 90);
  assert.equal(ordinalToNumericComparisonValue("swing_effort", "moderate"), ordinalToNumericComparisonValue("swing_effort", "moderate"));
  assert.throws(() => ordinalToNumericComparisonValue("swing_effort", "high"), /Unsupported/);
});

test("shadow comparison classifies thresholds and specification checks", () => {
  assert.equal(EQUIPMENT_DNA_SHADOW_COMPARISON_VERSION, "1.0");
  assert.equal(EQUIPMENT_DNA_SHADOW_DIFFERENCE_THRESHOLDS.alignedMaximum, 10);
  assert.equal(EQUIPMENT_DNA_SHADOW_DIFFERENCE_THRESHOLDS.minorMaximum, 20);

  const canonical = canonicalProfile();
  const aligned = compareCanonicalAndLegacyEquipmentDNA({ canonicalProfile: canonical, legacyProfile: adaptLegacyEquipmentDNAProfile(legacyProfile()), catalog: catalog() });
  assert.equal(aligned.overallStatus, "aligned");
  assert.equal(aligned.specificationChecks.every((check) => check.status === "match"), true);
  assert.ok(aligned.alignedCount >= 5);

  const minor = compareCanonicalAndLegacyEquipmentDNA({
    canonicalProfile: canonical,
    legacyProfile: adaptLegacyEquipmentDNAProfile(legacyProfile({ scores: { batControl: 59, swingWeight: 50, barrelForgiveness: 70, sweetSpotSize: 70, powerPotential: 70 } })),
    catalog: catalog()
  });
  assert.equal(minor.comparedAttributes.find((item) => item.canonicalKey === "bat_control_support")?.status, "minor_difference");
  assert.equal(minor.overallStatus, "review_recommended");

  const material = compareCanonicalAndLegacyEquipmentDNA({
    canonicalProfile: canonical,
    legacyProfile: adaptLegacyEquipmentDNAProfile(legacyProfile({ scores: { batControl: 20, swingWeight: 50, barrelForgiveness: 70, sweetSpotSize: 70, powerPotential: 70 } })),
    catalog: catalog()
  });
  assert.equal(material.comparedAttributes.find((item) => item.canonicalKey === "bat_control_support")?.status, "material_difference");
  assert.equal(material.overallStatus, "material_disagreement");

  const specMismatch = compareCanonicalAndLegacyEquipmentDNA({ canonicalProfile: canonical, legacyProfile: adaptLegacyEquipmentDNAProfile(legacyProfile()), catalog: { ...catalog(), drop: -10 } });
  assert.equal(specMismatch.specificationChecks.find((check) => check.key === "drop")?.status, "mismatch");
  assert.equal(specMismatch.overallStatus, "review_recommended");
});

test("shadow comparison keeps missing and experimental mappings honest", () => {
  const missingLegacy = compareCanonicalAndLegacyEquipmentDNA({ canonicalProfile: canonicalProfile(), legacyProfile: adaptLegacyEquipmentDNAProfile(legacyProfile({ scores: { batControl: undefined } })), catalog: catalog() });
  assert.equal(missingLegacy.comparedAttributes.find((item) => item.canonicalKey === "bat_control_support")?.status, "missing_legacy");

  const noLegacy = compareCanonicalAndLegacyEquipmentDNA({ canonicalProfile: canonicalProfile(), catalog: catalog() });
  assert.equal(noLegacy.overallStatus, "insufficient_data");

  const experimental = compareCanonicalAndLegacyEquipmentDNA({
    canonicalProfile: {
      ...canonicalProfile(),
      attributes: [...canonicalProfile().attributes, attribute("transition_difficulty", "moderate", "equipment"), attribute("confidence_building_potential", "high", "equipment")]
    },
    legacyProfile: adaptLegacyEquipmentDNAProfile(legacyProfile()),
    catalog: catalog()
  });
  assert.equal(experimental.comparedAttributes.find((item) => item.canonicalKey === "transition_difficulty")?.status, "incomparable");
  assert.equal(experimental.comparedAttributes.find((item) => item.canonicalKey === "confidence_building_potential")?.status, "incomparable");
  assert.notEqual(experimental.overallStatus, "material_disagreement");
});

function completeEvaluations() {
  return [
    evaluation("length", 30, "variant", variantId),
    evaluation("weight", 22, "variant", variantId),
    evaluation("drop", -8, "variant", variantId),
    evaluation("certification", "USA", "equipment", equipmentId),
    evaluation("barrel_diameter", 2.625, "equipment", equipmentId),
    evaluation("swing_effort", "moderate", "equipment", equipmentId),
    evaluation("forgiveness", "high", "equipment", equipmentId),
    evaluation("sweet_spot_support", "high", "equipment", equipmentId),
    evaluation("bat_control_support", "high", "equipment", equipmentId)
  ];
}

function evaluation(key: string, value: string | number, targetLevel: "equipment" | "variant", targetId: string): CanonicalEquipmentDNALoaderEvaluationRow {
  return {
    id: `eval-${key}`,
    equipmentId: targetLevel === "equipment" ? targetId : undefined,
    equipmentVariantId: targetLevel === "variant" ? targetId : undefined,
    targetLevel,
    attributeKey: key,
    attributeDefinitionVersion: "1.0",
    value,
    confidence: "high",
    evaluationMethod: key === "length" || key === "weight" || key === "drop" || key === "certification" || key === "barrel_diameter" ? "direct_specification" : "derived_mapping",
    evaluationVersion: 1,
    status: "active",
    rationale: `${key} rationale`,
    evaluatedAt: new Date("2026-07-15T00:00:00.000Z"),
    evidenceRecords: [evidence(key, value, targetLevel, targetId), ...(isBehaviorKey(key) ? [rubricEvidence(key, value, targetLevel, targetId)] : [])]
  };
}

function evidence(key: string, value: string | number, targetLevel: "equipment" | "variant", targetId: string): EquipmentDNAEvidenceRecord & { id: string } {
  const sourceType = isBehaviorKey(key) ? "internal_derived" : "manufacturer_specification";
  const method = isBehaviorKey(key) ? "derived_mapping" : "direct_specification";
  return {
    id: `evidence-${key}`,
    equipmentId: targetLevel === "equipment" ? targetId : undefined,
    equipmentVariantId: targetLevel === "variant" ? targetId : undefined,
    targetLevel,
    attributeKey: key,
    attributeDefinitionVersion: "1.0",
    sourceType,
    sourceName: "Fixture",
    sourceReference: `fixture:${key}`,
    method,
    normalizedValue: value,
    status: "active"
  };
}

function rubricEvidence(key: string, value: string | number, targetLevel: "equipment" | "variant", targetId: string): EquipmentDNAEvidenceRecord & { id: string } {
  return { ...evidence(key, value, targetLevel, targetId), id: `rubric-${key}`, sourceType: "other", sourceName: "Rubric", method: "standardized_rubric" };
}

function isBehaviorKey(key: string) {
  return key === "swing_effort" || key === "forgiveness" || key === "sweet_spot_support" || key === "bat_control_support";
}

function canonicalProfile(): CanonicalEquipmentDNAProfile {
  return {
    version: "1.0",
    equipmentId,
    equipmentVariantId: variantId,
    equipmentName: "Rawlings ICON 2026",
    variantLabel: "RAW-ICON-USA-30-22",
    registryVersion: "1.0",
    confidenceModelVersion: "1.0",
    readinessModelVersion: "1.0",
    scoreMappingVersion: "1.0",
    readiness: { ready: true, missingRequiredAttributes: [], insufficientConfidenceAttributes: [], invalidAttributes: [], experimentalAttributesIgnored: [], reasons: [] },
    maturity: "evaluated",
    attributes: [
      attribute("length", 30, "variant"),
      attribute("weight", 22, "variant"),
      attribute("drop", -8, "variant"),
      attribute("certification", "USA", "equipment"),
      attribute("barrel_diameter", 2.625, "equipment"),
      attribute("swing_effort", "moderate", "equipment"),
      attribute("forgiveness", "high", "equipment"),
      attribute("sweet_spot_support", "high", "equipment"),
      attribute("bat_control_support", "high", "equipment"),
      attribute("power_potential", "high", "equipment")
    ],
    missingAttributes: [],
    invalidAttributes: [],
    conflicts: [],
    generatedAt: new Date("2026-07-20T00:00:00.000Z")
  };
}

function attribute(key: string, value: string | number | boolean, targetLevel: "equipment" | "variant") {
  return {
    key,
    definitionVersion: "1.0",
    domain: key === "length" || key === "weight" || key === "drop" || key === "certification" || key === "barrel_diameter" ? "physical" : "performance",
    targetLevel,
    value,
    confidence: "high",
    evaluationMethod: targetLevel === "variant" ? "direct_specification" : "derived_mapping",
    evaluationVersion: 1,
    rationale: `${key} rationale`,
    evaluatedAt: new Date("2026-07-15T00:00:00.000Z"),
    evidence: [{ evidenceRecordId: `evidence-${key}`, sourceType: "other", sourceName: "Fixture", method: "standardized_rubric", status: "active" }],
    status: "active"
  } as CanonicalEquipmentDNAProfile["attributes"][number];
}

function legacyProfile(overrides: Partial<EquipmentDNAProfile> = {}): EquipmentDNAProfile {
  return {
    equipmentId,
    variantId,
    sourceLevel: "model",
    manufacturer: "Rawlings",
    model: "ICON",
    modelYear: 2026,
    certification: "USA",
    category: "bat",
    construction: "two_piece",
    material: "composite",
    barrelDiameter: 2.625,
    status: "active",
    profileVersion: 1,
    evidenceConfidence: { score: 80, band: "high" },
    certificationLevel: "gold",
    secondaryPersonalities: [],
    fitProfiles: [],
    specifications: [],
    availableVariants: [],
    selectedVariant: { id: variantId, lengthInches: 30, weightOunces: 22, dropWeight: -8, sku: "RAW-ICON-USA-30-22" },
    sourceProfileId: "legacy-profile-1",
    profileCompleteness: 100,
    publishedAt: "2026-07-01T00:00:00.000Z",
    missingCharacteristics: [],
    explanations: [],
    eligibility: { eligible: true, reasons: [] },
    ...overrides,
    scores: { batControl: 70, swingWeight: 50, barrelForgiveness: 70, sweetSpotSize: 70, powerPotential: 70, balance: 80, confidenceBuilding: 80, transitionFriendliness: 70, ...overrides.scores }
  };
}

function catalog() {
  return { length: 30, weight: 22, drop: -8, certification: "USA", barrelDiameter: 2.625 };
}
