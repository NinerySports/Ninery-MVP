import assert from "node:assert/strict";
import test from "node:test";
import type { CanonicalEquipmentDNAAdmissionDecision, CanonicalEquipmentDNAProfile } from "@ninery/equipment-intelligence";
import { equipmentDNAAttributes, type EquipmentDNAProfile } from "@ninery/equipment-intelligence";
import type { PlayerDNAProfileResult } from "@ninery/player-intelligence";
import {
  CANONICAL_CANDIDATE_ATTRIBUTION_VERSION,
  CANONICAL_CANDIDATE_CALIBRATION_VERSION,
  analyzeCanonicalCandidateVariance,
  runCanonicalCandidateRecommendationDualRun,
  scenarioEquipment,
  supportedCandidateFields,
  unsupportedCandidateFields
} from "../index.js";
import type { CompatibilityRequestContext } from "../compatibility.types.js";

const equipmentId = "rawlings-icon";
const atlasId = "atlas";
const hypeId = "hype-fire";
const variantId = "variant-1";
const analyzedAt = new Date("2026-07-23T00:00:00.000Z");

test("attribution explains the Ticket 024 ranking change without changing live authority", async () => {
  const request = requestFixture();
  const dualRun = await runCanonicalCandidateRecommendationDualRun(request);
  const attribution = analyzeCanonicalCandidateVariance({ request, dualRun, analyzedAt });

  assert.equal(CANONICAL_CANDIDATE_ATTRIBUTION_VERSION, "1.0");
  assert.equal(CANONICAL_CANDIDATE_CALIBRATION_VERSION, "1.0");
  assert.equal(attribution.legacyWinner.equipmentId, equipmentId);
  assert.equal(attribution.candidateWinner?.equipmentId, atlasId);
  assert.equal(attribution.winnerChanged, true);
  assert.equal(attribution.dualRunClassification, "ranking_changed");
  assert.ok(attribution.pairwiseWinnerAttribution);
  assert.ok(attribution.pairwiseWinnerAttribution.gapSwing > 0);
  assert.equal(dualRun.liveRecommendationSource, "legacy");
  assert.equal(dualRun.candidateAffectsLiveResult, false);
});

test("input variance preserves mapping metadata and missing unsupported fields", async () => {
  const request = requestFixture();
  const dualRun = await runCanonicalCandidateRecommendationDualRun(request);
  const attribution = analyzeCanonicalCandidateVariance({ request, dualRun, analyzedAt });

  const batControl = attribution.inputVariance.fields.find((field) => field.equipmentId === equipmentId && field.recommendationField === "batControl");
  assert.equal(batControl?.canonicalAttributeKey, "bat_control_support");
  assert.equal(batControl?.mappingVersion, "1.0");
  assert.equal(batControl?.direction, "decreased");

  const balance = attribution.inputVariance.fields.find((field) => field.equipmentId === equipmentId && field.recommendationField === "balance");
  assert.equal(balance?.direction, "missing_candidate");
  assert.equal(attribution.inputVariance.unsupportedFieldCount, 9);
});

test("one-factor attribution reports isolated deltas and residual variance", async () => {
  const request = requestFixture();
  const dualRun = await runCanonicalCandidateRecommendationDualRun(request);
  const attribution = analyzeCanonicalCandidateVariance({ request, dualRun, analyzedAt });

  const contribution = attribution.equipment
    .find((item) => item.equipment.equipmentId === equipmentId)
    ?.attributeContributions.find((item) => item.canonicalKey === "bat_control_support");
  assert.ok(contribution);
  assert.notEqual(contribution.isolatedOverallScoreDelta, 0);
  assert.ok(attribution.pairwiseWinnerAttribution);
  assert.equal(typeof attribution.pairwiseWinnerAttribution.residualGapSwing, "number");
});

test("dimension and weighted-score attribution uses actual engine dimensions", async () => {
  const attribution = analyzeCanonicalCandidateVariance({
    request: requestFixture(),
    dualRun: await runCanonicalCandidateRecommendationDualRun(requestFixture()),
    analyzedAt
  });

  const swingFeel = attribution.dimensionVariance.contributions.find((item) => item.dimension === "SWING_FEEL_BALANCE_FIT");
  assert.ok(swingFeel);
  assert.equal(typeof swingFeel.weight, "number");
  assert.equal(typeof swingFeel.weightedDelta, "number");
  assert.ok(attribution.dimensionVariance.largestWeightedDeltas.length > 0);
});

