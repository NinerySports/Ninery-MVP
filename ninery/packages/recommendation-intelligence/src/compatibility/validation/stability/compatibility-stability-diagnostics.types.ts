import type {
  CompatibilityModelName,
  CompatibilityPromotionOutcome,
  CompatibilityValidationInput,
  CompatibilityValidationSuiteResult
} from "../compatibility-validation.types.js";

export const COMPATIBILITY_STABILITY_DIAGNOSTIC_VERSION = "1.0";
export const COMPATIBILITY_CALIBRATION_ANALYSIS_VERSION = "1.0";
export const CONFIDENCE_COMPATIBILITY_CALIBRATION_SCENARIO_VERSION = "1.0";
export const TRANSITION_COMPATIBILITY_CALIBRATION_SCENARIO_VERSION = "1.0";
export const COMPATIBILITY_THRESHOLD_PROXIMITY_VERSION = "1.0";
export const COMPATIBILITY_TIE_SENSITIVITY_VERSION = "1.0";

export type CompatibilityStabilityConclusion =
  | "stable_without_change"
  | "stable_after_threshold_calibration"
  | "stable_after_weight_calibration"
  | "stable_after_normalization_calibration"
  | "stable_after_context_adjustment_calibration"
  | "requires_formula_revision"
  | "explanation_only_recommended"
  | "insufficient_validation_data";

export type CompatibilityStabilityCauseCode =
  | "MINOR_INPUT_SCORE_OVERREACTION"
  | "MINOR_INPUT_BAND_FLIP"
  | "MINOR_INPUT_RANKING_FLIP"
  | "MINOR_INPUT_REASON_FLIP"
  | "MINOR_INPUT_TRADEOFF_FLIP"
  | "NEAR_TIE_RANKING_SENSITIVITY"
  | "BAND_THRESHOLD_PROXIMITY"
  | "REASON_THRESHOLD_PROXIMITY"
  | "TRADEOFF_THRESHOLD_PROXIMITY"
  | "ASYMMETRIC_ALIGNMENT_SENSITIVITY"
  | "PLAYER_NEED_TRANSFORM_SENSITIVITY"
  | "CONTEXTUAL_ADJUSTMENT_SENSITIVITY"
  | "COMPONENT_WEIGHT_AMPLIFICATION"
  | "RENORMALIZATION_SENSITIVITY"
  | "FIXED_NEUTRAL_VALUE_EFFECT"
  | "READINESS_MODIFIER_AMPLIFICATION"
  | "PIECEWISE_THRESHOLD_DISCONTINUITY"
  | "ROUNDING_ONLY_DIFFERENCE"
  | "MEANINGFUL_INPUT_UNDERREACTION"
  | "MEANINGFUL_INPUT_OVERREACTION"
  | "MONOTONICITY_VIOLATION"
  | "INCOMPLETE_CONTEXT_INSTABILITY"
  | "LOW_EQUIPMENT_SEPARATION"
  | "HIGH_COMPONENT_OVERLAP"
  | "DOUBLE_COUNTING_LIMITATION"
  | "INSUFFICIENT_TRACE_DATA"
  | "NO_MATERIAL_INSTABILITY_FOUND";

export type CompatibilityStabilityCause = {
  readonly code: CompatibilityStabilityCauseCode;
  readonly message: string;
  readonly evidence: readonly string[];
};

export type CompatibilityStabilityFailure = {
  readonly failureId: string;
  readonly reproductionStatus: "reproduced" | "not_reproduced" | "invalidated_by_trace_gap";
  readonly model: CompatibilityModelName;
  readonly syntheticPlayerId: string;
  readonly equipmentId: string;
  readonly equipmentVariantId?: string;
  readonly perturbation: {
    readonly inputField: string;
    readonly originalValue?: number | string;
    readonly perturbedValue?: number | string;
    readonly absoluteChange?: number;
    readonly relativeChange?: number;
    readonly classifiedAs: "minor" | "meaningful";
  };
  readonly baseline: {
    readonly score?: number;
    readonly band?: string;
    readonly rank?: number;
    readonly reasons: readonly string[];
    readonly tradeoffs: readonly string[];
    readonly confidence?: string;
  };
  readonly perturbed: {
    readonly score?: number;
    readonly band?: string;
    readonly rank?: number;
    readonly reasons: readonly string[];
    readonly tradeoffs: readonly string[];
    readonly confidence?: string;
  };
  readonly differences: {
    readonly scoreDelta?: number;
    readonly bandChanged: boolean;
    readonly rankingChanged: boolean;
    readonly reasonCodesAdded: readonly string[];
    readonly reasonCodesRemoved: readonly string[];
    readonly tradeoffCodesAdded: readonly string[];
    readonly tradeoffCodesRemoved: readonly string[];
    readonly confidenceChanged: boolean;
  };
  readonly suspectedCauses: readonly CompatibilityStabilityCauseCode[];
  readonly traceReferences: readonly string[];
};

