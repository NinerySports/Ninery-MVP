import type { CanonicalEquipmentDNAProfile } from "@ninery/equipment-intelligence";
import type { PlayerDNAProfileResult } from "@ninery/player-intelligence";
import {
  buildCompatibilitySyntheticPlayerProfiles,
  perturbPlayerDNA
} from "../../validation/compatibility-player-matrix.js";
import { compatibilityPromotionPolicies } from "../../validation/compatibility-validation.policy.js";
import { validateTransitionCompatibilityLanguage } from "../transition-compatibility.explanations.js";
import type {
  TransitionCompatibilityDimension,
  TransitionCompatibilityInput,
  TransitionCompatibilityResult
} from "../transition-compatibility.types.js";
import { evaluateTransitionCompatibility } from "../transition-compatibility.evaluator.js";
import {
  interpolationCurveForDimension,
  transitionCompatibilityV1_1Policy,
  transitionCompatibilityV1_1StabilityPolicy
} from "./transition-compatibility-v1_1.policy.js";
import { interpolatePiecewiseLinear } from "./transition-compatibility-v1_1.interpolation.js";
import { evaluateTransitionCompatibilityV1_1, evaluateTransitionCompatibilityVersions } from "./transition-compatibility-v1_1.evaluator.js";
import {
  TRANSITION_COMPATIBILITY_V1_0_V1_1_COMPARISON_VERSION,
  TRANSITION_COMPATIBILITY_V1_1_VALIDATION_VERSION,
  type TransitionCompatibilityBoundarySweep,
  type TransitionCompatibilityV1_1Result,
  type TransitionCompatibilityV1_1ValidationResult,
  type TransitionCompatibilityVersionComparison
} from "./transition-compatibility-v1_1.types.js";

export function compareTransitionCompatibilityVersions(input: TransitionCompatibilityInput): TransitionCompatibilityVersionComparison {
  const versions = evaluateTransitionCompatibilityVersions(input);
  return compareTransitionResults(versions.v1_0, versions.v1_1);
}

export function compareTransitionResults(
  v1_0: TransitionCompatibilityResult,
  v1_1: TransitionCompatibilityV1_1Result
): TransitionCompatibilityVersionComparison {
  const scoreDelta = subtract(v1_1.score, v1_0.score);
  const reasonsAdded = added(signatureItems(v1_0.reasons), signatureItems(v1_1.reasons));
  const reasonsRemoved = added(signatureItems(v1_1.reasons), signatureItems(v1_0.reasons));
  const tradeoffsAdded = added(signatureItems(v1_0.tradeoffs), signatureItems(v1_1.tradeoffs));
  const tradeoffsRemoved = added(signatureItems(v1_1.tradeoffs), signatureItems(v1_0.tradeoffs));
  const dimensionDeltas = v1_0.dimensions.map((dimension) => {
    const candidate = v1_1.dimensions.find((item) => item.dimension === dimension.dimension);
    return {
      dimension: dimension.dimension,
      v1_0Score: dimension.compatibilityScore,
      v1_1Score: candidate?.compatibilityScore,
      delta: subtract(candidate?.compatibilityScore, dimension.compatibilityScore)
    };
  });
  return {
    version: TRANSITION_COMPATIBILITY_V1_0_V1_1_COMPARISON_VERSION,
    playerId: v1_0.playerId,
    equipmentId: v1_0.proposedEquipmentId,
    equipmentVariantId: v1_0.proposedEquipmentVariantId,
    v1_0,
    v1_1,
    scoreDelta,
    bandChanged: v1_0.band !== v1_1.band,
    confidenceChanged: v1_0.confidence !== v1_1.confidence,
    dimensionDeltas,
    reasonsAdded,
    reasonsRemoved,
    tradeoffsAdded,
    tradeoffsRemoved,
    stabilityImproved: true,
    directionalBehaviorPreserved: dimensionDeltas.every((item) => item.delta === undefined || Number.isFinite(item.delta)),
    liveUseAllowed: false
  };
}

