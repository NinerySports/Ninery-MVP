import type { PhysicalMeasurementEvidenceRecord } from "./physical-measurement-protocol.types.js";

export type PersistedPhysicalMeasurementEvidence = {
  readonly id: string;
  readonly sourceReference: string | null;
  readonly equipmentId: string | null;
  readonly equipmentVariantId: string | null;
  readonly attributeKey: string;
  readonly sourceDate: Date | string | null;
  readonly unit: string | null;
  readonly evaluatorReference: string | null;
  readonly rawValue: unknown;
  readonly normalizedValue: unknown;
};

export type PhysicalMeasurementEvidenceDifference = { readonly field: string; readonly persisted: unknown; readonly generated: unknown };

export function comparePhysicalMeasurementEvidence(persisted: PersistedPhysicalMeasurementEvidence, generated: PhysicalMeasurementEvidenceRecord): readonly PhysicalMeasurementEvidenceDifference[] {
  const pairs: readonly [string, unknown, unknown][] = [
    ["id", persisted.id, generated.id],
    ["sourceReference", persisted.sourceReference, generated.sourceReference],
    ["equipmentId", persisted.equipmentId, generated.equipmentId],
    ["equipmentVariantId", persisted.equipmentVariantId, generated.equipmentVariantId],
    ["attributeKey", persisted.attributeKey, generated.attributeKey],
    ["sourceDate", dateValue(persisted.sourceDate), dateValue(generated.sourceDate)],
    ["unit", persisted.unit, generated.unit],
    ["evaluatorReference", persisted.evaluatorReference, generated.operatorId],
    ["rawValue", persisted.rawValue, generated.rawValue],
    ["normalizedValue", persisted.normalizedValue, generated.normalizedValue]
  ];
  return pairs.flatMap(([field, left, right]) => semanticJson(left) === semanticJson(right) ? [] : [{ field, persisted: left, generated: right }]);
}

export function physicalMeasurementEvidenceIsSemanticallyEqual(persisted: PersistedPhysicalMeasurementEvidence, generated: PhysicalMeasurementEvidenceRecord) {
  return comparePhysicalMeasurementEvidence(persisted, generated).length === 0;
}

export function semanticJson(value: unknown): string { return JSON.stringify(canonicalize(value)); }

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([, child]) => child !== undefined).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, canonicalize(child)]));
  if (typeof value === "number" && Number.isFinite(value)) return Number(value.toPrecision(15));
  return value;
}

function dateValue(value: Date | string | null) { return value === null ? null : new Date(value).toISOString(); }