export type CompatibilityThresholdProximityAnalysis = {
  readonly version: typeof COMPATIBILITY_THRESHOLD_PROXIMITY_VERSION;
  readonly evaluations: readonly {
    readonly failureId: string;
    readonly thresholdType: "band" | "reason" | "tradeoff" | "confidence" | "component_status" | "ranking_tie";
    readonly thresholdName: string;
    readonly thresholdValue?: number;
    readonly baselineValue?: number;
    readonly perturbedValue?: number;
    readonly baselineDistance?: number;
    readonly perturbedDistance?: number;
    readonly thresholdCrossed: boolean;
    readonly crossingExplainsObservedChange: boolean;
  }[];
  readonly thresholdDrivenFailureCount: number;
  readonly formulaDrivenFailureCount: number;
  readonly mixedFailureCount: number;
  readonly explanation: readonly string[];
};

export type CompatibilityTieSensitivityAnalysis = {
  readonly version: typeof COMPATIBILITY_TIE_SENSITIVITY_VERSION;
  readonly scenarios: readonly {
    readonly syntheticPlayerId: string;
    readonly equipmentScores: readonly { readonly equipmentId: string; readonly score: number; readonly rank: number }[];
    readonly firstSecondGap?: number;
    readonly firstLastGap?: number;
    readonly perturbationChangedOrdering: boolean;
    readonly maximumScoreMovement?: number;
    readonly rankingFlipCausedByNearTie: boolean;
  }[];
  readonly nearTieThreshold: number;
  readonly nearTieScenarioCount: number;
  readonly rankingFlipScenarioCount: number;
  readonly rankingFlipsExplainedByNearTies: number;
  readonly recommendation: "retain_exact_ranking" | "use_equivalence_band" | "explanation_only" | "requires_formula_revision";
};

export type ConfidenceCompatibilitySaturationAnalysis = {
  readonly evaluationsNearCeiling: number;
  readonly totalEvaluations: number;
  readonly ceilingThreshold: number;
  readonly perComponent: readonly {
    readonly component: string;
    readonly minimumScore?: number;
    readonly maximumScore?: number;
    readonly averageScore?: number;
    readonly nearCeilingCount: number;
  }[];
  readonly overallCompressionDetected: boolean;
  readonly likelySources: readonly string[];
};

export type TransitionPhysicalOverlapAnalysis = {
  readonly components: readonly {
    readonly componentA: string;
    readonly componentB: string;
    readonly overlapType: "independent" | "partially_overlapping" | "strongly_overlapping";
    readonly explanation: string;
  }[];
  readonly currentCombinedWeight: number;
  readonly overlapRisk: "low" | "moderate" | "high";
  readonly analyticalRecommendations: readonly string[];
};

export type CompatibilityMissingContextClassification =
  | "correctly_blocked_required_context"
  | "could_complete_partial"
  | "confidence_only_missing"
  | "policy_too_strict"
  | "invalid_fixture";

export type CompatibilityCalibrationScenarioResult = {
  readonly model: CompatibilityModelName;
  readonly scenarioName: string;
  readonly scenarioVersion: string;
  readonly description: string;
  readonly completed: boolean;
  readonly failureReason?: string;
  readonly analyticalOnly: true;
  readonly productionSafe: false | "not_assessed";
  readonly completedEvaluations: number;
  readonly blockedEvaluations: number;
  readonly partialEvaluations: number;
  readonly averageEquipmentScoreRange?: number;
  readonly minorPerturbationFailureCount: number;
  readonly bandFlipCount: number;
  readonly rankingFlipCount: number;
  readonly monotonicityViolationCount: number;
  readonly missingInputSafetyPassed: boolean;
  readonly reasonQualityPassed: boolean;
  readonly languageSafetyPassed: boolean;
  readonly doubleCountingRisk: "low" | "moderate" | "high";
  readonly legacyComparisonSummary?: readonly string[];
  readonly improvements: readonly string[];
  readonly regressions: readonly string[];
};

