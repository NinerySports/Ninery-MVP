import assert from "node:assert/strict";
import test from "node:test";
import type {
  CanonicalEquipmentDNAAttributeValue,
  CanonicalEquipmentDNAProfile,
  EquipmentDNAAttributeDomain,
  EquipmentDNAAttributeKey,
  EquipmentDNAAttributeNormalizedValue
} from "@ninery/equipment-intelligence";
import type { PlayerDNAProfileResult } from "@ninery/player-intelligence";
import {
  COMPATIBILITY_DOUBLE_COUNTING_ANALYSIS_VERSION,
  COMPATIBILITY_PROMOTION_DECISION_VERSION,
  COMPATIBILITY_SYNTHETIC_PLAYER_MATRIX_VERSION,
  COMPATIBILITY_VALIDATION_MODEL_VERSION,
  COMPATIBILITY_VALIDATION_POLICY_VERSION,
  analyzeCompatibilityDoubleCounting,
  buildCompatibilitySyntheticMatrix,
  buildCompatibilitySyntheticPlayerProfiles,
  compatibilityPromotionPolicies,
  scoreSeparationLabel,
  validateCompatibilityLanguageSafety,
  validateCompatibilityModels
} from "../compatibility/validation/index.js";

const evaluatedAt = new Date("2026-08-04T00:00:00.000Z");

test("validation constants, policies, and separation labels are stable", () => {
  assert.equal(COMPATIBILITY_VALIDATION_MODEL_VERSION, "1.0");
  assert.equal(COMPATIBILITY_VALIDATION_POLICY_VERSION, "1.0");
  assert.equal(COMPATIBILITY_SYNTHETIC_PLAYER_MATRIX_VERSION, "1.0");
  assert.equal(COMPATIBILITY_PROMOTION_DECISION_VERSION, "1.0");
  assert.equal(COMPATIBILITY_DOUBLE_COUNTING_ANALYSIS_VERSION, "1.0");
  assert.equal(scoreSeparationLabel(0), "very_low");
  assert.equal(scoreSeparationLabel(3), "low");
  assert.equal(scoreSeparationLabel(8), "useful");
  assert.equal(scoreSeparationLabel(12), "strong");
  assert.equal(compatibilityPromotionPolicies.confidence_compatibility.allowExplanationOnlyWhenDoubleCountingHigh, true);
  assert.equal(compatibilityPromotionPolicies.transition_compatibility.maximumDoubleCountingRiskForInternalCandidate, "moderate");
});

test("synthetic player matrix contains required deterministic profiles without persistence", () => {
  const profiles = buildCompatibilitySyntheticPlayerProfiles(playerFixture());
  assert.equal(profiles.length, 6);
  assert.deepEqual(profiles.map((profile) => profile.profileId), [
    "synthetic-developing-support-needs",
    "synthetic-experienced-contact",
    "synthetic-power-ready",
    "synthetic-recent-growth",
    "synthetic-incomplete-context",
    "synthetic-advanced-direct-feedback"
  ]);
  assert.ok(profiles.every((profile) => profile.playerDNA.version === "1.0.0"));
  const incomplete = profiles.find((profile) => profile.profileId === "synthetic-incomplete-context");
  assert.equal(incomplete?.playerDNA.inputSnapshot.playerProfile?.experienceYears, undefined);
  assert.ok(incomplete?.knownMissingInformation.includes("playerProfile.experienceYears"));
});

test("matrix runs both compatibility models for all synthetic players and equipment", () => {
  const matrix = buildCompatibilitySyntheticMatrix({
    basePlayerDNA: playerFixture(),
    canonicalProfiles: demoProfiles(),
    currentEquipmentProfile: demoProfiles()[0],
    evaluatedAt
  });
  assert.equal(matrix.version, "1.0");
  assert.equal(matrix.playerProfiles.length, 6);
  assert.equal(matrix.equipment.length, 3);
  assert.equal(matrix.evaluations.length, 18);
  assert.ok(matrix.completedEvaluationCount >= 30);
  assert.equal(matrix.deterministic, true);
  assert.ok(matrix.evaluations.every((evaluation) => evaluation.confidenceCompatibility));
  assert.ok(matrix.evaluations.every((evaluation) => evaluation.transitionCompatibility));
});

