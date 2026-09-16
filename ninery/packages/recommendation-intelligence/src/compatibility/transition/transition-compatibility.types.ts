import type { CanonicalEquipmentDNAProfile } from "@ninery/equipment-intelligence";
import type { PlayerDNAProfileResult } from "@ninery/player-intelligence";
import type { CompatibilityDimensionCode } from "../../compatibility.types.js";

export const TRANSITION_COMPATIBILITY_MODEL_VERSION = "1.0";
export const TRANSITION_COMPATIBILITY_POLICY_VERSION = "1.0";
export const TRANSITION_COMPATIBILITY_REASON_VERSION = "1.0";
export const TRANSITION_CHANGE_PROFILE_VERSION = "1.0";

export type TransitionCompatibilityBand =
  | "very_manageable_transition"
  | "manageable_transition"
  | "moderate_adjustment"
  | "demanding_transition"
  | "highly_demanding_transition";

export type TransitionCompatibilityConfidence = "estimated" | "moderate" | "high";

export type TransitionCompatibilityRecommendationUsePolicy =
  | "shadow_only"
  | "future_replacement_candidate"
  | "requires_more_validation"
  | "not_suitable_for_ranking";

export type TransitionCompatibilityDimension =
  | "size_change_demand"
  | "mass_change_demand"
  | "drop_change_demand"
  | "balance_change_demand"
  | "swing_effort_change_demand"
  | "experience_adjustment_demand";

export type TransitionCompatibilityDimensionStatus =
  | "very_manageable"
  | "manageable"
  | "moderate_adjustment"
  | "demanding"
  | "highly_demanding"
  | "missing_input";

export type PlayerTransitionReadinessProfile = {
  readonly version: "1.0";
  readonly playerId: string;
  readonly physicalReadiness?: number;
  readonly batControlReadiness?: number;
  readonly experienceReadiness?: number;
  readonly developmentReadiness?: number;
  readonly equipmentChangeTolerance?: number;
  readonly growthStability?: number;
  readonly swingFeelFlexibility?: number;
  readonly currentEquipmentFamiliarity?: number;
  readonly sourceSummary: {
    readonly availableInputs: readonly string[];
    readonly missingInputs: readonly string[];
    readonly derivedInputs: readonly string[];
  };
  readonly confidence: TransitionCompatibilityConfidence;
};

export type CurrentEquipmentTransitionContext = {
  readonly equipmentId?: string;
  readonly equipmentVariantId?: string;
  readonly length?: number;
  readonly weight?: number;
  readonly drop?: number;
  readonly balanceProfile?: number;
  readonly swingEffort?: number;
  readonly construction?: string;
  readonly material?: string;
  readonly familiarity?: number;
  readonly sourceSummary: {
    readonly availableInputs: readonly string[];
    readonly missingInputs: readonly string[];
  };
};

export type ProposedEquipmentTransitionContext = {
  readonly equipmentId: string;
  readonly equipmentVariantId?: string;
  readonly length?: number;
  readonly weight?: number;
  readonly drop?: number;
  readonly balanceProfile?: number;
  readonly swingEffort?: number;
  readonly construction?: string;
  readonly material?: string;
  readonly sourceSummary: {
    readonly numericReferenceInputs: readonly string[];
    readonly ordinalProjectedInputs: readonly string[];
    readonly specificationInputs: readonly string[];
    readonly missingInputs: readonly string[];
  };
};

export type EquipmentTransitionChangeProfile = {
  readonly version: typeof TRANSITION_CHANGE_PROFILE_VERSION;
  readonly sizeChange?: number;
  readonly massChange?: number;
  readonly dropChange?: number;
  readonly balanceChange?: number;
  readonly swingEffortChange?: number;
  readonly constructionChange?: number;
  readonly rawDifferences: {
    readonly lengthDelta?: number;
    readonly weightDelta?: number;
    readonly dropDelta?: number;
    readonly balanceDelta?: number;
    readonly swingEffortDelta?: number;
    readonly constructionChanged?: boolean;
  };
  readonly missingInputs: readonly string[];
};

