import { equipmentDNAConstructEvidenceMap } from "./equipment-multi-source-strategy.js";
import type { EvidenceSupportRole, MultiSourceEvidenceClass } from "./equipment-multi-source-strategy.types.js";
import { buildEquipmentDNAEvidenceReadModel } from "./read-model/equipment-dna-evidence-read-model.js";
import type { EquipmentDNAEvidenceItem, EquipmentDNAEvidenceRecordInput } from "./read-model/equipment-dna-evidence-read-model.types.js";
import { physicalEvaluationProtocolV11Questions, isProtocolV11CalibrationEvidence, assessPhysicalEvaluatorRelationship } from "../physical-evaluation/protocol-v1-1/index.js";
import { physicalBatStandaloneObservationScale } from "../physical-evaluation/structured-physical-bat-evaluation.policy.js";
import { physicalMeasurementMethods, circumferenceDerivedDiameterMethods } from "./physical-measurement/physical-measurement-protocol.js";
import { getEquipmentDNAAttributeDefinition, validateEquipmentDNAAttributeValue } from "../attributes/index.js";

export const STRONGER_CONSTRUCT_EVIDENCE_ADMISSIBILITY_VERSION = "1.0" as const;
export const strongerEvidenceReasonCodes = [
  "unsupported_evidence_class", "unsupported_source_type", "unsupported_method", "unsupported_definition_version",
  "unsupported_protocol_version", "malformed_identity", "equipment_mismatch", "observed_variant_mismatch",
  "ambiguous_target_scope", "generalization_not_established", "selected_variant_required", "missing_required_provenance",
  "calibration_only", "protocol_restriction", "unresolved_dependence", "repeat_evaluator", "shared_provenance",
  "incompatible_value_representation", "comparability_not_established", "malformed_raw_metadata",
  "inactive_evidence", "disputed_evidence", "withdrawn_evidence", "superseded_evidence", "construct_not_applicable",
  "acquisition_contract_not_established", "independence_metadata_conflict"
] as const;
export type StrongerEvidenceReasonCode = typeof strongerEvidenceReasonCodes[number];
export type StrongerEvidenceDisposition = "admissible" | "admissible_with_restrictions" | "excluded" | "unresolved";
export type StrongerEvidenceCandidate = EquipmentDNAEvidenceRecordInput & {
  readonly attributeDefinitionVersion: string;
  readonly evidenceClass?: string;
};
export type StrongerEvidenceRequest = { readonly equipmentId: string; readonly equipmentVariantId?: string; readonly construct: string };
export type StrongerEvidenceIdentity = { readonly equipmentId?: string; readonly equipmentVariantId?: string; readonly specimenReference?: string };
export type StrongerEvidenceAdmissibility = {
  readonly version: typeof STRONGER_CONSTRUCT_EVIDENCE_ADMISSIBILITY_VERSION;
  readonly evidenceRecordId: string;
  readonly evidenceClass?: MultiSourceEvidenceClass;
  readonly construct: string;
  readonly sourceType: string;
  readonly method: string;
  readonly status: string;
  readonly attributeDefinitionVersion: string;
  readonly observedIdentity: StrongerEvidenceIdentity;
  readonly declaredTarget: StrongerEvidenceIdentity & { readonly targetLevel: string };
  readonly applicability: { readonly level: "equipment" | "variant" | "specimen" | "unresolved"; readonly equipmentId?: string; readonly equipmentVariantId?: string; readonly specimenReference?: string; readonly modelGeneralizationEstablished: boolean };
  readonly constructRole: EvidenceSupportRole;
  readonly permittedAssessment: "construct_evidence" | "calibration_only" | "none";
  readonly provenance: { readonly complete: boolean; readonly missing: readonly string[]; readonly sourceReference?: string; readonly sourceDate?: string; readonly protocolVersion?: string; readonly evaluatorReference?: string; readonly sessionReference?: string; readonly instrumentReference?: string; readonly upstreamReferences: readonly string[] };
  readonly dependence: { readonly state: "independent_evaluator" | "repeat_evaluator" | "unresolved"; readonly evaluatorGroup?: string; readonly relationships: readonly { readonly kind: "evaluator" | "session" | "specimen" | "instrument" | "upstream"; readonly reference: string; readonly evidenceRecordIds: readonly string[] }[] };
  readonly value: { readonly kind: "ordinal" | "categorical" | "numeric" | "observation_only" | "unavailable"; readonly value?: unknown; readonly unit?: string; readonly scale?: string; readonly crossRecordComparability: "not_established" };
  readonly disposition: StrongerEvidenceDisposition;
  readonly reasons: readonly StrongerEvidenceReasonCode[];
  readonly exclusions: readonly StrongerEvidenceReasonCode[];
  readonly restrictions: readonly StrongerEvidenceReasonCode[];
  readonly evidence?: EquipmentDNAEvidenceItem;
  readonly authority: { readonly canonicalValueCreated: false; readonly numericValueCreated: false; readonly synthesisEligibilityGranted: false; readonly compatibilityAuthorityGranted: false; readonly recommendationAuthorityGranted: false; readonly decisionBookAuthorityGranted: false };
};

