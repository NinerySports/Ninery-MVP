import type {
  EquipmentDNAAttributeKey,
  EquipmentDNAAttributeNormalizedValue
} from "../attributes/index.js";
import type { Prisma } from "@prisma/client";

export type EquipmentJsonValue = Prisma.JsonValue;

export const equipmentEvidenceSourceTypeValues = [
  "manufacturer_specification",
  "objective_measurement",
  "structured_expert_evaluation",
  "player_feedback",
  "parent_feedback",
  "coach_feedback",
  "field_observation",
  "historical_outcome",
  "internal_derived",
  "other"
] as const;

export type EquipmentEvidenceSourceType = (typeof equipmentEvidenceSourceTypeValues)[number];

export const equipmentEvidenceStatusValues = ["active", "superseded", "disputed", "withdrawn"] as const;

export type EquipmentEvidenceStatus = (typeof equipmentEvidenceStatusValues)[number];

export const equipmentEvaluationMethodValues = [
  "direct_specification",
  "instrument_measurement",
  "standardized_rubric",
  "multi_evaluator_consensus",
  "structured_feedback",
  "derived_mapping",
  "manual_review"
] as const;

export type EquipmentEvaluationMethod = (typeof equipmentEvaluationMethodValues)[number];

export const equipmentAttributeConfidenceValues = ["validated", "high", "moderate", "estimated"] as const;

export type EquipmentAttributeConfidence = (typeof equipmentAttributeConfidenceValues)[number];

export const equipmentDNAMaturityLevelValues = [
  "basic",
  "evaluated",
  "validated",
  "trusted",
  "living_intelligence"
] as const;

export type EquipmentDNAMaturityLevel = (typeof equipmentDNAMaturityLevelValues)[number];

export const equipmentDNAEvaluationStatusValues = ["draft", "active", "superseded", "rejected"] as const;

export type EquipmentDNAEvaluationStatus = (typeof equipmentDNAEvaluationStatusValues)[number];

export const equipmentDNAEvaluatorTypeValues = ["system", "staff", "expert", "external"] as const;

export type EquipmentDNAEvaluatorType = (typeof equipmentDNAEvaluatorTypeValues)[number];

export type EquipmentDNATargetLevel = "equipment" | "variant";

export type EquipmentDNAEvidenceRecord = {
  id?: string;
  equipmentId?: string;
  equipmentVariantId?: string;
  targetLevel: EquipmentDNATargetLevel;
  attributeKey: EquipmentDNAAttributeKey | string;
  attributeDefinitionVersion: string;
  sourceType: EquipmentEvidenceSourceType;
  sourceName: string;
  sourceReference?: string;
  sourceDate?: Date;
  retrievedAt?: Date;
  method: EquipmentEvaluationMethod;
  rawValue?: EquipmentJsonValue;
  normalizedValue?: EquipmentJsonValue;
  unit?: string;
  notes?: string;
  status: EquipmentEvidenceStatus;
  evaluatorType?: EquipmentDNAEvaluatorType;
  evaluatorReference?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type EquipmentDNAAttributeEvaluation = {
  id?: string;
  equipmentId?: string;
  equipmentVariantId?: string;
  targetLevel: EquipmentDNATargetLevel;
  attributeKey: EquipmentDNAAttributeKey | string;
  attributeDefinitionVersion: string;
  value: EquipmentDNAAttributeNormalizedValue;
  confidence: EquipmentAttributeConfidence;
  evaluationMethod: EquipmentEvaluationMethod;
  evaluationVersion: number;
  status: EquipmentDNAEvaluationStatus;
  rationale?: string;
  evaluatedAt?: Date;
  reviewDueAt?: Date;
  supersedesEvaluationId?: string;
  createdAt?: Date;
  updatedAt?: Date;
  evidenceRecords?: EquipmentDNAEvidenceRecord[];
};

export type EquipmentDNAEvaluationActivationInput = {
  evaluation: EquipmentDNAAttributeEvaluation;
  evidenceRecords: EquipmentDNAEvidenceRecord[];
  currentEvaluation?: EquipmentDNAAttributeEvaluation;
};

export type EquipmentEvidenceValidationResult = {
  valid: boolean;
  errors: string[];
};

export type EquipmentEvidenceRequirementCompatibilityResult = {
  compatible: boolean;
  reasons: string[];
};

export type EquipmentAttributeConfidenceAssessment = {
  confidence: EquipmentAttributeConfidence;
  reasons: string[];
};

export type EquipmentEvidenceConflict = {
  conflict: boolean;
  severity: "none" | "minor" | "material";
  reasons: string[];
};

export type EquipmentDNARecommendationReadinessAssessment = {
  ready: boolean;
  maturity: EquipmentDNAMaturityLevel;
  missingRequiredAttributes: EquipmentDNAAttributeKey[];
  insufficientConfidenceAttributes: EquipmentDNAAttributeKey[];
  invalidAttributes: EquipmentDNAAttributeKey[];
  experimentalAttributesIgnored: EquipmentDNAAttributeKey[];
  reasons: string[];
};

export type EquipmentDNAMaturityAssessment = {
  maturity: EquipmentDNAMaturityLevel;
  reasons: string[];
};