test("mapping compression detects collapsed numeric gaps and boundary effects", async () => {
  const attribution = analyzeCanonicalCandidateVariance({
    request: requestFixture(),
    dualRun: await runCanonicalCandidateRecommendationDualRun(requestFixture()),
    analyzedAt
  });

  assert.ok(attribution.mappingCompression.entries.some((entry) => entry.compressionDetected));
  assert.ok(attribution.mappingCompression.entries.every((entry) => entry.distinctLegacyValueCount >= entry.distinctCandidateValueCount || entry.boundaryAmplificationDetected));
  assert.equal(typeof attribution.mappingCompression.entries[0]?.gapRetainedRatio, "number");
});

test("calibration scenarios are complete and production mappings remain unchanged", async () => {
  const request = requestFixture();
  const dualRun = await runCanonicalCandidateRecommendationDualRun(request);
  const attribution = analyzeCanonicalCandidateVariance({ request, dualRun, analyzedAt });

  assert.deepEqual(attribution.calibrationScenarios.map((scenario) => scenario.name), [
    "current_midpoint",
    "lower_bound",
    "upper_bound",
    "interval_center",
    "legacy_preserving_reference",
    "supported_attributes_only",
    "optional_legacy_carryover_estimate"
  ]);
  assert.equal(attribution.calibrationScenarios.every((scenario) => scenario.completed), true);
  assert.deepEqual([...supportedCandidateFields], ["batControl", "swingWeight", "barrelForgiveness", "sweetSpotSize", "powerPotential"]);
  assert.deepEqual([...unsupportedCandidateFields], ["balance", "confidenceBuilding", "transitionFriendliness"]);
});

test("winner stability and recommendations are deterministic", async () => {
  const first = analyzeCanonicalCandidateVariance({
    request: requestFixture(),
    dualRun: await runCanonicalCandidateRecommendationDualRun(requestFixture()),
    analyzedAt
  });
  const second = analyzeCanonicalCandidateVariance({
    request: requestFixture(),
    dualRun: await runCanonicalCandidateRecommendationDualRun(requestFixture()),
    analyzedAt
  });

  assert.deepEqual(first, second);
  assert.equal(first.numericValuePreservationRecommendation, "attribute_specific_numeric_reference_recommended");
  assert.equal(first.architectureRecommendations.balance_profile, "remain_equipment_dna");
  assert.equal(first.architectureRecommendations.confidence_building_potential, "split_intrinsic_and_relational");
  assert.equal(first.architectureRecommendations.transition_difficulty, "move_to_compatibility_intelligence");
});

test("scenario helpers support supported-only and carryover estimates without mutating inputs", () => {
  const legacy = legacyEquipment();
  const candidate = candidateEquipment();
  const supportedOnly = scenarioEquipment("supported_attributes_only", legacy, candidate);
  const carryover = scenarioEquipment("optional_legacy_carryover_estimate", legacy, candidate);

  assert.equal(supportedOnly[0]?.scores.balance, undefined);
  assert.equal(carryover[0]?.scores.balance, legacy[0]?.scores.balance);
  assert.equal(legacy[0]?.scores.balance, 86);
  assert.equal(candidate[0]?.scores.balance, undefined);
});

function requestFixture() {
  return {
    playerInput: playerFixture(),
    requestContext: contextFixture(),
    legacyEquipmentInputs: legacyEquipment(),
    canonicalProfiles: canonicalProfiles(),
    admissionDecisions: canonicalProfiles().map((profile) => admissionDecision(profile)),
    evaluatedAt: analyzedAt
  };
}

