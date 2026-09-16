import type {
  CanonicalEquipmentDNAAdmissionDecision,
  CanonicalEquipmentDNAProfile,
  EquipmentAttributeConfidence,
  EquipmentDNAAttributeKey,
  EquipmentDNAAttributeNormalizedValue,
  EquipmentDNANumericReference,
  EquipmentDNANumericReferenceCandidate,
  EquipmentDNANumericReferenceMethod
} from "@ninery/equipment-intelligence";
import type { EquipmentDNAAttribute, EquipmentDNAProfile } from "@ninery/equipment-intelligence";
import type { CompatibilityRunResult } from "../compatibility.types.js";
import type { CanonicalCandidateRecommendationVariance } from "../candidate/index.js";

export const CANONICAL_ATTRIBUTE_SOURCE_SELECTION_POLICY_VERSION = "1.0";
export const CANONICAL_ATTRIBUTE_SOURCE_SELECTION_DECISION_VERSION = "1.0";
export const NUMERIC_REFERENCE_CANDIDATE_INPUT_MAPPING_VERSION = "1.0";
export const THREE_PATH_RECOMMENDATION_COMPARISON_VERSION = "1.0";

export type CanonicalCandidateInputStrategy = "ordinal_only" | "numeric_reference_aware" | "numeric_reference_with_balance";
export type CanonicalCandidateAttributeInputSource = "numeric_reference" | "ordinal_projection" | "unavailable";

export type CanonicalAttributeSourceSelectionOutcome =
  | "numeric_reference_selected"
  | "ordinal_projection_selected"
  | "blocked_invalid_reference"
  | "blocked_inconsistent_reference"
  | "blocked_insufficient_confidence"
  | "blocked_unsupported_attribute"
  | "blocked_unsupported_method"
  | "blocked_unsupported_version"
  | "blocked_missing_numeric_reference"
  | "blocked_missing_ordinal_value"
  | "blocked_no_safe_source";

export type CanonicalAttributeSourceSelectionReasonCode =
  | "NUMERIC_REFERENCE_AVAILABLE"
  | "NUMERIC_REFERENCE_VALID"
  | "NUMERIC_REFERENCE_ORDINAL_CONSISTENT"
  | "NUMERIC_REFERENCE_CONFIDENCE_SUFFICIENT"
  | "NUMERIC_REFERENCE_METHOD_SUPPORTED"
  | "NUMERIC_REFERENCE_VERSION_SUPPORTED"
  | "NUMERIC_REFERENCE_SELECTED"
  | "NUMERIC_REFERENCE_MISSING"
  | "NUMERIC_REFERENCE_INVALID"
  | "NUMERIC_REFERENCE_ORDINAL_INCONSISTENT"
  | "NUMERIC_REFERENCE_CONFIDENCE_INSUFFICIENT"
  | "NUMERIC_REFERENCE_METHOD_UNSUPPORTED"
  | "NUMERIC_REFERENCE_VERSION_UNSUPPORTED"
  | "ORDINAL_PROJECTION_AVAILABLE"
  | "ORDINAL_PROJECTION_SELECTED"
  | "ORDINAL_FALLBACK_ALLOWED"
  | "ORDINAL_FALLBACK_NOT_ALLOWED"
  | "ATTRIBUTE_SUPPORTED"
  | "ATTRIBUTE_UNSUPPORTED"
  | "ATTRIBUTE_RELATIONAL_EXCLUDED"
  | "NO_SAFE_INPUT_SOURCE"
  | "ADMISSION_REQUIRED"
  | "ADMISSION_INVALID"
  | "PROFILE_VERSION_MISMATCH";

export type CanonicalAttributeSourceSelectionFinding = {
  readonly code: CanonicalAttributeSourceSelectionReasonCode;
  readonly severity: "info" | "warning" | "blocking";
  readonly message: string;
  readonly details?: Record<string, unknown>;
};

export type CanonicalAttributeSourceSelectionDecision = {
  readonly version: typeof CANONICAL_ATTRIBUTE_SOURCE_SELECTION_DECISION_VERSION;
  readonly policyVersion: string;
  readonly equipmentId: string;
  readonly equipmentVariantId?: string;
  readonly attributeKey: EquipmentDNAAttributeKey;
  readonly targetRecommendationField: EquipmentDNAAttribute;
  readonly outcome: CanonicalAttributeSourceSelectionOutcome;
  readonly selectedSource: CanonicalCandidateAttributeInputSource;
  readonly selectedNumericValue?: number;
  readonly canonicalOrdinalValue?: EquipmentDNAAttributeNormalizedValue;
  readonly ordinalProjectedValue?: number;
  readonly numericReference?: {
    readonly value: number;
    readonly scale: "0_100";
    readonly confidence: EquipmentAttributeConfidence;
    readonly referenceMethod: EquipmentDNANumericReferenceMethod;
    readonly mappingVersion: string;
    readonly validationStatus: "valid" | "invalid";
  };
  readonly reasons: readonly CanonicalAttributeSourceSelectionFinding[];
  readonly warnings: readonly CanonicalAttributeSourceSelectionFinding[];
  readonly fallbackUsed: boolean;
  readonly candidateInputAllowed: boolean;
  readonly evaluatedAt: Date;
};

