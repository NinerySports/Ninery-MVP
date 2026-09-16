import type { CurrentEquipmentFamiliarityResult } from "@ninery/player-intelligence";
import type { TransitionCompatibilityV1_1Result } from "../v1_1/index.js";

export const TRANSITION_EXTENDED_SHADOW_STUDY_VERSION = "1.0";
export const TRANSITION_OBSERVATION_SCHEMA_VERSION = "1.0";
export const TRANSITION_OUTCOME_COMPARISON_VERSION = "1.0";
export const TRANSITION_EXTENDED_SHADOW_POLICY_VERSION = "1.0";

export type TransitionShadowStudyStatus =
  | "draft"
  | "prediction_captured"
  | "observation_active"
  | "observation_complete"
  | "cancelled"
  | "invalidated";

export type TransitionObservationCheckpoint =
  | "first_use"
  | "early_sessions"
  | "acclimation_period"
  | "custom";

export type TransitionObservationSource =
  | "player"
  | "parent_or_guardian"
  | "coach"
  | "internal_staff"
  | "combined";

export type TransitionAdjustmentDemandLabel =
  | "minimal"
  | "mild"
  | "moderate"
  | "substantial"
  | "very_substantial"
  | "unknown";

export type TransitionObservationSessionContext = {
  readonly context?: "practice" | "lesson" | "game" | "batting_cage" | "other";
  readonly approximateSwingCount?: "under_10" | "10_to_25" | "26_to_50" | "over_50" | "unknown";
  readonly instructionOccurred?: boolean;
  readonly unusualFatigueReported?: boolean;
  readonly equipmentConfigurationChanged?: boolean;
  readonly configurationNotes?: string;
};

export type TransitionAdjustmentObservation = {
  readonly version: typeof TRANSITION_OBSERVATION_SCHEMA_VERSION;
  readonly checkpoint: TransitionObservationCheckpoint;
  readonly observedAt: Date;
  readonly equipmentActuallyUsed: boolean;
  readonly meaningfulUseOccurred: boolean;
  readonly observedAdjustmentDemand?: TransitionAdjustmentDemandLabel;
  readonly swingEffortAdjustment?: Exclude<TransitionAdjustmentDemandLabel, "very_substantial">;
  readonly timingAdjustment?: Exclude<TransitionAdjustmentDemandLabel, "very_substantial">;
  readonly barrelControlAdjustment?: Exclude<TransitionAdjustmentDemandLabel, "very_substantial">;
  readonly balanceFeelAdjustment?: Exclude<TransitionAdjustmentDemandLabel, "very_substantial">;
  readonly continuedUsingProposedEquipment?: "yes" | "no" | "mixed" | "unknown";
  readonly returnedToPriorEquipment?: "yes" | "no" | "temporarily" | "unknown";
  readonly additionalAcclimationNeeded?: "yes" | "no" | "unknown";
  readonly observationConfidence: "low" | "moderate" | "high";
  readonly notes?: string;
  readonly source: TransitionObservationSource;
  readonly directlyWitnessed: boolean;
  readonly sourceReference?: string;
  readonly conflictsWithAnotherSource?: boolean;
  readonly sessionContext?: TransitionObservationSessionContext;
};

export type TransitionPredictionSnapshot = {
  readonly transitionModelVersion: "1.1";
  readonly transitionPolicyVersion: string;
  readonly interpolationVersion: string;
  readonly predictedScore: number;
  readonly predictedBand: string;
  readonly predictedConfidence: string;
  readonly dimensionResults: TransitionCompatibilityV1_1Result["dimensions"];
  readonly reasons: TransitionCompatibilityV1_1Result["reasons"];
  readonly tradeoffs: TransitionCompatibilityV1_1Result["tradeoffs"];
  readonly missingInformation: TransitionCompatibilityV1_1Result["missingInformation"];
  readonly playerReadinessSnapshot: TransitionCompatibilityV1_1Result["playerReadiness"];
  readonly currentEquipmentSnapshot: TransitionCompatibilityV1_1Result["currentEquipment"];
  readonly proposedEquipmentSnapshot: TransitionCompatibilityV1_1Result["proposedEquipment"];
  readonly familiaritySnapshot: CurrentEquipmentFamiliarityResult;
  readonly trace: TransitionCompatibilityV1_1Result["trace"];
  readonly inputHash: string;
  readonly predictionHash: string;
  readonly predictedAt: Date;
};

export type TransitionExtendedShadowStudy = {
  readonly version: typeof TRANSITION_EXTENDED_SHADOW_STUDY_VERSION;
  readonly id: string;
  readonly studyKey: string;
  readonly playerId: string;
  readonly currentEquipmentId: string;
  readonly currentEquipmentVariantId?: string;
  readonly proposedEquipmentId: string;
  readonly proposedEquipmentVariantId?: string;
  readonly status: TransitionShadowStudyStatus;
  readonly familiarity: CurrentEquipmentFamiliarityResult;
  readonly prediction?: TransitionPredictionSnapshot;
  readonly observationWindowStartedAt?: Date;
  readonly observationWindowCompletedAt?: Date;
  readonly observations: readonly TransitionAdjustmentObservation[];
  readonly cancellationReason?: string;
  readonly invalidationReason?: string;
  readonly fixtureKind?: "development_fixture" | "real_observation";
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type TransitionOutcomeFinding = {
  readonly code: string;
  readonly severity: "info" | "warning" | "blocker";
  readonly message: string;
};

export type TransitionOutcomeComparison = {
  readonly version: typeof TRANSITION_OUTCOME_COMPARISON_VERSION;
  readonly studyId: string;
  readonly predictedScore: number;
  readonly predictedBand: string;
  readonly predictedAdjustmentCategory: string;
  readonly observedAdjustmentCategory?: "minimal" | "mild" | "moderate" | "substantial" | "very_substantial" | "insufficient_data";
  readonly comparisonStatus:
    | "broadly_aligned"
    | "partially_aligned"
    | "materially_different"
    | "insufficient_observation"
    | "conflicting_observations"
    | "study_invalidated";
  readonly checkpointComparisons: readonly {
    readonly checkpoint: TransitionObservationCheckpoint;
    readonly observedCategory?: string;
    readonly alignment?: string;
    readonly explanation: string;
  }[];
  readonly observerAgreement: "single_source" | "generally_consistent" | "mixed" | "material_conflict" | "insufficient_data";
  readonly outcomeConfidence: "low" | "moderate" | "high";
  readonly findings: readonly TransitionOutcomeFinding[];
  readonly warnings: readonly TransitionOutcomeFinding[];
  readonly modelChangeRecommended: false;
  readonly livePromotionRecommended: false;
  readonly comparedAt: Date;
};
