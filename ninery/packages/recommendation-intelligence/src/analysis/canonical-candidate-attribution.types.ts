import type {
  EquipmentAttributeConfidence,
  EquipmentDNAAttributeKey,
  EquipmentDNAAttributeNormalizedValue
} from "@ninery/equipment-intelligence";
import type { CompatibilityDimensionCode } from "../compatibility.types.js";
import type {
  CanonicalCandidateMappedAttribute,
  CanonicalCandidateVarianceClassification
} from "../candidate/index.js";

export const CANONICAL_CANDIDATE_ATTRIBUTION_VERSION = "1.0";
export const CANONICAL_CANDIDATE_CALIBRATION_VERSION = "1.0";

export type EquipmentIdentity = {
  readonly equipmentId: string;
  readonly equipmentVariantId?: string;
  readonly label: string;
};

export type CanonicalCandidateAttributionCauseCode =
  | "ORDINAL_MIDPOINT_COMPRESSION"
  | "ORDINAL_BOUNDARY_EFFECT"
  | "MISSING_CANONICAL_ATTRIBUTE"
  | "UNSUPPORTED_MAPPING"
  | "ATTRIBUTE_DIRECTIONALITY"
  | "ATTRIBUTE_VALUE_CHANGED"
  | "DIMENSION_WEIGHT_AMPLIFICATION"
  | "OVERALL_WEIGHT_AMPLIFICATION"
  | "CONFIDENCE_CHANGED"
  | "REASON_SET_CHANGED"
  | "TRADEOFF_SET_CHANGED"
  | "ALTERNATIVE_ORDER_CHANGED"
  | "TIE_BREAKER_CHANGED"
  | "ELIGIBILITY_UNCHANGED"
  | "CONFIGURATION_MATCHED"
  | "PLAYER_INPUT_MATCHED"
  | "ENGINE_VERSION_MATCHED"
  | "INSUFFICIENT_TRACE_DATA"
  | "NO_MATERIAL_CAUSE_IDENTIFIED";

export type CandidateInputFieldVariance = {
  readonly equipmentId: string;
  readonly equipmentVariantId?: string;
  readonly recommendationField: string;
  readonly canonicalAttributeKey?: EquipmentDNAAttributeKey;
  readonly legacyValue?: number | string | boolean;
  readonly candidateValue?: number | string | boolean;
  readonly numericDelta?: number;
  readonly absoluteDelta?: number;
  readonly direction: "increased" | "decreased" | "unchanged" | "missing_legacy" | "missing_candidate" | "incomparable";
  readonly sourceCanonicalValue?: EquipmentDNAAttributeNormalizedValue;
  readonly mappingStrategy?: string;
  readonly mappingVersion?: string;
  readonly confidence?: EquipmentAttributeConfidence;
};

export type CandidateInputVarianceSummary = {
  readonly fields: readonly CandidateInputFieldVariance[];
  readonly changedCount: number;
  readonly missingCandidateCount: number;
  readonly unsupportedFieldCount: number;
};

export type CandidateAttributeContribution = {
  readonly equipmentId: string;
  readonly canonicalKey: EquipmentDNAAttributeKey;
  readonly recommendationField: string;
  readonly legacyValue?: number;
  readonly candidateValue?: number;
  readonly isolatedOverallScoreDelta: number;
  readonly isolatedDimensionDeltas: Readonly<Record<string, number | undefined>>;
  readonly isolatedConfidenceDelta?: number;
  readonly contributionDirection: "favored_candidate" | "favored_legacy" | "neutral" | "not_measurable";
  readonly interactionWarning?: string;
};

export type CandidateWeightedScoreContribution = {
  readonly equipmentId: string;
  readonly dimension: CompatibilityDimensionCode;
  readonly legacyRawScore?: number;
  readonly candidateRawScore?: number;
  readonly rawDelta?: number;
  readonly weight?: number;
  readonly legacyWeightedContribution?: number;
  readonly candidateWeightedContribution?: number;
  readonly weightedDelta?: number;
};

