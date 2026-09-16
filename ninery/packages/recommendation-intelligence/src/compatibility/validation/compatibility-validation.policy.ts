import type {
  CompatibilityModelName,
  CompatibilityPromotionOutcome,
  CompatibilityPromotionPolicy
} from "./compatibility-validation.types.js";
import { COMPATIBILITY_VALIDATION_POLICY_VERSION } from "./compatibility-validation.types.js";

export const compatibilityValidationScoreSeparationThresholds = {
  veryLowMaximum: 2,
  lowMaximum: 5,
  usefulMaximum: 10
} as const;

export const compatibilityValidationOutcomePriority: readonly CompatibilityPromotionOutcome[] = [
  "blocked_invalid_model_output",
  "blocked_unsupported_version",
  "blocked_language_safety",
  "blocked_directional_inconsistency",
  "blocked_unstable_behavior",
  "blocked_missing_player_context",
  "blocked_confidence_miscalibration",
  "blocked_reason_quality",
  "blocked_double_counting_risk",
  "blocked_low_score_separation",
  "blocked_insufficient_validation",
  "explanation_only_candidate",
  "approved_for_extended_shadow",
  "approved_for_internal_candidate"
];

export const compatibilityPromotionPolicies: Record<CompatibilityModelName, CompatibilityPromotionPolicy> = {
  confidence_compatibility: {
    version: COMPATIBILITY_VALIDATION_POLICY_VERSION,
    minimumCompletedSyntheticEvaluations: 18,
    requirePlayerDifferentiation: true,
    requireEquipmentDifferentiation: true,
    minimumAverageScoreSeparation: 3,
    maximumMinorPerturbationScoreDelta: 4,
    maximumMinorPerturbationBandFlips: 1,
    requireMonotonicity: true,
    requireSafeMissingInputHandling: true,
    requireReasonQuality: true,
    requireLanguageSafety: true,
    maximumDoubleCountingRiskForInternalCandidate: "moderate",
    allowExplanationOnlyWhenDoubleCountingHigh: true,
    minimumConfidenceForInternalCandidate: "moderate"
  },
  transition_compatibility: {
    version: COMPATIBILITY_VALIDATION_POLICY_VERSION,
    minimumCompletedSyntheticEvaluations: 18,
    requirePlayerDifferentiation: true,
    requireEquipmentDifferentiation: true,
    minimumAverageScoreSeparation: 5,
    maximumMinorPerturbationScoreDelta: 5,
    maximumMinorPerturbationBandFlips: 1,
    requireMonotonicity: true,
    requireSafeMissingInputHandling: true,
    requireReasonQuality: true,
    requireLanguageSafety: true,
    maximumDoubleCountingRiskForInternalCandidate: "moderate",
    allowExplanationOnlyWhenDoubleCountingHigh: false,
    minimumConfidenceForInternalCandidate: "moderate"
  }
};

export function scoreSeparationLabel(range: number | undefined): "missing" | "very_low" | "low" | "useful" | "strong" {
  if (range === undefined) return "missing";
  if (range <= compatibilityValidationScoreSeparationThresholds.veryLowMaximum) return "very_low";
  if (range <= compatibilityValidationScoreSeparationThresholds.lowMaximum) return "low";
  if (range <= compatibilityValidationScoreSeparationThresholds.usefulMaximum) return "useful";
  return "strong";
}
