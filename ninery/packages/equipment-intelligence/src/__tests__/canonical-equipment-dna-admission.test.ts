import assert from "node:assert/strict";
import test from "node:test";
import {
  CANONICAL_EQUIPMENT_DNA_ADMISSION_POLICY_VERSION,
  CANONICAL_EQUIPMENT_DNA_ADMISSION_DECISION_VERSION,
  evaluateCanonicalEquipmentDNAAdmission,
  meetsMinimumEquipmentDNAMaturity,
  type CanonicalEquipmentDNAProfile,
  type EquipmentDNAAttributeComparison,
  type EquipmentDNAShadowComparisonResult
} from "../index.js";

const equipmentId = "equipment-1";
const variantId = "variant-1";
const evaluatedAt = new Date("2026-07-21T00:00:00.000Z");

test("admission approves a complete aligned profile for internal candidate use while keeping live use disabled", () => {
  const decision = evaluateCanonicalEquipmentDNAAdmission({
    canonicalProfile: canonicalProfile(),
    shadowComparison: shadowComparison(),
    evaluatedAt
  });

  assert.equal(CANONICAL_EQUIPMENT_DNA_ADMISSION_POLICY_VERSION, "1.0");
  assert.equal(decision.version, CANONICAL_EQUIPMENT_DNA_ADMISSION_DECISION_VERSION);
  assert.equal(decision.policyVersion, "1.0");
  assert.equal(decision.outcome, "approved_for_internal_candidate");
  assert.equal(decision.eligibleForShadow, true);
  assert.equal(decision.eligibleForInternalCandidate, true);
  assert.equal(decision.liveRecommendationUseAllowed, false);
  assert.equal(decision.mappingCoverage.coverageRatio, 1);
  assert.deepEqual(decision.mappingCoverage.successfullyComparedKeys, ["bat_control_support", "swing_effort", "forgiveness", "sweet_spot_support"]);
  assert.equal(decision.versionAssessment.supported, true);
});

test("admission has explicit maturity ordering", () => {
  assert.equal(meetsMinimumEquipmentDNAMaturity("basic", "evaluated"), false);
  assert.equal(meetsMinimumEquipmentDNAMaturity("evaluated", "evaluated"), true);
  assert.equal(meetsMinimumEquipmentDNAMaturity("validated", "evaluated"), true);
  assert.equal(meetsMinimumEquipmentDNAMaturity("trusted", "validated"), true);
  assert.equal(meetsMinimumEquipmentDNAMaturity("living_intelligence", "trusted"), true);
});

test("admission blocks not-ready profiles before lower-priority material disagreements", () => {
  const decision = evaluateCanonicalEquipmentDNAAdmission({
    canonicalProfile: {
      ...canonicalProfile(),
      readiness: {
        ready: false,
        missingRequiredAttributes: ["length"],
        insufficientConfidenceAttributes: [],
        invalidAttributes: [],
        experimentalAttributesIgnored: [],
        reasons: ["Missing length."]
      },
      missingAttributes: ["length"]
    },
    shadowComparison: {
      ...shadowComparison(),
      overallStatus: "material_disagreement",
      materialDifferenceCount: 1,
      comparedAttributes: comparisons({ batControlStatus: "material_difference" })
    },
    evaluatedAt
  });

  assert.equal(decision.outcome, "blocked_not_ready");
  assert.ok(decision.blockers.some((blocker) => blocker.code === "PROFILE_NOT_READY"));
  assert.ok(decision.blockers.some((blocker) => blocker.code === "SHADOW_MATERIAL_DISAGREEMENT"));
});

test("admission blocks insufficient confidence using domain-specific thresholds", () => {
  const decision = evaluateCanonicalEquipmentDNAAdmission({
    canonicalProfile: {
      ...canonicalProfile(),
      attributes: canonicalProfile().attributes.map((attribute) =>
        attribute.key === "length" ? { ...attribute, confidence: "moderate" } : attribute
      )
    },
    shadowComparison: shadowComparison(),
    evaluatedAt
  });

  assert.equal(decision.outcome, "blocked_insufficient_confidence");
  assert.deepEqual(decision.blockers.find((blocker) => blocker.code === "REQUIRED_CONFIDENCE_INSUFFICIENT")?.attributeKeys, ["length"]);
});

