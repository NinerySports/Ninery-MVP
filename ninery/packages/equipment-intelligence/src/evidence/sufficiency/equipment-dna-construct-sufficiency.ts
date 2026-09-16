import { equipmentDNAConstructEvidenceMap } from "../equipment-multi-source-strategy.js";
import type { MultiSourceEvidenceClass } from "../equipment-multi-source-strategy.types.js";
import type { EquipmentDNAEvidenceItem, EquipmentDNAEvidenceReadModel } from "../read-model/index.js";
import type { EquipmentDNAConstructSufficiencyAssessment, EquipmentDNAConstructSufficiencyProfile, EquipmentDNACrossEquipmentCalibrationState, EquipmentDNAEvidenceRole, EquipmentDNASynthesisReadinessAssessment } from "./equipment-dna-construct-sufficiency.types.js";

export const EQUIPMENT_DNA_CONSTRUCT_SUFFICIENCY_PROFILE_VERSION = "1.0";
export const EQUIPMENT_DNA_SYNTHESIS_READINESS_VERSION = "1.0";

const behavioralConstructs = equipmentDNAConstructEvidenceMap.filter((item) => !item.canonicalAttribute && item.lifecycle !== "supported");

export const equipmentDNAConstructSufficiencyProfiles: readonly EquipmentDNAConstructSufficiencyProfile[] = behavioralConstructs.map((strategy) => ({
  construct: strategy.construct,
  version: EQUIPMENT_DNA_CONSTRUCT_SUFFICIENCY_PROFILE_VERSION,
  synthesisPolicyState: "not_established",
  synthesisCurrentlyPermitted: false,
  eligibleEvidenceClasses: evidenceClassesForRoles(strategy.sourceRoles, ["primary_candidate"]),
  requiredEvidenceClasses: [],
  supportingEvidenceClasses: evidenceClassesForRoles(strategy.sourceRoles, ["supporting_candidate", "validation_candidate", "future_validation_candidate"]),
  rationale: "Ninery has construct-specific calibration evidence, but an empirically earned sufficiency policy and cross-equipment generalization rule have not been established.",
  inverseSemantics: strategy.construct === "response_degradation" ? "Higher degradation means less forgiveness; readiness does not calculate a forgiveness value." : undefined
}));

export function assessEquipmentDNAConstructSynthesisReadiness(input: { readonly readModel: EquipmentDNAEvidenceReadModel; readonly profiles?: readonly EquipmentDNAConstructSufficiencyProfile[]; readonly crossEquipmentCalibrationState: EquipmentDNACrossEquipmentCalibrationState; readonly equipmentCoverageCount: number }): EquipmentDNASynthesisReadinessAssessment {
  const profiles = input.profiles ?? equipmentDNAConstructSufficiencyProfiles;
  const constructs = profiles.map((profile) => assess(profile, input.readModel, input.crossEquipmentCalibrationState));
  return {
    version: EQUIPMENT_DNA_SYNTHESIS_READINESS_VERSION, evidenceReadModelVersion: input.readModel.version,
    equipmentId: input.readModel.identity.equipmentId, equipmentVariantId: input.readModel.identity.variant?.id,
    crossEquipmentCalibrationState: input.crossEquipmentCalibrationState,
    protocolVersions: unique(input.readModel.evidenceByClass.structured_human_evaluation.map((item) => item.protocolVersion).filter(isString)),
    equipmentCoverageCount: input.equipmentCoverageCount, constructs,
    counts: { insufficient_evidence: constructs.filter((item) => item.readiness === "insufficient_evidence").length, emerging_evidence: constructs.filter((item) => item.readiness === "emerging_evidence").length, review_required: constructs.filter((item) => item.readiness === "review_required").length, synthesis_eligible: constructs.filter((item) => item.readiness === "synthesis_eligible").length },
    firewalls: { ...input.readModel.firewalls, behavioralSynthesisPerformed: false }
  };
}

