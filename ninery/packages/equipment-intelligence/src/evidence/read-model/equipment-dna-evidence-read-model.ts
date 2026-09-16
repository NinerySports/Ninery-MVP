import { equipmentDNAConstructEvidenceMap, normalizePhysicalMeasurement } from "../equipment-multi-source-strategy.js";
import { multiSourceEvidenceClassValues, type MultiSourceEvidenceClass } from "../equipment-multi-source-strategy.types.js";
import type { EquipmentDNACatalogFactInput, EquipmentDNAConstructSupport, EquipmentDNAEvidenceIdentity, EquipmentDNAEvidenceItem, EquipmentDNAEvidenceReadModel, EquipmentDNAEvidenceRecordInput } from "./equipment-dna-evidence-read-model.types.js";

export const EQUIPMENT_DNA_EVIDENCE_READ_MODEL_VERSION = "1.0";

export function buildEquipmentDNAEvidenceReadModel(input: { readonly identity: EquipmentDNAEvidenceIdentity; readonly catalogFacts: readonly EquipmentDNACatalogFactInput[]; readonly records: readonly EquipmentDNAEvidenceRecordInput[] }): EquipmentDNAEvidenceReadModel {
  const catalog = input.catalogFacts.map((fact, index): EquipmentDNAEvidenceItem => ({
    id: `catalog:${fact.level}:${fact.key}:${index}`, evidenceClass: "verified_catalog_fact", claimKey: fact.key, recordAttributeKey: fact.key,
    knowledgeLevel: fact.level, targetLevel: fact.level, equipmentId: input.identity.equipmentId,
    equipmentVariantId: fact.level === "variant" ? input.identity.variant?.id : undefined,
    method: "direct_specification", unit: fact.unit, sourceName: fact.sourceName, sourceReference: fact.sourceReference,
    sourceDate: iso(fact.verifiedAt), rawObservation: { value: fact.value, unit: fact.unit }, normalizedRepresentation: { value: fact.value, unit: fact.unit },
    limitations: ["Catalog fact describes the product or nominal variant specification; it is not a specimen measurement."], status: "active"
  }));
  const persisted = input.records.map(toEvidenceItem).sort(compareEvidence);
  const evidence = [...catalog, ...persisted].sort(compareEvidence);
  const evidenceByClass: EquipmentDNAEvidenceReadModel["evidenceByClass"] = {
    verified_catalog_fact: evidence.filter((item) => item.evidenceClass === "verified_catalog_fact"),
    direct_physical_measurement: evidence.filter((item) => item.evidenceClass === "direct_physical_measurement"),
    controlled_mechanical_test: evidence.filter((item) => item.evidenceClass === "controlled_mechanical_test"),
    structured_human_evaluation: evidence.filter((item) => item.evidenceClass === "structured_human_evaluation"),
    structured_field_observation: evidence.filter((item) => item.evidenceClass === "structured_field_observation"),
    modeled_estimate: evidence.filter((item) => item.evidenceClass === "modeled_estimate")
  };
  const counts: EquipmentDNAEvidenceReadModel["evidenceClassCounts"] = {
    verified_catalog_fact: evidenceByClass.verified_catalog_fact.length,
    direct_physical_measurement: evidenceByClass.direct_physical_measurement.length,
    controlled_mechanical_test: evidenceByClass.controlled_mechanical_test.length,
    structured_human_evaluation: evidenceByClass.structured_human_evaluation.length,
    structured_field_observation: evidenceByClass.structured_field_observation.length,
    modeled_estimate: evidenceByClass.modeled_estimate.length
  };
  return {
    version: EQUIPMENT_DNA_EVIDENCE_READ_MODEL_VERSION, identity: input.identity, evidence, evidenceByClass, evidenceClassCounts: counts,
    missingEvidenceClasses: multiSourceEvidenceClassValues.filter((evidenceClass) => counts[evidenceClass] === 0),
    constructSupport: equipmentDNAConstructEvidenceMap.map((strategy) => constructSupport(strategy, evidence)),
    differences: describeCatalogSpecimenDifferences(evidence),
    firewalls: { canonicalChanges: false, numericReferenceChanges: false, modeledEstimatesCreated: false, recommendationImpact: "none", writesPerformed: false }
  };
}

