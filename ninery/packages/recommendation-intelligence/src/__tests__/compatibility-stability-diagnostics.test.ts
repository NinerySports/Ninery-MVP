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
  COMPATIBILITY_CALIBRATION_ANALYSIS_VERSION,
  COMPATIBILITY_STABILITY_DIAGNOSTIC_VERSION,
  COMPATIBILITY_THRESHOLD_PROXIMITY_VERSION,
  COMPATIBILITY_TIE_SENSITIVITY_VERSION,
  CONFIDENCE_COMPATIBILITY_CALIBRATION_SCENARIO_VERSION,
  TRANSITION_COMPATIBILITY_CALIBRATION_SCENARIO_VERSION,
  runCompatibilityStabilityDiagnostics
} from "../compatibility/validation/index.js";

const evaluatedAt = new Date("2026-08-04T00:00:00.000Z");

test("stability diagnostic constants are exported and stable", () => {
  assert.equal(COMPATIBILITY_STABILITY_DIAGNOSTIC_VERSION, "1.0");
  assert.equal(COMPATIBILITY_CALIBRATION_ANALYSIS_VERSION, "1.0");
  assert.equal(CONFIDENCE_COMPATIBILITY_CALIBRATION_SCENARIO_VERSION, "1.0");
  assert.equal(TRANSITION_COMPATIBILITY_CALIBRATION_SCENARIO_VERSION, "1.0");
  assert.equal(COMPATIBILITY_THRESHOLD_PROXIMITY_VERSION, "1.0");
  assert.equal(COMPATIBILITY_TIE_SENSITIVITY_VERSION, "1.0");
});

test("diagnostics reproduce Ticket 035 stability failures and preserve exact perturbations", () => {
  const suite = diagnostics();
  assert.equal(suite.productionModelChanged, false);
  assert.equal(suite.liveRecommendationUseAllowed, false);
  for (const result of suite.results) {
    assert.equal(result.productionModelChanged, false);
    assert.equal(result.liveRecommendationUseAllowed, false);
    assert.ok(result.failedScenarios.length > 0);
    assert.ok(result.failedScenarios.every((failure) => failure.reproductionStatus === "reproduced"));
    assert.ok(result.failedScenarios.every((failure) => failure.perturbation.inputField.length > 0));
    assert.ok(result.failedScenarios.every((failure) => failure.perturbation.originalValue !== undefined));
    assert.ok(result.failedScenarios.every((failure) => failure.perturbation.perturbedValue !== undefined));
    assert.ok(result.failedScenarios.every((failure) => failure.failureId.includes(result.model)));
  }
});

test("threshold proximity and tie sensitivity separate score movement from presentation movement", () => {
  const suite = diagnostics();
  const confidence = suite.results.find((result) => result.model === "confidence_compatibility");
  const transition = suite.results.find((result) => result.model === "transition_compatibility");
  assert.ok(confidence);
  assert.ok(transition);
  assert.equal(confidence?.thresholdProximity.version, "1.0");
  assert.ok((confidence?.tieSensitivity.nearTieScenarioCount ?? 0) > 0);
  assert.equal(confidence?.tieSensitivity.recommendation, "explanation_only");
  assert.ok((transition?.thresholdProximity.thresholdDrivenFailureCount ?? 0) >= 1);
  assert.ok(transition?.primaryCauses.some((cause) => cause.code === "PIECEWISE_THRESHOLD_DISCONTINUITY"));
});

test("confidence diagnostics classify saturation, low separation, and high overlap", () => {
  const confidence = diagnostics().results.find((result) => result.model === "confidence_compatibility");
  assert.ok(confidence?.confidenceSaturation);
  assert.ok((confidence?.confidenceSaturation?.evaluationsNearCeiling ?? 0) > 0);
  assert.ok(confidence?.primaryCauses.some((cause) => cause.code === "LOW_EQUIPMENT_SEPARATION"));
  assert.ok(confidence?.primaryCauses.some((cause) => cause.code === "HIGH_COMPONENT_OVERLAP"));
  assert.equal(confidence?.stabilityConclusion, "explanation_only_recommended");
});

test("transition diagnostics classify missing context, physical overlap, and calibration target", () => {
  const transition = diagnostics().results.find((result) => result.model === "transition_compatibility");
  assert.ok(transition?.transitionPhysicalOverlap);
  assert.equal(transition?.transitionPhysicalOverlap?.overlapRisk, "moderate");
  assert.ok((transition?.missingContextClassifications.length ?? 0) >= 1);
  assert.ok(transition?.missingContextClassifications.every((item) => item.classification === "correctly_blocked_required_context"));
  assert.equal(transition?.stabilityConclusion, "stable_after_threshold_calibration");
});

test("calibration scenarios are analytical, compared, and do not mutate official promotion outcomes", () => {
  const suite = diagnostics();
  for (const result of suite.results) {
    assert.ok(result.calibrationScenarios.length >= 5);
    assert.ok(result.calibrationScenarios.every((scenario) => scenario.analyticalOnly));
    assert.ok(result.calibrationScenarios.every((scenario) => scenario.productionSafe === "not_assessed"));
    assert.equal(result.calibrationComparison.version, "1.0");
    assert.ok(result.calibrationComparison.recommendedScenario);
    assert.equal(result.promotionReassessment.originalOutcome, "blocked_unstable_behavior");
    assert.equal(result.promotionReassessment.projectedOutcomeRequiresImplementation, true);
    assert.equal(result.promotionReassessment.promotionStillBlocked, true);
    assert.equal(result.recommendedCalibrationPackage?.requiresImplementationTicket, true);
    assert.equal(result.recommendedCalibrationPackage?.liveUseApproved, false);
  }
});

function diagnostics() {
  return runCompatibilityStabilityDiagnostics({
    basePlayerDNA: playerFixture(),
    canonicalProfiles: demoProfiles(),
    currentEquipmentProfile: demoProfiles()[0],
    evaluatedAt
  });
}

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
  values: { balance: number; swingEffort: number; forgiveness: number; sweetSpot: number; batControl: number; predictability: number; construction: string }
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

function attr(key: EquipmentDNAAttributeKey, value: EquipmentDNAAttributeNormalizedValue, domain: EquipmentDNAAttributeDomain, numericValue?: number): CanonicalEquipmentDNAAttributeValue {
  return {
    key,
    definitionVersion: "1.0",
    domain,
    targetLevel: key === "length" || key === "weight" || key === "drop" ? "variant" : "equipment",
    value,
    confidence: "high",
    evaluationMethod: "derived_mapping",
    evaluationVersion: 1,
    rationale: `${key} stability fixture`,
    evaluatedAt,
    evidence: numericValue === undefined ? [] : [{ evidenceRecordId: `${key}-evidence`, sourceType: "internal_derived", sourceName: "stability fixture", method: "derived_mapping", status: "active", rawValue: { normalizedScore: numericValue, sourceScore: numericValue, referenceMethod: "legacy_preserved" }, evaluatorType: "system" }],
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