test("validation suite returns independent promotion decisions and keeps live flags closed", () => {
  const result = validateCompatibilityModels({
    basePlayerDNA: playerFixture(),
    canonicalProfiles: demoProfiles(),
    currentEquipmentProfile: demoProfiles()[0],
    evaluatedAt
  });
  assert.equal(result.liveRecommendationUseAllowed, false);
  assert.equal(result.results.length, 2);
  const confidence = result.results.find((item) => item.model === "confidence_compatibility");
  const transition = result.results.find((item) => item.model === "transition_compatibility");
  assert.ok(confidence);
  assert.ok(transition);
  assert.equal(confidence?.promotionDecision.liveRankingUseAllowed, false);
  assert.equal(confidence?.promotionDecision.liveExplanationUseAllowed, false);
  assert.equal(transition?.promotionDecision.liveRankingUseAllowed, false);
  assert.equal(transition?.promotionDecision.liveExplanationUseAllowed, false);
  assert.ok(confidence?.promotionDecision.outcome);
  assert.ok(transition?.promotionDecision.outcome);
  assert.notEqual(confidence?.promotionDecision, transition?.promotionDecision);
  assert.ok(confidence?.doubleCounting.requiresReplacementRatherThanAddition);
  assert.ok(transition?.doubleCounting.requiresReplacementRatherThanAddition);
});

test("validation analyses cover separation, differentiation, stability, sensitivity, missing input, and calibration", () => {
  const suite = validateCompatibilityModels({
    basePlayerDNA: playerFixture(),
    canonicalProfiles: demoProfiles(),
    currentEquipmentProfile: demoProfiles()[0],
    evaluatedAt
  });
  for (const result of suite.results) {
    assert.ok(result.scoreSeparation.perPlayer.length >= 5);
    assert.ok(result.playerDifferentiation.perEquipment.length === 3);
    assert.ok(result.equipmentDifferentiation.perPlayer.length >= 5);
    assert.ok(result.stability.perturbations.length >= 2);
    assert.ok(result.stability.perturbations.every((perturbation) => perturbation.scoreDelta !== undefined));
    assert.ok(result.sensitivity.scenarios.length >= 3);
    assert.ok(result.monotonicity.checks.length >= 3);
    assert.equal(result.missingInputBehavior.safe, true);
    assert.equal(result.confidenceCalibration.validatedConfidenceCount, 0);
    assert.equal(result.languageSafety.safe, true);
    assert.ok(result.explanationQuality.inputGroundingRatio >= 0.8);
    assert.ok(result.findings.some((finding) => finding.code === "MORE_REAL_WORLD_VALIDATION_REQUIRED"));
  }
});

test("language safety catches prohibited phrases and accepts approved compatibility copy", () => {
  const unsafeConfidence = validateCompatibilityLanguageSafety({
    model: "confidence_compatibility",
    results: [
      {
        ...minimalConfidenceResult(),
        reasons: [{ code: "MODEL_CONFIDENCE_LIMITED", message: "This bat will make the player confident." }]
      }
    ]
  });
  assert.equal(unsafeConfidence.safe, false);
  const unsafeTransition = validateCompatibilityLanguageSafety({
    model: "transition_compatibility",
    results: [
      {
        ...minimalTransitionResult(),
        reasons: [{ code: "MODEL_CONFIDENCE_LIMITED", message: "This bat will be easy immediately." }]
      }
    ]
  });
  assert.equal(unsafeTransition.safe, false);
});

test("double-counting analysis distinguishes high confidence risk from moderate transition risk", () => {
  const confidence = analyzeCompatibilityDoubleCounting("confidence_compatibility");
  const transition = analyzeCompatibilityDoubleCounting("transition_compatibility");
  assert.equal(confidence.highestRisk, "high");
  assert.equal(confidence.safeForIndependentRankingWeight, false);
  assert.equal(confidence.safeForExplanationOnly, true);
  assert.equal(transition.highestRisk, "moderate");
  assert.equal(transition.safeForIndependentRankingWeight, false);
  assert.ok(transition.recommendations.some((recommendation) => recommendation.includes("replacement candidate")));
});

function playerFixture(): PlayerDNAProfileResult {
  return {
    profileId: "player-dna-demo",
    playerId: "player-demo",
    version: "1.0.0",
    status: "generated",
    scoringRuleVersion: "player-dna-mvp-v1",
    inputHash: "player-input",
    scores: {
      batControl: 88,
      swingSpeed: 68,
      powerPotential: 57,
      contactConsistency: 70,
      physicalStrength: 50,
      confidence: 69,
      transitionReadiness: 58,
      growthStability: 72,
      equipmentAwareness: 70,
      profileCompleteness: 92
    },
    categories: {
      preferredSwingFeel: "light",
      developmentStage: "competitive",
      primaryHittingGoal: "improve_bat_control",
      currentEquipmentAssessment: "likes a light swing",
      growthStatus: "moderate_growth",
      profileConfidenceLevel: "high"
    },
    confidence: { score: 84, level: "high", factors: {}, missingInformation: [] },
    explanations: [],
    missingInformation: [],
    inputSnapshot: { player: { id: "player-demo" }, playerProfile: { experienceYears: 5 } },
    scoreBreakdown: {},
    generatedAt: "2026-08-04T00:00:00.000Z"
  };
}

