import type { ExternalExpertSupportingCoverage, ExternalExpertSupportingRoleDecision, ExternalExpertSupportingRoleInput, ExternalExpertSupportingRoleReasonCode } from "./external-expert-supporting-role.types.js";
import { externalExpertSupportingRoleEligibleConstructs, externalExpertSupportingRolePolicyStatus } from "./external-expert-supporting-role.types.js";
import type { EquipmentDNAEvidenceReadModel } from "../read-model/index.js";
import type { EquipmentDNAEvidenceReadModelWithSupportingCoverage } from "./external-expert-supporting-role.types.js";

export const EXTERNAL_EXPERT_SUPPORTING_ROLE_POLICY_VERSION = "1.0-provisional" as const;

export function evaluateExternalExpertSupportingRole(input: ExternalExpertSupportingRoleInput): ExternalExpertSupportingRoleDecision {
  const blockers: ExternalExpertSupportingRoleReasonCode[] = [];
  if (input.verificationState === "superseded") blockers.push("CLAIM_SUPERSEDED");
  if (input.verificationState === "conflicting") blockers.push("CLAIM_CONFLICT_REQUIRES_REVIEW");
  if (input.claimType === "marketing_claim") blockers.push("MARKETING_CONTENT");
  else if (!["subjective_observation", "comparative_observation"].includes(input.claimType)) blockers.push("NOT_BEHAVIORAL_OBSERVATION");
  if (input.sourceType !== "independent_expert_review") blockers.push("SOURCE_NOT_EXTERNAL_EXPERT");
  if (input.dependencyType === "unknown_dependency") blockers.push("SOURCE_DEPENDENCY_UNKNOWN");
  else if (input.dependencyType !== "independent_observation") blockers.push("SOURCE_DEPENDENT");
  if (!["exact_variant_match", "equipment_model_match"].includes(input.identityCertainty)) blockers.push("IDENTITY_UNRESOLVED");
  if (!input.identityApplicable || Object.values(input.identityChecks).some((matches) => matches === false)) blockers.push("IDENTITY_SCOPE_INSUFFICIENT");
  if (!input.construct || !externalExpertSupportingRoleEligibleConstructs.some((construct) => construct === input.construct)) blockers.push("CONSTRUCT_NOT_ELIGIBLE");
  if (input.mappingConfidence !== "high") blockers.push("MAPPING_NOT_HIGH_CONFIDENCE");
  if (!["context_only", "qualified"].includes(input.qualificationState)) blockers.push("QUALIFICATION_NOT_ELIGIBLE");
  if (input.reviewState === "reviewed_rejected") blockers.push("HUMAN_REVIEW_REJECTED");
  else if (!["reviewed_accepted", "reviewed_with_limitations"].includes(input.reviewState) || input.approvalActor !== "human") blockers.push("HUMAN_REVIEW_REQUIRED");
  const uniqueBlockers = [...new Set(blockers)]; const eligible = uniqueBlockers.length === 0;
  return { policy: "external_expert_supporting_role", policyVersion: EXTERNAL_EXPERT_SUPPORTING_ROLE_POLICY_VERSION, policyStatus: externalExpertSupportingRolePolicyStatus, sourceLabel: "external_independent_reviewer_observation",
    observationId: input.observationId, eligible, qualification: eligible ? "qualified" : "not_qualified", role: eligible ? "supporting_context" : "not_applicable",
    construct: input.construct ?? undefined, identityScope: input.identityScope, identityChecks: input.identityChecks, independenceGroupId: input.independenceGroupId, direction: input.direction, comparisonTarget: input.comparisonTarget,
    reasons: eligible ? ["SUPPORTING_ROLE_ELIGIBLE"] : [], blockers: uniqueBlockers, directEvidenceContribution: 0, structuredEvaluationContribution: 0,
    physicalMeasurementContribution: 0, controlledMechanicalContribution: 0, canonicalValueCreated: false, numericValueCreated: false, synthesisEligibilityGranted: false, recommendationInputCreated: false };
}

export function summarizeExternalExpertSupportingCoverage(decisions: readonly ExternalExpertSupportingRoleDecision[]): ExternalExpertSupportingCoverage {
  const supporting = decisions.filter((decision) => decision.eligible);
  const constructs = [...new Set(supporting.map((decision) => decision.construct).filter((value): value is string => Boolean(value)))].sort();
  return { policyVersion: EXTERNAL_EXPERT_SUPPORTING_ROLE_POLICY_VERSION, supportingRecordCount: supporting.length,
    supportingSourceCount: new Set(supporting.map((decision) => decision.independenceGroupId)).size,
    independentSupportingSourceCount: new Set(supporting.map((decision) => decision.independenceGroupId)).size,
    constructCoverage: constructs.map((construct) => { const records = supporting.filter((decision) => decision.construct === construct); return { construct, recordCount: records.length, independentSourceCount: new Set(records.map((decision) => decision.independenceGroupId)).size }; }),
    directEvidenceCountContribution: 0, synthesisEligibilityGranted: false };
}

export function attachExternalExpertSupportingCoverage(readModel: EquipmentDNAEvidenceReadModel, decisions: readonly ExternalExpertSupportingRoleDecision[]): EquipmentDNAEvidenceReadModelWithSupportingCoverage {
  return { ...readModel, supportingRoleCoverage: summarizeExternalExpertSupportingCoverage(decisions) };
}