export type CandidateDimensionVarianceSummary = {
  readonly contributions: readonly CandidateWeightedScoreContribution[];
  readonly largestWeightedDeltas: readonly CandidateWeightedScoreContribution[];
};

export type CandidateScoreVarianceSummary = {
  readonly overall: readonly { equipmentId: string; legacyScore?: number; candidateScore?: number; delta?: number }[];
  readonly largestLosses: readonly { equipmentId: string; delta: number }[];
  readonly largestGains: readonly { equipmentId: string; delta: number }[];
};

export type CandidateConfidenceVarianceSummary = {
  readonly items: readonly { equipmentId: string; legacyConfidence?: number; candidateConfidence?: number; delta?: number }[];
  readonly influencedRanking: boolean;
};

export type CandidateExplanationVarianceSummary = {
  readonly reasonAddedCount: number;
  readonly reasonRemovedCount: number;
  readonly tradeoffAddedCount: number;
  readonly tradeoffRemovedCount: number;
  readonly alternativeChanged: boolean;
};

export type CandidateTieBreakerAttribution = {
  readonly influencedFinalRanking: boolean;
  readonly legacyTieBreakers: readonly string[];
  readonly candidateTieBreakers: readonly string[];
  readonly changed: boolean;
};

export type PairwiseWinnerAttribution = {
  readonly legacyWinner: EquipmentIdentity;
  readonly candidateWinner: EquipmentIdentity;
  readonly legacyScoreGap: number;
  readonly candidateScoreGap: number;
  readonly gapSwing: number;
  readonly attributeGapContributions: readonly {
    readonly canonicalKey: EquipmentDNAAttributeKey;
    readonly contributionToGapSwing: number;
    readonly favoredEquipmentId?: string;
  }[];
  readonly dimensionGapContributions: readonly {
    readonly dimension: CompatibilityDimensionCode;
    readonly contributionToGapSwing: number;
    readonly favoredEquipmentId?: string;
  }[];
  readonly confidenceGapContribution?: number;
  readonly tieBreakerContribution?: string;
  readonly residualGapSwing: number;
};

export type CandidateMappingCompressionEntry = {
  readonly canonicalKey: EquipmentDNAAttributeKey;
  readonly equipmentValues: readonly {
    readonly equipmentId: string;
    readonly legacyValue?: number;
    readonly canonicalOrdinal?: EquipmentDNAAttributeNormalizedValue;
    readonly candidateNumericValue?: number;
  }[];
  readonly distinctLegacyValueCount: number;
  readonly distinctCanonicalOrdinalCount: number;
  readonly distinctCandidateValueCount: number;
  readonly maximumLegacyGap?: number;
  readonly maximumCandidateGap?: number;
  readonly gapRetainedRatio?: number;
  readonly compressionDetected: boolean;
  readonly boundaryAmplificationDetected: boolean;
  readonly materiallyAffectedRanking: boolean;
};

export type CandidateMappingCompressionAnalysis = {
  readonly entries: readonly CandidateMappingCompressionEntry[];
  readonly compressionDetected: boolean;
  readonly boundaryAmplificationDetected: boolean;
};

export type CandidateMissingAttributeImpactAnalysis = {
  readonly unsupportedFields: readonly string[];
  readonly supportedOnlySymmetryCompleted: boolean;
  readonly supportedOnlyWinner?: EquipmentIdentity;
  readonly optionalLegacyCarryoverCompleted: boolean;
  readonly optionalLegacyCarryoverWinner?: EquipmentIdentity;
  readonly conclusions: readonly string[];
};

export type CandidateCalibrationScenarioName =
  | "current_midpoint"
  | "lower_bound"
  | "upper_bound"
  | "interval_center"
  | "legacy_preserving_reference"
  | "supported_attributes_only"
  | "optional_legacy_carryover_estimate";

export type CandidateCalibrationScenarioResult = {
  readonly name: CandidateCalibrationScenarioName;
  readonly description: string;
  readonly completed: boolean;
  readonly failureReason?: string;
  readonly winner?: EquipmentIdentity;
  readonly ranking: readonly EquipmentIdentity[];
  readonly scores: readonly { equipmentId: string; score: number }[];
  readonly differsFromLegacyWinner: boolean;
  readonly differsFromCurrentCandidateWinner: boolean;
  readonly scoreGapBetweenIconAndAtlas?: number;
  readonly materialWarnings: readonly string[];
};