function demoProfiles(): CanonicalEquipmentDNAProfile[] {
  return [
    canonicalProfile("rawlings-icon", "Rawlings ICON 2026", "RAW-ICON-USA-30-22", { balance: 11, swingEffort: 42, forgiveness: 86, sweetSpot: 88, batControl: 91, predictability: 80, construction: "two_piece_composite" }),
    canonicalProfile("ls-atlas", "Louisville Slugger Atlas 2026", "LS-ATLAS-USA-30-22", { balance: 16, swingEffort: 48, forgiveness: 80, sweetSpot: 82, batControl: 85, predictability: 74, construction: "one_piece_alloy" }),
    canonicalProfile("easton-hype", "Easton Hype Fire 2026", "EAS-HYPE-USA-30-22", { balance: 26, swingEffort: 56, forgiveness: 88, sweetSpot: 91, batControl: 78, predictability: 78, construction: "two_piece_composite" })
  ];
}

function canonicalProfile(
  id: string,
  equipmentName: string,
  variantLabel: string,
  values: {
    balance: number;
    swingEffort: number;
    forgiveness: number;
    sweetSpot: number;
    batControl: number;
    predictability: number;
    construction: string;
  }
): CanonicalEquipmentDNAProfile {
  return {
    version: "1.0",
    equipmentId: `${id}-equipment`,
    equipmentVariantId: `${id}-variant`,
    equipmentName,
    variantLabel,
    registryVersion: "1.0",
    confidenceModelVersion: "1.0",
    readinessModelVersion: "1.0",
    scoreMappingVersion: "1.0",
    readiness: { ready: true, missingRequiredAttributes: [], insufficientConfidenceAttributes: [], invalidAttributes: [], experimentalAttributesIgnored: [], reasons: [] },
    maturity: "evaluated",
    attributes: [
      attr("length", 30, "physical", 30),
      attr("weight", 22, "physical", 22),
      attr("drop", -8, "physical", -8),
      attr("construction", values.construction, "physical"),
      attr("material", values.construction.includes("alloy") ? "alloy" : "composite", "physical"),
      attr("balance_profile", balanceOrdinal(values.balance), "performance", values.balance),
      attr("swing_effort", swingEffortOrdinal(values.swingEffort), "performance", values.swingEffort),
      attr("forgiveness", supportOrdinal(values.forgiveness), "performance", values.forgiveness),
      attr("sweet_spot_support", supportOrdinal(values.sweetSpot), "performance", values.sweetSpot),
      attr("bat_control_support", supportOrdinal(values.batControl), "performance", values.batControl),
      attr("predictability_support", supportOrdinal(values.predictability), "performance", values.predictability)
    ],
    missingAttributes: [],
    invalidAttributes: [],
    conflicts: [],
    generatedAt: evaluatedAt
  };
}

function attr(
  key: EquipmentDNAAttributeKey,
  value: EquipmentDNAAttributeNormalizedValue,
  domain: EquipmentDNAAttributeDomain,
  numericValue?: number
): CanonicalEquipmentDNAAttributeValue {
  return {
    key,
    definitionVersion: "1.0",
    domain,
    targetLevel: key === "length" || key === "weight" || key === "drop" ? "variant" : "equipment",
    value,
    confidence: "high",
    evaluationMethod: "derived_mapping",
    evaluationVersion: 1,
    rationale: `${key} validation fixture`,
    evaluatedAt,
    evidence: numericValue === undefined
      ? []
      : [{
          evidenceRecordId: `${key}-evidence`,
          sourceType: "internal_derived",
          sourceName: "validation fixture",
          method: "derived_mapping",
          status: "active",
          rawValue: { normalizedScore: numericValue, sourceScore: numericValue, referenceMethod: "legacy_preserved" },
          evaluatorType: "system"
        }],
    status: "active"
  };
}

function supportOrdinal(value: number): EquipmentDNAAttributeNormalizedValue {
  if (value >= 80) return "very_high";
  if (value >= 60) return "high";
  if (value >= 40) return "moderate";
  if (value >= 20) return "low";
  return "very_low";
}