export type CanonicalAttributeSourceSelectionPolicy = {
  readonly version: string;
  readonly supportedAttributes: readonly EquipmentDNAAttributeKey[];
  readonly numericReference: {
    readonly enabledAttributes: readonly EquipmentDNAAttributeKey[];
    readonly supportedScales: readonly ["0_100"];
    readonly supportedMethods: readonly EquipmentDNANumericReferenceMethod[];
    readonly supportedVersions: readonly string[];
    readonly minimumConfidenceByAttribute: Partial<Record<EquipmentDNAAttributeKey, EquipmentAttributeConfidence>>;
    readonly requireOrdinalConsistency: boolean;
  };
  readonly ordinalFallback: {
    readonly allowedAttributes: readonly EquipmentDNAAttributeKey[];
    readonly allowedWhenReferenceMissing: boolean;
    readonly allowedWhenReferenceInvalid: boolean;
    readonly allowedWhenConfidenceInsufficient: boolean;
    readonly allowedWhenVersionUnsupported: boolean;
  };
  readonly requiredCandidateAttributes: readonly EquipmentDNAAttributeKey[];
};

export type CanonicalCandidateAttributeSourceSelectionResult = {
  readonly version: typeof CANONICAL_ATTRIBUTE_SOURCE_SELECTION_DECISION_VERSION;
  readonly policyVersion: string;
  readonly equipmentId: string;
  readonly equipmentVariantId?: string;
  readonly decisions: readonly CanonicalAttributeSourceSelectionDecision[];
  readonly requiredAttributesComplete: boolean;
  readonly selectedNumericReferenceCount: number;
  readonly selectedOrdinalProjectionCount: number;
  readonly blockedAttributeCount: number;
  readonly missingRequiredAttributes: readonly EquipmentDNAAttributeKey[];
  readonly blockedRequiredAttributes: readonly EquipmentDNAAttributeKey[];
  readonly candidateInputAllowed: boolean;
  readonly warnings: readonly string[];
};

export type CanonicalSelectedSourceTrace = {
  readonly canonicalKey: EquipmentDNAAttributeKey;
  readonly recommendationField: EquipmentDNAAttribute;
  readonly selectedSource: Exclude<CanonicalCandidateAttributeInputSource, "unavailable">;
  readonly selectedValue: number;
  readonly ordinalValue: EquipmentDNAAttributeNormalizedValue;
  readonly ordinalProjectedValue: number;
  readonly numericReferenceValue?: number;
  readonly canonicalValueBeforeRecommendationBridge?: number;
  readonly recommendationBridgeValue?: number;
  readonly recommendationBridgeStrategy?: string;
  readonly recommendationBridgeVersion?: string;
  readonly recommendationBridgeExplanation?: string;
  readonly selectionOutcome: CanonicalAttributeSourceSelectionOutcome;
  readonly selectionPolicyVersion: string;
  readonly numericReferenceVersion?: string;
};

export type NumericReferenceCandidateAdaptedEquipmentInput = {
  readonly equipment: EquipmentDNAProfile;
  readonly selectedSources: readonly CanonicalSelectedSourceTrace[];
  readonly warnings: readonly string[];
};

export type CanonicalCandidatePrecisionRestorationAnalysis = {
  readonly legacyWinnerId: string;
  readonly ordinalCandidateWinnerId?: string;
  readonly numericReferenceCandidateWinnerId?: string;
  readonly ordinalWinnerMatchesLegacy: boolean;
  readonly numericReferenceWinnerMatchesLegacy: boolean;
  readonly ordinalRankingDistance: number;
  readonly numericReferenceRankingDistance: number;
  readonly ordinalAverageScoreDelta: number;
  readonly numericReferenceAverageScoreDelta: number;
  readonly ordinalMaximumScoreDelta: number;
  readonly numericReferenceMaximumScoreDelta: number;
  readonly ordinalDimensionVariance: number;
  readonly numericReferenceDimensionVariance: number;
  readonly ordinalReasonAlignmentRatio: number;
  readonly numericReferenceReasonAlignmentRatio: number;
  readonly numericReferenceImprovedWinnerAlignment: boolean;
  readonly numericReferenceImprovedRankingAlignment: boolean;
  readonly numericReferenceReducedScoreVariance: boolean;
  readonly numericReferenceReducedDimensionVariance: boolean;
  readonly numericReferenceImprovedReasonAlignment: boolean;
  readonly conclusion:
    | "numeric_reference_materially_improved_alignment"
    | "numeric_reference_modestly_improved_alignment"
    | "numeric_reference_no_meaningful_improvement"
    | "numeric_reference_reduced_alignment"
    | "insufficient_data";
};

export type CanonicalCandidateThreePathResult = {
  readonly version: "1.0";
  readonly comparisonVersion: typeof THREE_PATH_RECOMMENDATION_COMPARISON_VERSION;
  readonly legacyAuthoritative: CompatibilityRunResult;
  readonly ordinalCandidate?: CompatibilityRunResult;
  readonly numericReferenceCandidate?: CompatibilityRunResult;
  readonly ordinalExecutionStatus: "completed" | "blocked" | "failed";
  readonly numericReferenceExecutionStatus: "completed" | "blocked" | "failed";
  readonly ordinalVariance: CanonicalCandidateRecommendationVariance;
  readonly numericReferenceVariance: CanonicalCandidateRecommendationVariance;
  readonly sourceSelection: readonly CanonicalCandidateAttributeSourceSelectionResult[];
  readonly precisionRestoration: CanonicalCandidatePrecisionRestorationAnalysis;
  readonly liveRecommendationSource: "legacy";
  readonly candidateAffectsLiveResult: false;
  readonly evaluatedAt: Date;
};

export type CanonicalCandidateSourceSelectionProfileInput = {
  readonly canonicalProfile: CanonicalEquipmentDNAProfile;
  readonly admissionDecision: CanonicalEquipmentDNAAdmissionDecision;
  readonly numericReferences: readonly (EquipmentDNANumericReference | EquipmentDNANumericReferenceCandidate)[];
};
