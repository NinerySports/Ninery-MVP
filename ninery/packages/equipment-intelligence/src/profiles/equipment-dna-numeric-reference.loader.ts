import type { EquipmentDNAAttributeKey } from "../attributes/index.js";
import type { EquipmentDNAEvaluatorType, EquipmentJsonValue } from "../evidence/index.js";
import type { CanonicalEquipmentDNAAttributeValue, CanonicalEquipmentDNAProfile } from "./canonical-equipment-dna-profile.types.js";
import {
  EQUIPMENT_DNA_NUMERIC_REFERENCE_MAPPING_VERSION,
  EQUIPMENT_DNA_NUMERIC_REFERENCE_MODEL_VERSION,
  type EquipmentDNAAttributeNumericReference,
  type EquipmentDNANumericReference,
  type EquipmentDNANumericReferenceEvaluatorType,
  type EquipmentDNANumericReferenceProfile
} from "./equipment-dna-numeric-reference.types.js";
import {
  isEquipmentDNANumericReferenceSupported,
  supportedNumericReferenceAttributes,
  unsupportedNumericReferenceAttributes,
  validateEquipmentDNANumericReference
} from "./equipment-dna-numeric-reference.validation.js";

export class EquipmentDNANumericReferenceError extends Error {}
export class EquipmentDNANumericReferenceUnsupportedAttributeError extends EquipmentDNANumericReferenceError {}
export class EquipmentDNANumericReferenceInvalidEvidenceError extends EquipmentDNANumericReferenceError {}

export function loadEquipmentDNANumericReferenceProfile(
  profile: CanonicalEquipmentDNAProfile
): EquipmentDNANumericReferenceProfile {
  const references = profile.attributes
    .filter((attribute) => isRelevantNumericReferenceAttribute(attribute.key))
    .map(loadAttributeNumericReference)
    .sort(compareAttributeReferences);

  return {
    version: EQUIPMENT_DNA_NUMERIC_REFERENCE_MODEL_VERSION,
    equipmentId: profile.equipmentId,
    equipmentVariantId: profile.equipmentVariantId,
    equipmentName: profile.equipmentName,
    variantLabel: profile.variantLabel,
    supportedAttributes: supportedNumericReferenceAttributes,
    unsupportedAttributes: unsupportedNumericReferenceAttributes,
    references,
    availableCount: references.filter((reference) => reference.numericReference).length,
    supportedCount: references.filter((reference) => reference.supported === "supported").length,
    validCount: references.filter((reference) => reference.validationStatus === "pass").length,
    invalidCount: references.filter((reference) => reference.validationStatus === "fail").length,
    missingCount: references.filter((reference) => reference.validationStatus === "missing").length,
    generatedAt: profile.generatedAt
  };
}

export function loadAttributeNumericReference(
  attribute: CanonicalEquipmentDNAAttributeValue
): EquipmentDNAAttributeNumericReference {
  if (!isEquipmentDNANumericReferenceSupported(attribute.key)) {
    return {
      attributeKey: attribute.key,
      ordinalValue: attribute.value,
      supported: "unsupported",
      validationStatus: "unsupported",
      reasons: [`${attribute.key} is not supported by Numeric Reference Model v${EQUIPMENT_DNA_NUMERIC_REFERENCE_MODEL_VERSION}.`]
    };
  }

  const numericReference = extractNumericReference(attribute);
  const validation = validateEquipmentDNANumericReference({
    attributeKey: attribute.key,
    ordinalValue: attribute.value,
    numericReference,
    previousConfidence: attribute.confidence
  });

  return {
    attributeKey: attribute.key,
    ordinalValue: attribute.value,
    supported: "supported",
    numericReference,
    validationStatus: validation.status,
    reasons: validation.valid ? ["Numeric reference is present, provenance-backed, and ordinal-consistent."] : validation.reasons
  };
}

export function requireSupportedEquipmentDNANumericReferenceAttribute(attributeKey: EquipmentDNAAttributeKey): void {
  if (!isEquipmentDNANumericReferenceSupported(attributeKey)) {
    throw new EquipmentDNANumericReferenceUnsupportedAttributeError(`${attributeKey} is not supported by Numeric Reference Model v${EQUIPMENT_DNA_NUMERIC_REFERENCE_MODEL_VERSION}.`);
  }
}

function extractNumericReference(attribute: CanonicalEquipmentDNAAttributeValue): EquipmentDNANumericReference | undefined {
  const derivedEvidence = attribute.evidence.find((evidence) => {
    return evidence.status === "active" && evidence.sourceType === "internal_derived" && hasNumericMetadata(evidence.rawValue);
  });
  if (!derivedEvidence || !hasNumericMetadata(derivedEvidence.rawValue)) return undefined;

  const raw = derivedEvidence.rawValue;
  const numericValue = raw.normalizedScore ?? raw.sourceScore;
  if (typeof numericValue !== "number") {
    throw new EquipmentDNANumericReferenceInvalidEvidenceError(`${attribute.key} numeric reference evidence did not contain a numeric score.`);
  }

  return {
    numericValue,
    scale: "0_100",
    referenceMethod: raw.referenceMethod === "derived_from_evaluation" || raw.referenceMethod === "structured_evaluation" || raw.referenceMethod === "manual_expert_review"
      ? raw.referenceMethod
      : "legacy_preserved",
    confidence: attribute.confidence,
    evaluatorType: mapEvaluatorType(derivedEvidence.evaluatorType),
    mappingVersion: EQUIPMENT_DNA_NUMERIC_REFERENCE_MAPPING_VERSION,
    generatedAt: attribute.evaluatedAt,
    sourceEvidenceRecordId: derivedEvidence.evidenceRecordId,
    sourceReference: derivedEvidence.sourceReference,
    sourceScore: typeof raw.sourceScore === "number" ? raw.sourceScore : undefined
  };
}

function hasNumericMetadata(value: EquipmentJsonValue | undefined): value is {
  readonly sourceScore?: number;
  readonly normalizedScore?: number;
  readonly referenceMethod?: string;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as { readonly sourceScore?: unknown; readonly normalizedScore?: unknown };
  return typeof candidate.normalizedScore === "number" || typeof candidate.sourceScore === "number";
}

function mapEvaluatorType(evaluatorType: EquipmentDNAEvaluatorType | undefined): EquipmentDNANumericReferenceEvaluatorType {
  if (evaluatorType === "expert") return "expert";
  if (evaluatorType === "staff" || evaluatorType === "system") return "internal";
  return "derived";
}

function isRelevantNumericReferenceAttribute(attributeKey: EquipmentDNAAttributeKey): boolean {
  return (
    supportedNumericReferenceAttributes.includes(attributeKey as (typeof supportedNumericReferenceAttributes)[number]) ||
    unsupportedNumericReferenceAttributes.includes(attributeKey as (typeof unsupportedNumericReferenceAttributes)[number])
  );
}

function compareAttributeReferences(a: EquipmentDNAAttributeNumericReference, b: EquipmentDNAAttributeNumericReference): number {
  return numericReferenceOrder(a.attributeKey) - numericReferenceOrder(b.attributeKey);
}

function numericReferenceOrder(attributeKey: EquipmentDNAAttributeKey): number {
  const order = [
    "bat_control_support",
    "swing_effort",
    "forgiveness",
    "sweet_spot_support",
    "power_potential",
    "balance_profile",
    "predictability_support",
    "transition_difficulty",
    "confidence_building_potential"
  ];
  const index = order.indexOf(attributeKey);
  return index === -1 ? 999 : index;
}
