import type {
  ConfidenceCompatibilityBand,
  ConfidenceCompatibilityDimension,
  ConfidenceCompatibilityRecommendationUsePolicy
} from "./confidence-compatibility.types.js";
import {
  CONFIDENCE_COMPATIBILITY_MODEL_VERSION,
  CONFIDENCE_COMPATIBILITY_POLICY_VERSION,
  CONFIDENCE_COMPATIBILITY_REASON_VERSION
} from "./confidence-compatibility.types.js";

export const CONFIDENCE_COMPATIBILITY_TECHNICAL_DEFINITION =
  "The degree to which a bat's predictable, manageable, and understandable behavior aligns with a specific player's current developmental readiness, consistency, experience, and need for equipment that supports repeatable outcomes.";

export const CONFIDENCE_COMPATIBILITY_PARENT_DEFINITION =
  "How well the bat's behavior may fit this player's current need for a manageable and understandable hitting experience.";

export const CONFIDENCE_COMPATIBILITY_EXCLUSIONS = [
  "psychological diagnosis",
  "self-esteem score",
  "emotional-health assessment",
  "guarantee of confidence",
  "universal product property",
  "player preference alone",
  "overall bat quality",
  "replacement for coaching",
  "transition compatibility"
] as const;

export const confidenceCompatibilityBandRanges = {
  very_supportive_fit: [80, 100],
  supportive_fit: [65, 79],
  mixed_fit: [45, 64],
  demanding_fit: [25, 44],
  highly_demanding_fit: [0, 24]
} as const satisfies Record<ConfidenceCompatibilityBand, readonly [number, number]>;

export const confidenceCompatibilityDimensionWeights = {
  predictability_alignment: 0.3,
  forgiveness_alignment: 0.2,
  bat_control_alignment: 0.2,
  manageable_effort_alignment: 0.15,
  contact_support_alignment: 0.15
} as const satisfies Record<ConfidenceCompatibilityDimension, number>;

export const confidenceCompatibilityRequiredPlayerInputs = [
  "batControlNeed",
  "contactConsistencyNeed",
  "predictabilityNeed",
  "forgivenessNeed",
  "manageableEffortNeed"
] as const;

export const confidenceCompatibilityRequiredEquipmentInputs = [
  "predictabilitySupport",
  "forgivenessSupport",
  "sweetSpotSupport",
  "manageableEffortSupport",
  "batControlSupport"
] as const;

export const confidenceCompatibilityPolicy = {
  version: CONFIDENCE_COMPATIBILITY_POLICY_VERSION,
  modelVersion: CONFIDENCE_COMPATIBILITY_MODEL_VERSION,
  reasonVersion: CONFIDENCE_COMPATIBILITY_REASON_VERSION,
  ownership: "compatibility_intelligence",
  nature: "relational",
  recommendationUsePolicy: "shadow_only" as ConfidenceCompatibilityRecommendationUsePolicy,
  candidatePolicyConclusion: "requires_more_validation" as ConfidenceCompatibilityRecommendationUsePolicy,
  scoreScale: "0_100",
  playerNeedDirection: "0 = low support need, 100 = high support need",
  equipmentSupportDirection: "0 = low support capability, 100 = high support capability",
  alignment: {
    supportBelowNeedPenaltyMultiplier: 1.1,
    supportAboveNeedPenaltyMultiplier: 0.25,
    supportAboveNeedMaximumPenalty: 15,
    supportMetTolerance: 5
  },
  confidence: {
    completeModerateProfile: "moderate",
    completeHighQualityProfile: "high",
    missingRequiredInput: "estimated",
    validatedAllowed: false
  },
  reasonThresholds: {
    supportiveMinimum: 75,
    tradeoffExcessMinimum: 25,
    belowNeedMaximum: 64
  },
  explicitlyExcludedInputs: [
    "legacy confidenceBuilding",
    "legacy transitionFriendliness",
    "age-only confidence inference",
    "balance as universal confidence support"
  ],
  notes: [
    "The model compares player support need with equipment support capability using an asymmetric adequacy score.",
    "Support below need is penalized more strongly than modest support above need.",
    "Very advanced players may receive lower support needs and tradeoffs for highly assisted response.",
    "This model does not diagnose confidence and does not claim equipment creates confidence."
  ]
} as const;

export function confidenceCompatibilityBandForScore(score: number): ConfidenceCompatibilityBand {
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new Error("Confidence compatibility score must be between 0 and 100.");
  }
  for (const [band, [min, max]] of Object.entries(confidenceCompatibilityBandRanges) as Array<[ConfidenceCompatibilityBand, readonly [number, number]]>) {
    if (score >= min && score <= max) return band;
  }
  throw new Error(`Confidence compatibility score ${score} did not match a band.`);
}

export function validateConfidenceCompatibilityPolicy(): readonly string[] {
  const total = Object.values(confidenceCompatibilityDimensionWeights).reduce((sum, value) => sum + value, 0);
  const errors: string[] = [];
  if (Math.round(total * 1000) !== 1000) errors.push("confidence compatibility weights must sum to 1.0");
  if (confidenceCompatibilityPolicy.confidence.validatedAllowed) errors.push("validated confidence must not be enabled for v1.0");
  if (confidenceCompatibilityPolicy.recommendationUsePolicy !== "shadow_only") errors.push("v1.0 must remain shadow-only");
  return errors;
}