function toEvidenceItem(record: EquipmentDNAEvidenceRecordInput): EquipmentDNAEvidenceItem {
  const raw = object(record.rawValue); const normalized = object(record.normalizedValue);
  const evidenceClass = classifyEvidenceClass(record);
  const specimenReference = string(raw.specimenReference);
  const sessionReference = string(raw.measurementSessionId) ?? string(raw.sessionId) ?? sessionFromSource(record.sourceReference);
  const protocolVersion = string(raw.protocolVersion);
  const observedAggregate = raw.observedAggregate ?? raw.aggregate ?? raw.aggregateValue ?? raw.median;
  const hasDistinctDerivation = normalized.derived === true && (typeof normalized.derivationMethod === "string" || normalized.observedUnit !== normalized.unit);
  const derived = hasDistinctDerivation ? { quantity: string(normalized.derivedQuantity), method: string(normalized.derivationMethod), value: normalized.value, independentMeasurement: false as const } : undefined;
  return {
    id: record.id, evidenceClass, claimKey: evidenceClass === "structured_human_evaluation" ? string(raw.dimensionKey) ?? record.attributeKey : record.attributeKey, recordAttributeKey: record.attributeKey,
    knowledgeLevel: evidenceClass === "direct_physical_measurement" && specimenReference ? "specimen" : record.targetLevel,
    targetLevel: record.targetLevel, equipmentId: record.equipmentId ?? "unscoped", equipmentVariantId: record.equipmentVariantId,
    specimenReference, sessionReference,
    protocolIdentity: string(raw.protocol) ?? string(raw.questionnaireVersion), protocolVersion,
    method: string(raw.method) ?? record.method, unit: record.unit, sourceName: record.sourceName, sourceReference: record.sourceReference,
    sourceDate: iso(record.sourceDate), operatorOrEvaluatorReference: record.evaluatorReference,
    rawObservation: record.rawValue, aggregate: observedAggregate, normalizedRepresentation: record.normalizedValue ?? raw.observation, derivation: derived,
    limitations: arrayOfStrings(raw.limitations, record.notes), qualityState: string(raw.quality),
    independenceGroup: record.evaluatorReference ?? specimenReference ?? sessionReference, status: record.status
  };
}

function classifyEvidenceClass(record: EquipmentDNAEvidenceRecordInput): MultiSourceEvidenceClass {
  if (record.sourceType === "manufacturer_specification") return "verified_catalog_fact";
  if (record.sourceType === "objective_measurement") return "direct_physical_measurement";
  if (record.sourceType === "structured_expert_evaluation") return "structured_human_evaluation";
  if (["player_feedback", "parent_feedback", "coach_feedback", "field_observation"].includes(record.sourceType)) return "structured_field_observation";
  if (record.sourceType === "internal_derived") return "modeled_estimate";
  return record.method === "instrument_measurement" ? "controlled_mechanical_test" : "modeled_estimate";
}

function constructSupport(strategy: (typeof equipmentDNAConstructEvidenceMap)[number], evidence: readonly EquipmentDNAEvidenceItem[]): EquipmentDNAConstructSupport {
  const relevant = multiSourceEvidenceClassValues.filter((evidenceClass) => strategy.sourceRoles[evidenceClass] !== "not_applicable" && strategy.sourceRoles[evidenceClass] !== "unknown");
  const matches = evidence.filter((item) => item.claimKey === strategy.construct && relevant.includes(item.evidenceClass));
  const classes = unique(matches.map((item) => item.evidenceClass));
  const reviewReasons = matches.some((item) => ["disputed", "withdrawn"].includes(item.status)) ? ["Evidence status requires review."] : [];
  const state = reviewReasons.length ? "review_required" : matches.length === 0 ? "no_evidence" : classes.length > 1 ? "mixed_evidence" : unique(matches.map((item) => item.independenceGroup).filter(Boolean)).length > 1 ? "multiple_source_support" : "single_source_support";
  return { construct: strategy.construct, lifecycle: strategy.lifecycle, canonicalAttribute: strategy.canonicalAttribute, relevantEvidenceClasses: relevant.map((evidenceClass) => ({ evidenceClass, role: strategy.sourceRoles[evidenceClass] })), evidence: matches, missingRelevantEvidenceClasses: relevant.filter((evidenceClass) => !classes.includes(evidenceClass)), sourceCount: unique(matches.map((item) => item.independenceGroup ?? item.sourceReference ?? item.id)).length, sessionCount: unique(matches.map((item) => item.sessionReference).filter(Boolean)).length, specimenCount: unique(matches.map((item) => item.specimenReference).filter(Boolean)).length, evidenceClassesRepresented: classes, supportState: state, synthesisSufficient: false, reviewReasons };
}