const sourceClasses: Readonly<Record<string, MultiSourceEvidenceClass>> = {
  manufacturer_specification: "verified_catalog_fact", objective_measurement: "direct_physical_measurement",
  structured_expert_evaluation: "structured_human_evaluation", player_feedback: "structured_field_observation",
  parent_feedback: "structured_field_observation", coach_feedback: "structured_field_observation",
  field_observation: "structured_field_observation", internal_derived: "modeled_estimate"
};

export function assessStrongerConstructEvidence(input: {
  readonly request: StrongerEvidenceRequest;
  readonly records: readonly StrongerEvidenceCandidate[];
  readonly variants: readonly { readonly id: string; readonly equipmentId: string }[];
}): readonly StrongerEvidenceAdmissibility[] {
  return input.records.filter(record => isRelevant(record, input.request.construct))
    .map(record => assess(record, input)).sort((a, b) => a.evidenceRecordId.localeCompare(b.evidenceRecordId));
}

function assess(record: StrongerEvidenceCandidate, input: Parameters<typeof assessStrongerConstructEvidence>[0]): StrongerEvidenceAdmissibility {
  const excluded: StrongerEvidenceReasonCode[] = [];
  const unresolved: StrongerEvidenceReasonCode[] = [];
  const restrictions: StrongerEvidenceReasonCode[] = [];
  const raw = object(record.rawValue);
  if (record.rawValue !== undefined && record.rawValue !== null && !raw) excluded.push("malformed_raw_metadata");
  const metadata = raw ?? {};
  const verification = object(metadata.physicalVerification) ?? object(metadata.targetVerification);
  const identityFields = [record.id, record.equipmentId, record.equipmentVariantId, metadata.equipmentId, metadata.targetEquipmentId, metadata.equipmentVariantId, metadata.targetEquipmentVariantId, verification?.equipmentId, verification?.equipmentVariantId];
  if (identityFields.some(value => value !== undefined && value !== null && !text(value))) excluded.push("malformed_identity");
  const equipmentIds = strings([record.equipmentId, metadata.equipmentId, metadata.targetEquipmentId, verification?.equipmentId]);
  const variantIds = strings([record.equipmentVariantId, metadata.equipmentVariantId, metadata.targetEquipmentVariantId, verification?.equipmentVariantId]);
  const observedEquipmentId = text(metadata.equipmentId) ?? text(metadata.targetEquipmentId) ?? text(verification?.equipmentId) ?? record.equipmentId;
  const observedVariantId = text(metadata.equipmentVariantId) ?? text(metadata.targetEquipmentVariantId) ?? text(verification?.equipmentVariantId) ?? record.equipmentVariantId;
  if (!record.id || !record.equipmentId || equipmentIds.length !== 1 || variantIds.length > 1) excluded.push("malformed_identity");
  if (equipmentIds.some(id => id !== input.request.equipmentId)) excluded.push("equipment_mismatch");
  if (observedVariantId && !input.variants.some(variant => variant.id === observedVariantId && variant.equipmentId === input.request.equipmentId)) excluded.push("malformed_identity");
  if (observedVariantId && input.request.equipmentVariantId && observedVariantId !== input.request.equipmentVariantId) excluded.push("observed_variant_mismatch");
  const evidenceClass = Object.hasOwn(sourceClasses, record.sourceType) ? sourceClasses[record.sourceType] : undefined;
  if (!evidenceClass) excluded.push("unsupported_source_type");
  if (record.evidenceClass && record.evidenceClass !== evidenceClass) excluded.push("unsupported_evidence_class");
  const strategy = equipmentDNAConstructEvidenceMap.find(item => item.construct === input.request.construct);
  const constructRole = evidenceClass && strategy ? strategy.sourceRoles[evidenceClass] : "unknown";
  if (constructRole === "unknown" || constructRole === "not_applicable") excluded.push("construct_not_applicable");
  if (record.status !== "active") excluded.push(record.status === "disputed" ? "disputed_evidence" : record.status === "withdrawn" ? "withdrawn_evidence" : record.status === "superseded" ? "superseded_evidence" : "inactive_evidence");
  if (!["equipment", "variant"].includes(record.targetLevel) || (record.targetLevel === "variant" && !observedVariantId)) unresolved.push("ambiguous_target_scope");
  if (observedVariantId && !input.request.equipmentVariantId) unresolved.push("selected_variant_required");
  if (observedVariantId) restrictions.push("generalization_not_established");
  if (!observedVariantId && evidenceClass !== "verified_catalog_fact") unresolved.push("generalization_not_established", "ambiguous_target_scope");

  const missing: string[] = [];
  const need = (name: string, present: boolean) => { if (!present) missing.push(name); };
  need("source_reference", !!text(record.sourceReference));
  need("source_name", !!text(record.sourceName));
  const sourceDate = date(record.sourceDate);
  need("source_date", !!sourceDate);
  const protocolVersion = text(metadata.protocolVersion);
  const sessionReference = text(metadata.sessionId) ?? text(metadata.measurementSessionId);
  const instrumentReference = text(object(metadata.instrument)?.instrumentReference);
  const calibration = metadata.studyClassification === "protocol_calibration_evidence";
  let permittedAssessment: StrongerEvidenceAdmissibility["permittedAssessment"] = calibration ? "calibration_only" : "construct_evidence";
  if (calibration) restrictions.push("calibration_only");
  if (metadata.canonicalEligible === false || metadata.numericReferenceEligible === false || metadata.recommendationEligible === false) restrictions.push("protocol_restriction");
  if (evidenceClass === "verified_catalog_fact") {
    if (record.method !== "direct_specification") excluded.push("unsupported_method");
    if (record.attributeDefinitionVersion !== "1.0") excluded.push("unsupported_definition_version");
  } else if (evidenceClass === "structured_human_evaluation") {
    need("evaluator_reference", !!text(record.evaluatorReference));
    need("session_reference", !!sessionReference);
    if (record.method !== "standardized_rubric") excluded.push("unsupported_method");
    if (record.attributeDefinitionVersion !== "1.0") excluded.push("unsupported_definition_version");
    if (protocolVersion !== "1.1") unresolved.push("unsupported_protocol_version");
    else {
      const question = physicalEvaluationProtocolV11Questions.find(item => item.dimensionKey === input.request.construct);
      if (!question || metadata.questionId !== question.id || metadata.dimensionKey !== question.dimensionKey || record.attributeKey !== question.attributeKey || metadata.inverseSemantics !== (question.responseScale === "five_level_inverse_degradation")) excluded.push("incompatible_value_representation");
      if (!isProtocolV11CalibrationEvidence({ sourceReference: record.sourceReference ?? "", rawValue: record.rawValue }) || metadata.provenanceClassification !== "real_protocol_calibration_observation") unresolved.push("missing_required_provenance");
      need("physical_verification", verification?.confidence === "confident" && !!date(verification.verifiedAt) && !!text(verification.verifiedBy));
      const evaluator = object(metadata.evaluator);
      if (evaluator?.evaluatorId !== record.evaluatorReference) excluded.push("malformed_raw_metadata");
      if (record.normalizedValue !== undefined && record.normalizedValue !== null) excluded.push("incompatible_value_representation");
    }
  } else if (evidenceClass === "direct_physical_measurement") {
    if (record.method !== "instrument_measurement") excluded.push("unsupported_method");
    if (record.attributeDefinitionVersion !== "physical-measurement-1.0") excluded.push("unsupported_definition_version");
    if (metadata.protocol !== "ninery_physical_measurement" || protocolVersion !== "1.0" || metadata.methodVersion !== "1.0") unresolved.push("unsupported_protocol_version");
    const methods = [...Object.values(physicalMeasurementMethods), ...Object.values(circumferenceDerivedDiameterMethods)];
    const methodDefinition = methods.find(method => method.measurementType === record.attributeKey && method.method === metadata.method);
    if (!methodDefinition) excluded.push("unsupported_method");
    else {
      const trials = Array.isArray(metadata.trials) ? metadata.trials.map(object) : [];
      need("protocol_trials", trials.length >= methodDefinition.minimumTrials && trials.every(trial => trial && typeof trial.value === "number" && Number.isFinite(trial.value) && typeof trial.trialNumber === "number" && trial.repositioned === true));
      need("reference_points", metadata.referencePoints === methodDefinition.referencePoints);
      const normalized = object(record.normalizedValue);
      if (!methodDefinition.supportedRawUnits.includes(String(metadata.rawUnit)) || normalized?.unit !== methodDefinition.preferredUnit || typeof normalized?.value !== "number" || !Number.isFinite(normalized.value) || record.unit !== normalized.unit) excluded.push("incompatible_value_representation");
    }
    need("specimen_reference", !!text(metadata.specimenReference)); need("session_reference", !!sessionReference);
    need("instrument_reference", !!instrumentReference); need("operator_reference", !!text(metadata.operatorId));
    need("trials", Array.isArray(metadata.trials) && metadata.trials.length > 0);
    need("physical_verification", verification?.confidence === "confident" && !!date(verification.verifiedAt) && !!text(verification.verifiedBy));
    if (metadata.provenanceClassification !== "real_physical_measurement") unresolved.push("missing_required_provenance");
    need("equipment_condition", ["new", "normal_used_condition", "materially_worn", "modified"].includes(String(metadata.equipmentCondition)));
    need("measurement_quality", ["complete_repeatable", "complete_variation_observed", "instrument_uncertain"].includes(String(metadata.quality)));
  } else if (evidenceClass === "structured_field_observation" || evidenceClass === "modeled_estimate") {
    if (record.method !== (evidenceClass === "modeled_estimate" ? "derived_mapping" : "structured_feedback")) excluded.push("unsupported_method");
    if (record.attributeDefinitionVersion !== "1.0") excluded.push("unsupported_definition_version");
    unresolved.push("acquisition_contract_not_established");
  }
  if (missing.length) unresolved.push("missing_required_provenance");

  const upstreamReferences = strings(Array.isArray(metadata.inputEvidenceReferences) ? metadata.inputEvidenceReferences : [metadata.upstreamClaimId]);
  const references = { evaluator: text(record.evaluatorReference), session: sessionReference, specimen: text(metadata.specimenReference), instrument: instrumentReference };
  const relationships: StrongerEvidenceAdmissibility["dependence"]["relationships"][number][] = [];
  for (const [kind, reference] of Object.entries(references)) {
    if (!reference) continue;
    const peers = input.records.filter(peer => peer.id !== record.id && peer.equipmentId === record.equipmentId && referenceFor(peer, kind) === reference).map(peer => peer.id).sort();
    if (peers.length && isRelationshipKind(kind)) relationships.push({ kind, reference, evidenceRecordIds: peers });
  }
  for (const reference of upstreamReferences) {
    const peers = input.records.filter(peer => peer.id !== record.id && strings(Array.isArray(object(peer.rawValue)?.inputEvidenceReferences) ? object(peer.rawValue)?.inputEvidenceReferences as unknown[] : [object(peer.rawValue)?.upstreamClaimId]).includes(reference)).map(peer => peer.id).sort();
    if (peers.length) relationships.push({ kind: "upstream", reference, evidenceRecordIds: peers });
  }
  let dependenceState: StrongerEvidenceAdmissibility["dependence"]["state"] = "unresolved";
  if (calibration && protocolVersion === "1.1" && record.evaluatorReference && sessionReference && sourceDate) {
    const prior = input.records.filter(peer => peer.equipmentId === record.equipmentId && peer.id !== record.id && text(object(peer.rawValue)?.sessionId) !== sessionReference && text(peer.evaluatorReference) === record.evaluatorReference);
    if (prior.every(peer => !!date(peer.sourceDate) && !!text(object(peer.rawValue)?.sessionId) && !!text(object(peer.rawValue)?.protocolVersion) && peer.sourceType === "structured_expert_evaluation")) {
      const historical = prior.filter(peer => date(peer.sourceDate)! < sourceDate || (date(peer.sourceDate) === sourceDate && (peer.sourceReference ?? "") < (record.sourceReference ?? "")))
        .flatMap(peer => { const value = object(peer.rawValue); return value && peer.equipmentId && text(value.sessionId) && text(value.protocolVersion) ? [{ evidenceRecordId: peer.id, equipmentId: peer.equipmentId, sessionId: text(value.sessionId)!, evaluatorId: peer.evaluatorReference!, protocolVersion: text(value.protocolVersion)!, sourceReference: peer.sourceReference ?? "" }] : []; });
      const declared = metadata.evaluatorRelationship;
      if (declared === "independent_evaluator" || declared === "repeat_evaluator") {
        const review = assessPhysicalEvaluatorRelationship({ equipmentId: input.request.equipmentId, sessionId: sessionReference, evaluatorId: record.evaluatorReference, declaredRelationship: declared, existingEvidence: historical });
        if (review.valid && metadata.independentSourceContribution === review.independentSourceContribution) dependenceState = review.derivedRelationship;
        else unresolved.push("independence_metadata_conflict");
      }
    }
  }
  if (dependenceState === "unresolved") restrictions.push("unresolved_dependence");
  if (dependenceState === "repeat_evaluator") restrictions.push("repeat_evaluator");
  if (relationships.length) restrictions.push("shared_provenance");
  const value = representation(record, metadata, evidenceClass, input.request.construct);
  if (value.kind === "unavailable") unresolved.push("incompatible_value_representation");
  restrictions.push("comparability_not_established");
  const disposition: StrongerEvidenceDisposition = excluded.length ? "excluded" : unresolved.length ? "unresolved" : restrictions.length ? "admissible_with_restrictions" : "admissible";
  if (disposition === "excluded" || disposition === "unresolved") permittedAssessment = "none";
  // Invoke #066 only after explicit source classification; its fallback must never classify unknown records.
  const evidence = evidenceClass ? buildEquipmentDNAEvidenceReadModel({ identity: { equipmentId: input.request.equipmentId, manufacturer: "", model: "" }, catalogFacts: [], records: [{ ...record, sourceDate }] }).evidence[0] : undefined;
  return {
    version: STRONGER_CONSTRUCT_EVIDENCE_ADMISSIBILITY_VERSION, evidenceRecordId: record.id, evidenceClass,
    construct: input.request.construct, sourceType: record.sourceType, method: record.method, status: record.status,
    attributeDefinitionVersion: record.attributeDefinitionVersion,
    observedIdentity: { equipmentId: observedEquipmentId, equipmentVariantId: observedVariantId, specimenReference: text(metadata.specimenReference) },
    declaredTarget: { targetLevel: record.targetLevel, equipmentId: record.equipmentId, equipmentVariantId: record.equipmentVariantId },
    applicability: { level: permittedAssessment === "none" ? "unresolved" : observedVariantId ? text(metadata.specimenReference) ? "specimen" : "variant" : "equipment", equipmentId: observedEquipmentId, equipmentVariantId: observedVariantId, specimenReference: text(metadata.specimenReference), modelGeneralizationEstablished: !observedVariantId && evidenceClass === "verified_catalog_fact" && permittedAssessment !== "none" },
    constructRole, permittedAssessment,
    provenance: { complete: missing.length === 0 && !unresolved.includes("missing_required_provenance"), missing: [...new Set(missing)].sort(), sourceReference: record.sourceReference, sourceDate, protocolVersion, evaluatorReference: record.evaluatorReference, sessionReference, instrumentReference, upstreamReferences },
    dependence: { state: dependenceState, evaluatorGroup: dependenceState !== "unresolved" ? record.evaluatorReference : undefined, relationships: relationships.sort((a, b) => a.kind.localeCompare(b.kind) || a.reference.localeCompare(b.reference)) },
    value, disposition, reasons: sorted([...excluded, ...unresolved, ...restrictions]), exclusions: sorted([...excluded, ...unresolved]), restrictions: sorted(restrictions), evidence,
    authority: { canonicalValueCreated: false, numericValueCreated: false, synthesisEligibilityGranted: false, compatibilityAuthorityGranted: false, recommendationAuthorityGranted: false, decisionBookAuthorityGranted: false }
  };
}

