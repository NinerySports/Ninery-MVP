import type { CanonicalEquipmentDNAProfile } from "@ninery/equipment-intelligence";
import type { PlayerDNAProfileResult } from "@ninery/player-intelligence";
import type {
  ConfidenceCompatibilityResult,
  LegacyConfidenceDimensionComparison,
  LegacyConfidenceDimensionInput
} from "../confidence/index.js";
import type {
  LegacyTransitionDimensionComparison,
  LegacyTransitionDimensionInput,
  TransitionCompatibilityResult
} from "../transition/index.js";

export const COMPATIBILITY_VALIDATION_MODEL_VERSION = "1.0";
export const COMPATIBILITY_VALIDATION_POLICY_VERSION = "1.0";
export const COMPATIBILITY_SYNTHETIC_PLAYER_MATRIX_VERSION = "1.0";
export const COMPATIBILITY_PROMOTION_DECISION_VERSION = "1.0";
export const COMPATIBILITY_DOUBLE_COUNTING_ANALYSIS_VERSION = "1.0";

export type CompatibilityModelName = "confidence_compatibility" | "transition_compatibility";

export type CompatibilityPromotionOutcome =
  | "approved_for_extended_shadow"
  | "approved_for_internal_candidate"
  | "explanation_only_candidate"
  | "blocked_insufficient_validation"
  | "blocked_low_score_separation"
  | "blocked_missing_player_context"
  | "blocked_unstable_behavior"
  | "blocked_directional_inconsistency"
  | "blocked_confidence_miscalibration"
  | "blocked_reason_quality"
  | "blocked_language_safety"
  | "blocked_double_counting_risk"
  | "blocked_unsupported_version"
  | "blocked_invalid_model_output";

export type CompatibilityValidationFindingCode =
  | "MODEL_OUTPUT_VALID"
  | "MODEL_OUTPUT_INVALID"
  | "PLAYER_DIFFERENTIATION_SUFFICIENT"
  | "PLAYER_DIFFERENTIATION_INSUFFICIENT"
  | "EQUIPMENT_DIFFERENTIATION_SUFFICIENT"
  | "EQUIPMENT_DIFFERENTIATION_INSUFFICIENT"
  | "SCORE_SEPARATION_SUFFICIENT"
  | "SCORE_SEPARATION_LOW"
  | "MONOTONICITY_CONFIRMED"
  | "MONOTONICITY_VIOLATION"
  | "DIRECTIONAL_BEHAVIOR_CONFIRMED"
  | "DIRECTIONAL_BEHAVIOR_INCONSISTENT"
  | "MINOR_INPUT_STABILITY_CONFIRMED"
  | "MINOR_INPUT_OVERREACTION"
  | "MEANINGFUL_INPUT_SENSITIVITY_CONFIRMED"
  | "MEANINGFUL_INPUT_UNDERREACTION"
  | "MISSING_INPUT_CONFIDENCE_REDUCTION_CONFIRMED"
  | "MISSING_INPUT_HANDLING_INVALID"
  | "CONFIDENCE_CALIBRATION_REASONABLE"
  | "CONFIDENCE_CALIBRATION_OVERSTATED"
  | "CONFIDENCE_CALIBRATION_UNDERSTATED"
  | "LEGACY_ALIGNMENT_OBSERVED"
  | "LEGACY_DIVERGENCE_EXPLAINED"
  | "LEGACY_DIVERGENCE_UNEXPLAINED"
  | "REASON_QUALITY_SUFFICIENT"
  | "REASON_QUALITY_INSUFFICIENT"
  | "TRADEOFF_QUALITY_SUFFICIENT"
  | "TRADEOFF_QUALITY_INSUFFICIENT"
  | "LANGUAGE_SAFETY_CONFIRMED"
  | "LANGUAGE_SAFETY_VIOLATION"
  | "DOUBLE_COUNTING_RISK_LOW"
  | "DOUBLE_COUNTING_RISK_MODERATE"
  | "DOUBLE_COUNTING_RISK_HIGH"
  | "SYNTHETIC_MATRIX_COMPLETED"
  | "SYNTHETIC_MATRIX_INCOMPLETE"
  | "MORE_REAL_WORLD_VALIDATION_REQUIRED"
  | "MODEL_APPROVED_FOR_EXTENDED_SHADOW"
  | "MODEL_APPROVED_FOR_INTERNAL_CANDIDATE"
  | "MODEL_APPROVED_FOR_EXPLANATION_ONLY"
  | "MODEL_PROMOTION_BLOCKED";

