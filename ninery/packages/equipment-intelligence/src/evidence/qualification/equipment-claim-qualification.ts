import { EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION } from "../../attributes/index.js";
import { analyzeEquipmentClaimProvenance, claimAppliesToIdentity, validateEquipmentClaimProvenance, type EquipmentClaimIdentityAssertion, type EquipmentClaimProvenanceGraph } from "../acquisition/index.js";
import type { EquipmentJsonValue } from "../equipment-evidence.types.js";
import type { EquipmentClaimQualificationAssessment, EquipmentClaimQualificationBlockerCode, EquipmentClaimQualificationGapCode, EquipmentClaimQualificationReasonCode, ProposedEquipmentDNAEvidenceInput } from "./equipment-claim-qualification.types.js";

export const EQUIPMENT_CLAIM_QUALIFICATION_CONTRACT_VERSION = "1.0";

export function qualifyEquipmentClaim(input: { readonly graph: EquipmentClaimProvenanceGraph; readonly normalizedClaimId: string; readonly targetIdentity: EquipmentClaimIdentityAssertion }): EquipmentClaimQualificationAssessment {
  validateEquipmentClaimProvenance(input.graph);
  const normalized = input.graph.normalizedClaims.find((item) => item.id === input.normalizedClaimId);
  if (!normalized) return result(input.normalizedClaimId, "not_eligible", [], [], ["normalized_claim_missing"], [], [], false);
  const raw = input.graph.rawClaims.find((item) => item.id === normalized.rawClaimId)!;
  const source = input.graph.sources.find((item) => item.id === raw.sourceId)!;
  const document = input.graph.documents.find((item) => item.id === raw.documentId)!;
  const extraction = input.graph.extractionRuns.find((item) => item.id === raw.extractionRunId)!;
  const identity = input.graph.identities.find((item) => item.id === normalized.identityAssertionId)!;
  const dependency = input.graph.dependencies.find((item) => item.claimId === raw.id);
  const relationship = input.graph.constructRelationships.find((item) => item.normalizedClaimId === normalized.id);
  const modelLineage = input.graph.modeledLineages.find((item) => item.normalizedClaimId === normalized.id);
  const analysis = analyzeEquipmentClaimProvenance(input.graph);
  const conflict = analysis.conflicts.some((item) => item.normalizedClaimIds.includes(normalized.id));
  const reasons: EquipmentClaimQualificationReasonCode[] = ["claim_specific_assessment"];
  const gaps: EquipmentClaimQualificationGapCode[] = [];
  const blockers: EquipmentClaimQualificationBlockerCode[] = [];
  const warnings: string[] = [];
  const applicable = claimAppliesToIdentity(identity, input.targetIdentity);
  const target = targetFrom(identity);

  if (!["exact_variant_match", "equipment_model_match"].includes(identity.certainty)) blockers.push("identity_not_qualified");
  if (!applicable || !target) blockers.push("identity_scope_mismatch");
  else reasons.push(target.targetLevel === "variant" ? "exact_identity_scope" : "equipment_identity_scope");
  if (normalized.verificationState === "superseded" || raw.verificationState === "superseded") blockers.push("claim_superseded");
  if (normalized.verificationState === "conflicting" || raw.verificationState === "conflicting" || conflict) blockers.push("claim_conflicting");
  if (raw.reviewState === "reviewed_rejected" || normalized.reviewState === "reviewed_rejected") blockers.push("review_rejected");
  if (extraction.method === "ai_assisted") reasons.push("underlying_source_not_extractor");
  if ([extraction.reviewState, raw.reviewState, normalized.reviewState].some((state) => state === "not_reviewed" || state === "review_pending")) gaps.push("extraction_review_incomplete");
  if (dependency?.dependencyType === "unknown_dependency") gaps.push("dependency_unknown");
  if (["syndicated_from", "derived_from", "copied_from", "shared_upstream"].includes(dependency?.dependencyType ?? "")) reasons.push("shared_dependency_preserved");

  let state: EquipmentClaimQualificationAssessment["state"] = "not_eligible";
  if (raw.claimType === "marketing_claim") { blockers.push("marketing_behavior_forbidden"); reasons.push("marketing_claim_not_behavioral_evidence"); }
  else if (source.sourceType === "independent_expert_review" && document.documentType !== "survey_response") { state = "context_only"; reasons.push("unstructured_observation_context_only"); gaps.push("construct_policy_not_established"); }
  else if (source.sourceType === "retailer") {
    if (dependency && ["syndicated_from", "copied_from", "shared_upstream"].includes(dependency.dependencyType)) state = "context_only";
    else { state = "review_required"; gaps.push("authority_requires_review"); }
  } else if (blockers.length) state = blockers.includes("claim_conflicting") ? "review_required" : "not_eligible";
  else if (gaps.includes("extraction_review_incomplete") || gaps.includes("dependency_unknown")) state = "review_required";
  else if (catalogPath(raw.claimType, source.sourceType, raw.authority, normalized.evidenceClass)) { state = "qualified"; reasons.push("factual_specification", "authoritative_source_for_claim", "source_confirmed"); }
  else if (structuredPath(raw.claimType, source.sourceType, document.documentType, normalized.evidenceClass)) { state = "qualified"; reasons.push("structured_method", "source_confirmed"); }
  else if (normalized.evidenceClass === "modeled_estimate" && raw.claimType === "modeled_output") {
    if (!modelLineage?.inputNormalizedClaimIds.length || !modelLineage.inputIndependenceGroupIds.length) { state = "not_eligible"; blockers.push("model_lineage_missing"); }
    else { state = "qualified"; reasons.push("complete_model_lineage", "source_confirmed"); }
  } else { state = "context_only"; gaps.push("structured_method_metadata_incomplete"); }

  if (blockers.length && state === "qualified") state = blockers.includes("claim_conflicting") ? "review_required" : "not_eligible";
  if (state === "qualified" && normalized.verificationState !== "source_confirmed" && normalized.verificationState !== "corroborated") { state = "review_required"; gaps.push("extraction_review_incomplete"); }
  const evidenceInput = state === "qualified" && target ? buildProposedEvidence({ graph: input.graph, normalizedClaimId: normalized.id, targetIdentity: input.targetIdentity }) : undefined;
  return { contractVersion: EQUIPMENT_CLAIM_QUALIFICATION_CONTRACT_VERSION, normalizedClaimId: normalized.id, rawClaimId: raw.id, state, proposedEvidenceClass: state === "qualified" ? normalized.evidenceClass : undefined, proposedTarget: target?.proposed, identity: { certainty: identity.certainty, applicable }, authority: raw.authority, verification: normalized.verificationState, review: normalized.reviewState, dependency: dependency?.dependencyType ?? "unknown_dependency", constructRelationship: relationship ? { construct: relationship.construct, role: relationship.role, reviewed: relationship.reviewState === "reviewed_accepted" || relationship.reviewState === "reviewed_with_limitations" } : undefined, reasons: unique(reasons).sort(), gaps: unique(gaps).sort(), blockers: unique(blockers).sort(), warnings: unique(warnings).sort(), limitations: unique([...raw.limitations, ...normalized.limitations, ...(relationship?.limitations ?? []), ...(modelLineage?.limitations ?? [])]).sort(), proposedEvidenceInput: evidenceInput, firewalls: firewalls() };
}