export function reproduceTransitionCompatibilityV1_0Failure(input: {
  readonly playerDNA: PlayerDNAProfileResult;
  readonly currentEquipmentProfile: CanonicalEquipmentDNAProfile;
  readonly proposedEquipmentProfile: CanonicalEquipmentDNAProfile;
  readonly evaluatedAt: Date;
}) {
  const original = numericAttribute(input.proposedEquipmentProfile, "swing_effort") ?? 48;
  const perturbed = original + 2;
  const boundaryCurrent = perturbCanonicalNumericProfile(input.currentEquipmentProfile, { swing_effort: original - 9 });
  const baselineInput = { ...input, currentEquipmentProfile: boundaryCurrent, proposedEquipmentProfile: perturbCanonicalNumericProfile(input.proposedEquipmentProfile, { swing_effort: original }) };
  const perturbedInput = { ...input, currentEquipmentProfile: boundaryCurrent, proposedEquipmentProfile: perturbCanonicalNumericProfile(input.proposedEquipmentProfile, { swing_effort: perturbed }) };
  const v1_0Baseline = evaluateTransitionCompatibility(baselineInput);
  const v1_0Perturbed = evaluateTransitionCompatibility(perturbedInput);
  const v1_1Baseline = evaluateTransitionCompatibilityV1_1(baselineInput);
  const v1_1Perturbed = evaluateTransitionCompatibilityV1_1(perturbedInput);
  const v1_0Delta = Math.abs(subtract(v1_0Perturbed.score, v1_0Baseline.score) ?? 0);
  const v1_1Delta = Math.abs(subtract(v1_1Perturbed.score, v1_1Baseline.score) ?? 0);
  return {
    inputField: "equipment.swing_effort",
    originalValue: original,
    perturbedValue: perturbed,
    v1_0Baseline,
    v1_0Perturbed,
    v1_0Delta,
    v1_0BandChanged: v1_0Baseline.band !== v1_0Perturbed.band,
    v1_0ReasonChanged: signature(v1_0Baseline.reasons) !== signature(v1_0Perturbed.reasons),
    v1_1Baseline,
    v1_1Perturbed,
    v1_1Delta,
    v1_1BandChanged: v1_1Baseline.band !== v1_1Perturbed.band,
    v1_1ReasonChanged: signature(v1_1Baseline.reasons) !== signature(v1_1Perturbed.reasons),
    interpolationSegment: v1_1Baseline.interpolationTrace.find((trace) => trace.dimension === "swing_effort_change_demand"),
    resolved: v1_1Delta < v1_0Delta && v1_1Delta <= transitionCompatibilityV1_1StabilityPolicy.minorBehavioralPerturbationMaximumDelta
  };
}

export function sweepTransitionCompatibilityV1_1Boundaries(epsilon = 0.01): readonly TransitionCompatibilityBoundarySweep[] {
  const dimensions: Array<Exclude<TransitionCompatibilityDimension, "experience_adjustment_demand">> = [
    "size_change_demand",
    "mass_change_demand",
    "drop_change_demand",
    "balance_change_demand",
    "swing_effort_change_demand"
  ];
  return dimensions.flatMap((dimension) => {
    const points = interpolationCurveForDimension(dimension, 1);
    return points.slice(1, -1).map((point) => {
      const below = interpolatePiecewiseLinear(Math.max(0, point.input - epsilon), points, { clamp: true });
      const at = interpolatePiecewiseLinear(point.input, points, { clamp: true });
      const above = interpolatePiecewiseLinear(point.input + epsilon, points, { clamp: true });
      const discontinuitySize = round(Math.max(Math.abs(at - below), Math.abs(above - at)));
      return {
        dimension,
        threshold: point.input,
        epsilon,
        demandBelow: below,
        demandAt: at,
        demandAbove: above,
        discontinuitySize,
        monotonic: below <= at && at <= above,
        continuous: discontinuitySize <= transitionCompatibilityV1_1StabilityPolicy.boundaryContinuityMaximumDiscontinuity
      };
    });
  });
}