export type CompatibilityValidationFindingSeverity = "pass" | "warning" | "blocker";

export type CompatibilityValidationFinding = {
  readonly code: CompatibilityValidationFindingCode;
  readonly severity: CompatibilityValidationFindingSeverity;
  readonly message: string;
  readonly model?: CompatibilityModelName;
  readonly scenarioId?: string;
  readonly metadata?: Record<string, string | number | boolean | undefined>;
};

export type CompatibilityPromotionCriterionResult = {
  readonly criterion: string;
  readonly passed: boolean;
  readonly findingCode: CompatibilityValidationFindingCode;
  readonly explanation: string;
};

export type CompatibilityPromotionDecision = {
  readonly version: "1.0";
  readonly model: CompatibilityModelName;
  readonly outcome: CompatibilityPromotionOutcome;
  readonly eligibleForDiagnosticShadow: boolean;
  readonly eligibleForExtendedShadow: boolean;
  readonly eligibleForInternalCandidate: boolean;
  readonly eligibleForExplanationOnly: boolean;
  readonly liveRankingUseAllowed: false;
  readonly liveExplanationUseAllowed: false;
  readonly blockers: readonly CompatibilityValidationFinding[];
  readonly warnings: readonly CompatibilityValidationFinding[];
  readonly passedCriteria: readonly CompatibilityPromotionCriterionResult[];
  readonly failedCriteria: readonly CompatibilityPromotionCriterionResult[];
  readonly nextActions: readonly string[];
  readonly evaluatedAt: Date;
};

export type CompatibilityPromotionPolicy = {
  readonly version: string;
  readonly minimumCompletedSyntheticEvaluations: number;
  readonly requirePlayerDifferentiation: boolean;
  readonly requireEquipmentDifferentiation: boolean;
  readonly minimumAverageScoreSeparation: number;
  readonly maximumMinorPerturbationScoreDelta: number;
  readonly maximumMinorPerturbationBandFlips: number;
  readonly requireMonotonicity: boolean;
  readonly requireSafeMissingInputHandling: boolean;
  readonly requireReasonQuality: boolean;
  readonly requireLanguageSafety: boolean;
  readonly maximumDoubleCountingRiskForInternalCandidate: "low" | "moderate";
  readonly allowExplanationOnlyWhenDoubleCountingHigh: boolean;
  readonly minimumConfidenceForInternalCandidate: "moderate" | "high";
};

export type CompatibilitySyntheticPlayerProfile = {
  readonly profileId: string;
  readonly label: string;
  readonly purpose: string;
  readonly playerDNA: PlayerDNAProfileResult;
  readonly expectedDirectionalBehavior: readonly string[];
  readonly knownMissingInformation: readonly string[];
};

export type CompatibilityEquipmentIdentity = {
  readonly equipmentId: string;
  readonly equipmentVariantId?: string;
  readonly equipmentName: string;
  readonly variantLabel?: string;
};

export type CompatibilitySyntheticMatrixEvaluation = {
  readonly profileId: string;
  readonly equipmentId: string;
  readonly equipmentVariantId?: string;
  readonly confidenceCompatibility?: ConfidenceCompatibilityResult;
  readonly transitionCompatibility?: TransitionCompatibilityResult;
  readonly confidenceLegacyComparison?: LegacyConfidenceDimensionComparison;
  readonly transitionLegacyComparison?: LegacyTransitionDimensionComparison;
  readonly error?: string;
};

export type CompatibilitySyntheticMatrixResult = {
  readonly version: string;
  readonly playerProfiles: readonly {
    readonly profileId: string;
    readonly label: string;
    readonly purpose: string;
  }[];
  readonly equipment: readonly CompatibilityEquipmentIdentity[];
  readonly evaluations: readonly CompatibilitySyntheticMatrixEvaluation[];
  readonly completedEvaluationCount: number;
  readonly blockedEvaluationCount: number;
  readonly partialEvaluationCount: number;
  readonly deterministic: boolean;
};

