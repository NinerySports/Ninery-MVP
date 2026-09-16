import assert from "node:assert/strict";
import test from "node:test";
import type {
  CanonicalEquipmentDNAAttributeValue,
  CanonicalEquipmentDNAProfile,
  EquipmentDNAAttributeKey,
  EquipmentDNAAttributeNormalizedValue
} from "@ninery/equipment-intelligence";
import type { PlayerDNAProfileResult, PrimaryHittingGoal } from "@ninery/player-intelligence";
import {
  CONFIDENCE_COMPATIBILITY_EXCLUSIONS,
  CONFIDENCE_COMPATIBILITY_MODEL_VERSION,
  CONFIDENCE_COMPATIBILITY_PARENT_DEFINITION,
  CONFIDENCE_COMPATIBILITY_POLICY_VERSION,
  CONFIDENCE_COMPATIBILITY_REASON_VERSION,
  CONFIDENCE_COMPATIBILITY_TECHNICAL_DEFINITION,
  compareConfidenceCompatibilityWithLegacyDimension,
  confidenceCompatibilityBandForScore,
  confidenceCompatibilityDimensionWeights,
  confidenceCompatibilityPolicy,
  evaluateConfidenceCompatibility,
  normalizeEquipmentConfidenceSupport,
  normalizePlayerConfidenceSupportNeeds,
  scoreSupportAdequacy,
  validateConfidenceCompatibilityLanguage,
  validateConfidenceCompatibilityPolicy
} from "../compatibility/confidence/index.js";

