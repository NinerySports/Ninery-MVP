import type {
  InterpolationPoint,
  InterpolationTrace
} from "./transition-compatibility-v1_1.interpolation.js";
import type {
  TransitionCompatibilityDimension,
  TransitionCompatibilityDimensionResult,
  TransitionCompatibilityInput,
  TransitionCompatibilityResult,
  TransitionCompatibilityTradeoff
} from "../transition-compatibility.types.js";

export const TRANSITION_COMPATIBILITY_MODEL_VERSION_V1_1 = "1.1";
export const TRANSITION_COMPATIBILITY_POLICY_VERSION_V1_1 = "1.1";
export const TRANSITION_COMPATIBILITY_INTERPOLATION_VERSION = "1.0";
export const TRANSITION_COMPATIBILITY_V1_1_VALIDATION_VERSION = "1.0";
export const TRANSITION_COMPATIBILITY_V1_0_V1_1_COMPARISON_VERSION = "1.0";

export type TransitionCompatibilityCandidateVersion =
  | "v1_0"
  | "v1_1_linear_interpolation";

export type TransitionCompatibilityReadinessModifierTrace = {
  readonly dimension: TransitionCompatibilityDimension;
  readonly baselineDemand: number;
  readonly readinessValue: number;
  readonly multiplier: number;
  readonly absoluteAdjustment: number;
  readonly adjustedDemand: number;
  readonly bounded: boolean;
};

export type TransitionCompatibilityV1_1Result = Omit<
  TransitionCompatibilityResult,
  "version" | "modelVersion" | "policyVersion" | "trace"
> & {
  readonly version: "1.1";
  readonly modelVersion: typeof TRANSITION_COMPATIBILITY_MODEL_VERSION_V1_1;
  readonly policyVersion: typeof TRANSITION_COMPATIBILITY_POLICY_VERSION_V1_1;
  readonly interpolationVersion: typeof TRANSITION_COMPATIBILITY_INTERPOLATION_VERSION;
  readonly candidateVersion: "v1_1_linear_interpolation";
  readonly interpolationTrace: readonly InterpolationTrace[];
  readonly readinessModifierTrace: readonly TransitionCompatibilityReadinessModifierTrace[];
  readonly productionUseAllowed: false;
  readonly liveRecommendationUseAllowed: false;
  readonly trace: Omit<TransitionCompatibilityResult["trace"], "versions"> & {
    readonly interpolationVersion: typeof TRANSITION_COMPATIBILITY_INTERPOLATION_VERSION;
    readonly interpolationCurves: Record<string, readonly InterpolationPoint[]>;
    readonly readinessBounds: {
      readonly minimumMultiplier: number;
      readonly maximumMultiplier: number;
      readonly maximumAbsoluteDemandReduction: number;
      readonly maximumAbsoluteDemandIncrease: number;
      readonly minimumDemandRetained: number;
    };
    readonly candidateVersion: "v1_1_linear_interpolation";
    readonly productionUseAllowed: false;
    readonly liveRecommendationUseAllowed: false;
    readonly versions: {
      readonly model: typeof TRANSITION_COMPATIBILITY_MODEL_VERSION_V1_1;
      readonly policy: typeof TRANSITION_COMPATIBILITY_POLICY_VERSION_V1_1;
      readonly reason: TransitionCompatibilityResult["reasonVersion"];
      readonly changeProfile: TransitionCompatibilityResult["changeProfileVersion"];
      readonly playerDNA: string;
      readonly currentEquipmentDNA: string;
      readonly proposedEquipmentDNA: string;
    };
  };
};

export type TransitionCompatibilityVersionsInput = TransitionCompatibilityInput;

export type TransitionCompatibilityVersionsResult = {
  readonly version: "1.0";
  readonly candidateVersion: TransitionCompatibilityCandidateVersion;
  readonly v1_0: TransitionCompatibilityResult;
  readonly v1_1: TransitionCompatibilityV1_1Result;
  readonly productionUseAllowed: false;
  readonly liveRecommendationUseAllowed: false;
};

