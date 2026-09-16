import type { MultiSourceEvidenceClass } from "../equipment-multi-source-strategy.types.js";
import type { EquipmentDNAConstructSupportState, EquipmentDNAEvidenceItem, EquipmentDNAEvidenceReadModel } from "../read-model/index.js";

export const equipmentDNASynthesisReadinessValues = ["insufficient_evidence", "emerging_evidence", "review_required", "synthesis_eligible"] as const;
export type EquipmentDNASynthesisReadiness = (typeof equipmentDNASynthesisReadinessValues)[number];
export const equipmentDNASynthesisPolicyStateValues = ["not_established", "provisional", "established"] as const;
export type EquipmentDNASynthesisPolicyState = (typeof equipmentDNASynthesisPolicyStateValues)[number];
export const equipmentDNAEvidenceRoleValues = ["direct_construct_evidence", "supporting_context", "calibration_evidence", "not_applicable"] as const;
export type EquipmentDNAEvidenceRole = (typeof equipmentDNAEvidenceRoleValues)[number];
export type EquipmentDNACrossEquipmentCalibrationState = "single_equipment_only" | "cross_equipment_started";

export type EquipmentDNAConstructSufficiencyProfile = {
  readonly construct: string;
  readonly version: string;
  readonly synthesisPolicyState: EquipmentDNASynthesisPolicyState;
  readonly synthesisCurrentlyPermitted: boolean;
  readonly eligibleEvidenceClasses: readonly MultiSourceEvidenceClass[];
  readonly requiredEvidenceClasses: readonly MultiSourceEvidenceClass[];
  readonly supportingEvidenceClasses: readonly MultiSourceEvidenceClass[];
  readonly minimumIndependentSources?: number;
  readonly requiredProtocolVersions?: readonly string[];
  readonly crossEquipmentRequirement?: "none" | "cross_equipment_started";
  readonly rationale: string;
  readonly inverseSemantics?: string;
};

export type EquipmentDNAReadinessGap = { readonly code: "required_evidence_class_missing" | "insufficient_independent_sources" | "protocol_requirement_not_met" | "cross_equipment_calibration_not_started"; readonly explanation: string };
export type EquipmentDNAReadinessBlocker = { readonly code: "synthesis_policy_not_established" | "synthesis_not_permitted" | "unresolved_evidence_review" | "construct_mapping_not_established"; readonly explanation: string };
export type EquipmentDNAEvidenceRoleAssignment = { readonly evidence: EquipmentDNAEvidenceItem; readonly role: EquipmentDNAEvidenceRole };

export type EquipmentDNAConstructSufficiencyAssessment = {
  readonly construct: string;
  readonly profileVersion: string;
  readonly supportState: EquipmentDNAConstructSupportState;
  readonly synthesisPolicyState: EquipmentDNASynthesisPolicyState;
  readonly readiness: EquipmentDNASynthesisReadiness;
  readonly evidence: readonly EquipmentDNAEvidenceRoleAssignment[];
  readonly relevantEvidenceClasses: readonly MultiSourceEvidenceClass[];
  readonly recordCount: number;
  readonly sessionCount: number;
  readonly sourceOrEvaluatorCount: number;
  readonly independentSourceCount: number;
  readonly protocolVersions: readonly string[];
  readonly equipmentCount: number;
  readonly corroboration: "none" | "single_source" | "same_source_repeat" | "independent_same_method" | "cross_evidence_class";
  readonly gaps: readonly EquipmentDNAReadinessGap[];
  readonly blockers: readonly EquipmentDNAReadinessBlocker[];
  readonly explanation: readonly string[];
  readonly synthesizedValue?: never;
};

export type EquipmentDNASynthesisReadinessAssessment = {
  readonly version: "1.0";
  readonly evidenceReadModelVersion: string;
  readonly equipmentId: string;
  readonly equipmentVariantId?: string;
  readonly crossEquipmentCalibrationState: EquipmentDNACrossEquipmentCalibrationState;
  readonly protocolVersions: readonly string[];
  readonly equipmentCoverageCount: number;
  readonly constructs: readonly EquipmentDNAConstructSufficiencyAssessment[];
  readonly counts: Readonly<Record<EquipmentDNASynthesisReadiness, number>>;
  readonly firewalls: EquipmentDNAEvidenceReadModel["firewalls"] & { readonly behavioralSynthesisPerformed: false };
};