test("concept definition is relational, versioned, and avoids prohibited confidence claims", () => {
  assert.equal(CONFIDENCE_COMPATIBILITY_MODEL_VERSION, "1.0");
  assert.equal(CONFIDENCE_COMPATIBILITY_POLICY_VERSION, "1.0");
  assert.equal(CONFIDENCE_COMPATIBILITY_REASON_VERSION, "1.0");
  assert.equal(confidenceCompatibilityPolicy.nature, "relational");
  assert.equal(confidenceCompatibilityPolicy.recommendationUsePolicy, "shadow_only");
  assert.equal(validateConfidenceCompatibilityPolicy().length, 0);
  assert.match(CONFIDENCE_COMPATIBILITY_TECHNICAL_DEFINITION, /specific player's current developmental readiness/i);
  assert.match(CONFIDENCE_COMPATIBILITY_PARENT_DEFINITION, /may fit this player's current need/i);
  assert.ok(CONFIDENCE_COMPATIBILITY_EXCLUSIONS.includes("psychological diagnosis"));
  assert.deepEqual(validateConfidenceCompatibilityLanguage("This bat will make the player confident."), [
    "Prohibited confidence-compatibility language matched /will make (?:the )?(?:player|child|hitter).{0,20}confident/i."
  ]);
  assert.deepEqual(validateConfidenceCompatibilityLanguage("This bat may provide a manageable fit with understandable feedback."), []);
});

test("player support profile inverts capability only where direction is explicit and preserves missing familiarity", () => {
  const profile = normalizePlayerConfidenceSupportNeeds(playerFixture("improve_bat_control"));
  assert.equal(profile.version, "1.0");
  assert.equal(profile.batControlNeed, 22);
  assert.equal(profile.contactConsistencyNeed, 36);
  assert.equal(profile.manageableEffortNeed, 36);
  assert.equal(profile.developmentStage, "competitive");
  assert.equal(profile.currentEquipmentFamiliarity, undefined);
  assert.ok(profile.sourceSummary.derivedInputs.some((item) => item.includes("100 - capability")));
  assert.ok(profile.sourceSummary.missingInputs.includes("currentEquipmentFamiliarity"));
});

test("development stage and primary goal influence support needs without age-only inference", () => {
  const foundation = normalizePlayerConfidenceSupportNeeds(playerFixture("build_confidence", { developmentStage: "foundation" }));
  const advanced = normalizePlayerConfidenceSupportNeeds(playerFixture("improve_power", { developmentStage: "advanced" }));
  assert.ok((foundation.predictabilityNeed ?? 0) > (advanced.predictabilityNeed ?? 0));
  assert.equal(foundation.sourceSummary.availableInputs.includes("player.dateOfBirth"), false);
});

test("equipment support profile uses canonical numeric references and inverts swing-effort demand", () => {
  const profile = normalizeEquipmentConfidenceSupport(canonicalProfile());
  assert.equal(profile.predictabilitySupport, 80);
  assert.equal(profile.forgivenessSupport, 86);
  assert.equal(profile.sweetSpotSupport, 88);
  assert.equal(profile.batControlSupport, 91);
  assert.equal(profile.manageableEffortSupport, 58);
  assert.ok(profile.sourceSummary.numericReferenceInputs.includes("predictability_support"));
  assert.ok(profile.sourceSummary.numericReferenceInputs.includes("manageableEffortSupport from inverse swing_effort"));
  assert.equal(profile.sourceSummary.missingInputs.includes("confidenceBuilding"), false);
});

test("dimension scoring is asymmetric and never treats missing as zero", () => {
  assert.equal(scoreSupportAdequacy(70, 70), 100);
  assert.equal(scoreSupportAdequacy(70, 60), 89);
  assert.equal(scoreSupportAdequacy(70, 90), 95);
  assert.equal(scoreSupportAdequacy(90, 0), 1);
  const result = evaluateConfidenceCompatibility({
    playerDNA: playerFixture("improve_bat_control"),
    canonicalEquipmentProfile: canonicalProfile({ omitAttribute: "predictability_support" }),
    evaluatedAt: new Date("2026-08-01T00:00:00.000Z")
  });
  assert.equal(result.status, "blocked_missing_equipment_input");
  assert.equal(result.dimensions.find((dimension) => dimension.dimension === "predictability_alignment")?.score, undefined);
  assert.ok(result.missingInformation.some((item) => item.key === "predictabilitySupport" && item.required));
});

test("complete result includes trace, reasons, tradeoffs, bands, and moderate shadow confidence", () => {
  const result = evaluateConfidenceCompatibility({
    playerDNA: playerFixture("improve_bat_control"),
    canonicalEquipmentProfile: canonicalProfile(),
    evaluatedAt: new Date("2026-08-01T00:00:00.000Z")
  });
  assert.equal(result.status, "completed");
  assert.equal(result.recommendationUsePolicy, "shadow_only");
  assert.equal(result.confidence, "moderate");
  assert.equal(result.trace.directionInversions.includes("manageableEffortSupport = 100 - canonical swing_effort demand"), true);
  assert.equal(result.trace.completeness.requiredEquipmentInputsPresent, 5);
  assert.equal(result.dimensions.length, Object.keys(confidenceCompatibilityDimensionWeights).length);
  assert.ok((result.score ?? 0) >= 80);
  assert.equal(confidenceCompatibilityBandForScore(result.score ?? 0), result.band);
  assert.ok(result.reasons.some((reason) => reason.code === "PREDICTABLE_RESPONSE_SUPPORTS_CURRENT_NEEDS"));
  assert.ok(result.missingInformation.some((item) => item.key === "currentEquipmentFamiliarity" && !item.required));
});

test("advanced-player support excess can produce direct-feedback tradeoffs without psychological language", () => {
  const result = evaluateConfidenceCompatibility({
    playerDNA: playerFixture("improve_power", { developmentStage: "advanced" }),
    canonicalEquipmentProfile: canonicalProfile(),
    evaluatedAt: new Date("2026-08-01T00:00:00.000Z")
  });
  assert.ok(result.tradeoffs.some((tradeoff) => tradeoff.code === "ADVANCED_PLAYER_MAY_PREFER_MORE_DIRECT_RESPONSE"));
  const allText = [...result.reasons.map((item) => item.message), ...result.tradeoffs.map((item) => item.message)].join(" ");
  assert.deepEqual(validateConfidenceCompatibilityLanguage(allText), []);
});

test("unsupported versions block safely and v1.0 never returns validated confidence", () => {
  const result = evaluateConfidenceCompatibility({
    playerDNA: { ...playerFixture("improve_bat_control"), version: "future" },
    canonicalEquipmentProfile: canonicalProfile(),
    evaluatedAt: new Date("2026-08-01T00:00:00.000Z")
  });
  assert.equal(result.status, "blocked_unsupported_version");
  assert.notEqual(result.confidence, "validated");
});

test("legacy comparison distinguishes confidence-building and development-goal dimensions", () => {
  const result = evaluateConfidenceCompatibility({
    playerDNA: playerFixture("improve_bat_control"),
    canonicalEquipmentProfile: canonicalProfile(),
    evaluatedAt: new Date("2026-08-01T00:00:00.000Z")
  });
  const comparison = compareConfidenceCompatibilityWithLegacyDimension({
    result,
    legacy: {
      equipmentId: result.equipmentId,
      equipmentVariantId: result.equipmentVariantId,
      dimensions: [
        { code: "CONFIDENCE_BUILDING_FIT", rawScore: 82 },
        { code: "DEVELOPMENT_GOAL_FIT", rawScore: 74 }
      ],
      reasonCodes: ["CONFIDENCE_BUILDING_FIT"],
      tradeoffCodes: []
    }
  });
  assert.equal(comparison.legacyConfidenceBuildingFit, 82);
  assert.equal(comparison.legacyDevelopmentGoalFit, 74);
  assert.ok(["aligned", "minor_difference", "material_difference"].includes(comparison.status));
  assert.equal(comparison.explanation.includes("not equivalent") || comparison.explanation.includes("semantically broader"), true);
});

function playerFixture(
  goal: PrimaryHittingGoal,
  overrides: Partial<PlayerDNAProfileResult["categories"]> = {}
): PlayerDNAProfileResult {
  return {
    profileId: "player-dna-1",
    playerId: "player-1",
    version: "1.0.0",
    status: "generated",
    scoringRuleVersion: "player-dna-mvp-v1",
    inputHash: "player-input",
    scores: {
      batControl: 90,
      swingSpeed: 72,
      powerPotential: 76,
      contactConsistency: 68,
      physicalStrength: 62,
      confidence: 70,
      transitionReadiness: 74,
      growthStability: 66,
      equipmentAwareness: 78,
      profileCompleteness: 92
    },
    categories: {
      preferredSwingFeel: "light",
      developmentStage: "competitive",
      primaryHittingGoal: goal,
      currentEquipmentAssessment: "likes light swing, good pop, large sweet spot",
      growthStatus: "moderate_growth",
      profileConfidenceLevel: "high",
      ...overrides
    },
    confidence: { score: 84, level: "high", factors: {}, missingInformation: [] },
    explanations: [],
    missingInformation: [],
    inputSnapshot: { player: { id: "player-1" }, playerProfile: { experienceYears: 5 } },
    scoreBreakdown: {},
    generatedAt: "2026-01-01T00:00:00.000Z"
  };
}

function canonicalProfile(input: { omitAttribute?: EquipmentDNAAttributeKey } = {}): CanonicalEquipmentDNAProfile {
  const attributes = [
    attribute("predictability_support", "very_high", 80, "moderate"),
    attribute("forgiveness", "very_high", 86, "high"),
    attribute("sweet_spot_support", "very_high", 88, "high"),
    attribute("bat_control_support", "very_high", 91, "high"),
    attribute("swing_effort", "moderate", 42, "high")
  ].filter((candidate) => candidate.key !== input.omitAttribute);

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
    attributes,
    missingAttributes: [],
    invalidAttributes: [],
    conflicts: [],
    generatedAt: new Date("2026-08-01T00:00:00.000Z")
  };
}

function attribute(
  key: EquipmentDNAAttributeKey,
  value: EquipmentDNAAttributeNormalizedValue,
  numericValue: number,
  confidence: "moderate" | "high"
): CanonicalEquipmentDNAAttributeValue {
  return {
    key,
    definitionVersion: "1.0",
    domain: "performance",
    targetLevel: "equipment",
    value,
    confidence,
    evaluationMethod: "derived_mapping",
    evaluationVersion: 1,
    rationale: `${key} fixture rationale`,
    evaluatedAt: new Date("2026-08-01T00:00:00.000Z"),
    evidence: [
      {
        evidenceRecordId: `${key}-evidence`,
        sourceType: "internal_derived",
        sourceName: "test fixture",
        method: "derived_mapping",
        status: "active",
        sourceReference: `test:${key}`,
        rawValue: {
          normalizedScore: numericValue,
          sourceScore: numericValue,
          referenceMethod: key === "predictability_support" ? "derived_from_evaluation" : "legacy_preserved"
        },
        evaluatorType: "system"
      }
    ],
    status: "active"
  };
}
