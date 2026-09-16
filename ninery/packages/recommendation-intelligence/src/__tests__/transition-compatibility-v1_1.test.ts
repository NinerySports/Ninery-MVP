import assert from "node:assert/strict";
import test from "node:test";
import type {
  CanonicalEquipmentDNAAttributeValue,
  CanonicalEquipmentDNAProfile,
  EquipmentDNAAttributeDomain,
  EquipmentDNAAttributeKey,
  EquipmentDNAAttributeNormalizedValue
} from "@ninery/equipment-intelligence";
import type { PlayerDNAProfileResult, PrimaryHittingGoal } from "@ninery/player-intelligence";
import {
  TRANSITION_COMPATIBILITY_MODEL_VERSION,
  TRANSITION_COMPATIBILITY_MODEL_VERSION_V1_1,
  TRANSITION_COMPATIBILITY_POLICY_VERSION,
  TRANSITION_COMPATIBILITY_POLICY_VERSION_V1_1,
  TRANSITION_COMPATIBILITY_INTERPOLATION_VERSION,
  compareTransitionCompatibilityVersions,
  evaluateTransitionCompatibility,
  evaluateTransitionCompatibilityV1_1,
  evaluateTransitionCompatibilityVersions,
  interpolatePiecewiseLinear,
  reproduceTransitionCompatibilityV1_0Failure,
  sweepTransitionCompatibilityV1_1Boundaries,
  transitionCompatibilityV1_1InterpolationCurves,
  transitionCompatibilityV1_1Policy,
  validateTransitionCompatibilityV1_1,
  validateTransitionCompatibilityV1_1Policy
} from "../compatibility/transition/index.js";

test("v1.1 constants and policy are separate while v1.0 remains unchanged", () => {
  assert.equal(TRANSITION_COMPATIBILITY_MODEL_VERSION, "1.0");
  assert.equal(TRANSITION_COMPATIBILITY_POLICY_VERSION, "1.0");
  assert.equal(TRANSITION_COMPATIBILITY_MODEL_VERSION_V1_1, "1.1");
  assert.equal(TRANSITION_COMPATIBILITY_POLICY_VERSION_V1_1, "1.1");
  assert.equal(TRANSITION_COMPATIBILITY_INTERPOLATION_VERSION, "1.0");
  assert.equal(transitionCompatibilityV1_1Policy.recommendationUsePolicy, "shadow_only");
  assert.equal(transitionCompatibilityV1_1Policy.productionUseAllowed, false);
  assert.equal(transitionCompatibilityV1_1Policy.liveRecommendationUseAllowed, false);
  assert.equal(transitionCompatibilityV1_1Policy.physicalOverlapDecision, "preserve_v1_0_weights");
  assert.deepEqual(validateTransitionCompatibilityV1_1Policy(), []);
});

test("piecewise-linear interpolation validates points and is deterministic", () => {
  const points = [
    { input: 0, output: 0 },
    { input: 10, output: 20 },
    { input: 20, output: 45 }
  ] as const;
  assert.equal(interpolatePiecewiseLinear(0, points), 0);
  assert.equal(interpolatePiecewiseLinear(10, points), 20);
  assert.equal(interpolatePiecewiseLinear(20, points), 45);
  assert.equal(interpolatePiecewiseLinear(15, points), 32.5);
  assert.equal(interpolatePiecewiseLinear(-1, points), 0);
  assert.equal(interpolatePiecewiseLinear(25, points), 45);
  assert.equal(interpolatePiecewiseLinear(15, points), interpolatePiecewiseLinear(15, points));
  assert.throws(() => interpolatePiecewiseLinear(Number.NaN, points), /finite/);
  assert.throws(() => interpolatePiecewiseLinear(1, [{ input: 1, output: 0 }, { input: 1, output: 20 }]), /strictly increasing/);
  assert.throws(() => interpolatePiecewiseLinear(1, [{ input: 0, output: 0 }, { input: 1, output: 101 }]), /between 0 and 100/);
});

test("swing-effort v1.1 smoothing materially reduces original 48 to 50 v1.0 jump", () => {
  const current = canonicalProfile("current", { length: 30, weight: 22, drop: -8, balance: 11, swingEffort: 39 });
  const proposed = canonicalProfile("proposed", { length: 30, weight: 22, drop: -8, balance: 11, swingEffort: 48 });
  const failure = reproduceTransitionCompatibilityV1_0Failure({
    playerDNA: playerFixture("improve_contact", { transitionReadiness: 76, batControl: 88, physicalStrength: 68 }),
    currentEquipmentProfile: current,
    proposedEquipmentProfile: proposed,
    evaluatedAt: date()
  });
  assert.equal(failure.inputField, "equipment.swing_effort");
  assert.equal(failure.v1_0Delta > 5, true);
  assert.equal(failure.v1_1Delta <= 5, true);
  assert.equal(failure.v1_1Delta < failure.v1_0Delta, true);
  assert.equal(failure.resolved, true);
  assert.equal(failure.interpolationSegment?.segmentStart.input, 0);
  assert.equal(failure.interpolationSegment?.segmentEnd.input, 10);
});