function assess(profile: EquipmentDNAConstructSufficiencyProfile, readModel: EquipmentDNAEvidenceReadModel, crossEquipmentState: EquipmentDNACrossEquipmentCalibrationState): EquipmentDNAConstructSufficiencyAssessment {
  const support = readModel.constructSupport.find((item) => item.construct === profile.construct);
  const evidence = readModel.evidence.filter((item) => item.claimKey === profile.construct).map((item) => ({ evidence: item, role: role(item, profile) }));
  const eligible = evidence.filter((item) => item.role === "direct_construct_evidence" || item.role === "calibration_evidence");
  const independentGroups = unique(eligible.filter((item) => object(item.evidence.rawObservation).independentSourceContribution !== 0).map((item) => item.evidence.independenceGroup).filter(isString));
  const sessions = unique(eligible.map((item) => item.evidence.sessionReference).filter(isString));
  const protocols = unique(eligible.map((item) => item.evidence.protocolVersion).filter(isString));
  const classes = unique(eligible.map((item) => item.evidence.evidenceClass));
  const gaps: EquipmentDNAConstructSufficiencyAssessment["gaps"] = [
    ...profile.requiredEvidenceClasses.filter((required) => !classes.includes(required)).map((required) => ({ code: "required_evidence_class_missing" as const, explanation: `Required evidence class ${required} is missing.` })),
    ...(profile.minimumIndependentSources !== undefined && independentGroups.length < profile.minimumIndependentSources ? [{ code: "insufficient_independent_sources" as const, explanation: `Requires ${profile.minimumIndependentSources} independent sources; ${independentGroups.length} are represented.` }] : []),
    ...(profile.requiredProtocolVersions?.some((required) => !protocols.includes(required)) ? [{ code: "protocol_requirement_not_met" as const, explanation: `Required protocol coverage is missing: ${profile.requiredProtocolVersions.filter((required) => !protocols.includes(required)).join(", ")}.` }] : []),
    ...(profile.crossEquipmentRequirement === "cross_equipment_started" && crossEquipmentState === "single_equipment_only" ? [{ code: "cross_equipment_calibration_not_started" as const, explanation: "The profile requires cross-equipment calibration, but current coverage is single-equipment only." }] : [])
  ];
  const review = eligible.some((item) => ["disputed", "withdrawn"].includes(item.evidence.status)) || support?.supportState === "review_required";
  const blockers: EquipmentDNAConstructSufficiencyAssessment["blockers"] = [
    ...(profile.synthesisPolicyState === "not_established" ? [{ code: "synthesis_policy_not_established" as const, explanation: "No empirically earned construct sufficiency policy is established." }] : []),
    ...(!profile.synthesisCurrentlyPermitted ? [{ code: "synthesis_not_permitted" as const, explanation: "This versioned profile does not permit synthesis." }] : []),
    ...(review ? [{ code: "unresolved_evidence_review" as const, explanation: "Persisted evidence status or support review requires resolution before synthesis." }] : [])
  ];
  const readiness = review ? "review_required" : eligible.length === 0 ? "insufficient_evidence" : blockers.length || gaps.length ? "emerging_evidence" : "synthesis_eligible";
  return {
    construct: profile.construct, profileVersion: profile.version, supportState: support?.supportState ?? "no_evidence", synthesisPolicyState: profile.synthesisPolicyState, readiness, evidence,
    relevantEvidenceClasses: unique([...profile.eligibleEvidenceClasses, ...profile.supportingEvidenceClasses]), recordCount: evidence.length,
    sessionCount: sessions.length, sourceOrEvaluatorCount: unique(eligible.map((item) => item.evidence.operatorOrEvaluatorReference ?? item.evidence.sourceReference ?? item.evidence.id)).length,
    independentSourceCount: independentGroups.length, protocolVersions: protocols,
    equipmentCount: unique(eligible.map((item) => item.evidence.equipmentId)).length,
    corroboration: corroboration(eligible.map((item) => item.evidence), independentGroups.length, sessions.length), gaps, blockers,
    explanation: [eligible.length ? `${eligible.length} direct or calibration evidence record(s) are present.` : "No direct construct evidence is present.", `${independentGroups.length} provenance-aware independent source group(s) are represented.`, profile.rationale, ...(profile.inverseSemantics ? [profile.inverseSemantics] : [])]
  };
}

function role(item: EquipmentDNAEvidenceItem, profile: EquipmentDNAConstructSufficiencyProfile): EquipmentDNAEvidenceRole {
  if (profile.eligibleEvidenceClasses.includes(item.evidenceClass) && item.evidenceClass === "structured_human_evaluation" && object(item.rawObservation).studyClassification === "protocol_calibration_evidence") return "calibration_evidence";
  if (profile.eligibleEvidenceClasses.includes(item.evidenceClass)) return "direct_construct_evidence";
  if (profile.supportingEvidenceClasses.includes(item.evidenceClass)) return "supporting_context";
  return "not_applicable";
}
function evidenceClassesForRoles(roles: Readonly<Record<MultiSourceEvidenceClass, string>>, accepted: readonly string[]) { return (Object.keys(roles) as MultiSourceEvidenceClass[]).filter((evidenceClass) => accepted.includes(roles[evidenceClass])); }
function corroboration(items: readonly EquipmentDNAEvidenceItem[], independent: number, sessions: number) { if (!items.length) return "none" as const; if (new Set(items.map((item) => item.evidenceClass)).size > 1) return "cross_evidence_class" as const; if (independent > 1) return "independent_same_method" as const; if (sessions > 1) return "same_source_repeat" as const; return "single_source" as const; }
function object(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function unique<T>(values: readonly T[]): T[] { return [...new Set(values)]; }
function isString(value: string | undefined): value is string { return typeof value === "string"; }