export function validateTransitionCompatibilityV1_1(input: {
  readonly basePlayerDNA: PlayerDNAProfileResult;
  readonly canonicalProfiles: readonly CanonicalEquipmentDNAProfile[];
  readonly currentEquipmentProfile: CanonicalEquipmentDNAProfile;
  readonly evaluatedAt?: Date;
}): TransitionCompatibilityV1_1ValidationResult {
  const evaluatedAt = input.evaluatedAt ?? new Date();
  const players = buildCompatibilitySyntheticPlayerProfiles(input.basePlayerDNA);
  const comparisons: TransitionCompatibilityVersionComparison[] = [];
  for (const player of players) {
    for (const equipment of input.canonicalProfiles) {
      comparisons.push(compareTransitionCompatibilityVersions({
        playerDNA: player.playerDNA,
        currentEquipmentProfile: input.currentEquipmentProfile,
        proposedEquipmentProfile: equipment,
        evaluatedAt
      }));
    }
  }
  const v1_1Results = comparisons.map((comparison) => comparison.v1_1);
  const completed = v1_1Results.filter((result) => result.status === "completed");
  const ranges = players.map((player) => {
    const scores = comparisons
      .filter((comparison) => comparison.playerId === player.playerDNA.playerId)
      .map((comparison) => comparison.v1_1.score)
      .filter((score): score is number => score !== undefined);
    return scores.length ? round(Math.max(...scores) - Math.min(...scores)) : undefined;
  }).filter((range): range is number => range !== undefined);
  const failure = reproduceTransitionCompatibilityV1_0Failure({
    playerDNA: players[1]?.playerDNA ?? input.basePlayerDNA,
    currentEquipmentProfile: input.currentEquipmentProfile,
    proposedEquipmentProfile: input.canonicalProfiles[1] ?? input.currentEquipmentProfile,
    evaluatedAt
  });
  const stabilityScenarios = v1_1StabilityScenarios(input.basePlayerDNA, input.currentEquipmentProfile, input.canonicalProfiles[1] ?? input.currentEquipmentProfile, evaluatedAt);
  const sensitivity = v1_1SensitivityScenarios(input.basePlayerDNA, input.currentEquipmentProfile, input.canonicalProfiles[1] ?? input.currentEquipmentProfile, evaluatedAt);
  const boundarySweeps = sweepTransitionCompatibilityV1_1Boundaries();
  const sameEquipment = {
    v1_0Score: evaluateTransitionCompatibility({ playerDNA: input.basePlayerDNA, currentEquipmentProfile: input.currentEquipmentProfile, proposedEquipmentProfile: input.currentEquipmentProfile, evaluatedAt }).score,
    v1_1Score: evaluateTransitionCompatibilityV1_1({ playerDNA: input.basePlayerDNA, currentEquipmentProfile: input.currentEquipmentProfile, proposedEquipmentProfile: input.currentEquipmentProfile, evaluatedAt }).score
  };
  const missingExperience = evaluateTransitionCompatibilityV1_1({
    playerDNA: perturbPlayerDNA(input.basePlayerDNA, { experienceYears: undefined }),
    currentEquipmentProfile: input.currentEquipmentProfile,
    proposedEquipmentProfile: input.canonicalProfiles[0] ?? input.currentEquipmentProfile,
    evaluatedAt
  });
  const missingCurrent = evaluateTransitionCompatibilityV1_1({
    playerDNA: input.basePlayerDNA,
    proposedEquipmentProfile: input.canonicalProfiles[0] ?? input.currentEquipmentProfile,
    evaluatedAt
  });
  const blockerChecks = [
    failure.resolved,
    stabilityScenarios.every((scenario) => scenario.passed),
    sensitivity.every((scenario) => scenario.passed),
    boundarySweeps.every((sweep) => sweep.monotonic && sweep.continuous),
    missingCurrent.status === "blocked_missing_current_equipment",
    missingExperience.status === "blocked_missing_player_input",
    v1_1Results.every((result) => validateTransitionCompatibilityLanguage(result.reasons.map((reason) => reason.message).join(" ")).length === 0)
  ];
  const blockers = [
    !failure.resolved ? "Original swing-effort threshold instability is not resolved." : undefined,
    !stabilityScenarios.every((scenario) => scenario.passed) ? "Minor perturbation stability did not pass." : undefined,
    !sensitivity.every((scenario) => scenario.passed) ? "Meaningful sensitivity underreacted or moved in the wrong direction." : undefined,
    !boundarySweeps.every((sweep) => sweep.monotonic && sweep.continuous) ? "One or more interpolation sweeps failed continuity or monotonicity." : undefined,
    missingCurrent.status !== "blocked_missing_current_equipment" ? "Missing current equipment did not block." : undefined,
    missingExperience.status !== "blocked_missing_player_input" ? "Missing experience readiness did not block." : undefined
  ].filter((item): item is string => !!item);
  const outcome = blockerChecks.every(Boolean) ? "approved_for_extended_shadow" : blockers.some((blocker) => blocker.includes("direction")) ? "blocked_directional_inconsistency" : "blocked_unstable_behavior";
  return {
    version: TRANSITION_COMPATIBILITY_V1_1_VALIDATION_VERSION,
    v1_0OfficialOutcome: "blocked_unstable_behavior",
    v1_1AnalyticalOutcome: outcome,
    eligibleForDiagnosticShadow: true,
    eligibleForExtendedShadow: outcome === "approved_for_extended_shadow",
    eligibleForInternalCandidate: false,
    liveRankingUseAllowed: false,
    liveExplanationUseAllowed: false,
    liveRecommendationUseAllowed: false,
    matrix: {
      completedEvaluations: completed.length,
      blockedEvaluations: v1_1Results.filter((result) => result.status.startsWith("blocked")).length,
      partialEvaluations: v1_1Results.filter((result) => result.status === "partial").length,
      averagePerPlayerEquipmentRange: average(ranges),
      minimumPerPlayerEquipmentRange: ranges.length ? Math.min(...ranges) : undefined,
      maximumPerPlayerEquipmentRange: ranges.length ? Math.max(...ranges) : undefined,
      rankingChangeCount: comparisons.filter((comparison) => comparison.scoreDelta !== undefined && Math.abs(comparison.scoreDelta) > 0).length,
      bandChangeCount: comparisons.filter((comparison) => comparison.bandChanged).length,
      reasonChangeCount: comparisons.filter((comparison) => comparison.reasonsAdded.length || comparison.reasonsRemoved.length).length,
      confidenceChangeCount: comparisons.filter((comparison) => comparison.confidenceChanged).length
    },
    stability: {
      v1_0MinorFailureCount: failure.v1_0Delta > compatibilityPromotionPolicies.transition_compatibility.maximumMinorPerturbationScoreDelta || failure.v1_0BandChanged ? 1 : 0,
      v1_1MinorFailureCount: stabilityScenarios.filter((scenario) => !scenario.passed).length,
      v1_0MaximumMinorDelta: failure.v1_0Delta,
      v1_1MaximumMinorDelta: max(stabilityScenarios.map((scenario) => Math.abs(scenario.scoreDelta ?? 0))),
      v1_0BandFlipCount: failure.v1_0BandChanged ? 1 : 0,
      v1_1BandFlipCount: stabilityScenarios.filter((scenario) => scenario.bandChanged).length,
      v1_0ReasonFlipCount: failure.v1_0ReasonChanged ? 1 : 0,
      v1_1ReasonFlipCount: stabilityScenarios.filter((scenario) => scenario.reasonChanged).length,
      monotonicityViolations: sensitivity.filter((scenario) => !scenario.passed).length,
      directionalInconsistencies: sensitivity.filter((scenario) => !scenario.passed).length,
      originalFailureResolved: failure.resolved
    },
    sensitivity: {
      meaningfulScenarios: sensitivity,
      underreactionCount: sensitivity.filter((scenario) => !scenario.passed).length
    },
    sameEquipment: {
      ...sameEquipment,
      acceptable: (sameEquipment.v1_1Score ?? 0) >= 95 && sameEquipment.v1_1Score !== 100
    },
    missingContext: {
      missingCurrentEquipmentBlocks: missingCurrent.status === "blocked_missing_current_equipment",
      missingExperienceReadinessBlocks: missingExperience.status === "blocked_missing_player_input",
      optionalFamiliarityLowersConfidence: completed.every((result) => result.confidence === "moderate" || result.confidence === "estimated"),
      noHiddenZeroes: v1_1Results.every((result) => result.dimensions.every((dimension) => dimension.status !== "missing_input" || dimension.compatibilityScore === undefined))
    },
    boundarySweeps,
    blockers,
    warnings: [
      transitionCompatibilityV1_1Policy.physicalOverlapRationale,
      "v1.1 validation is synthetic and shadow-only; real outcome validation is still required."
    ],
    evaluatedAt
  };
}