function legacyEquipment(): EquipmentDNAProfile[] {
  return [
    equipmentFixture({ equipmentId, manufacturer: "Rawlings", model: "ICON", scores: { batControl: 88, balance: 86, swingWeight: 32, barrelForgiveness: 74, sweetSpotSize: 80, powerPotential: 85, confidenceBuilding: 88, transitionFriendliness: 72 } }),
    equipmentFixture({ equipmentId: atlasId, manufacturer: "Louisville Slugger", model: "Atlas", scores: { batControl: 84, balance: 82, swingWeight: 45, barrelForgiveness: 68, sweetSpotSize: 72, powerPotential: 82, confidenceBuilding: 82, transitionFriendliness: 58 } }),
    equipmentFixture({ equipmentId: hypeId, manufacturer: "Easton", model: "Hype Fire", scores: { batControl: 78, balance: 72, swingWeight: 58, barrelForgiveness: 86, sweetSpotSize: 88, powerPotential: 96, confidenceBuilding: 78, transitionFriendliness: 71 } })
  ];
}

function candidateEquipment(): EquipmentDNAProfile[] {
  return legacyEquipment().map((equipment) => ({
    ...equipment,
    scores: {
      batControl: equipment.equipmentId === hypeId ? 50 : 70,
      swingWeight: equipment.equipmentId === equipmentId ? 50 : equipment.equipmentId === atlasId ? 50 : 70,
      barrelForgiveness: equipment.equipmentId === hypeId ? 70 : 70,
      sweetSpotSize: equipment.equipmentId === hypeId ? 70 : 70,
      powerPotential: equipment.equipmentId === hypeId ? 70 : 70
    },
    missingCharacteristics: []
  }));
}

function canonicalProfiles(): CanonicalEquipmentDNAProfile[] {
  return candidateEquipment().map((equipment) => ({
    version: "1.0",
    equipmentId: equipment.equipmentId,
    equipmentVariantId: equipment.variantId,
    equipmentName: `${equipment.manufacturer} ${equipment.model} 2026`,
    variantLabel: equipment.selectedVariant?.sku,
    registryVersion: "1.0",
    confidenceModelVersion: "1.0",
    readinessModelVersion: "1.0",
    scoreMappingVersion: "1.0",
    readiness: { ready: true, missingRequiredAttributes: [], insufficientConfidenceAttributes: [], invalidAttributes: [], experimentalAttributesIgnored: [], reasons: [] },
    maturity: "evaluated",
    attributes: [
      attribute("length", 30, "physical", "variant", "high"),
      attribute("weight", 22, "physical", "variant", "high"),
      attribute("drop", -8, "physical", "variant", "high"),
      attribute("certification", "USA", "physical", "equipment", "high"),
      attribute("barrel_diameter", 2.625, "physical", "equipment", "high"),
      attribute("bat_control_support", equipment.equipmentId === hypeId ? "moderate" : "high", "development", "equipment", "moderate"),
      attribute("swing_effort", equipment.equipmentId === hypeId ? "demanding" : "moderate", "performance", "equipment", "moderate"),
      attribute("forgiveness", "high", "performance", "equipment", "moderate"),
      attribute("sweet_spot_support", "high", "performance", "equipment", "moderate"),
      attribute("power_potential", "high", "performance", "equipment", "moderate")
    ],
    missingAttributes: [],
    invalidAttributes: [],
    conflicts: [],
    generatedAt: analyzedAt
  }));
}

function admissionDecision(profile: CanonicalEquipmentDNAProfile): CanonicalEquipmentDNAAdmissionDecision {
  return {
    version: "1.0",
    policyVersion: "1.0",
    equipmentId: profile.equipmentId,
    equipmentVariantId: profile.equipmentVariantId,
    equipmentName: profile.equipmentName,
    evaluatedAt: analyzedAt,
    outcome: "approved_for_internal_candidate",
    eligibleForShadow: true,
    eligibleForInternalCandidate: true,
    liveRecommendationUseAllowed: false,
    blockers: [],
    warnings: [],
    criteria: [],
    mappingCoverage: { requiredComparableKeys: ["bat_control_support", "swing_effort", "forgiveness", "sweet_spot_support"], successfullyComparedKeys: ["bat_control_support", "swing_effort", "forgiveness", "sweet_spot_support"], missingCanonicalKeys: [], missingLegacyKeys: [], incomparableRequiredKeys: [], optionalIncomparableKeys: [], coverageRatio: 1, requiredCoverageSatisfied: true },
    versionAssessment: { supported: true, actual: { admissionPolicyVersion: "1.0", canonicalProfileVersion: "1.0", registryVersion: "1.0", confidenceModelVersion: "1.0", readinessModelVersion: "1.0", scoreMappingVersion: "1.0", shadowComparisonVersion: "1.0", ordinalComparisonVersion: "1.0" }, unsupported: [] },
    sourceSummary: { ready: true, maturity: "evaluated", shadowStatus: "aligned", specificationMatchCount: 5, specificationProblemCount: 0, alignedBehaviorCount: 5, minorBehaviorDifferenceCount: 0, materialBehaviorDifferenceCount: 0, incomparableBehaviorCount: 3 },
    nextActions: []
  };
}

