import type { EquipmentDNAAttribute } from "@ninery/equipment-intelligence";
import type { CompatibilityDimensionCode, CompatibilityRunResult } from "../compatibility.types.js";
import type { CanonicalCandidateThreePathResult } from "../candidate-selection/index.js";

export const CANONICAL_RESIDUAL_VARIANCE_ANALYSIS_VERSION = "1.0";

export const CANONICAL_RESIDUAL_SCENARIOS = [
  "legacy_full",
  "numeric_reference_current",
  "legacy_supported_only",
  "numeric_reference_supported_only",
  "numeric_reference_with_balance_carryover",
  "numeric_reference_with_confidence_building_carryover",
  "numeric_reference_with_transition_carryover",
  "numeric_reference_with_all_optional_carryover",
  "numeric_reference_without_completeness_penalty",
  "numeric_reference_legacy_confidence_reference"
] as const;

export type CanonicalResidualScenarioId = (typeof CANONICAL_RESIDUAL_SCENARIOS)[number];

export type CanonicalResidualCauseCode =
  | "MISSING_BALANCE_SIGNAL"
  | "MISSING_CONFIDENCE_BUILDING_SIGNAL"
  | "MISSING_TRANSITION_SIGNAL"
  | "INPUT_COMPLETENESS_CHANGED"
  | "EVIDENCE_CONFIDENCE_CHANGED"
  | "NEUTRAL_MISSING_DIMENSION_SCORE"
  | "REASON_THRESHOLD_CROSSING"
  | "TRADEOFF_THRESHOLD_CROSSING"
  | "EXPECTED_CANONICAL_PROVENANCE_TRACE"
  | "OPTIONAL_SIGNAL_CARRYOVER_REDUCES_RESIDUAL"
  | "SUPPORTED_NUMERIC_REFERENCE_PATH_RESTORES_RANKING";

export type OptionalLegacySignalKey = "balance" | "confidenceBuilding" | "transitionFriendliness";

export type OptionalLegacySignalInventoryItem = {
  readonly signal: OptionalLegacySignalKey;
  readonly canonicalKey: "balance_profile" | "confidence_building_potential" | "transition_difficulty";
  readonly legacyField: EquipmentDNAAttribute;
  readonly presentInLegacyCount: number;
  readonly presentInNumericReferenceCount: number;
  readonly affectedDimensions: readonly CompatibilityDimensionCode[];
  readonly affectsDevelopmentGoalFit: boolean;
  readonly affectsConfidence: boolean;
  readonly affectsReasonSelection: boolean;
  readonly affectsTradeoffSelection: boolean;
  readonly affectsTieBreakReference: boolean;
  readonly recommendationRole: "intrinsic_optional" | "relational_experimental";
  readonly causeCode: CanonicalResidualCauseCode;
};

export type CanonicalResidualScenarioSummary = {
  readonly id: CanonicalResidualScenarioId;
  readonly result: CompatibilityRunResult;
  readonly ranking: readonly string[];
  readonly winnerEquipmentId?: string;
  readonly winnerLabel?: string;
  readonly winnerMatchesLegacy: boolean;
  readonly rankingDistanceFromLegacy: number;
  readonly averageOverallScoreDeltaFromLegacy: number;
  readonly maximumOverallScoreDeltaFromLegacy: number;
  readonly averageDimensionDeltaFromLegacy: number;
  readonly averageConfidenceDeltaFromLegacy: number;
  readonly reasonAlignmentRatio: number;
  readonly tradeoffAlignmentRatio: number;
  readonly iconAtlasGap?: number;
};

export type OptionalSignalAttribution = {
  readonly signal: OptionalLegacySignalKey | "all_optional";
  readonly scenarioId: CanonicalResidualScenarioId;
  readonly overallScoreDeltaByEquipment: readonly EquipmentResidualDelta[];
  readonly confidenceDeltaByEquipment: readonly EquipmentResidualDelta[];
  readonly dimensionDeltaByEquipment: readonly DimensionResidualDelta[];
  readonly iconAtlasGapDelta?: number;
  readonly rankingChangedFromNumericReferenceCurrent: boolean;
  readonly reasonAlignmentDelta: number;
  readonly tradeoffAlignmentDelta: number;
  readonly causeCodes: readonly CanonicalResidualCauseCode[];
};