test("v1.1 component curves are monotonic and boundary sweeps are continuous", () => {
  for (const points of Object.values(transitionCompatibilityV1_1InterpolationCurves)) {
    for (let index = 1; index < points.length; index += 1) {
      assert.ok(points[index].input > points[index - 1].input);
      assert.ok(points[index].output >= points[index - 1].output);
    }
  }
  const sweeps = sweepTransitionCompatibilityV1_1Boundaries();
  assert.ok(sweeps.length >= 10);
  assert.equal(sweeps.every((sweep) => sweep.monotonic), true);
  assert.equal(sweeps.every((sweep) => sweep.continuous), true);
});

test("v1.1 evaluates in parallel with v1.0 and keeps live flags closed", () => {
  const input = {
    playerDNA: playerFixture("improve_bat_control"),
    currentEquipmentProfile: canonicalProfile("current", { length: 30, weight: 22, drop: -8, balance: 11, swingEffort: 42 }),
    proposedEquipmentProfile: canonicalProfile("proposed", { length: 31, weight: 24, drop: -7, balance: 50, swingEffort: 74 }),
    evaluatedAt: date()
  };
  const versions = evaluateTransitionCompatibilityVersions(input);
  assert.equal(versions.v1_0.version, "1.0");
  assert.equal(versions.v1_1.version, "1.1");
  assert.equal(versions.v1_1.candidateVersion, "v1_1_linear_interpolation");
  assert.equal(versions.v1_1.productionUseAllowed, false);
  assert.equal(versions.v1_1.liveRecommendationUseAllowed, false);
  assert.ok(versions.v1_1.interpolationTrace.length >= 5);
  assert.ok(versions.v1_1.readinessModifierTrace.length >= 5);
  const comparison = compareTransitionCompatibilityVersions(input);
  assert.equal(comparison.version, "1.0");
  assert.equal(comparison.liveUseAllowed, false);
  assert.ok(comparison.dimensionDeltas.some((dimension) => dimension.dimension === "swing_effort_change_demand"));
});

test("readiness modifiers are bounded, monotonic, and cannot erase material demand", () => {
  const current = canonicalProfile("current", { length: 30, weight: 22, drop: -8, balance: 11, swingEffort: 42 });
  const proposed = canonicalProfile("proposed", { length: 31, weight: 24, drop: -7, balance: 50, swingEffort: 74 });
  const scores = [0, 25, 50, 75, 100].map((transitionReadiness) => evaluateTransitionCompatibilityV1_1({
    playerDNA: playerFixture("prepare_for_transition", { transitionReadiness, batControl: transitionReadiness, physicalStrength: transitionReadiness }),
    currentEquipmentProfile: current,
    proposedEquipmentProfile: proposed,
    evaluatedAt: date()
  }));
  for (let index = 1; index < scores.length; index += 1) {
    assert.ok((scores[index].score ?? 0) >= (scores[index - 1].score ?? 0));
  }
  const high = scores.at(-1);
  assert.ok(high?.dimensions.every((dimension) => dimension.baseAdjustmentDemand === 0 || (dimension.finalAdjustmentDemand ?? 0) > 0));
  assert.ok(high?.readinessModifierTrace.some((trace) => trace.bounded));
});

test("missing required context remains blocking without hidden zeroes", () => {
  const current = canonicalProfile("current", { length: 30, weight: 22, drop: -8, balance: 11, swingEffort: 42 });
  const proposed = canonicalProfile("proposed", { length: 31, weight: 23, drop: -8, balance: 26, swingEffort: 56 });
  const missingCurrent = evaluateTransitionCompatibilityV1_1({ playerDNA: playerFixture("improve_contact"), proposedEquipmentProfile: proposed, evaluatedAt: date() });
  assert.equal(missingCurrent.status, "blocked_missing_current_equipment");
  const missingExperience = evaluateTransitionCompatibilityV1_1({
    playerDNA: { ...playerFixture("improve_contact"), inputSnapshot: { player: { id: "player-1" }, playerProfile: {} } },
    currentEquipmentProfile: current,
    proposedEquipmentProfile: proposed,
    evaluatedAt: date()
  });
  assert.equal(missingExperience.status, "blocked_missing_player_input");
  assert.equal(missingExperience.dimensions.some((dimension) => dimension.status === "missing_input" && dimension.compatibilityScore === 0), false);
});

