import type { EquipmentDNAAttributeKey } from "../attributes/index.js";
import type { EquipmentAttributeConfidence, EquipmentDNAMaturityLevel } from "../evidence/index.js";
import type { CanonicalEquipmentDNAProfile } from "../profiles/canonical-equipment-dna-profile.types.js";
import type { EquipmentDNAShadowComparisonResult } from "../profiles/canonical-equipment-dna-profile.comparison.js";

export const CANONICAL_EQUIPMENT_DNA_ADMISSION_DECISION_VERSION = "1.0";

export type CanonicalEquipmentDNAAdmissionOutcome =
  | "approved_for_shadow"
  | "approved_for_internal_candidate"
  | "blocked_not_ready"
  | "blocked_insufficient_maturity"
  | "blocked_insufficient_confidence"
  | "blocked_conflict"
  | "blocked_material_disagreement"
  | "blocked_specification_mismatch"
  | "blocked_insufficient_mapping_coverage"
  | "blocked_unsupported_version"
  | "blocked_invalid_profile";

export type CanonicalEquipmentDNAAdmissionReasonCode =
  | "PROFILE_READY"
  | "PROFILE_NOT_READY"
  | "MATURITY_SUFFICIENT"
  | "MATURITY_INSUFFICIENT"
  | "REQUIRED_CONFIDENCE_SUFFICIENT"
  | "REQUIRED_CONFIDENCE_INSUFFICIENT"
  | "NO_MATERIAL_CONFLICTS"
  | "MATERIAL_CONFLICT_PRESENT"
  | "SPECIFICATIONS_ALIGNED"
  | "SPECIFICATION_MISMATCH_PRESENT"
  | "SHADOW_ALIGNED"
  | "SHADOW_REVIEW_RECOMMENDED"
  | "SHADOW_MATERIAL_DISAGREEMENT"
  | "MAPPING_COVERAGE_SUFFICIENT"
  | "MAPPING_COVERAGE_INSUFFICIENT"
  | "OPTIONAL_MAPPING_UNAVAILABLE"
  | "EXPERIMENTAL_ATTRIBUTE_IGNORED"
  | "SUPPORTED_VERSIONS"
  | "UNSUPPORTED_VERSION"
  | "DUPLICATE_ACTIVE_EVALUATION"
  | "INVALID_CANONICAL_VALUE"
  | "MISSING_LEGACY_PROFILE"
  | "MISSING_SELECTED_VARIANT"
  | "PROFILE_LOAD_FAILED";

export type CanonicalEquipmentDNAAdmissionCriterionName =
  | "profile_readiness"
  | "profile_validity"
  | "selected_variant"
  | "minimum_maturity"
  | "required_confidence"
  | "material_conflicts"
  | "specification_alignment"
  | "shadow_alignment"
  | "mapping_coverage"
  | "supported_versions";

export type CanonicalEquipmentDNAAdmissionFinding = {
  readonly code: CanonicalEquipmentDNAAdmissionReasonCode;
  readonly message: string;
  readonly outcome?: CanonicalEquipmentDNAAdmissionOutcome;
  readonly attributeKeys?: readonly EquipmentDNAAttributeKey[];
};

export type CanonicalEquipmentDNAAdmissionCriterion = {
  readonly name: CanonicalEquipmentDNAAdmissionCriterionName;
  readonly passed: boolean;
  readonly reasonCodes: readonly CanonicalEquipmentDNAAdmissionReasonCode[];
  readonly details: readonly string[];
};

export type CanonicalEquipmentDNAMappingCoverage = {
  readonly requiredComparableKeys: readonly EquipmentDNAAttributeKey[];
  readonly successfullyComparedKeys: readonly EquipmentDNAAttributeKey[];
  readonly missingCanonicalKeys: readonly EquipmentDNAAttributeKey[];
  readonly missingLegacyKeys: readonly EquipmentDNAAttributeKey[];
  readonly incomparableRequiredKeys: readonly EquipmentDNAAttributeKey[];
  readonly optionalIncomparableKeys: readonly EquipmentDNAAttributeKey[];
  readonly coverageRatio: number;
  readonly requiredCoverageSatisfied: boolean;
};

