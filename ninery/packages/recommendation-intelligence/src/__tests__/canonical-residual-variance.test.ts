import assert from "node:assert/strict";
import test from "node:test";
import type { EquipmentDNAProfile } from "@ninery/equipment-intelligence";
import type { PlayerDNAProfileResult } from "@ninery/player-intelligence";
import {
  analyzeCanonicalResidualVariance,
  CANONICAL_RESIDUAL_SCENARIOS,
  type CanonicalCandidateThreePathResult,
  type CanonicalCandidateRecommendationVariance,
  type CompatibilityRunResult
} from "../index.js";
import { CompatibilityScoringEngine } from "../scoring/compatibility-scoring-engine.js";

const evaluatedAt = new Date("2026-07-28T00:00:00.000Z");

test("residual analysis inventories unsupported optional legacy signals", async () => {
  const analysis = await fixtureAnalysis();

  assert.deepEqual(analysis.missingSignalInventory.map((item) => item.signal), [
    "balance",
    "confidenceBuilding",
    "transitionFriendliness"
  ]);
  assert.equal(analysis.missingSignalInventory.every((item) => item.presentInLegacyCount === 2), true);
  assert.equal(analysis.missingSignalInventory.every((item) => item.presentInNumericReferenceCount === 0), true);
  assert.equal(analysis.missingSignalInventory.find((item) => item.signal === "confidenceBuilding")?.affectsDevelopmentGoalFit, true);
});

test("residual analysis runs every required scenario deterministically", async () => {
  const first = await fixtureAnalysis();
  const second = await fixtureAnalysis();

  assert.deepEqual(first.scenarios.map((scenario) => scenario.id), [...CANONICAL_RESIDUAL_SCENARIOS]);
  assert.deepEqual(
    first.scenarios.map((scenario) => [scenario.id, scenario.winnerLabel, scenario.rankingDistanceFromLegacy]),
    second.scenarios.map((scenario) => [scenario.id, scenario.winnerLabel, scenario.rankingDistanceFromLegacy])
  );
});

test("optional carryover scenarios attribute residual without changing live source", async () => {
  const analysis = await fixtureAnalysis();
  const allOptional = analysis.optionalSignalAttribution.find((item) => item.signal === "all_optional");

  assert.equal(analysis.liveRecommendationSource, "legacy");
  assert.equal(analysis.candidateAffectsLiveResult, false);
  assert.ok(allOptional);
  assert.equal(allOptional.causeCodes.includes("OPTIONAL_SIGNAL_CARRYOVER_REDUCES_RESIDUAL"), true);
  assert.equal(analysis.primaryCauseCodes.includes("MISSING_BALANCE_SIGNAL"), true);
  assert.equal(analysis.primaryCauseCodes.includes("MISSING_CONFIDENCE_BUILDING_SIGNAL"), true);
  assert.equal(analysis.primaryCauseCodes.includes("MISSING_TRANSITION_SIGNAL"), true);
});

test("normalization documents missing optionals as neutral dimensions rather than zeroes", async () => {
  const analysis = await fixtureAnalysis();

  assert.equal(analysis.normalization.missingOptionalSignalsAreTreatedAsZero, false);
  assert.equal(analysis.normalization.missingOptionalDimensionRawScore, 50);
  assert.equal(analysis.normalization.weightsRenormalizedWhenSignalsMissing, false);
});

test("completeness and confidence isolation scenarios are reported separately", async () => {
  const analysis = await fixtureAnalysis();

  assert.equal(analysis.completeness.completenessPenaltyAffectsMatchScore, true);
  assert.equal(analysis.completeness.completenessPenaltyAffectsConfidence, true);
  assert.equal(analysis.completeness.evidenceConfidenceAffectsMatchScore, true);
  assert.equal(analysis.completeness.evidenceConfidenceAffectsConfidence, true);
  assert.equal(analysis.decomposition.length, 2);
  assert.equal(analysis.decomposition.every((item) => Math.abs(item.unexplainedResidual) < 0.01), true);
});