export function buildProposedEquipmentDNAEvidenceInput(input: { readonly graph: EquipmentClaimProvenanceGraph; readonly normalizedClaimId: string; readonly targetIdentity: EquipmentClaimIdentityAssertion }): ProposedEquipmentDNAEvidenceInput | undefined {
  return qualifyEquipmentClaim(input).proposedEvidenceInput;
}

function buildProposedEvidence(input: { graph: EquipmentClaimProvenanceGraph; normalizedClaimId: string; targetIdentity: EquipmentClaimIdentityAssertion }): ProposedEquipmentDNAEvidenceInput {
  const normalized = input.graph.normalizedClaims.find((item) => item.id === input.normalizedClaimId)!; const raw = input.graph.rawClaims.find((item) => item.id === normalized.rawClaimId)!; const source = input.graph.sources.find((item) => item.id === raw.sourceId)!; const document = input.graph.documents.find((item) => item.id === raw.documentId)!; const extraction = input.graph.extractionRuns.find((item) => item.id === raw.extractionRunId)!; const identity = input.graph.identities.find((item) => item.id === normalized.identityAssertionId)!; const dependency = input.graph.dependencies.find((item) => item.claimId === raw.id); const relationship = input.graph.constructRelationships.find((item) => item.normalizedClaimId === normalized.id); const target = targetFrom(identity)!;
  return { targetLevel: target.targetLevel, equipmentId: target.equipmentId, equipmentVariantId: target.equipmentVariantId, attributeKey: evidenceAttributeKey(normalized.claimKey), attributeDefinitionVersion: EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION, sourceType: evidenceSourceType(source.sourceType, normalized.evidenceClass), sourceName: source.displayName, sourceReference: `${document.sourceReference}#claim=${raw.id}&normalized=${normalized.id}`, sourceDate: document.publishedAt ? new Date(document.publishedAt) : undefined, retrievedAt: new Date(document.retrievedAt), method: evidenceMethod(normalized.evidenceClass), rawValue: toJson({ claim: raw.rawStructuredValue ?? raw.rawText ?? null, normalizedClaimId: normalized.id, rawClaimId: raw.id, documentId: document.id, extractionRunId: extraction.id, independenceGroupId: raw.independenceGroupId, authority: raw.authority, verificationState: normalized.verificationState, reviewState: normalized.reviewState, dependencyType: dependency?.dependencyType ?? "unknown_dependency", qualificationContractVersion: EQUIPMENT_CLAIM_QUALIFICATION_CONTRACT_VERSION, limitations: [...raw.limitations, ...normalized.limitations] }), normalizedValue: toJson({ value: normalized.normalizedValue, unit: normalized.normalizedUnit }), unit: normalized.normalizedUnit, notes: `Qualified in memory under Equipment Claim Qualification Contract ${EQUIPMENT_CLAIM_QUALIFICATION_CONTRACT_VERSION}.`, status: "active", qualificationContractVersion: EQUIPMENT_CLAIM_QUALIFICATION_CONTRACT_VERSION, evidenceClass: normalized.evidenceClass, evidenceRole: relationship?.role === "direct_construct_evidence" && relationship.reviewState === "reviewed_accepted" ? "direct_construct_evidence" : relationship?.role === "calibration_evidence" && relationship.reviewState === "reviewed_accepted" ? "calibration_evidence" : "supporting_context", independenceGroupId: raw.independenceGroupId, provenance: { sourceId: source.id, sourceType: source.sourceType, documentId: document.id, documentReference: document.sourceReference, rawClaimId: raw.id, normalizedClaimId: normalized.id, extractionRunId: extraction.id, verificationState: normalized.verificationState, reviewState: normalized.reviewState, dependencyType: dependency?.dependencyType ?? "unknown_dependency", authority: raw.authority } };
}