export type CandidateWinnerStabilityAnalysis = {
  readonly scenarioCount: number;
  readonly completedScenarioCount: number;
  readonly winnerFrequency: readonly { equipmentId: string; count: number; ratio: number }[];
  readonly stableWinner?: EquipmentIdentity;
  readonly winnerSensitiveToMapping: boolean;
  readonly winnerSensitiveToMissingAttributes: boolean;
  readonly winnerSensitiveToBoundarySelection: boolean;
  readonly conclusions: readonly string[];
};

export type NumericValuePreservationRecommendation =
  | "ordinal_only_sufficient"
  | "numeric_reference_recommended"
  | "attribute_specific_numeric_reference_recommended"
  | "insufficient_evidence";

export type AttributeArchitectureRecommendation =
  | "remain_equipment_dna"
  | "move_to_compatibility_intelligence"
  | "split_intrinsic_and_relational"
  | "requires_further_definition";

export type CandidateAttributionCause = {
  readonly code: CanonicalCandidateAttributionCauseCode;
  readonly rank: number;
  readonly confidence: "high" | "moderate" | "low";
  readonly summary: string;
  readonly affectedEquipmentIds: readonly string[];
  readonly affectedAttributes: readonly EquipmentDNAAttributeKey[];
  readonly estimatedGapContribution?: number;
  readonly supportingScenarioNames: readonly CandidateCalibrationScenarioName[];
};

export type CanonicalCandidateEquipmentAttribution = {
  readonly equipment: EquipmentIdentity;
  readonly inputVariance: readonly CandidateInputFieldVariance[];
  readonly attributeContributions: readonly CandidateAttributeContribution[];
  readonly weightedContributions: readonly CandidateWeightedScoreContribution[];
};

export type CanonicalCandidateVarianceAttribution = {
  readonly version: "1.0";
  readonly attributionVersion: typeof CANONICAL_CANDIDATE_ATTRIBUTION_VERSION;
  readonly calibrationVersion: typeof CANONICAL_CANDIDATE_CALIBRATION_VERSION;
  readonly legacyWinner: EquipmentIdentity;
  readonly candidateWinner?: EquipmentIdentity;
  readonly winnerChanged: boolean;
  readonly equipment: readonly CanonicalCandidateEquipmentAttribution[];
  readonly pairwiseWinnerAttribution?: PairwiseWinnerAttribution;
  readonly inputVariance: CandidateInputVarianceSummary;
  readonly dimensionVariance: CandidateDimensionVarianceSummary;
  readonly scoreVariance: CandidateScoreVarianceSummary;
  readonly confidenceVariance: CandidateConfidenceVarianceSummary;
  readonly explanationVariance: CandidateExplanationVarianceSummary;
  readonly tieBreakerAttribution: CandidateTieBreakerAttribution;
  readonly mappingCompression: CandidateMappingCompressionAnalysis;
  readonly missingAttributeImpact: CandidateMissingAttributeImpactAnalysis;
  readonly calibrationScenarios: readonly CandidateCalibrationScenarioResult[];
  readonly winnerStability: CandidateWinnerStabilityAnalysis;
  readonly numericValuePreservationRecommendation: NumericValuePreservationRecommendation;
  readonly architectureRecommendations: Readonly<Record<"balance_profile" | "confidence_building_potential" | "transition_difficulty", AttributeArchitectureRecommendation>>;
  readonly primaryCauses: readonly CandidateAttributionCause[];
  readonly secondaryCauses: readonly CandidateAttributionCause[];
  readonly conclusions: readonly string[];
  readonly cautions: readonly string[];
  readonly dualRunClassification: CanonicalCandidateVarianceClassification;
  readonly mappedAttributes: readonly CanonicalCandidateMappedAttribute[];
  readonly analyzedAt: Date;
};
