import type {
  EquipmentDNAAttributeKey,
  EquipmentDNAAttributeNormalizedValue
} from "../attributes/index.js";
import type { EquipmentAttributeConfidence } from "../evidence/index.js";

export const EQUIPMENT_DNA_NUMERIC_REFERENCE_MODEL_VERSION = "1.0";
export const EQUIPMENT_DNA_NUMERIC_REFERENCE_MAPPING_VERSION = "1.0";

export type EquipmentDNANumericReferenceScale = "0_100";

export type EquipmentDNANumericReferenceMethod =
  | "structured_evaluation"
  | "derived_from_evaluation"
  | "legacy_preserved"
  | "manual_expert_review";

export type EquipmentDNANumericReferenceEvaluatorType = "expert" | "internal" | "derived";

export type EquipmentDNANumericReferenceSupportStatus = "supported" | "unsupported";

export type EquipmentDNANumericReferenceValidationStatus = "pass" | "fail" | "missing" | "unsupported";

export type EquipmentDNANumericReference = {
  readonly numericValue: number;
  readonly scale: EquipmentDNANumericReferenceScale;
  readonly referenceMethod: EquipmentDNANumericReferenceMethod;
  readonly confidence: EquipmentAttributeConfidence;
  readonly evaluatorType: EquipmentDNANumericReferenceEvaluatorType;
  readonly mappingVersion: typeof EQUIPMENT_DNA_NUMERIC_REFERENCE_MAPPING_VERSION;
  readonly generatedAt: Date;
  readonly sourceEvidenceRecordId?: string;
  readonly sourceReference?: string;
  readonly sourceScore?: number;
};

export type EquipmentDNANumericReferenceCandidate = Omit<
  EquipmentDNANumericReference,
  "scale" | "referenceMethod" | "confidence" | "evaluatorType" | "mappingVersion"
> & {
  readonly scale: string;
  readonly referenceMethod: string;
  readonly confidence: string;
  readonly evaluatorType: string;
  readonly mappingVersion: string;
};

export type EquipmentDNAAttributeNumericReference = {
  readonly attributeKey: EquipmentDNAAttributeKey;
  readonly ordinalValue: EquipmentDNAAttributeNormalizedValue;
  readonly supported: EquipmentDNANumericReferenceSupportStatus;
  readonly numericReference?: EquipmentDNANumericReference;
  readonly validationStatus: EquipmentDNANumericReferenceValidationStatus;
  readonly reasons: readonly string[];
};

export type EquipmentDNANumericReferenceProfile = {
  readonly version: typeof EQUIPMENT_DNA_NUMERIC_REFERENCE_MODEL_VERSION;
  readonly equipmentId: string;
  readonly equipmentVariantId?: string;
  readonly equipmentName: string;
  readonly variantLabel?: string;
  readonly supportedAttributes: readonly EquipmentDNAAttributeKey[];
  readonly unsupportedAttributes: readonly EquipmentDNAAttributeKey[];
  readonly references: readonly EquipmentDNAAttributeNumericReference[];
  readonly availableCount: number;
  readonly supportedCount: number;
  readonly validCount: number;
  readonly invalidCount: number;
  readonly missingCount: number;
  readonly generatedAt: Date;
};

export type EquipmentDNANumericReferenceValidationInput = {
  readonly attributeKey: EquipmentDNAAttributeKey;
  readonly ordinalValue: EquipmentDNAAttributeNormalizedValue;
  readonly numericReference?: EquipmentDNANumericReference | EquipmentDNANumericReferenceCandidate;
  readonly previousConfidence?: EquipmentAttributeConfidence;
  readonly confidenceChangeExplanation?: string;
};

export type EquipmentDNANumericReferenceValidationResult = {
  readonly valid: boolean;
  readonly status: EquipmentDNANumericReferenceValidationStatus;
  readonly reasons: readonly string[];
};