export type TransitionCompatibilityDimensionResult = {
  readonly dimension: TransitionCompatibilityDimension;
  readonly currentValue?: number | string;
  readonly proposedValue?: number | string;
  readonly rawDifference?: number;
  readonly baseAdjustmentDemand?: number;
  readonly readinessModifier?: number;
  readonly finalAdjustmentDemand?: number;
  readonly compatibilityScore?: number;
  readonly weight: number;
  readonly weightedContribution?: number;
  readonly status: TransitionCompatibilityDimensionStatus;
  readonly explanation: string;
};

export type TransitionCompatibilityReasonCode =
  | "SIZE_CHANGE_IS_MANAGEABLE"
  | "MASS_CHANGE_IS_MANAGEABLE"
  | "DROP_CHANGE_IS_MANAGEABLE"
  | "BALANCE_CHANGE_IS_MANAGEABLE"
  | "SWING_EFFORT_CHANGE_IS_MANAGEABLE"
  | "PLAYER_READINESS_SUPPORTS_TRANSITION"
  | "CURRENT_EQUIPMENT_IS_SIMILAR"
  | "SIZE_CHANGE_REQUIRES_ADJUSTMENT"
  | "MASS_CHANGE_REQUIRES_ADJUSTMENT"
  | "DROP_CHANGE_REQUIRES_ADJUSTMENT"
  | "BALANCE_CHANGE_REQUIRES_ADJUSTMENT"
  | "SWING_EFFORT_CHANGE_REQUIRES_ADJUSTMENT"
  | "PLAYER_READINESS_LIMITS_TRANSITION"
  | "CURRENT_EQUIPMENT_FAMILIARITY_MISSING"
  | "GROWTH_CONTEXT_MISSING"
  | "SWING_FEEL_PREFERENCE_MISSING"
  | "MODEL_CONFIDENCE_LIMITED";

export type TransitionCompatibilityTradeoffCode =
  | "MORE_POWERFUL_SETUP_REQUIRES_ADJUSTMENT"
  | "HEAVIER_SETUP_MAY_REQUIRE_ACCLIMATION"
  | "LIGHTER_SETUP_MAY_CHANGE_TIMING"
  | "END_LOAD_CHANGE_MAY_ALTER_BARREL_FEEL"
  | "EASIER_SWING_EFFORT_MAY_CHANGE_TIMING"
  | "CONSTRUCTION_CHANGE_MAY_CHANGE_FEEDBACK"
  | "CURRENT_FAMILIARITY_LIMITS_CERTAINTY";

export type TransitionCompatibilityReason = {
  readonly code: TransitionCompatibilityReasonCode;
  readonly message: string;
  readonly dimension?: TransitionCompatibilityDimension;
};

export type TransitionCompatibilityTradeoff = {
  readonly code: TransitionCompatibilityTradeoffCode;
  readonly message: string;
  readonly dimension?: TransitionCompatibilityDimension;
};

export type TransitionCompatibilityMissingInput = {
  readonly sourceArea: "player_dna" | "current_equipment" | "proposed_equipment" | "version";
  readonly key: string;
  readonly required: boolean;
  readonly effect: string;
  readonly recommendedNextAction: string;
};

export type TransitionCompatibilityTrace = {
  readonly currentEquipmentValues: Record<string, number | string | undefined>;
  readonly proposedEquipmentValues: Record<string, number | string | undefined>;
  readonly normalizedDifferences: EquipmentTransitionChangeProfile["rawDifferences"];
  readonly demandThresholds: Record<string, readonly number[]>;
  readonly readinessModifiers: readonly string[];
  readonly componentWeights: Record<TransitionCompatibilityDimension, number>;
  readonly componentCoverage: {
    readonly scoredComponents: number;
    readonly totalComponents: number;
  };
  readonly missingInputs: readonly TransitionCompatibilityMissingInput[];
  readonly confidenceFactors: readonly string[];
  readonly versions: {
    readonly model: typeof TRANSITION_COMPATIBILITY_MODEL_VERSION;
    readonly policy: typeof TRANSITION_COMPATIBILITY_POLICY_VERSION;
    readonly reason: typeof TRANSITION_COMPATIBILITY_REASON_VERSION;
    readonly changeProfile: typeof TRANSITION_CHANGE_PROFILE_VERSION;
    readonly playerDNA: string;
    readonly currentEquipmentDNA: string;
    readonly proposedEquipmentDNA: string;
  };
  readonly reasonThresholds: {
    readonly manageableMinimum: number;
    readonly demandingMaximum: number;
  };
};