export type TransitionCompatibilityVersionComparison = {
  readonly version: typeof TRANSITION_COMPATIBILITY_V1_0_V1_1_COMPARISON_VERSION;
  readonly playerId: string;
  readonly equipmentId: string;
  readonly equipmentVariantId?: string;
  readonly v1_0: TransitionCompatibilityResult;
  readonly v1_1: TransitionCompatibilityV1_1Result;
  readonly scoreDelta?: number;
  readonly bandChanged: boolean;
  readonly confidenceChanged: boolean;
  readonly dimensionDeltas: readonly {
    readonly dimension: TransitionCompatibilityDimension;
    readonly v1_0Score?: number;
    readonly v1_1Score?: number;
    readonly delta?: number;
  }[];
  readonly reasonsAdded: readonly string[];
  readonly reasonsRemoved: readonly string[];
  readonly tradeoffsAdded: readonly string[];
  readonly tradeoffsRemoved: readonly string[];
  readonly stabilityImproved: boolean;
  readonly directionalBehaviorPreserved: boolean;
  readonly liveUseAllowed: false;
};

export type TransitionCompatibilityBoundarySweep = {
  readonly dimension: Exclude<TransitionCompatibilityDimension, "experience_adjustment_demand">;
  readonly threshold: number;
  readonly epsilon: number;
  readonly demandBelow: number;
  readonly demandAt: number;
  readonly demandAbove: number;
  readonly discontinuitySize: number;
  readonly monotonic: boolean;
  readonly continuous: boolean;
};

export type TransitionCompatibilityV1_1ValidationResult = {
  readonly version: typeof TRANSITION_COMPATIBILITY_V1_1_VALIDATION_VERSION;
  readonly v1_0OfficialOutcome: "blocked_unstable_behavior";
  readonly v1_1AnalyticalOutcome:
    | "approved_for_extended_shadow"
    | "blocked_unstable_behavior"
    | "blocked_directional_inconsistency"
    | "blocked_missing_player_context"
    | "blocked_reason_quality";
  readonly eligibleForDiagnosticShadow: true;
  readonly eligibleForExtendedShadow: boolean;
  readonly eligibleForInternalCandidate: false;
  readonly liveRankingUseAllowed: false;
  readonly liveExplanationUseAllowed: false;
  readonly liveRecommendationUseAllowed: false;
  readonly matrix: {
    readonly completedEvaluations: number;
    readonly blockedEvaluations: number;
    readonly partialEvaluations: number;
    readonly averagePerPlayerEquipmentRange?: number;
    readonly minimumPerPlayerEquipmentRange?: number;
    readonly maximumPerPlayerEquipmentRange?: number;
    readonly rankingChangeCount: number;
    readonly bandChangeCount: number;
    readonly reasonChangeCount: number;
    readonly confidenceChangeCount: number;
  };
  readonly stability: {
    readonly v1_0MinorFailureCount: number;
    readonly v1_1MinorFailureCount: number;
    readonly v1_0MaximumMinorDelta?: number;
    readonly v1_1MaximumMinorDelta?: number;
    readonly v1_0BandFlipCount: number;
    readonly v1_1BandFlipCount: number;
    readonly v1_0ReasonFlipCount: number;
    readonly v1_1ReasonFlipCount: number;
    readonly monotonicityViolations: number;
    readonly directionalInconsistencies: number;
    readonly originalFailureResolved: boolean;
  };
  readonly sensitivity: {
    readonly meaningfulScenarios: readonly {
      readonly scenarioId: string;
      readonly baselineScore?: number;
      readonly changedScore?: number;
      readonly scoreDelta?: number;
      readonly passed: boolean;
    }[];
    readonly underreactionCount: number;
  };
  readonly sameEquipment: {
    readonly v1_0Score?: number;
    readonly v1_1Score?: number;
    readonly acceptable: boolean;
  };
  readonly missingContext: {
    readonly missingCurrentEquipmentBlocks: boolean;
    readonly missingExperienceReadinessBlocks: boolean;
    readonly optionalFamiliarityLowersConfidence: boolean;
    readonly noHiddenZeroes: boolean;
  };
  readonly boundarySweeps: readonly TransitionCompatibilityBoundarySweep[];
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
  readonly evaluatedAt: Date;
};

export type TransitionCompatibilityComponentInput = {
  readonly dimension: TransitionCompatibilityDimension;
  readonly currentValue?: number;
  readonly proposedValue?: number;
  readonly rawDifference?: number;
  readonly baseAdjustmentDemand?: number;
  readonly readiness?: number;
  readonly explanation: string;
};

export type TransitionCompatibilityV1_1DimensionBuildResult = {
  readonly dimension: TransitionCompatibilityDimensionResult;
  readonly interpolationTrace?: InterpolationTrace;
  readonly readinessTrace?: TransitionCompatibilityReadinessModifierTrace;
};

export type TransitionCompatibilityV1_1Tradeoff = TransitionCompatibilityTradeoff;