test("admission blocks specification mismatches", () => {
  const decision = evaluateCanonicalEquipmentDNAAdmission({
    canonicalProfile: canonicalProfile(),
    shadowComparison: {
      ...shadowComparison(),
      overallStatus: "review_recommended",
      specificationChecks: specificationChecks({ dropStatus: "mismatch" })
    },
    evaluatedAt
  });

  assert.equal(decision.outcome, "blocked_specification_mismatch");
  assert.deepEqual(decision.blockers.find((blocker) => blocker.code === "SPECIFICATION_MISMATCH_PRESENT")?.attributeKeys, ["drop"]);
});

test("admission blocks insufficient required mapping coverage without treating missing values as aligned", () => {
  const decision = evaluateCanonicalEquipmentDNAAdmission({
    canonicalProfile: canonicalProfile(),
    shadowComparison: {
      ...shadowComparison(),
      comparedAttributes: comparisons({ batControlStatus: "missing_legacy" }),
      alignedCount: 3,
      overallStatus: "review_recommended"
    },
    evaluatedAt
  });

  assert.equal(decision.outcome, "blocked_insufficient_mapping_coverage");
  assert.equal(decision.mappingCoverage.coverageRatio, 0.75);
  assert.deepEqual(decision.mappingCoverage.missingLegacyKeys, ["bat_control_support"]);
});

test("admission blocks unsupported versions fail-closed", () => {
  const decision = evaluateCanonicalEquipmentDNAAdmission({
    canonicalProfile: { ...canonicalProfile(), registryVersion: "2.0" },
    shadowComparison: shadowComparison(),
    evaluatedAt
  });

  assert.equal(decision.outcome, "blocked_unsupported_version");
  assert.equal(decision.versionAssessment.supported, false);
  assert.deepEqual(decision.versionAssessment.unsupported, ["registry=2.0"]);
});

test("admission blocks invalid profiles and missing selected variants", () => {
  const decision = evaluateCanonicalEquipmentDNAAdmission({
    canonicalProfile: {
      ...canonicalProfile(),
      equipmentVariantId: undefined,
      invalidAttributes: ["length"],
      attributes: []
    },
    shadowComparison: { ...shadowComparison(), equipmentVariantId: undefined },
    evaluatedAt
  });

  assert.equal(decision.outcome, "blocked_invalid_profile");
  assert.ok(decision.blockers.some((blocker) => blocker.code === "MISSING_SELECTED_VARIANT"));
  assert.ok(decision.blockers.some((blocker) => blocker.code === "INVALID_CANONICAL_VALUE"));
  assert.ok(decision.blockers.some((blocker) => blocker.code === "PROFILE_LOAD_FAILED"));
});

test("admission reports optional and experimental mappings as warnings only", () => {
  const decision = evaluateCanonicalEquipmentDNAAdmission({
    canonicalProfile: {
      ...canonicalProfile(),
      readiness: {
        ...canonicalProfile().readiness,
        experimentalAttributesIgnored: ["confidence_building_potential", "transition_difficulty"]
      }
    },
    shadowComparison: shadowComparison(),
    evaluatedAt
  });

  assert.equal(decision.outcome, "approved_for_internal_candidate");
  assert.ok(decision.warnings.some((warning) => warning.code === "OPTIONAL_MAPPING_UNAVAILABLE"));
  assert.ok(decision.warnings.some((warning) => warning.code === "EXPERIMENTAL_ATTRIBUTE_IGNORED"));
  assert.deepEqual(decision.mappingCoverage.optionalIncomparableKeys, ["balance_profile", "confidence_building_potential", "transition_difficulty"]);
});

test("admission approves shadow only when review is recommended but no blocking criterion fails", () => {
  const decision = evaluateCanonicalEquipmentDNAAdmission({
    canonicalProfile: canonicalProfile(),
    shadowComparison: {
      ...shadowComparison(),
      overallStatus: "review_recommended",
      comparedAttributes: comparisons({ batControlStatus: "minor_difference" }),
      alignedCount: 3,
      minorDifferenceCount: 1
    },
    evaluatedAt
  });

  assert.equal(decision.outcome, "approved_for_shadow");
  assert.equal(decision.eligibleForShadow, true);
  assert.equal(decision.eligibleForInternalCandidate, false);
  assert.ok(decision.warnings.some((warning) => warning.code === "SHADOW_REVIEW_RECOMMENDED"));
});

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
    readiness: { ready: true, missingRequiredAttributes: [], insufficientConfidenceAttributes: [], invalidAttributes: [], experimentalAttributesIgnored: [], reasons: ["Ready."] },
    maturity: "evaluated",
    attributes: [
      attribute("length", 30, "physical", "variant", "high"),
      attribute("weight", 22, "physical", "variant", "high"),
      attribute("drop", -8, "physical", "variant", "high"),
      attribute("certification", "USA", "physical", "equipment", "high"),
      attribute("barrel_diameter", 2.625, "physical", "equipment", "high"),
      attribute("swing_effort", "moderate", "performance", "equipment", "moderate"),
      attribute("forgiveness", "high", "performance", "equipment", "moderate"),
      attribute("sweet_spot_support", "high", "performance", "equipment", "moderate"),
      attribute("bat_control_support", "high", "development", "equipment", "moderate")
    ],
    missingAttributes: [],
    invalidAttributes: [],
    conflicts: [],
    generatedAt: evaluatedAt
  };
}