function describeCatalogSpecimenDifferences(evidence: readonly EquipmentDNAEvidenceItem[]) {
  const pairs = [{ catalog: "weight", specimen: "actual_mass", canonicalUnit: "grams" }, { catalog: "length", specimen: "overall_length", canonicalUnit: "millimeters" }, { catalog: "barrel_diameter", specimen: "barrel_diameter", canonicalUnit: "millimeters" }] as const;
  return pairs.flatMap(({ catalog, specimen, canonicalUnit }) => {
    const catalogItems = evidence.filter((item) => item.evidenceClass === "verified_catalog_fact" && item.claimKey === catalog);
    const specimenItems = evidence.filter((item) => item.evidenceClass === "direct_physical_measurement" && item.claimKey === specimen);
    if (!catalogItems.length && !specimenItems.length) return [];
    const comparable = catalogItems.flatMap((item) => comparableValue(item, canonicalUnit)).flatMap((catalogValue) => specimenItems.flatMap((item) => comparableValue(item, canonicalUnit)).map((specimenValue) => ({ catalogValue, specimenValue })));
    const exact = comparable.some(({ catalogValue, specimenValue }) => catalogValue === specimenValue);
    const state = !catalogItems.length || !specimenItems.length || !comparable.length ? "no_comparable_evidence" as const : exact ? "consistent_or_no_material_difference" as const : "descriptive_difference" as const;
    const explanation = state === "consistent_or_no_material_difference" ? `Catalog and specimen values are exactly equivalent after deterministic conversion to ${canonicalUnit}; no tolerance was applied.` : state === "descriptive_difference" ? "Comparable catalog and specimen values are not exactly equivalent. They remain separate claims, and no calibrated materiality threshold is applied, so this is not automatically a conflict." : "Comparable scalar values and supported units are required on both sides.";
    return [{ key: `${catalog}:${specimen}`, state, explanation, catalogEvidenceIds: catalogItems.map((item) => item.id), specimenEvidenceIds: specimenItems.map((item) => item.id) }];
  });
}

function comparableValue(item: EquipmentDNAEvidenceItem, canonicalUnit: string): readonly number[] {
  const representation = object(item.normalizedRepresentation);
  const observation = object(item.rawObservation);
  const value = number(representation.value) ?? number(item.normalizedRepresentation) ?? number(item.aggregate) ?? number(observation.value);
  const unit = normalizeUnit(string(representation.unit) ?? itemUnit(item) ?? string(observation.unit));
  if (value === undefined || !unit) return [];
  try { return [normalizePhysicalMeasurement(value, unit, canonicalUnit).normalizedValue]; } catch { return []; }
}

function itemUnit(item: EquipmentDNAEvidenceItem) { return normalizeUnit(item.unit); }
function normalizeUnit(unit?: string) { const aliases: Record<string, string> = { in: "inches", inch: "inches", inches: "inches", mm: "millimeters", millimeter: "millimeters", millimeters: "millimeters", oz: "ounces", ounce: "ounces", ounces: "ounces", g: "grams", gram: "grams", grams: "grams" }; return unit ? aliases[unit.toLowerCase()] : undefined; }

function object(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function string(value: unknown): string | undefined { return typeof value === "string" && value.length ? value : undefined; }
function number(value: unknown): number | undefined { return typeof value === "number" && Number.isFinite(value) ? value : undefined; }
function iso(value: Date | string | undefined): string | undefined { return value ? new Date(value).toISOString() : undefined; }
function arrayOfStrings(value: unknown, fallback?: string): readonly string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : fallback ? [fallback] : []; }
function sessionFromSource(value?: string) { const match = value?.match(/^(?:physical-bat-evaluation:[^:]+:|physical-measurement:)([^:]+)/); return match?.[1]; }
function unique<T>(values: readonly T[]): T[] { return [...new Set(values)]; }
function compareEvidence(left: EquipmentDNAEvidenceItem, right: EquipmentDNAEvidenceItem) { return left.evidenceClass.localeCompare(right.evidenceClass) || left.claimKey.localeCompare(right.claimKey) || left.id.localeCompare(right.id); }