export type TransitionCompatibilityResultStatus =
  | "completed"
  | "partial"
  | "blocked_missing_current_equipment"
  | "blocked_missing_player_input"
  | "blocked_missing_proposed_equipment_input"
  | "blocked_unsupported_version"
  | "failed";

export type TransitionCompatibilityResult = {
  readonly version: "1.0";
  readonly modelVersion: typeof TRANSITION_COMPATIBILITY_MODEL_VERSION;
  readonly policyVersion: typeof TRANSITION_COMPATIBILITY_POLICY_VERSION;
  readonly reasonVersion: typeof TRANSITION_COMPATIBILITY_REASON_VERSION;
  readonly changeProfileVersion: typeof TRANSITION_CHANGE_PROFILE_VERSION;
  readonly recommendationUsePolicy: TransitionCompatibilityRecommendationUsePolicy;
  readonly playerId: string;
  readonly currentEquipmentId?: string;
  readonly currentEquipmentVariantId?: string;
  readonly proposedEquipmentId: string;
  readonly proposedEquipmentVariantId?: string;
  readonly score?: number;
  readonly band?: TransitionCompatibilityBand;
  readonly dimensions: readonly TransitionCompatibilityDimensionResult[];
  readonly confidence: TransitionCompatibilityConfidence;
  readonly reasons: readonly TransitionCompatibilityReason[];
  readonly tradeoffs: readonly TransitionCompatibilityTradeoff[];
  readonly missingInformation: readonly TransitionCompatibilityMissingInput[];
  readonly playerReadiness: PlayerTransitionReadinessProfile;
  readonly currentEquipment: CurrentEquipmentTransitionContext;
  readonly proposedEquipment: ProposedEquipmentTransitionContext;
  readonly changeProfile: EquipmentTransitionChangeProfile;
  readonly trace: TransitionCompatibilityTrace;
  readonly status: TransitionCompatibilityResultStatus;
  readonly evaluatedAt: Date;
};

export type TransitionCompatibilityInput = {
  readonly playerDNA: PlayerDNAProfileResult;
  readonly currentEquipmentProfile?: CanonicalEquipmentDNAProfile;
  readonly proposedEquipmentProfile: CanonicalEquipmentDNAProfile;
  readonly evaluatedAt?: Date;
};

export type LegacyTransitionDimensionComparisonStatus =
  | "aligned"
  | "minor_difference"
  | "material_difference"
  | "incomparable"
  | "insufficient_data";

export type LegacyTransitionDimensionComparison = {
  readonly equipmentId: string;
  readonly equipmentVariantId?: string;
  readonly legacyTransitionFriendliness?: number;
  readonly legacyTransitionFit?: number;
  readonly canonicalTransitionCompatibility?: number;
  readonly scoreDeltas: {
    readonly friendliness?: number;
    readonly fit?: number;
  };
  readonly reasonOverlap: number;
  readonly tradeoffOverlap: number;
  readonly status: LegacyTransitionDimensionComparisonStatus;
  readonly explanation: string;
};

export type LegacyTransitionDimensionInput = {
  readonly equipmentId: string;
  readonly equipmentVariantId?: string;
  readonly legacyTransitionFriendliness?: number;
  readonly dimensions: readonly {
    readonly code: CompatibilityDimensionCode;
    readonly rawScore: number;
  }[];
  readonly reasonCodes?: readonly string[];
  readonly tradeoffCodes?: readonly string[];
};
