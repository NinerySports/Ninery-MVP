import type {
  EquipmentDNAAttributeDomain,
  EquipmentDNAAttributeKey,
  EquipmentDNAAttributeNormalizedValue
} from "../attributes/index.js";
import type {
  EquipmentDNAEvaluatorType,
  EquipmentAttributeConfidence,
  EquipmentDNAEvaluationStatus,
  EquipmentDNAMaturityLevel,
  EquipmentDNATargetLevel,
  EquipmentEvaluationMethod,
  EquipmentEvidenceSourceType,
  EquipmentEvidenceStatus,
  EquipmentJsonValue
} from "../evidence/index.js";

export const CANONICAL_EQUIPMENT_DNA_PROFILE_VERSION = "1.0";

export type CanonicalEquipmentDNAProfileVersion = typeof CANONICAL_EQUIPMENT_DNA_PROFILE_VERSION;

export type CanonicalEquipmentDNAConflict = {
  readonly key: EquipmentDNAAttributeKey | string;
  readonly severity: "minor" | "material";
  readonly reasons: readonly string[];
};

export type CanonicalEquipmentDNAEvidenceSummary = {
  readonly evidenceRecordId: string;
  readonly sourceType: EquipmentEvidenceSourceType;
  readonly sourceName: string;
  readonly method: EquipmentEvaluationMethod;
  readonly status: EquipmentEvidenceStatus;
  readonly sourceReference?: string;
  readonly rawValue?: EquipmentJsonValue;
  readonly normalizedValue?: EquipmentJsonValue;
  readonly evaluatorType?: EquipmentDNAEvaluatorType;
  readonly evaluatorReference?: string;
};

export type CanonicalEquipmentDNAAttributeValue = {
  readonly key: EquipmentDNAAttributeKey;
  readonly definitionVersion: string;
  readonly domain: EquipmentDNAAttributeDomain;
  readonly targetLevel: EquipmentDNATargetLevel;
  readonly value: EquipmentDNAAttributeNormalizedValue;
  readonly confidence: EquipmentAttributeConfidence;
  readonly evaluationMethod: EquipmentEvaluationMethod;
  readonly evaluationVersion: number;
  readonly rationale: string;
  readonly evaluatedAt: Date;
  readonly evidence: readonly CanonicalEquipmentDNAEvidenceSummary[];
  readonly status: Extract<EquipmentDNAEvaluationStatus, "active">;
};

export type CanonicalEquipmentDNAReadinessResult = {
  readonly ready: boolean;
  readonly missingRequiredAttributes: readonly EquipmentDNAAttributeKey[];
  readonly insufficientConfidenceAttributes: readonly EquipmentDNAAttributeKey[];
  readonly invalidAttributes: readonly EquipmentDNAAttributeKey[];
  readonly experimentalAttributesIgnored: readonly EquipmentDNAAttributeKey[];
  readonly reasons: readonly string[];
};

export type CanonicalEquipmentDNAProfile = {
  readonly version: CanonicalEquipmentDNAProfileVersion;
  readonly equipmentId: string;
  readonly equipmentVariantId?: string;
  readonly equipmentName: string;
  readonly variantLabel?: string;
  readonly registryVersion: string;
  readonly confidenceModelVersion: string;
  readonly readinessModelVersion: string;
  readonly scoreMappingVersion: string;
  readonly readiness: CanonicalEquipmentDNAReadinessResult;
  readonly maturity: EquipmentDNAMaturityLevel;
  readonly attributes: readonly CanonicalEquipmentDNAAttributeValue[];
  readonly missingAttributes: readonly EquipmentDNAAttributeKey[];
  readonly invalidAttributes: readonly EquipmentDNAAttributeKey[];
  readonly conflicts: readonly CanonicalEquipmentDNAConflict[];
  readonly generatedAt: Date;
};
