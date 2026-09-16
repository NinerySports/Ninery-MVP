import type { EquipmentClaimDependencyType, EquipmentClaimReviewState, EquipmentClaimType, EquipmentIdentityCertainty, EquipmentSourceType } from "../acquisition/index.js";
import type { EquipmentClaimQualificationState } from "../qualification/index.js";
import type { EquipmentDNAEvidenceReadModel } from "../read-model/index.js";

export const externalExpertSupportingRolePolicyStatus = "PROVISIONAL_CONSTRUCT_SPECIFIC_POLICY" as const;
export const externalExpertSupportingRoleEligibleConstructs = ["startup_demand", "rotational_demand"] as const;
export type ExternalExpertIdentityScope = "equipment_family" | "certification_family" | "drop_family" | "size_family" | "exact_variant";
export type ExternalExpertMappingConfidence = "high" | "medium" | "low" | "unmapped";
export type ExternalExpertSupportingRoleReasonCode = "SUPPORTING_ROLE_ELIGIBLE" | "CONSTRUCT_NOT_ELIGIBLE" | "SOURCE_NOT_EXTERNAL_EXPERT" | "SOURCE_DEPENDENCY_UNKNOWN" | "SOURCE_DEPENDENT" | "IDENTITY_UNRESOLVED" | "IDENTITY_SCOPE_INSUFFICIENT" | "MAPPING_NOT_HIGH_CONFIDENCE" | "HUMAN_REVIEW_REQUIRED" | "HUMAN_REVIEW_REJECTED" | "QUALIFICATION_NOT_ELIGIBLE" | "MARKETING_CONTENT" | "NOT_BEHAVIORAL_OBSERVATION" | "CLAIM_SUPERSEDED" | "CLAIM_CONFLICT_REQUIRES_REVIEW";
export type ExternalExpertSupportingRoleInput = {
  readonly observationId: string; readonly sourceType: EquipmentSourceType; readonly claimType: EquipmentClaimType; readonly dependencyType: EquipmentClaimDependencyType; readonly independenceGroupId: string;
  readonly identityCertainty: EquipmentIdentityCertainty; readonly identityScope: ExternalExpertIdentityScope; readonly identityApplicable: boolean;
  readonly identityChecks: { readonly manufacturer: boolean; readonly model: boolean; readonly modelYear: boolean; readonly certification: boolean; readonly productFamily: boolean; readonly drop?: boolean; readonly size?: boolean; readonly variant?: boolean };
  readonly construct?: string | null;
  readonly mappingConfidence: ExternalExpertMappingConfidence; readonly qualificationState: EquipmentClaimQualificationState; readonly verificationState: "active" | "conflicting" | "superseded";
  readonly reviewState: EquipmentClaimReviewState; readonly approvalActor?: "human" | "ai" | "system"; readonly direction: "lower" | "moderate_or_neutral" | "higher" | "comparative_only" | "unspecified"; readonly comparisonTarget?: string;
};
export type ExternalExpertSupportingRoleDecision = {
  readonly policy: "external_expert_supporting_role"; readonly policyVersion: "1.0-provisional"; readonly policyStatus: typeof externalExpertSupportingRolePolicyStatus;
  readonly sourceLabel: "external_independent_reviewer_observation";
  readonly observationId: string; readonly eligible: boolean; readonly qualification: "qualified" | "not_qualified"; readonly role: "supporting_context" | "not_applicable"; readonly construct?: string;
  readonly identityScope: ExternalExpertIdentityScope; readonly identityChecks: ExternalExpertSupportingRoleInput["identityChecks"]; readonly independenceGroupId: string; readonly direction: ExternalExpertSupportingRoleInput["direction"]; readonly comparisonTarget?: string;
  readonly reasons: readonly ExternalExpertSupportingRoleReasonCode[]; readonly blockers: readonly ExternalExpertSupportingRoleReasonCode[];
  readonly directEvidenceContribution: 0; readonly structuredEvaluationContribution: 0; readonly physicalMeasurementContribution: 0; readonly controlledMechanicalContribution: 0;
  readonly canonicalValueCreated: false; readonly numericValueCreated: false; readonly synthesisEligibilityGranted: false; readonly recommendationInputCreated: false;
};
export type ExternalExpertSupportingCoverage = {
  readonly policyVersion: "1.0-provisional"; readonly supportingRecordCount: number; readonly supportingSourceCount: number; readonly independentSupportingSourceCount: number;
  readonly constructCoverage: readonly { readonly construct: string; readonly recordCount: number; readonly independentSourceCount: number }[];
  readonly directEvidenceCountContribution: 0; readonly synthesisEligibilityGranted: false;
};
export type EquipmentDNAEvidenceReadModelWithSupportingCoverage = EquipmentDNAEvidenceReadModel & {
  readonly supportingRoleCoverage: ExternalExpertSupportingCoverage;
};
