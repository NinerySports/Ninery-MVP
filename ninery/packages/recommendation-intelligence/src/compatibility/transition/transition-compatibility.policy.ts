import type {
  TransitionCompatibilityBand,
  TransitionCompatibilityDimension,
  TransitionCompatibilityRecommendationUsePolicy
} from "./transition-compatibility.types.js";
import {
  TRANSITION_COMPATIBILITY_MODEL_VERSION,
  TRANSITION_COMPATIBILITY_POLICY_VERSION,
  TRANSITION_COMPATIBILITY_REASON_VERSION,
  TRANSITION_CHANGE_PROFILE_VERSION
} from "./transition-compatibility.types.js";

export const TRANSITION_COMPATIBILITY_TECHNICAL_DEFINITION =
  "The degree to which the equipment changes between a player's current bat and a proposed bat align with the player's present physical readiness, bat-control capability, experience, development stage, and equipment-adjustment tolerance.";

export const TRANSITION_COMPATIBILITY_PARENT_DEFINITION =
  "How manageable the move from the player's current bat to this bat may be right now.";

export const TRANSITION_COMPATIBILITY_EXCLUSIONS = [
  "universal product transition score",
  "guarantee of immediate comfort",
  "guarantee of performance",
  "psychological diagnosis",
  "current-bat quality judgment",
  "simple inversion of legacy transition friendliness",
  "a reason to avoid all meaningful equipment changes",
  "replacement for coaching or acclimation"
] as const;

export const transitionCompatibilityBandRanges = {
  very_manageable_transition: [80, 100],
  manageable_transition: [65, 79.99],
  moderate_adjustment: [45, 64.99],
  demanding_transition: [25, 44.99],
  highly_demanding_transition: [0, 24.99]
} as const satisfies Record<TransitionCompatibilityBand, readonly [number, number]>;

export const transitionCompatibilityDimensionWeights = {
  size_change_demand: 0.15,
  mass_change_demand: 0.2,
  drop_change_demand: 0.15,
  balance_change_demand: 0.15,
  swing_effort_change_demand: 0.2,
  experience_adjustment_demand: 0.15
} as const satisfies Record<TransitionCompatibilityDimension, number>;

export const transitionCompatibilityRequiredPlayerInputs = [
  "batControlReadiness",
  "developmentReadiness",
  "experienceReadiness"
] as const;

export const transitionCompatibilityRequiredCurrentInputs = ["length", "weight", "drop"] as const;
export const transitionCompatibilityRequiredProposedInputs = ["length", "weight", "drop"] as const;

export const transitionCompatibilityDemandThresholds = {
  lengthInches: [0, 0.5, 1, 1.5, 2],
  weightOunces: [0, 1, 2, 3],
  drop: [0, 1, 2, 3],
  balance: [0, 10, 20, 35, 50],
  swingEffort: [0, 10, 20, 35, 50]
} as const;

export const transitionCompatibilityPolicy = {
  version: TRANSITION_COMPATIBILITY_POLICY_VERSION,
  modelVersion: TRANSITION_COMPATIBILITY_MODEL_VERSION,
  reasonVersion: TRANSITION_COMPATIBILITY_REASON_VERSION,
  changeProfileVersion: TRANSITION_CHANGE_PROFILE_VERSION,
  ownership: "compatibility_intelligence",
  nature: "relational",
  recommendationUsePolicy: "shadow_only" as TransitionCompatibilityRecommendationUsePolicy,
  candidatePolicyConclusion: "requires_more_validation" as TransitionCompatibilityRecommendationUsePolicy,
  demandDirection: "0 = no meaningful adjustment demand, 100 = very high adjustment demand",
  compatibilityDirection: "0 = highly demanding transition fit, 100 = highly manageable transition fit",
  normalizationStrategy: "fixed_weight",
  minimumComponentCoverage: 4,
  readinessModifier: {
    maximumReduction: 20,
    maximumIncrease: 12,
    neutralReadiness: 60,
    minimumDemandRetained: 0.35
  },
  reasonThresholds: {
    manageableMinimum: 75,
    demandingMaximum: 64
  },
  explicitlyExcludedInputs: [
    "legacy transitionFriendliness",
    "legacy TRANSITION_FRIENDLINESS characteristic",
    "age-only transition inference",
    "universal product transition score"
  ],
  notes: [
    "The model computes equipment-change demand first, then converts demand to compatibility.",
    "Higher player readiness can reduce but never erase equipment-change demand.",
    "Missing required current or proposed specifications block the result.",
    "Legacy transitionFriendliness is comparison-only and never used as evidence or fallback."
  ]
} as const;

export function transitionCompatibilityBandForScore(score: number): TransitionCompatibilityBand {
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new Error("Transition compatibility score must be between 0 and 100.");
  }
  for (const [band, [min, max]] of Object.entries(transitionCompatibilityBandRanges) as Array<[TransitionCompatibilityBand, readonly [number, number]]>) {
    if (score >= min && score <= max) return band;
  }
  throw new Error(`Transition compatibility score ${score} did not match a band.`);
}

export function validateTransitionCompatibilityPolicy(): readonly string[] {
  const errors: string[] = [];
  const total = Object.values(transitionCompatibilityDimensionWeights).reduce((sum, value) => sum + value, 0);
  if (Math.round(total * 1000) !== 1000) errors.push("transition compatibility weights must sum to 1.0");
  if (transitionCompatibilityPolicy.recommendationUsePolicy !== "shadow_only") errors.push("v1.0 must remain shadow-only");
  if (transitionCompatibilityPolicy.readinessModifier.minimumDemandRetained <= 0) errors.push("readiness modifier must not erase component demand");
  return errors;
}
