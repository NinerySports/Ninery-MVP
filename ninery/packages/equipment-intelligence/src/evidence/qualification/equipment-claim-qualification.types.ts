import type { MultiSourceEvidenceClass } from "../equipment-multi-source-strategy.types.js";
import type { EquipmentDNAEvidenceRecord } from "../equipment-evidence.types.js";
import type { EquipmentClaimAuthority, EquipmentClaimConstructRole, EquipmentClaimDependencyType, EquipmentClaimReviewState, EquipmentClaimVerificationState, EquipmentIdentityCertainty } from "../acquisition/index.js";

export const equipmentClaimQualificationStateValues = ["qualified", "context_only", "review_required", "not_eligible"] as const;
export type EquipmentClaimQualificationState = (typeof equipmentClaimQualificationStateValues)[number];
export type EquipmentClaimQualificationReasonCode = "claim_specific_assessment" | "factual_specification" | "authoritative_source_for_claim" | "source_confirmed" | "structured_method" | "complete_model_lineage" | "exact_identity_scope" | "equipment_identity_scope" | "underlying_source_not_extractor" | "shared_dependency_preserved" | "unstructured_observation_context_only" | "marketing_claim_not_behavioral_evidence";
export type EquipmentClaimQualificationGapCode = "authority_requires_review" | "dependency_unknown" | "extraction_review_incomplete" | "construct_policy_not_established" | "structured_method_metadata_incomplete";
export type EquipmentClaimQualificationBlockerCode = "identity_not_qualified" | "identity_scope_mismatch" | "claim_conflicting" | "claim_superseded" | "review_rejected" | "marketing_behavior_forbidden" | "evidence_class_mismatch" | "model_lineage_missing" | "normalized_claim_missing";

export type ProposedEquipmentDNAEvidenceInput = Omit<EquipmentDNAEvidenceRecord, "id" | "createdAt" | "updatedAt"> & {
  readonly qualificationContractVersion: "1.0";
  readonly evidenceClass: MultiSourceEvidenceClass;
  readonly evidenceRole: EquipmentClaimConstructRole;
  readonly independenceGroupId: string;
  readonly provenance: {
    readonly sourceId: string; readonly sourceType: string; readonly documentId: string; readonly documentReference: string;
    readonly rawClaimId: string; readonly normalizedClaimId: string; readonly extractionRunId: string;
    readonly verificationState: EquipmentClaimVerificationState; readonly reviewState: EquipmentClaimReviewState;
    readonly dependencyType: EquipmentClaimDependencyType; readonly authority: EquipmentClaimAuthority;
  };
};

export type EquipmentClaimQualificationAssessment = {
  readonly contractVersion: "1.0";
  readonly normalizedClaimId: string;
  readonly rawClaimId?: string;
  readonly state: EquipmentClaimQualificationState;
  readonly proposedEvidenceClass?: MultiSourceEvidenceClass;
  readonly proposedTarget?: { readonly level: "equipment" | "variant"; readonly equipmentId?: string; readonly equipmentVariantId?: string };
  readonly identity: { readonly certainty?: EquipmentIdentityCertainty; readonly applicable: boolean };
  readonly authority?: EquipmentClaimAuthority;
  readonly verification?: EquipmentClaimVerificationState;
  readonly review?: EquipmentClaimReviewState;
  readonly dependency?: EquipmentClaimDependencyType;
  readonly constructRelationship?: { readonly construct: string; readonly role: EquipmentClaimConstructRole; readonly reviewed: boolean };
  readonly reasons: readonly EquipmentClaimQualificationReasonCode[];
  readonly gaps: readonly EquipmentClaimQualificationGapCode[];
  readonly blockers: readonly EquipmentClaimQualificationBlockerCode[];
  readonly warnings: readonly string[];
  readonly limitations: readonly string[];
  readonly proposedEvidenceInput?: ProposedEquipmentDNAEvidenceInput;
  readonly firewalls: { readonly canonicalValueCreated: false; readonly synthesisEligibilityGranted: false; readonly recommendationEligibilityGranted: false; readonly persistencePerformed: false };
};