export type CompatibilityScoreSeparationAnalysis = {
  readonly overallMinimumScore?: number;
  readonly overallMaximumScore?: number;
  readonly overallRange?: number;
  readonly perPlayer: readonly {
    readonly profileId: string;
    readonly minimumScore?: number;
    readonly maximumScore?: number;
    readonly range?: number;
    readonly standardSpread?: number;
    readonly lowSeparation: boolean;
  }[];
  readonly averagePerPlayerRange?: number;
  readonly minimumPerPlayerRange?: number;
  readonly maximumPerPlayerRange?: number;
  readonly sufficient: boolean;
  readonly explanation: readonly string[];
};

export type CompatibilityPlayerDifferentiationAnalysis = {
  readonly perEquipment: readonly {
    readonly equipmentId: string;
    readonly scoresByPlayer: readonly {
      readonly profileId: string;
      readonly score?: number;
      readonly confidence?: string;
    }[];
    readonly scoreRange?: number;
    readonly orderingChangesAcrossPlayers: boolean;
    readonly reasonChangesAcrossPlayers: boolean;
    readonly tradeoffChangesAcrossPlayers: boolean;
  }[];
  readonly rankingOrderVariesAcrossPlayers: boolean;
  readonly reasonSetsVaryAcrossPlayers: boolean;
  readonly sufficient: boolean;
  readonly explanation: readonly string[];
};

export type CompatibilityEquipmentDifferentiationAnalysis = {
  readonly perPlayer: readonly {
    readonly profileId: string;
    readonly scoreRange?: number;
    readonly bandCount: number;
    readonly reasonSetsDiffer: boolean;
    readonly tradeoffSetsDiffer: boolean;
    readonly ordering: readonly string[];
    readonly sufficient: boolean;
  }[];
  readonly sufficient: boolean;
  readonly explanation: readonly string[];
};

export type CompatibilityStabilityAnalysis = {
  readonly perturbations: readonly {
    readonly model: CompatibilityModelName;
    readonly scenarioId: string;
    readonly inputField: string;
    readonly originalValue: number;
    readonly perturbedValue: number;
    readonly originalScore?: number;
    readonly perturbedScore?: number;
    readonly scoreDelta?: number;
    readonly bandChanged: boolean;
    readonly rankingChanged: boolean;
    readonly reasonSetChanged: boolean;
  }[];
  readonly maximumMinorPerturbationDelta?: number;
  readonly excessiveBandFlips: number;
  readonly excessiveRankingFlips: number;
  readonly stable: boolean;
  readonly explanation: readonly string[];
};

export type CompatibilitySensitivityAnalysis = {
  readonly scenarios: readonly {
    readonly scenarioId: string;
    readonly changedInput: string;
    readonly originalScore?: number;
    readonly changedScore?: number;
    readonly scoreDelta?: number;
    readonly expectedDirection: "increase" | "decrease" | "not_increase" | "not_decrease";
    readonly passed: boolean;
  }[];
  readonly sensitive: boolean;
  readonly explanation: readonly string[];
};

export type CompatibilityMonotonicityAnalysis = {
  readonly checks: readonly {
    readonly scenarioId: string;
    readonly expectation: string;
    readonly baselineScore?: number;
    readonly changedScore?: number;
    readonly passed: boolean;
  }[];
  readonly passed: boolean;
  readonly explanation: readonly string[];
};

export type CompatibilityMissingInputAnalysis = {
  readonly scenarios: readonly {
    readonly scenarioId: string;
    readonly missingInput: string;
    readonly status: string;
    readonly confidence: string;
    readonly score?: number;
    readonly missingReported: boolean;
    readonly zeroSubstitutionDetected: boolean;
    readonly passed: boolean;
  }[];
  readonly safe: boolean;
  readonly explanation: readonly string[];
};

export type CompatibilityConfidenceCalibrationAnalysis = {
  readonly completeResultCount: number;
  readonly highConfidenceCount: number;
  readonly moderateConfidenceCount: number;
  readonly estimatedConfidenceCount: number;
  readonly validatedConfidenceCount: number;
  readonly incompleteResultsReduceConfidence: boolean;
  readonly reasonable: boolean;
  readonly explanation: readonly string[];
};

export type CompatibilityLegacyValidationAnalysis = {
  readonly comparisons: readonly (LegacyConfidenceDimensionComparison | LegacyTransitionDimensionComparison)[];
  readonly materialDivergenceCount: number;
  readonly unexplainedMaterialDivergenceCount: number;
  readonly semanticDifferenceExplained: boolean;
  readonly sufficient: boolean;
  readonly explanation: readonly string[];
};

