import type {
  CanonicalEquipmentDNAProfile,
  EquipmentAttributeConfidence
} from "@ninery/equipment-intelligence";
import type { PlayerDNAProfileResult } from "@ninery/player-intelligence";
import type { CompatibilityDimensionCode } from "../../compatibility.types.js";

export const CONFIDENCE_COMPATIBILITY_MODEL_VERSION = "1.0";
export const CONFIDENCE_COMPATIBILITY_POLICY_VERSION = "1.0";
export const CONFIDENCE_COMPATIBILITY_REASON_VERSION = "1.0";

export type ConfidenceCompatibilityBand =
  | "very_supportive_fit"
  | "supportive_fit"
  | "mixed_fit"
  | "demanding_fit"
  | "highly_demanding_fit";

export type ConfidenceCompatibilityConfidence = "estimated" | "moderate" | "high";

export type ConfidenceCompatibilityRecommendationUsePolicy =
  | "shadow_only"
  | "future_replacement_candidate"
  | "requires_more_validation"
  | "not_suitable_for_ranking";

export type ConfidenceCompatibilityDimension =
  | "predictability_alignment"
  | "forgiveness_alignment"
  | "bat_control_alignment"
  | "manageable_effort_alignment"
  | "contact_support_alignment";

export type ConfidenceCompatibilityDimensionStatus =
  | "support_met"
  | "support_exceeds_need"
  | "support_below_need"
  | "missing_input";

export type ConfidenceCompatibilityReasonCode =
  | "PREDICTABLE_RESPONSE_SUPPORTS_CURRENT_NEEDS"
  | "FORGIVENESS_SUPPORTS_CURRENT_NEEDS"
  | "MANAGEABLE_EFFORT_SUPPORTS_CURRENT_NEEDS"
  | "BAT_CONTROL_SUPPORTS_CURRENT_NEEDS"
  | "SWEET_SPOT_SUPPORTS_CURRENT_NEEDS"
  | "PLAYER_NEEDS_LESS_ASSISTED_FEEL"
  | "EQUIPMENT_SUPPORT_BELOW_CURRENT_NEED"
  | "EQUIPMENT_SUPPORT_EXCEEDS_CURRENT_NEED"
  | "PLAYER_INPUT_INCOMPLETE"
  | "EQUIPMENT_INPUT_INCOMPLETE"
  | "CURRENT_EQUIPMENT_CONTEXT_MISSING"
  | "MODEL_CONFIDENCE_LIMITED";

export type ConfidenceCompatibilityTradeoffCode =
  | "PREDICTABILITY_MAY_REDUCE_DIRECT_FEEDBACK"
  | "HIGH_FORGIVENESS_MAY_MASK_FEEDBACK"
  | "MORE_DEMANDING_SWING_MAY_REQUIRE_ADJUSTMENT"
  | "LOWER_SUPPORT_MAY_CHALLENGE_CURRENT_CONSISTENCY"
  | "ADVANCED_PLAYER_MAY_PREFER_MORE_DIRECT_RESPONSE";

export type ConfidenceCompatibilityMissingInput = {
  readonly sourceArea: "player_dna" | "equipment_dna" | "current_equipment" | "version";
  readonly key: string;
  readonly required: boolean;
  readonly effect: string;
  readonly recommendedNextAction: string;
};

export type ConfidenceCompatibilityReason = {
  readonly code: ConfidenceCompatibilityReasonCode;
  readonly message: string;
  readonly dimension?: ConfidenceCompatibilityDimension;
};

export type ConfidenceCompatibilityTradeoff = {
  readonly code: ConfidenceCompatibilityTradeoffCode;
  readonly message: string;
  readonly dimension?: ConfidenceCompatibilityDimension;
};

export type PlayerConfidenceSupportNeedsProfile = {
  readonly version: "1.0";
  readonly playerId: string;
  readonly batControlNeed?: number;
  readonly contactConsistencyNeed?: number;
  readonly predictabilityNeed?: number;
  readonly forgivenessNeed?: number;
  readonly manageableEffortNeed?: number;
  readonly transitionSupportNeed?: number;
  readonly developmentStructureNeed?: number;
  readonly experienceLevel?: number;
  readonly developmentStage?: string;
  readonly currentEquipmentFamiliarity?: number;
  readonly sourceSummary: {
    readonly availableInputs: readonly string[];
    readonly missingInputs: readonly string[];
    readonly derivedInputs: readonly string[];
  };
  readonly confidence: EquipmentAttributeConfidence;
};

export type EquipmentConfidenceSupportProfile = {
  readonly version: "1.0";
  readonly equipmentId: string;
  readonly equipmentVariantId?: string;
  readonly predictabilitySupport?: number;
  readonly forgivenessSupport?: number;
  readonly sweetSpotSupport?: number;
  readonly manageableEffortSupport?: number;
  readonly batControlSupport?: number;
  readonly balanceHandlingSupport?: number;
  readonly barrelStabilitySupport?: number;
  readonly sourceSummary: {
    readonly numericReferenceInputs: readonly string[];
    readonly ordinalProjectedInputs: readonly string[];
    readonly missingInputs: readonly string[];
  };
  readonly confidence: EquipmentAttributeConfidence;
};