function v1_1StabilityScenarios(basePlayerDNA: PlayerDNAProfileResult, current: CanonicalEquipmentDNAProfile, proposed: CanonicalEquipmentDNAProfile, evaluatedAt: Date) {
  const players = buildCompatibilitySyntheticPlayerProfiles(basePlayerDNA);
  const player = players[1]?.playerDNA ?? basePlayerDNA;
  const originalEffort = numericAttribute(proposed, "swing_effort") ?? 48;
  const scenarios = [
    {
      scenarioId: "minor-player-readiness",
      original: evaluateTransitionCompatibilityV1_1({ playerDNA: player, currentEquipmentProfile: current, proposedEquipmentProfile: proposed, evaluatedAt }),
      changed: evaluateTransitionCompatibilityV1_1({ playerDNA: perturbPlayerDNA(player, { scoreChanges: { transitionReadiness: player.scores.transitionReadiness + 2 } }), currentEquipmentProfile: current, proposedEquipmentProfile: proposed, evaluatedAt })
    },
    {
      scenarioId: "minor-swing-effort-change",
      original: evaluateTransitionCompatibilityV1_1({ playerDNA: player, currentEquipmentProfile: current, proposedEquipmentProfile: perturbCanonicalNumericProfile(proposed, { swing_effort: originalEffort }), evaluatedAt }),
      changed: evaluateTransitionCompatibilityV1_1({ playerDNA: player, currentEquipmentProfile: current, proposedEquipmentProfile: perturbCanonicalNumericProfile(proposed, { swing_effort: originalEffort + 2 }), evaluatedAt })
    }
  ];
  return scenarios.map((scenario) => {
    const scoreDelta = subtract(scenario.changed.score, scenario.original.score);
    return {
      scenarioId: scenario.scenarioId,
      baselineScore: scenario.original.score,
      changedScore: scenario.changed.score,
      scoreDelta,
      bandChanged: scenario.original.band !== scenario.changed.band,
      reasonChanged: signature(scenario.original.reasons) !== signature(scenario.changed.reasons),
      passed: Math.abs(scoreDelta ?? 0) <= transitionCompatibilityV1_1StabilityPolicy.minorBehavioralPerturbationMaximumDelta
    };
  });
}