export type CompatibilityExplanationQualityAnalysis = {
  readonly evaluatedResultCount: number;
  readonly genericReasonCount: number;
  readonly contradictoryFindingCount: number;
  readonly duplicateFindingCount: number;
  readonly unsupportedClaimCount: number;
  readonly inputGroundingRatio: number;
  readonly missingInformationActionabilityRatio: number;
  readonly sufficient: boolean;
  readonly findings: readonly string[];
};

export type CompatibilityLanguageSafetyAnalysis = {
  readonly scannedTextCount: number;
  readonly prohibitedPhraseMatches: readonly string[];
  readonly unsafeImplicationFindings: readonly string[];
  readonly safe: boolean;
};

export type CompatibilityDoubleCountingAnalysis = {
  readonly version: typeof COMPATIBILITY_DOUBLE_COUNTING_ANALYSIS_VERSION;
  readonly model: CompatibilityModelName;
  readonly overlappingInputs: readonly {
    readonly compatibilityComponent: string;
    readonly existingRecommendationDimension: string;
    readonly overlapType: "same_input" | "derived_input" | "related_signal" | "presentation_only";
    readonly risk: "low" | "moderate" | "high";
    readonly explanation: string;
  }[];
  readonly highestRisk: "low" | "moderate" | "high";
  readonly safeForExplanationOnly: boolean;
  readonly safeForIndependentRankingWeight: boolean;
  readonly requiresReplacementRatherThanAddition: boolean;
  readonly recommendations: readonly string[];
};

export type CompatibilityModelValidationResult = {
  readonly version: "1.0";
  readonly validationVersion: string;
  readonly validationPolicyVersion: string;
  readonly syntheticMatrixVersion: string;
  readonly promotionDecisionVersion: string;
  readonly model: CompatibilityModelName;
  readonly modelVersion: string;
  readonly policyVersion: string;
  readonly playerDNAVersion: string;
  readonly equipmentDNAVersion: string;
  readonly syntheticMatrix: CompatibilitySyntheticMatrixResult;
  readonly scoreSeparation: CompatibilityScoreSeparationAnalysis;
  readonly playerDifferentiation: CompatibilityPlayerDifferentiationAnalysis;
  readonly equipmentDifferentiation: CompatibilityEquipmentDifferentiationAnalysis;
  readonly stability: CompatibilityStabilityAnalysis;
  readonly sensitivity: CompatibilitySensitivityAnalysis;
  readonly monotonicity: CompatibilityMonotonicityAnalysis;
  readonly missingInputBehavior: CompatibilityMissingInputAnalysis;
  readonly confidenceCalibration: CompatibilityConfidenceCalibrationAnalysis;
  readonly legacyComparison: CompatibilityLegacyValidationAnalysis;
  readonly explanationQuality: CompatibilityExplanationQualityAnalysis;
  readonly languageSafety: CompatibilityLanguageSafetyAnalysis;
  readonly doubleCounting: CompatibilityDoubleCountingAnalysis;
  readonly promotionDecision: CompatibilityPromotionDecision;
  readonly findings: readonly CompatibilityValidationFinding[];
  readonly warnings: readonly CompatibilityValidationFinding[];
  readonly nextActions: readonly string[];
  readonly liveRecommendationUseAllowed: false;
  readonly evaluatedAt: Date;
};

export type CompatibilityValidationInput = {
  readonly basePlayerDNA: PlayerDNAProfileResult;
  readonly canonicalProfiles: readonly CanonicalEquipmentDNAProfile[];
  readonly currentEquipmentProfile: CanonicalEquipmentDNAProfile;
  readonly confidenceLegacyInputs?: readonly LegacyConfidenceDimensionInput[];
  readonly transitionLegacyInputs?: readonly LegacyTransitionDimensionInput[];
  readonly evaluatedAt?: Date;
};

export type CompatibilityValidationSuiteResult = {
  readonly version: "1.0";
  readonly validationVersion: string;
  readonly syntheticMatrixVersion: string;
  readonly results: readonly CompatibilityModelValidationResult[];
  readonly liveRecommendationUseAllowed: false;
  readonly evaluatedAt: Date;
};