function representation(record: StrongerEvidenceCandidate, raw: Record<string, unknown>, evidenceClass: MultiSourceEvidenceClass | undefined, construct: string): StrongerEvidenceAdmissibility["value"] {
  const base = { crossRecordComparability: "not_established" as const };
  if (evidenceClass === "structured_human_evaluation" && raw.protocolVersion === "1.1") {
    const observation = raw.observation;
    if (typeof observation !== "string" || !physicalBatStandaloneObservationScale.some(value => value === observation)) return { ...base, kind: "unavailable" };
    return observation === "unable_to_assess" ? { ...base, kind: "observation_only", value: observation } : { ...base, kind: "ordinal", value: observation, scale: `physical-evaluation:1.1:${construct}:${raw.inverseSemantics === true ? "inverse_degradation" : "absolute"}` };
  }
  const normalized = object(record.normalizedValue);
  const value = normalized && "value" in normalized ? normalized.value : record.normalizedValue;
  if (evidenceClass === "verified_catalog_fact" && getEquipmentDNAAttributeDefinition(record.attributeKey)) {
    const validated = validateEquipmentDNAAttributeValue(record.attributeKey, value);
    if (validated.valid) return { ...base, kind: typeof value === "number" ? "numeric" : "categorical", value, unit: record.unit };
    return { ...base, kind: "unavailable" };
  }
  if (typeof value === "number" && Number.isFinite(value) && text(normalized?.unit ?? record.unit)) return { ...base, kind: "numeric", value, unit: text(normalized?.unit ?? record.unit) };
  return Object.keys(raw).length ? { ...base, kind: "observation_only", value: record.rawValue } : { ...base, kind: "unavailable" };
}
function referenceFor(record: StrongerEvidenceCandidate, kind: string) { const raw = object(record.rawValue); return kind === "evaluator" ? text(record.evaluatorReference) : kind === "session" ? text(raw?.sessionId) ?? text(raw?.measurementSessionId) : kind === "specimen" ? text(raw?.specimenReference) : text(object(raw?.instrument)?.instrumentReference); }
function isRelevant(record: StrongerEvidenceCandidate, construct: string) { return record.attributeKey === construct || object(record.rawValue)?.dimensionKey === construct; }
function object(value: unknown): Record<string, unknown> | undefined { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined; }
function text(value: unknown): string | undefined { return typeof value === "string" && value.trim().length && !value.includes("<") ? value : undefined; }
function strings(values: readonly unknown[]) { return [...new Set(values.flatMap(value => text(value) ? [text(value)!] : []))].sort(); }
function sorted(values: readonly StrongerEvidenceReasonCode[]) { return [...new Set(values)].sort(); }
function date(value: unknown): string | undefined { if (!(typeof value === "string" || value instanceof Date)) return undefined; const parsed = new Date(value); return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : undefined; }
function isRelationshipKind(value: string): value is "evaluator" | "session" | "specimen" | "instrument" { return ["evaluator", "session", "specimen", "instrument"].includes(value); }