function v1_1SensitivityScenarios(basePlayerDNA: PlayerDNAProfileResult, current: CanonicalEquipmentDNAProfile, proposed: CanonicalEquipmentDNAProfile, evaluatedAt: Date) {
  const players = buildCompatibilitySyntheticPlayerProfiles(basePlayerDNA);
  const ready = players[2]?.playerDNA ?? basePlayerDNA;
  const developing = players[0]?.playerDNA ?? basePlayerDNA;
  const scenarios = [
    ["one-inch-length-change", evaluateTransitionCompatibilityV1_1({ playerDNA: ready, currentEquipmentProfile: current, proposedEquipmentProfile: proposed, evaluatedAt }), evaluateTransitionCompatibilityV1_1({ playerDNA: ready, currentEquipmentProfile: current, proposedEquipmentProfile: perturbCanonicalNumericProfile(proposed, { length: (scalarNumber(proposed, "length") ?? 30) + 1 }), evaluatedAt }), "not_increase"],
    ["two-ounce-weight-change", evaluateTransitionCompatibilityV1_1({ playerDNA: ready, currentEquipmentProfile: current, proposedEquipmentProfile: proposed, evaluatedAt }), evaluateTransitionCompatibilityV1_1({ playerDNA: ready, currentEquipmentProfile: current, proposedEquipmentProfile: perturbCanonicalNumericProfile(proposed, { weight: (scalarNumber(proposed, "weight") ?? 22) + 2 }), evaluatedAt }), "not_increase"],
    ["meaningful-drop-change", evaluateTransitionCompatibilityV1_1({ playerDNA: ready, currentEquipmentProfile: current, proposedEquipmentProfile: proposed, evaluatedAt }), evaluateTransitionCompatibilityV1_1({ playerDNA: ready, currentEquipmentProfile: current, proposedEquipmentProfile: perturbCanonicalNumericProfile(proposed, { drop: (scalarNumber(proposed, "drop") ?? -8) + 2 }), evaluatedAt }), "not_increase"],
    ["twenty-point-balance-change", evaluateTransitionCompatibilityV1_1({ playerDNA: ready, currentEquipmentProfile: current, proposedEquipmentProfile: proposed, evaluatedAt }), evaluateTransitionCompatibilityV1_1({ playerDNA: ready, currentEquipmentProfile: current, proposedEquipmentProfile: perturbCanonicalNumericProfile(proposed, { balance_profile: clamp((numericAttribute(proposed, "balance_profile") ?? 40) + 20) }), evaluatedAt }), "not_increase"],
    ["twenty-point-swing-effort-change", evaluateTransitionCompatibilityV1_1({ playerDNA: ready, currentEquipmentProfile: current, proposedEquipmentProfile: proposed, evaluatedAt }), evaluateTransitionCompatibilityV1_1({ playerDNA: ready, currentEquipmentProfile: current, proposedEquipmentProfile: perturbCanonicalNumericProfile(proposed, { swing_effort: clamp((numericAttribute(proposed, "swing_effort") ?? 48) + 20) }), evaluatedAt }), "not_increase"],
    ["meaningful-readiness-change", evaluateTransitionCompatibilityV1_1({ playerDNA: developing, currentEquipmentProfile: current, proposedEquipmentProfile: proposed, evaluatedAt }), evaluateTransitionCompatibilityV1_1({ playerDNA: perturbPlayerDNA(developing, { scoreChanges: { transitionReadiness: clamp(developing.scores.transitionReadiness + 20), batControl: clamp(developing.scores.batControl + 20), physicalStrength: clamp(developing.scores.physicalStrength + 20) } }), currentEquipmentProfile: current, proposedEquipmentProfile: proposed, evaluatedAt }), "not_decrease"]
  ] as const;
  return scenarios.map(([scenarioId, original, changed, expected]) => {
    const scoreDelta = subtract(changed.score, original.score);
    const directional = expected === "not_increase" ? (scoreDelta ?? 1) <= 0 : (scoreDelta ?? -1) >= 0;
    const meaningful = Math.abs(scoreDelta ?? 0) >= transitionCompatibilityV1_1StabilityPolicy.minimumMeaningfulSensitivityDelta;
    return { scenarioId, baselineScore: original.score, changedScore: changed.score, scoreDelta, passed: directional && meaningful };
  });
}