function attribute(
  key: CanonicalEquipmentDNAProfile["attributes"][number]["key"],
  value: CanonicalEquipmentDNAProfile["attributes"][number]["value"],
  domain: CanonicalEquipmentDNAProfile["attributes"][number]["domain"],
  targetLevel: CanonicalEquipmentDNAProfile["attributes"][number]["targetLevel"],
  confidence: CanonicalEquipmentDNAProfile["attributes"][number]["confidence"]
): CanonicalEquipmentDNAProfile["attributes"][number] {
  return {
    key,
    definitionVersion: "1.0",
    domain,
    targetLevel,
    value,
    confidence,
    evaluationMethod: targetLevel === "variant" ? "direct_specification" : "derived_mapping",
    evaluationVersion: 1,
    rationale: `${key} rationale`,
    evaluatedAt,
    evidence: [{ evidenceRecordId: `evidence-${key}`, sourceType: "other", sourceName: "Fixture", method: "manual_review", status: "active" }],
    status: "active"
  };
}

function shadowComparison(): EquipmentDNAShadowComparisonResult {
  return {
    version: "1.0",
    equipmentId,
    equipmentVariantId: variantId,
    equipmentName: "Rawlings ICON 2026",
    canonicalProfileReady: true,
    canonicalMaturity: "evaluated",
    comparedAttributes: comparisons({}),
    specificationChecks: specificationChecks({}),
    alignedCount: 5,
    minorDifferenceCount: 0,
    materialDifferenceCount: 0,
    incomparableCount: 3,
    overallStatus: "aligned",
    reasons: ["Comparable canonical and legacy values are aligned within thresholds."]
  };
}

function comparisons(input: {
  batControlStatus?: EquipmentDNAAttributeComparison["status"];
}): EquipmentDNAAttributeComparison[] {
  return [
    comparison("bat_control_support", "batControl", input.batControlStatus ?? "aligned"),
    comparison("swing_effort", "swingWeight", "aligned"),
    comparison("forgiveness", "barrelForgiveness", "aligned"),
    comparison("sweet_spot_support", "sweetSpotSize", "aligned"),
    comparison("power_potential", "powerPotential", "aligned"),
    comparison("balance_profile", "balance", "incomparable"),
    comparison("confidence_building_potential", "confidenceBuilding", "incomparable"),
    comparison("transition_difficulty", "transitionFriendliness", "incomparable")
  ];
}

function comparison(
  canonicalKey: EquipmentDNAAttributeComparison["canonicalKey"],
  legacyField: string,
  status: EquipmentDNAAttributeComparison["status"]
): EquipmentDNAAttributeComparison {
  return {
    canonicalKey,
    legacyField,
    canonicalValue: status === "missing_canonical" ? undefined : "high",
    canonicalNumericEquivalent: status === "missing_canonical" || status === "incomparable" ? undefined : 70,
    legacyValue: status === "missing_legacy" ? undefined : 70,
    normalizedDifference: status === "aligned" ? 0 : status === "minor_difference" ? 15 : status === "material_difference" ? 40 : undefined,
    status,
    comparisonStrategy: "test strategy",
    explanation: `${canonicalKey} ${status}`
  };
}

function specificationChecks(input: {
  dropStatus?: "match" | "mismatch" | "missing";
}) {
  return [
    spec("length", 30, 30, "match"),
    spec("weight", 22, 22, "match"),
    spec("drop", -8, input.dropStatus === "mismatch" ? -10 : -8, input.dropStatus ?? "match"),
    spec("certification", "USA", "USA", "match"),
    spec("barrel_diameter", 2.625, 2.625, "match")
  ];
}

function spec(
  key: EquipmentDNAShadowComparisonResult["specificationChecks"][number]["key"],
  canonicalValue: unknown,
  catalogValue: unknown,
  status: EquipmentDNAShadowComparisonResult["specificationChecks"][number]["status"]
): EquipmentDNAShadowComparisonResult["specificationChecks"][number] {
  return { key, canonicalValue, catalogValue, status, explanation: `${key} ${status}` };
}