function contextFixture(): CompatibilityRequestContext {
  return { playerId: "player-1", certification: "USA", category: "bat", variantPreferences: { length: 30, drop: -8 }, budget: { maximum: 400 }, resultLimit: 3 };
}

function playerFixture(): PlayerDNAProfileResult {
  return {
    profileId: "player-dna-1",
    playerId: "player-1",
    version: "player-dna-mvp-v1",
    status: "generated",
    scoringRuleVersion: "player-dna-mvp-v1",
    inputHash: "player-input",
    scores: { batControl: 90, swingSpeed: 72, powerPotential: 76, contactConsistency: 68, physicalStrength: 62, confidence: 70, transitionReadiness: 74, growthStability: 66, equipmentAwareness: 78, profileCompleteness: 92 },
    categories: { preferredSwingFeel: "light", developmentStage: "competitive", primaryHittingGoal: "improve_bat_control", currentEquipmentAssessment: "likes light swing", growthStatus: "moderate_growth", profileConfidenceLevel: "high" },
    confidence: { score: 84, level: "high", factors: {}, missingInformation: [] },
    explanations: [],
    missingInformation: [],
    inputSnapshot: { player: { id: "player-1" } },
    scoreBreakdown: {},
    generatedAt: "2026-01-01T00:00:00.000Z"
  };
}

function attribute(
  key: CanonicalEquipmentDNAProfile["attributes"][number]["key"],
  value: CanonicalEquipmentDNAProfile["attributes"][number]["value"],
  domain: CanonicalEquipmentDNAProfile["attributes"][number]["domain"],
  targetLevel: CanonicalEquipmentDNAProfile["attributes"][number]["targetLevel"],
  confidence: CanonicalEquipmentDNAProfile["attributes"][number]["confidence"]
): CanonicalEquipmentDNAProfile["attributes"][number] {
  return { key, definitionVersion: "1.0", domain, targetLevel, value, confidence, evaluationMethod: targetLevel === "variant" ? "direct_specification" : "derived_mapping", evaluationVersion: 1, rationale: `${key} rationale`, evaluatedAt: analyzedAt, evidence: [{ evidenceRecordId: `evidence-${key}`, sourceType: "other", sourceName: "Fixture", method: "manual_review", status: "active" }], status: "active" };
}

function equipmentFixture(overrides: Partial<EquipmentDNAProfile> & { scores: EquipmentDNAProfile["scores"] }): EquipmentDNAProfile {
  const scores = overrides.scores;
  return {
    equipmentId: overrides.equipmentId ?? equipmentId,
    variantId,
    sourceLevel: "model",
    manufacturer: overrides.manufacturer ?? "Rawlings",
    model: overrides.model ?? "ICON",
    modelYear: 2026,
    certification: "USA",
    category: "bat",
    barrelDiameter: 2.625,
    status: "active",
    profileVersion: 1,
    evidenceConfidence: { score: 78, band: "high" },
    certificationLevel: "gold",
    secondaryPersonalities: [],
    fitProfiles: [],
    specifications: [],
    availableVariants: [{ id: variantId, lengthInches: 30, weightOunces: 22, dropWeight: -8, msrp: 349, sku: "SKU" }],
    selectedVariant: { id: variantId, lengthInches: 30, weightOunces: 22, dropWeight: -8, msrp: 349, sku: "SKU" },
    sourceProfileId: `${overrides.equipmentId ?? equipmentId}-dna`,
    profileCompleteness: 100,
    publishedAt: "2026-01-01T00:00:00.000Z",
    scores,
    missingCharacteristics: equipmentDNAAttributes.filter((item) => scores[item] === undefined),
    explanations: [],
    eligibility: { eligible: true, reasons: [] }
  };
}