export type CompatibilityCalibrationComparison = {
  readonly version: typeof COMPATIBILITY_CALIBRATION_ANALYSIS_VERSION;
  readonly baselineScenario: string;
  readonly scenarios: readonly {
    readonly scenarioName: string;
    readonly stabilityImproved: boolean;
    readonly sensitivityPreserved: boolean;
    readonly monotonicityPreserved: boolean;
    readonly separationImproved: boolean;
    readonly missingInputSafetyPreserved: boolean;
    readonly reasonQualityPreserved: boolean;
    readonly languageSafetyPreserved: boolean;
    readonly doubleCountingRiskReduced: boolean;
    readonly overallAssessment: "strong_candidate" | "promising" | "mixed" | "regression" | "insufficient_data";
  }[];
  readonly recommendedScenario?: string;
  readonly explanation: readonly string[];
};

export type CompatibilityCalibrationPackage = {
  readonly model: CompatibilityModelName;
  readonly packageVersion: "1.0";
  readonly sourceScenario: string;
  readonly proposedChanges: readonly {
    readonly area:
      | "formula"
      | "weight"
      | "threshold"
      | "band"
      | "normalization"
      | "context_adjustment"
      | "reason_threshold"
      | "tradeoff_threshold"
      | "promotion_policy"
      | "use_mode";
    readonly currentBehavior: string;
    readonly proposedBehavior: string;
    readonly rationale: string;
    readonly evidence: readonly string[];
  }[];
  readonly expectedBenefits: readonly string[];
  readonly knownRisks: readonly string[];
  readonly requiresImplementationTicket: true;
  readonly liveUseApproved: false;
};

export type CompatibilityPromotionReassessment = {
  readonly originalOutcome: CompatibilityPromotionOutcome;
  readonly analyticalProjectedOutcome?: CompatibilityPromotionOutcome;
  readonly projectedOutcomeRequiresImplementation: true;
  readonly promotionStillBlocked: true;
  readonly explanation: readonly string[];
};

export type CompatibilityStabilityDiagnosticResult = {
  readonly version: "1.0";
  readonly diagnosticVersion: typeof COMPATIBILITY_STABILITY_DIAGNOSTIC_VERSION;
  readonly calibrationVersion: typeof COMPATIBILITY_CALIBRATION_ANALYSIS_VERSION;
  readonly model: CompatibilityModelName;
  readonly originalCompatibilityModelVersion: string;
  readonly originalCompatibilityPolicyVersion: string;
  readonly validationPolicyVersion: string;
  readonly syntheticMatrixVersion: string;
  readonly originalValidationOutcome: CompatibilityPromotionOutcome;
  readonly failedScenarios: readonly CompatibilityStabilityFailure[];
  readonly thresholdProximity: CompatibilityThresholdProximityAnalysis;
  readonly tieSensitivity: CompatibilityTieSensitivityAnalysis;
  readonly componentSensitivity: {
    readonly highSensitivityComponentCount: number;
    readonly findings: readonly string[];
  };
  readonly contextualAdjustmentSensitivity: {
    readonly findings: readonly string[];
  };
  readonly normalizationSensitivity: {
    readonly findings: readonly string[];
  };
  readonly confidenceSaturation?: ConfidenceCompatibilitySaturationAnalysis;
  readonly transitionPhysicalOverlap?: TransitionPhysicalOverlapAnalysis;
  readonly missingContextClassifications: readonly {
    readonly scenarioId: string;
    readonly classification: CompatibilityMissingContextClassification;
    readonly missingRequirements: readonly string[];
  }[];
  readonly calibrationScenarios: readonly CompatibilityCalibrationScenarioResult[];
  readonly calibrationComparison: CompatibilityCalibrationComparison;
  readonly promotionReassessment: CompatibilityPromotionReassessment;
  readonly primaryCauses: readonly CompatibilityStabilityCause[];
  readonly secondaryCauses: readonly CompatibilityStabilityCause[];
  readonly unexplainedFailures: readonly CompatibilityStabilityFailure[];
  readonly stabilityConclusion: CompatibilityStabilityConclusion;
  readonly recommendedCalibrationPackage?: CompatibilityCalibrationPackage;
  readonly productionModelChanged: false;
  readonly liveRecommendationUseAllowed: false;
  readonly evaluatedAt: Date;
};

export type CompatibilityStabilityDiagnosticSuite = {
  readonly version: "1.0";
  readonly results: readonly CompatibilityStabilityDiagnosticResult[];
  readonly validationSuite: CompatibilityValidationSuiteResult;
  readonly productionModelChanged: false;
  readonly liveRecommendationUseAllowed: false;
  readonly evaluatedAt: Date;
};

export type CompatibilityStabilityDiagnosticInput = CompatibilityValidationInput;