export type ConfidenceCompatibilityDimensionResult = {
  readonly dimension: ConfidenceCompatibilityDimension;
  readonly playerNeed?: number;
  readonly equipmentSupport?: number;
  readonly score?: number;
  readonly weight: number;
  readonly weightedContribution?: number;
  readonly status: ConfidenceCompatibilityDimensionStatus;
  readonly explanation: string;
};

export type ConfidenceCompatibilityTrace = {
  readonly playerInputs: Record<string, number | string | undefined>;
  readonly equipmentInputs: Record<string, number | string | undefined>;
  readonly transformations: readonly string[];
  readonly directionInversions: readonly string[];
  readonly weights: Record<ConfidenceCompatibilityDimension, number>;
  readonly dimensionScores: readonly ConfidenceCompatibilityDimensionResult[];
  readonly completeness: {
    readonly requiredPlayerInputsPresent: number;
    readonly requiredPlayerInputsTotal: number;
    readonly requiredEquipmentInputsPresent: number;
    readonly requiredEquipmentInputsTotal: number;
  };
  readonly confidenceFactors: readonly string[];
  readonly versions: {
    readonly model: typeof CONFIDENCE_COMPATIBILITY_MODEL_VERSION;
    readonly policy: typeof CONFIDENCE_COMPATIBILITY_POLICY_VERSION;
    readonly reasons: typeof CONFIDENCE_COMPATIBILITY_REASON_VERSION;
    readonly playerDNA: string;
    readonly equipmentDNAProfile: string;
    readonly predictabilitySupport: string;
  };
  readonly reasonThresholds: {
    readonly supportiveMinimum: number;
    readonly tradeoffExcessMinimum: number;
    readonly belowNeedMaximum: number;
  };
  readonly missingInputs: readonly ConfidenceCompatibilityMissingInput[];
};

export type ConfidenceCompatibilityResultStatus =
  | "completed"
  | "partial"
  | "blocked_missing_player_input"
  | "blocked_missing_equipment_input"
  | "blocked_unsupported_version"
  | "failed";

export type ConfidenceCompatibilityResult = {
  readonly version: "1.0";
  readonly modelVersion: typeof CONFIDENCE_COMPATIBILITY_MODEL_VERSION;
  readonly policyVersion: typeof CONFIDENCE_COMPATIBILITY_POLICY_VERSION;
  readonly reasonVersion: typeof CONFIDENCE_COMPATIBILITY_REASON_VERSION;
  readonly recommendationUsePolicy: ConfidenceCompatibilityRecommendationUsePolicy;
  readonly playerId: string;
  readonly equipmentId: string;
  readonly equipmentVariantId?: string;
  readonly score?: number;
  readonly band?: ConfidenceCompatibilityBand;
  readonly dimensions: readonly ConfidenceCompatibilityDimensionResult[];
  readonly confidence: ConfidenceCompatibilityConfidence;
  readonly reasons: readonly ConfidenceCompatibilityReason[];
  readonly tradeoffs: readonly ConfidenceCompatibilityTradeoff[];
  readonly missingInformation: readonly ConfidenceCompatibilityMissingInput[];
  readonly playerProfile: PlayerConfidenceSupportNeedsProfile;
  readonly equipmentProfile: EquipmentConfidenceSupportProfile;
  readonly trace: ConfidenceCompatibilityTrace;
  readonly status: ConfidenceCompatibilityResultStatus;
  readonly evaluatedAt: Date;
};

export type ConfidenceCompatibilityInput = {
  readonly playerDNA: PlayerDNAProfileResult;
  readonly canonicalEquipmentProfile: CanonicalEquipmentDNAProfile;
  readonly evaluatedAt?: Date;
};

export type LegacyConfidenceDimensionComparisonStatus =
  | "aligned"
  | "minor_difference"
  | "material_difference"
  | "incomparable"
  | "insufficient_data";

export type LegacyConfidenceDimensionComparison = {
  readonly equipmentId: string;
  readonly equipmentVariantId?: string;
  readonly legacyConfidenceBuildingFit?: number;
  readonly legacyDevelopmentGoalFit?: number;
  readonly canonicalConfidenceCompatibility?: number;
  readonly scoreDeltas: {
    readonly confidenceBuilding?: number;
    readonly developmentGoal?: number;
  };
  readonly reasonOverlap: number;
  readonly tradeoffOverlap: number;
  readonly status: LegacyConfidenceDimensionComparisonStatus;
  readonly explanation: string;
};

export type LegacyConfidenceDimensionInput = {
  readonly equipmentId: string;
  readonly equipmentVariantId?: string;
  readonly dimensions: readonly {
    readonly code: CompatibilityDimensionCode;
    readonly rawScore: number;
  }[];
  readonly reasonCodes?: readonly string[];
  readonly tradeoffCodes?: readonly string[];
};