async function fixtureAnalysis() {
  const request = fixtureRequest();
  const legacy = score(request.legacyEquipmentInputs, request.playerInput);
  const numeric = score(request.legacyEquipmentInputs.map(numericReferenceEquipment), request.playerInput);
  return analyzeCanonicalResidualVariance({
    request,
    threePath: threePath(legacy, numeric),
    evaluatedAt
  });
}

function fixtureRequest() {
  return {
    playerInput: playerDNA(),
    requestContext: {
      playerId: "player-1",
      playerDNAProfileId: "player-dna-1",
      certification: "USA" as const,
      category: "bat" as const,
      variantPreferences: { length: 30, drop: -8 },
      budget: { maximum: 400 },
      resultLimit: 2,
      forceRegenerate: true
    },
    legacyEquipmentInputs: [
      equipment("eq-icon", "variant-icon", "Rawlings", "ICON", {
        batControl: 91,
        balance: 74,
        swingWeight: 42,
        barrelForgiveness: 86,
        sweetSpotSize: 88,
        powerPotential: 84,
        confidenceBuilding: 86,
        transitionFriendliness: 83
      }),
      equipment("eq-atlas", "variant-atlas", "Louisville Slugger", "Atlas", {
        batControl: 85,
        balance: 70,
        swingWeight: 48,
        barrelForgiveness: 80,
        sweetSpotSize: 82,
        powerPotential: 81,
        confidenceBuilding: 79,
        transitionFriendliness: 78
      })
    ],
    canonicalProfiles: [],
    admissionDecisions: [],
    evaluatedAt
  };
}

function numericReferenceEquipment(profile: EquipmentDNAProfile): EquipmentDNAProfile {
  return {
    ...profile,
    sourceProfileId: `canonical-candidate:${profile.equipmentId}`,
    profileCompleteness: 70,
    evidenceConfidence: { score: 72, band: "medium" },
    scores: {
      batControl: profile.scores.batControl,
      swingWeight: profile.scores.swingWeight,
      barrelForgiveness: profile.scores.barrelForgiveness,
      sweetSpotSize: profile.scores.sweetSpotSize,
      powerPotential: profile.scores.powerPotential
    },
    missingCharacteristics: ["balance", "confidenceBuilding", "transitionFriendliness"]
  };
}

function score(equipment: readonly EquipmentDNAProfile[], playerInput: PlayerDNAProfileResult): CompatibilityRunResult {
  return new CompatibilityScoringEngine().score({
    playerDNA: playerInput,
    equipment: [...equipment],
    context: {
      playerId: playerInput.playerId,
      playerDNAProfileId: playerInput.profileId,
      certification: "USA",
      category: "bat",
      variantPreferences: { length: 30, drop: -8 },
      budget: { maximum: 400 },
      resultLimit: 2,
      forceRegenerate: true
    }
  });
}

function playerDNA(): PlayerDNAProfileResult {
  return {
    profileId: "player-dna-1",
    playerId: "player-1",
    version: "1.0",
    scoringRuleVersion: "fixture",
    inputHash: "hash",
    scores: {
      batControl: 82,
      swingSpeed: 72,
      powerPotential: 80,
      contactConsistency: 68,
      physicalStrength: 70,
      confidence: 58,
      transitionReadiness: 76,
      growthStability: 75,
      equipmentAwareness: 70,
      profileCompleteness: 92
    },
    categories: {
      preferredSwingFeel: "balanced",
      developmentStage: "competitive",
      primaryHittingGoal: "build_confidence",
      currentEquipmentAssessment: "ready",
      growthStatus: "stable",
      profileConfidenceLevel: "high"
    },
    confidence: { score: 88, level: "high", factors: {}, missingInformation: [] },
    explanations: [],
    missingInformation: [],
    inputSnapshot: { player: { id: "player-1" } },
    scoreBreakdown: {},
    generatedAt: "2026-07-28T00:00:00.000Z"
  };
}