test("v1.1 validation approves extended shadow only and preserves v1.0 official block", () => {
  const current = canonicalProfile("current", { length: 30, weight: 22, drop: -8, balance: 11, swingEffort: 39 });
  const profiles = [
    current,
    canonicalProfile("atlas", { length: 30, weight: 22, drop: -8, balance: 20, swingEffort: 48 }),
    canonicalProfile("hype", { length: 30, weight: 22, drop: -8, balance: 35, swingEffort: 58 })
  ];
  const validation = validateTransitionCompatibilityV1_1({
    basePlayerDNA: playerFixture("improve_contact"),
    currentEquipmentProfile: current,
    canonicalProfiles: profiles,
    evaluatedAt: date()
  });
  assert.equal(validation.v1_0OfficialOutcome, "blocked_unstable_behavior");
  assert.equal(validation.v1_1AnalyticalOutcome, "approved_for_extended_shadow");
  assert.equal(validation.eligibleForDiagnosticShadow, true);
  assert.equal(validation.eligibleForInternalCandidate, false);
  assert.equal(validation.liveRankingUseAllowed, false);
  assert.equal(validation.liveExplanationUseAllowed, false);
  assert.equal(validation.liveRecommendationUseAllowed, false);
  assert.equal(validation.stability.originalFailureResolved, true);
  assert.equal(validation.missingContext.missingCurrentEquipmentBlocks, true);
  assert.equal(validation.missingContext.missingExperienceReadinessBlocks, true);
});

test("same-equipment remains highly manageable but is not forced to 100", () => {
  const current = canonicalProfile("current", { length: 30, weight: 22, drop: -8, balance: 11, swingEffort: 42 });
  const v1 = evaluateTransitionCompatibility({ playerDNA: playerFixture("improve_contact"), currentEquipmentProfile: current, proposedEquipmentProfile: current, evaluatedAt: date() });
  const v11 = evaluateTransitionCompatibilityV1_1({ playerDNA: playerFixture("improve_contact"), currentEquipmentProfile: current, proposedEquipmentProfile: current, evaluatedAt: date() });
  assert.ok((v1.score ?? 0) >= 95);
  assert.ok((v11.score ?? 0) >= 95);
  assert.notEqual(v11.score, 100);
});

function playerFixture(
  goal: PrimaryHittingGoal,
  scoreOverrides: Partial<PlayerDNAProfileResult["scores"]> = {}
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
      profileCompleteness: 92,
      ...scoreOverrides
    },
    categories: {
      preferredSwingFeel: "light",
      developmentStage: "competitive",
      primaryHittingGoal: goal,
      currentEquipmentAssessment: "likes light swing, good pop, large sweet spot",
      growthStatus: "moderate_growth",
      profileConfidenceLevel: "high"
    },
    confidence: { score: 84, level: "high", factors: {}, missingInformation: [] },
    explanations: [],
    missingInformation: [],
    inputSnapshot: { player: { id: "player-1" }, playerProfile: { experienceYears: 5 } },
    scoreBreakdown: {},
    generatedAt: "2026-01-01T00:00:00.000Z"
  };
}

function canonicalProfile(
  id: string,
  values: { length: number; weight: number; drop: number; balance: number; swingEffort: number },
  omit: readonly EquipmentDNAAttributeKey[] = []
): CanonicalEquipmentDNAProfile {
  const attrs = [
    attr("length", values.length, "physical", values.length),
    attr("weight", values.weight, "physical", values.weight),
    attr("drop", values.drop, "physical", values.drop),
    attr("balance_profile", balanceOrdinal(values.balance), "performance", values.balance),
    attr("swing_effort", swingEffortOrdinal(values.swingEffort), "performance", values.swingEffort),
    attr("construction", "two_piece_composite", "physical"),
    attr("material", "composite", "physical")
  ].filter((attribute) => !omit.includes(attribute.key));
  return {
    version: "1.0",
    equipmentId: `${id}-equipment`,
    equipmentVariantId: `${id}-variant`,
    equipmentName: id,
    variantLabel: `${id}-sku`,
    registryVersion: "1.0",
    confidenceModelVersion: "1.0",
    readinessModelVersion: "1.0",
    scoreMappingVersion: "1.0",
    readiness: { ready: true, missingRequiredAttributes: [], insufficientConfidenceAttributes: [], invalidAttributes: [], experimentalAttributesIgnored: [], reasons: [] },
    maturity: "evaluated",
    attributes: attrs,
    missingAttributes: [],
    invalidAttributes: [],
    conflicts: [],
    generatedAt: date()
  };
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
    rationale: `${key} fixture`,
    evaluatedAt: date(),
    evidence: numericValue === undefined ? [] : [{
      evidenceRecordId: `${key}-evidence`,
      sourceType: "internal_derived",
      sourceName: "test fixture",
      method: "derived_mapping",
      status: "active",
      rawValue: { normalizedScore: numericValue, sourceScore: numericValue, referenceMethod: "legacy_preserved" },
      evaluatorType: "system"
    }],
    status: "active"
  };
}

function date(): Date {
  return new Date("2026-08-05T00:00:00.000Z");
}