export type CanonicalEquipmentDNAVersionAssessment = {
  readonly supported: boolean;
  readonly actual: {
    readonly admissionPolicyVersion: string;
    readonly canonicalProfileVersion: CanonicalEquipmentDNAProfile["version"] | string;
    readonly registryVersion: string;
    readonly confidenceModelVersion: string;
    readonly readinessModelVersion: string;
    readonly scoreMappingVersion: string;
    readonly shadowComparisonVersion: EquipmentDNAShadowComparisonResult["version"] | string;
    readonly ordinalComparisonVersion: string;
  };
  readonly unsupported: readonly string[];
};

export type CanonicalEquipmentDNAAdmissionSourceSummary = {
  readonly ready: boolean;
  readonly maturity: EquipmentDNAMaturityLevel;
  readonly shadowStatus: EquipmentDNAShadowComparisonResult["overallStatus"];
  readonly specificationMatchCount: number;
  readonly specificationProblemCount: number;
  readonly alignedBehaviorCount: number;
  readonly minorBehaviorDifferenceCount: number;
  readonly materialBehaviorDifferenceCount: number;
  readonly incomparableBehaviorCount: number;
};

export type CanonicalEquipmentDNAAdmissionDecision = {
  readonly version: typeof CANONICAL_EQUIPMENT_DNA_ADMISSION_DECISION_VERSION;
  readonly policyVersion: string;
  readonly equipmentId: string;
  readonly equipmentVariantId?: string;
  readonly equipmentName: string;
  readonly evaluatedAt: Date;
  readonly outcome: CanonicalEquipmentDNAAdmissionOutcome;
  readonly eligibleForShadow: boolean;
  readonly eligibleForInternalCandidate: boolean;
  readonly liveRecommendationUseAllowed: false;
  readonly blockers: readonly CanonicalEquipmentDNAAdmissionFinding[];
  readonly warnings: readonly CanonicalEquipmentDNAAdmissionFinding[];
  readonly criteria: readonly CanonicalEquipmentDNAAdmissionCriterion[];
  readonly mappingCoverage: CanonicalEquipmentDNAMappingCoverage;
  readonly versionAssessment: CanonicalEquipmentDNAVersionAssessment;
  readonly sourceSummary: CanonicalEquipmentDNAAdmissionSourceSummary;
  readonly nextActions: readonly string[];
};

export type CanonicalEquipmentDNAAdmissionPolicy = {
  readonly version: string;
  readonly minimumInternalCandidateMaturity: EquipmentDNAMaturityLevel;
  readonly requiredSpecificationKeys: readonly EquipmentDNAAttributeKey[];
  readonly requiredComparableBehaviorKeys: readonly EquipmentDNAAttributeKey[];
  readonly optionalComparableBehaviorKeys: readonly EquipmentDNAAttributeKey[];
  readonly experimentalAttributeKeys: readonly EquipmentDNAAttributeKey[];
  readonly minimumBehaviorMappingCoverage: number;
  readonly minimumConfidenceByDomain: {
    readonly physical: EquipmentAttributeConfidence;
    readonly performance: EquipmentAttributeConfidence;
    readonly development: EquipmentAttributeConfidence;
    readonly compatibility: EquipmentAttributeConfidence;
  };
  readonly supportedVersions: {
    readonly canonicalProfile: readonly string[];
    readonly registry: readonly string[];
    readonly confidenceModel: readonly string[];
    readonly readinessModel: readonly string[];
    readonly scoreMapping: readonly string[];
    readonly shadowComparison: readonly string[];
    readonly ordinalComparison: readonly string[];
  };
};
