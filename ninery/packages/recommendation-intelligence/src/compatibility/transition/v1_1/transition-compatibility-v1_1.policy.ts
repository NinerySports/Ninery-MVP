import {
  transitionCompatibilityBandForScore,
  transitionCompatibilityBandRanges,
  transitionCompatibilityDemandThresholds,
  transitionCompatibilityDimensionWeights,
  transitionCompatibilityPolicy
} from "../transition-compatibility.policy.js";
import type { TransitionCompatibilityDimension } from "../transition-compatibility.types.js";
import {
  TRANSITION_COMPATIBILITY_INTERPOLATION_VERSION,
  TRANSITION_COMPATIBILITY_MODEL_VERSION_V1_1,
  TRANSITION_COMPATIBILITY_POLICY_VERSION_V1_1
} from "./transition-compatibility-v1_1.types.js";
import type { InterpolationPoint } from "./transition-compatibility-v1_1.interpolation.js";

export const transitionCompatibilityV1_1ReadinessModifierPolicy = {
  minimumMultiplier: 0.35,
  maximumMultiplier: 1.2,
  maximumAbsoluteDemandReduction: 20,
  maximumAbsoluteDemandIncrease: 12,
  neutralReadiness: 60,
  minimumDemandRetained: 0.35
} as const;

export const transitionCompatibilityV1_1StabilityPolicy = {
  minorBehavioralPerturbationMaximumDelta: 5,
  maximumUnexpectedBandJumps: 0,
  minimumMeaningfulSensitivityDelta: 0.5,
  boundaryContinuityMaximumDiscontinuity: 0.6
} as const;

export const transitionCompatibilityV1_1InterpolationCurves = {
  size_change_demand: [
    { input: 0, output: 0 },
    { input: 0.5, output: 20 },
    { input: 1, output: 45 },
    { input: 1.5, output: 70 },
    { input: 2, output: 90 }
  ],
  mass_change_demand_heavier: [
    { input: 0, output: 0 },
    { input: 1, output: 23 },
    { input: 2, output: 51 },
    { input: 3, output: 79 },
    { input: 4, output: 100 }
  ],
  mass_change_demand_lighter: [
    { input: 0, output: 0 },
    { input: 1, output: 22 },
    { input: 2, output: 49 },
    { input: 3, output: 76 },
    { input: 4, output: 98 }
  ],
  drop_change_demand: [
    { input: 0, output: 0 },
    { input: 1, output: 20 },
    { input: 2, output: 45 },
    { input: 3, output: 70 },
    { input: 4, output: 90 }
  ],
  balance_change_demand: [
    { input: 0, output: 0 },
    { input: 10, output: 20 },
    { input: 20, output: 45 },
    { input: 35, output: 70 },
    { input: 50, output: 90 },
    { input: 65, output: 100 }
  ],
  swing_effort_change_demand_more: [
    { input: 0, output: 0 },
    { input: 10, output: 22.5 },
    { input: 20, output: 50 },
    { input: 35, output: 78.75 },
    { input: 50, output: 100 }
  ],
  swing_effort_change_demand_less: [
    { input: 0, output: 0 },
    { input: 10, output: 21.5 },
    { input: 20, output: 48 },
    { input: 35, output: 75.25 },
    { input: 50, output: 97.5 }
  ]
} as const satisfies Record<string, readonly InterpolationPoint[]>;

export const transitionCompatibilityV1_1Policy = {
  version: TRANSITION_COMPATIBILITY_POLICY_VERSION_V1_1,
  modelVersion: TRANSITION_COMPATIBILITY_MODEL_VERSION_V1_1,
  interpolationVersion: TRANSITION_COMPATIBILITY_INTERPOLATION_VERSION,
  recommendationUsePolicy: "shadow_only",
  candidateVersion: "v1_1_linear_interpolation",
  productionUseAllowed: false,
  liveRecommendationUseAllowed: false,
  dimensionWeights: transitionCompatibilityDimensionWeights,
  minimumComponentCoverage: transitionCompatibilityPolicy.minimumComponentCoverage,
  bandRanges: transitionCompatibilityBandRanges,
  reasonThresholds: transitionCompatibilityPolicy.reasonThresholds,
  demandThresholds: transitionCompatibilityDemandThresholds,
  interpolationCurves: transitionCompatibilityV1_1InterpolationCurves,
  readinessModifier: transitionCompatibilityV1_1ReadinessModifierPolicy,
  stability: transitionCompatibilityV1_1StabilityPolicy,
  physicalOverlapDecision: "preserve_v1_0_weights",
  physicalOverlapRationale: "Ticket #036 identified moderate physical overlap but did not approve a concrete weight package, so v1.1 changes only interpolation and explicit modifier bounds.",
  compatibilityDirection: transitionCompatibilityPolicy.compatibilityDirection,
  demandDirection: transitionCompatibilityPolicy.demandDirection
} as const;

export function transitionCompatibilityV1_1BandForScore(score: number) {
  return transitionCompatibilityBandForScore(score);
}

export function validateTransitionCompatibilityV1_1Policy(): readonly string[] {
  const errors: string[] = [];
  const total = Object.values(transitionCompatibilityV1_1Policy.dimensionWeights).reduce((sum, value) => sum + value, 0);
  if (Math.round(total * 1000) !== 1000) errors.push("v1.1 transition compatibility weights must sum to 1.0");
  if (transitionCompatibilityV1_1Policy.recommendationUsePolicy !== "shadow_only") errors.push("v1.1 must remain shadow-only");
  if (transitionCompatibilityV1_1ReadinessModifierPolicy.minimumMultiplier <= 0) errors.push("readiness multiplier must not erase demand");
  for (const [name, points] of Object.entries(transitionCompatibilityV1_1InterpolationCurves)) {
    let previousInput = -Infinity;
    let previousOutput = -Infinity;
    for (const point of points) {
      if (point.input <= previousInput) errors.push(`${name} inputs must increase`);
      if (point.output < previousOutput) errors.push(`${name} outputs must be monotonic`);
      previousInput = point.input;
      previousOutput = point.output;
    }
  }
  return errors;
}

export function interpolationCurveForDimension(
  dimension: Exclude<TransitionCompatibilityDimension, "experience_adjustment_demand">,
  delta: number
): readonly InterpolationPoint[] {
  if (dimension === "mass_change_demand") return delta >= 0 ? transitionCompatibilityV1_1InterpolationCurves.mass_change_demand_heavier : transitionCompatibilityV1_1InterpolationCurves.mass_change_demand_lighter;
  if (dimension === "swing_effort_change_demand") return delta >= 0 ? transitionCompatibilityV1_1InterpolationCurves.swing_effort_change_demand_more : transitionCompatibilityV1_1InterpolationCurves.swing_effort_change_demand_less;
  if (dimension === "size_change_demand") return transitionCompatibilityV1_1InterpolationCurves.size_change_demand;
  if (dimension === "drop_change_demand") return transitionCompatibilityV1_1InterpolationCurves.drop_change_demand;
  return transitionCompatibilityV1_1InterpolationCurves.balance_change_demand;
}