function catalogPath(type: string, source: string, authority: string, evidence: string) { return ["factual_specification", "certification_claim", "identity_claim"].includes(type) && ["manufacturer_primary", "certification_authority", "official_product_documentation"].includes(source) && ["authoritative", "primary"].includes(authority) && evidence === "verified_catalog_fact"; }
function structuredPath(type: string, source: string, document: string, evidence: string) { if (type === "measurement_observation") return source === "ninery_internal_measurement" && evidence === "direct_physical_measurement"; if (type === "test_observation") return source === "ninery_controlled_test" && evidence === "controlled_mechanical_test"; if (type === "field_observation") return source === "ninery_structured_field_observation" && document === "survey_response" && evidence === "structured_field_observation"; return type === "subjective_observation" && source === "ninery_internal_evaluation" && document === "survey_response" && evidence === "structured_human_evaluation"; }
function targetFrom(identity: EquipmentClaimIdentityAssertion) { if (identity.certainty === "exact_variant_match" && identity.equipmentVariantId) return { targetLevel: "variant" as const, equipmentVariantId: identity.equipmentVariantId, proposed: { level: "variant" as const, equipmentVariantId: identity.equipmentVariantId } }; if (identity.certainty === "equipment_model_match" && identity.equipmentId) return { targetLevel: "equipment" as const, equipmentId: identity.equipmentId, proposed: { level: "equipment" as const, equipmentId: identity.equipmentId } }; return undefined; }
function evidenceAttributeKey(key: string) { return ({ nominal_length: "length", nominal_weight: "weight" } as Record<string, string>)[key] ?? key; }
function evidenceSourceType(source: string, evidence: string): ProposedEquipmentDNAEvidenceInput["sourceType"] { if (evidence === "verified_catalog_fact") return "manufacturer_specification"; if (evidence === "direct_physical_measurement") return "objective_measurement"; if (evidence === "controlled_mechanical_test") return "other"; if (evidence === "structured_human_evaluation") return "structured_expert_evaluation"; if (evidence === "structured_field_observation") return "field_observation"; if (evidence === "modeled_estimate") return "internal_derived"; return source === "retailer" ? "other" : "other"; }
function evidenceMethod(evidence: string): ProposedEquipmentDNAEvidenceInput["method"] { if (evidence === "verified_catalog_fact") return "direct_specification"; if (evidence === "direct_physical_measurement" || evidence === "controlled_mechanical_test") return "instrument_measurement"; if (evidence === "structured_human_evaluation") return "standardized_rubric"; if (evidence === "structured_field_observation") return "structured_feedback"; return "derived_mapping"; }
function unique<T>(values: readonly T[]): T[] { return [...new Set(values)]; }
function toJson(value: unknown): EquipmentJsonValue { if (value === null || typeof value === "string" || typeof value === "boolean") return value; if (typeof value === "number") return Number.isFinite(value) ? value : null; if (Array.isArray(value)) return value.map(toJson); if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).map(([key, item]) => [key, toJson(item)])); return null; }
function firewalls() { return { canonicalValueCreated: false, synthesisEligibilityGranted: false, recommendationEligibilityGranted: false, persistencePerformed: false } as const; }
function result(id: string, state: EquipmentClaimQualificationAssessment["state"], reasons: EquipmentClaimQualificationReasonCode[], gaps: EquipmentClaimQualificationGapCode[], blockers: EquipmentClaimQualificationBlockerCode[], warnings: string[], limitations: string[], applicable: boolean): EquipmentClaimQualificationAssessment { return { contractVersion: "1.0", normalizedClaimId: id, state, identity: { applicable }, reasons, gaps, blockers, warnings, limitations, firewalls: firewalls() }; }