export type EquipmentResidualDelta = {
  readonly equipmentId: string;
  readonly equipmentVariantId?: string;
  readonly label: string;
  readonly before?: number;
  readonly after?: number;
  readonly delta?: number;
};

export type DimensionResidualDelta = EquipmentResidualDelta & {
  readonly dimension: CompatibilityDimensionCode;
};

export type CompletenessResidualAnalysis = {
  readonly profileCompletenessDeltaByEquipment: readonly EquipmentResidualDelta[];
  readonly evidenceConfidenceDeltaByEquipment: readonly EquipmentResidualDelta[];
  readonly missingCharacteristicsDeltaByEquipment: readonly EquipmentResidualDelta[];
  readonly completenessPenaltyAffectsMatchScore: boolean;
  readonly completenessPenaltyAffectsConfidence: boolean;
  readonly evidenceConfidenceAffectsMatchScore: boolean;
  readonly evidenceConfidenceAffectsConfidence: boolean;
};

export type NormalizationResidualAnalysis = {
  readonly missingOptionalSignalsAreTreatedAsZero: false;
  readonly missingOptionalDimensionRawScore: 50;
  readonly weightsRenormalizedWhenSignalsMissing: false;
  readonly affectedDimensions: readonly CompatibilityDimensionCode[];
  readonly explanation: string;
};

export type ThresholdResidualAnalysis = {
  readonly reasonThresholdCrossings: readonly string[];
  readonly tradeoffThresholdCrossings: readonly string[];
  readonly alternativeSetChanges: readonly string[];
};

export type TraceResidualAnalysis = {
  readonly expectedDifferences: readonly string[];
  readonly unexpectedDifferences: readonly string[];
  readonly provenanceOnly: boolean;
};

export type ScoreResidualDecomposition = {
  readonly equipmentId: string;
  readonly equipmentVariantId?: string;
  readonly label: string;
  readonly totalResidual: number;
  readonly allOptionalSignalContribution: number;
  readonly completenessContribution: number;
  readonly evidenceConfidenceContribution: number;
  readonly unexplainedResidual: number;
};

export type PairwiseResidualAnalysis = {
  readonly sourceLabel: string;
  readonly targetLabel: string;
  readonly legacyGap?: number;
  readonly numericReferenceGap?: number;
  readonly gapResidual?: number;
  readonly optionalCarryoverGapDeltas: readonly { readonly signal: OptionalLegacySignalKey | "all_optional"; readonly delta?: number }[];
  readonly rankingOrderRestored: boolean;
};

export type CanonicalResidualActivationReadiness =
  | "not_ready_missing_optional_signals"
  | "ready_for_shadow_only_observation"
  | "ready_after_optional_signal_policy"
  | "insufficient_data";

export type CanonicalResidualVarianceAnalysis = {
  readonly version: typeof CANONICAL_RESIDUAL_VARIANCE_ANALYSIS_VERSION;
  readonly liveRecommendationSource: "legacy";
  readonly candidateAffectsLiveResult: false;
  readonly threePathConclusion: CanonicalCandidateThreePathResult["precisionRestoration"]["conclusion"];
  readonly missingSignalInventory: readonly OptionalLegacySignalInventoryItem[];
  readonly scenarios: readonly CanonicalResidualScenarioSummary[];
  readonly optionalSignalAttribution: readonly OptionalSignalAttribution[];
  readonly completeness: CompletenessResidualAnalysis;
  readonly normalization: NormalizationResidualAnalysis;
  readonly thresholds: ThresholdResidualAnalysis;
  readonly trace: TraceResidualAnalysis;
  readonly decomposition: readonly ScoreResidualDecomposition[];
  readonly iconAtlasPairwise: PairwiseResidualAnalysis;
  readonly primaryCauseCodes: readonly CanonicalResidualCauseCode[];
  readonly architectureRecommendations: readonly string[];
  readonly activationReadiness: CanonicalResidualActivationReadiness;
  readonly evaluatedAt: Date;
};