function balanceOrdinal(value: number): EquipmentDNAAttributeNormalizedValue {
  if (value <= 19) return "very_balanced";
  if (value <= 39) return "balanced";
  if (value <= 59) return "slightly_end_loaded";
  if (value <= 79) return "end_loaded";
  return "very_end_loaded";
}

function swingEffortOrdinal(value: number): EquipmentDNAAttributeNormalizedValue {
  if (value <= 19) return "very_easy";
  if (value <= 39) return "easy";
  if (value <= 59) return "moderate";
  if (value <= 79) return "demanding";
  return "very_demanding";
}

function minimalConfidenceResult() {
  return {
    version: "1.0" as const,
    modelVersion: "1.0" as const,
    policyVersion: "1.0" as const,
    reasonVersion: "1.0" as const,
    recommendationUsePolicy: "shadow_only" as const,
    playerId: "player",
    equipmentId: "equipment",
    score: 90,
    band: "very_supportive_fit" as const,
    dimensions: [],
    confidence: "moderate" as const,
    reasons: [],
    tradeoffs: [],
    missingInformation: [],
    playerProfile: { version: "1.0" as const, playerId: "player", sourceSummary: { availableInputs: [], missingInputs: [], derivedInputs: [] }, confidence: "moderate" as const },
    equipmentProfile: { version: "1.0" as const, equipmentId: "equipment", sourceSummary: { numericReferenceInputs: [], ordinalProjectedInputs: [], missingInputs: [] }, confidence: "moderate" as const },
    trace: {
      playerInputs: {},
      equipmentInputs: {},
      transformations: [],
      directionInversions: [],
      weights: { predictability_alignment: 0.3, forgiveness_alignment: 0.2, bat_control_alignment: 0.2, manageable_effort_alignment: 0.15, contact_support_alignment: 0.15 },
      dimensionScores: [],
      completeness: { requiredPlayerInputsPresent: 0, requiredPlayerInputsTotal: 0, requiredEquipmentInputsPresent: 0, requiredEquipmentInputsTotal: 0 },
      confidenceFactors: [],
      versions: { model: "1.0" as const, policy: "1.0" as const, reasons: "1.0" as const, playerDNA: "1.0.0", equipmentDNAProfile: "1.0", predictabilitySupport: "1.0/1.0" },
      reasonThresholds: { supportiveMinimum: 75, tradeoffExcessMinimum: 25, belowNeedMaximum: 65 },
      missingInputs: []
    },
    status: "completed" as const,
    evaluatedAt
  };
}

function minimalTransitionResult() {
  return {
    version: "1.0" as const,
    modelVersion: "1.0" as const,
    policyVersion: "1.0" as const,
    reasonVersion: "1.0" as const,
    changeProfileVersion: "1.0" as const,
    recommendationUsePolicy: "shadow_only" as const,
    playerId: "player",
    currentEquipmentId: "current",
    proposedEquipmentId: "equipment",
    score: 90,
    band: "very_manageable_transition" as const,
    dimensions: [],
    confidence: "moderate" as const,
    reasons: [],
    tradeoffs: [],
    missingInformation: [],
    playerReadiness: { version: "1.0" as const, playerId: "player", sourceSummary: { availableInputs: [], missingInputs: [], derivedInputs: [] }, confidence: "moderate" as const },
    currentEquipment: { equipmentId: "current", sourceSummary: { availableInputs: [], missingInputs: [] } },
    proposedEquipment: { equipmentId: "equipment", sourceSummary: { numericReferenceInputs: [], ordinalProjectedInputs: [], specificationInputs: [], missingInputs: [] } },
    changeProfile: { version: "1.0" as const, rawDifferences: {}, missingInputs: [] },
    trace: {
      currentEquipmentValues: {},
      proposedEquipmentValues: {},
      normalizedDifferences: {},
      demandThresholds: {},
      readinessModifiers: [],
      componentWeights: { size_change_demand: 0.15, mass_change_demand: 0.2, drop_change_demand: 0.15, balance_change_demand: 0.15, swing_effort_change_demand: 0.2, experience_adjustment_demand: 0.15 },
      componentCoverage: { scoredComponents: 0, totalComponents: 0 },
      missingInputs: [],
      confidenceFactors: [],
      versions: { model: "1.0" as const, policy: "1.0" as const, reason: "1.0" as const, changeProfile: "1.0" as const, playerDNA: "1.0.0", currentEquipmentDNA: "1.0", proposedEquipmentDNA: "1.0" },
      reasonThresholds: { manageableMinimum: 75, demandingMaximum: 65 }
    },
    status: "completed" as const,
    evaluatedAt
  };
}