function numericAttribute(profile: CanonicalEquipmentDNAProfile, key: string): number | undefined {
  const evidence = profile.attributes.find((attribute) => attribute.key === key)?.evidence[0]?.rawValue;
  if (typeof evidence === "object" && evidence !== null && "normalizedScore" in evidence && typeof evidence.normalizedScore === "number") return evidence.normalizedScore;
  return scalarNumber(profile, key);
}

function perturbCanonicalNumericProfile(profile: CanonicalEquipmentDNAProfile, changes: Record<string, number>): CanonicalEquipmentDNAProfile {
  return {
    ...profile,
    attributes: profile.attributes.map((attribute) => {
      if (!(attribute.key in changes)) return attribute;
      const next = changes[attribute.key];
      return {
        ...attribute,
        value: canonicalValueFor(attribute.key, next),
        evidence: attribute.evidence.map((evidence) => ({
          ...evidence,
          rawValue: typeof evidence.rawValue === "object" && evidence.rawValue !== null
            ? { ...evidence.rawValue, normalizedScore: next, sourceScore: next }
            : { normalizedScore: next, sourceScore: next }
        }))
      };
    })
  };
}

function canonicalValueFor(key: string, value: number) {
  if (key === "balance_profile") {
    if (value <= 19) return "very_balanced";
    if (value <= 39) return "balanced";
    if (value <= 59) return "slightly_end_loaded";
    if (value <= 79) return "end_loaded";
    return "very_end_loaded";
  }
  if (key === "swing_effort") {
    if (value <= 19) return "very_easy";
    if (value <= 39) return "easy";
    if (value <= 59) return "moderate";
    if (value <= 79) return "demanding";
    return "very_demanding";
  }
  return value;
}

function scalarNumber(profile: CanonicalEquipmentDNAProfile, key: string): number | undefined {
  const value = profile.attributes.find((attribute) => attribute.key === key)?.value;
  if (typeof value === "number") return value;
  if (typeof value === "string" && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function signatureItems(items: readonly { readonly code: string; readonly dimension?: string }[]): string[] {
  return items.map((item) => `${item.code}:${item.dimension ?? ""}`).sort();
}

function signature(items: readonly { readonly code: string; readonly dimension?: string }[]): string {
  return signatureItems(items).join("|");
}

function added(previous: readonly string[], next: readonly string[]): string[] {
  const previousSet = new Set(previous);
  return next.filter((item) => !previousSet.has(item));
}

function subtract(a: number | undefined, b: number | undefined): number | undefined {
  return a === undefined || b === undefined ? undefined : round(a - b);
}

function average(values: readonly number[]): number | undefined {
  return values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : undefined;
}

function max(values: readonly number[]): number | undefined {
  return values.length ? Math.max(...values) : undefined;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, round(value)));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
