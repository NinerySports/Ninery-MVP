import type {
  CanonicalEquipmentDNAAdmissionDecision,
  CanonicalEquipmentDNAProfile,
  EquipmentAttributeConfidence,
  EquipmentDNAAttributeKey,
  EquipmentDNAAttributeNormalizedValue
} from "@ninery/equipment-intelligence";
import type { EquipmentDNAProfile } from "@ninery/equipment-intelligence";
import type { PlayerDNAProfileResult } from "@ninery/player-intelligence";
import type {
  CompatibilityDimensionCode,
  CompatibilityRequestContext,
  CompatibilityRunResult
} from "../compatibility.types.js";
import type { ScoringConfig } from "../scoring/scoring-config.types.js";

export const CANONICAL_CANDIDATE_DUAL_RUN_VERSION = "1.0";
export const CANONICAL_CANDIDATE_INPUT_MAPPING_VERSION = "1.0";
export const CANONICAL_CANDIDATE_DUAL_RUN_COMPARISON_VERSION = "1.0";

export type RecommendationExecutionMode = "legacy_authoritative" | "canonical_candidate";

export type CanonicalCandidateRecommendationRequest = {
  readonly playerInput: PlayerDNAProfileResult;
  readonly requestContext: CompatibilityRequestContext;
  readonly legacyEquipmentInputs: readonly EquipmentDNAProfile[];
  readonly canonicalProfiles: readonly CanonicalEquipmentDNAProfile[];
  readonly admissionDecisions: readonly CanonicalEquipmentDNAAdmissionDecision[];
  readonly recommendationConfig?: ScoringConfig;
  readonly evaluatedAt?: Date;
};

export type CanonicalCandidateMappedAttribute = {
  readonly equipmentId: string;
  readonly equipmentVariantId?: string;
  readonly canonicalKey: EquipmentDNAAttributeKey;
  readonly canonicalValue: EquipmentDNAAttributeNormalizedValue;
  readonly candidateNumericValue: number;
  readonly targetRecommendationField: string;
  readonly mappingVersion: typeof CANONICAL_CANDIDATE_INPUT_MAPPING_VERSION;
  readonly strategy: string;
  readonly confidence: EquipmentAttributeConfidence;
};

export type CanonicalCandidateAdaptedEquipmentInput = {
  readonly equipment: EquipmentDNAProfile;
  readonly mappedAttributes: readonly CanonicalCandidateMappedAttribute[];
  readonly warnings: readonly string[];
};

export type CanonicalCandidateAdmissionFailure = {
  readonly equipmentId: string;
  readonly equipmentVariantId?: string;
  readonly reason: string;
  readonly code:
    | "missing_admission"
    | "blocked_admission"
    | "shadow_only_admission"
    | "stale_admission"
    | "mismatched_admission"
    | "unsupported_admission_version";
};

export type CanonicalCandidateMappingFailure = {
  readonly equipmentId: string;
  readonly equipmentVariantId?: string;
  readonly canonicalKey: EquipmentDNAAttributeKey;
  readonly targetRecommendationField: string;
  readonly reason: string;
};

export type EquipmentEligibilityVariance = {
  readonly equipmentId: string;
  readonly equipmentVariantId?: string;
  readonly legacyEligible: boolean;
  readonly candidateEligible: boolean;
  readonly legacyReasons: readonly string[];
  readonly candidateReasons: readonly string[];
  readonly changed: boolean;
};

export type EquipmentRankingVariance = {
  readonly equipmentId: string;
  readonly equipmentVariantId?: string;
  readonly legacyRank?: number;
  readonly candidateRank?: number;
  readonly rankDelta?: number;
};

export type ScoreVarianceSeverity = "negligible" | "minor" | "material" | "missing";

export type EquipmentScoreVariance = {
  readonly equipmentId: string;
  readonly equipmentVariantId?: string;
  readonly legacyScore?: number;
  readonly candidateScore?: number;
  readonly delta?: number;
  readonly severity: ScoreVarianceSeverity;
};

export type DimensionScoreVariance = EquipmentScoreVariance & {
  readonly dimension: CompatibilityDimensionCode;
};

export type ReasonVariance = {
  readonly added: readonly string[];
  readonly removed: readonly string[];
  readonly unchanged: readonly string[];
};

export type TraceVariance = {
  readonly comparable: boolean;
  readonly expectedProvenanceDifference: boolean;
  readonly differences: readonly string[];
};

export type CanonicalCandidateVarianceClassification =
  | "equivalent"
  | "minor_variance"
  | "ranking_changed"
  | "eligibility_changed"
  | "material_variance"
  | "candidate_failed";

export type CanonicalCandidateRecommendationVariance = {
  readonly classification: CanonicalCandidateVarianceClassification;
  readonly eligibility: readonly EquipmentEligibilityVariance[];
  readonly ranking: readonly EquipmentRankingVariance[];
  readonly overallScores: readonly EquipmentScoreVariance[];
  readonly dimensionScores: readonly DimensionScoreVariance[];
  readonly confidenceScores: readonly EquipmentScoreVariance[];
  readonly reasons: ReasonVariance;
  readonly tradeoffs: ReasonVariance;
  readonly alternatives: ReasonVariance;
  readonly trace: TraceVariance;
  readonly summary: readonly string[];
};

export type CanonicalCandidateDualRunResult = {
  readonly version: typeof CANONICAL_CANDIDATE_DUAL_RUN_VERSION;
  readonly comparisonVersion: typeof CANONICAL_CANDIDATE_DUAL_RUN_COMPARISON_VERSION;
  readonly candidateInputMappingVersion: typeof CANONICAL_CANDIDATE_INPUT_MAPPING_VERSION;
  readonly legacyAuthoritative: CompatibilityRunResult;
  readonly canonicalCandidate?: CompatibilityRunResult;
  readonly candidateExecutionStatus:
    | "completed"
    | "blocked_by_admission"
    | "blocked_missing_mapping"
    | "blocked_invalid_candidate_input"
    | "candidate_failed";
  readonly variance: CanonicalCandidateRecommendationVariance;
  readonly admissionSummary: {
    readonly approvedEquipmentIds: readonly string[];
    readonly rejectedEquipmentIds: readonly string[];
    readonly reasons: readonly string[];
  };
  readonly mappingSummary: {
    readonly mappedAttributes: readonly CanonicalCandidateMappedAttribute[];
    readonly warnings: readonly string[];
    readonly failures: readonly CanonicalCandidateMappingFailure[];
  };
  readonly liveRecommendationSource: "legacy";
  readonly candidateAffectsLiveResult: false;
  readonly versions: {
    readonly recommendationEngine: string;
    readonly admissionPolicy: string;
    readonly canonicalProfile: string;
    readonly candidateInputMapping: string;
    readonly dualRunComparison: string;
  };
  readonly evaluatedAt: Date;
};

export const CANONICAL_CANDIDATE_SCORE_THRESHOLDS = {
  overall: { negligibleMaximum: 2, minorMaximum: 5 },
  dimension: { negligibleMaximum: 5, minorMaximum: 10 },
  confidence: { negligibleMaximum: 3, minorMaximum: 7 }
} as const;

export const CANONICAL_CANDIDATE_CLASSIFICATION_PRIORITY = [
  "candidate_failed",
  "eligibility_changed",
  "ranking_changed",
  "material_variance",
  "minor_variance",
  "equivalent"
] as const satisfies readonly CanonicalCandidateVarianceClassification[];