function equipment(
  equipmentId: string,
  variantId: string,
  manufacturer: string,
  model: string,
  scores: EquipmentDNAProfile["scores"]
): EquipmentDNAProfile {
  return {
    equipmentId,
    variantId,
    sourceLevel: "variant_adjusted",
    manufacturer,
    model,
    modelYear: 2026,
    certification: "USA",
    category: "bat",
    construction: "one_piece",
    material: "alloy",
    barrelDiameter: 2.625,
    status: "active",
    profileVersion: 1,
    evidenceConfidence: { score: 90, band: "high" },
    certificationLevel: "gold",
    secondaryPersonalities: [],
    fitProfiles: [],
    specifications: [],
    availableVariants: [{ id: variantId, lengthInches: 30, weightOunces: 22, dropWeight: -8, msrp: 349, sku: `${equipmentId}-sku` }],
    selectedVariant: { id: variantId, lengthInches: 30, weightOunces: 22, dropWeight: -8, msrp: 349, sku: `${equipmentId}-sku` },
    sourceProfileId: `legacy:${equipmentId}`,
    profileCompleteness: 95,
    publishedAt: "2026-07-28T00:00:00.000Z",
    scores,
    missingCharacteristics: [],
    explanations: [],
    eligibility: { eligible: true, reasons: [] }
  };
}

function threePath(
  legacyAuthoritative: CompatibilityRunResult,
  numericReferenceCandidate: CompatibilityRunResult
): CanonicalCandidateThreePathResult {
  return {
    version: "1.0",
    comparisonVersion: "1.0",
    legacyAuthoritative,
    ordinalCandidate: numericReferenceCandidate,
    numericReferenceCandidate,
    ordinalExecutionStatus: "completed",
    numericReferenceExecutionStatus: "completed",
    ordinalVariance: variance(),
    numericReferenceVariance: variance(),
    sourceSelection: [],
    precisionRestoration: {
      legacyWinnerId: legacyAuthoritative.primaryRecommendation?.equipment.equipmentId ?? "",
      ordinalCandidateWinnerId: numericReferenceCandidate.primaryRecommendation?.equipment.equipmentId,
      numericReferenceCandidateWinnerId: numericReferenceCandidate.primaryRecommendation?.equipment.equipmentId,
      ordinalWinnerMatchesLegacy: true,
      numericReferenceWinnerMatchesLegacy: true,
      ordinalRankingDistance: 0,
      numericReferenceRankingDistance: 0,
      ordinalAverageScoreDelta: 0,
      numericReferenceAverageScoreDelta: 0,
      ordinalMaximumScoreDelta: 0,
      numericReferenceMaximumScoreDelta: 0,
      ordinalDimensionVariance: 0,
      numericReferenceDimensionVariance: 0,
      ordinalReasonAlignmentRatio: 1,
      numericReferenceReasonAlignmentRatio: 1,
      numericReferenceImprovedWinnerAlignment: false,
      numericReferenceImprovedRankingAlignment: false,
      numericReferenceReducedScoreVariance: false,
      numericReferenceReducedDimensionVariance: false,
      numericReferenceImprovedReasonAlignment: false,
      conclusion: "numeric_reference_modestly_improved_alignment"
    },
    liveRecommendationSource: "legacy",
    candidateAffectsLiveResult: false,
    evaluatedAt
  };
}

function variance(): CanonicalCandidateRecommendationVariance {
  return {
    classification: "equivalent",
    eligibility: [],
    ranking: [],
    overallScores: [],
    dimensionScores: [],
    confidenceScores: [],
    reasons: { added: [], removed: [], unchanged: [] },
    tradeoffs: { added: [], removed: [], unchanged: [] },
    alternatives: { added: [], removed: [], unchanged: [] },
    trace: { comparable: true, expectedProvenanceDifference: true, differences: [] },
    summary: []
  };
}
