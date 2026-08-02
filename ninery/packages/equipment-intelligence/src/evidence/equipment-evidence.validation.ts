import {
  EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION,
  getEquipmentDNAAttributeDefinition,
  isEquipmentDNAAttributeKey,
  validateEquipmentDNAAttributeValue
} from "../attributes/index.js";
import type {
  EquipmentDNAAttributeEvaluation,
  EquipmentDNAEvidenceRecord,
  EquipmentEvidenceRequirementCompatibilityResult,
  EquipmentEvidenceValidationResult
} from "./equipment-evidence.types.js";
import {
  equipmentDNAEvaluationStatusValues,
  equipmentEvidenceStatusValues
} from "./equipment-evidence.types.js";

export function validateEquipmentDNAEvidenceRecord(
  evidence: EquipmentDNAEvidenceRecord
): EquipmentEvidenceValidationResult {
  const errors: string[] = [];
  const definition = getEquipmentDNAAttributeDefinition(evidence.attributeKey);

  if (!definition) {
    errors.push(`Unknown Equipment DNA attribute key: ${evidence.attributeKey}.`);
  }
  if (!evidence.attributeDefinitionVersion) {
    errors.push("Attribute definition version is required.");
  } else if (evidence.attributeDefinitionVersion !== EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION) {
    errors.push(`Unsupported attribute definition version: ${evidence.attributeDefinitionVersion}.`);
  }
  errors.push(...validateTargetLevel(evidence.targetLevel, evidence.equipmentId, evidence.equipmentVariantId));
  if (definition && definition.applicableLevel !== evidence.targetLevel) {
    errors.push(`${evidence.attributeKey} must be evaluated at ${definition.applicableLevel} level.`);
  }
  if (!evidence.sourceName.trim()) {
    errors.push("Evidence sourceName is required.");
  }
  if (!equipmentEvidenceStatusValues.includes(evidence.status)) {
    errors.push(`Invalid evidence status: ${evidence.status}.`);
  }
  if (evidence.sourceReference && containsSecretLikeValue(evidence.sourceReference)) {
    errors.push("Evidence sourceReference appears to contain secret material.");
  }

  return result(errors);
}

export function validateEquipmentDNAAttributeEvaluation(
  evaluation: EquipmentDNAAttributeEvaluation,
  evidenceRecords: readonly EquipmentDNAEvidenceRecord[] = []
): EquipmentEvidenceValidationResult {
  const errors: string[] = [];
  const definition = getEquipmentDNAAttributeDefinition(evaluation.attributeKey);

  if (!definition) {
    errors.push(`Unknown Equipment DNA attribute key: ${evaluation.attributeKey}.`);
  }
  if (!evaluation.attributeDefinitionVersion) {
    errors.push("Attribute definition version is required.");
  } else if (evaluation.attributeDefinitionVersion !== EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION) {
    errors.push(`Unsupported attribute definition version: ${evaluation.attributeDefinitionVersion}.`);
  }
  errors.push(...validateTargetLevel(evaluation.targetLevel, evaluation.equipmentId, evaluation.equipmentVariantId));
  if (definition && definition.applicableLevel !== evaluation.targetLevel) {
    errors.push(`${evaluation.attributeKey} must be evaluated at ${definition.applicableLevel} level.`);
  }
  if (definition && definition.status === "deprecated" && evaluation.status === "active") {
    errors.push(`${evaluation.attributeKey} is deprecated and cannot receive an active evaluation.`);
  }
  if (!equipmentDNAEvaluationStatusValues.includes(evaluation.status)) {
    errors.push(`Invalid evaluation status: ${evaluation.status}.`);
  }
  if (isEquipmentDNAAttributeKey(evaluation.attributeKey)) {
    const valueResult = validateEquipmentDNAAttributeValue(evaluation.attributeKey, evaluation.value);
    if (!valueResult.valid) {
      errors.push(...valueResult.errors);
    }
  }
  if (evaluation.status === "active") {
    if (evidenceRecords.filter((evidence) => evidence.status === "active").length === 0) {
      errors.push("Active evaluations require at least one active supporting evidence record.");
    }
    if (!evaluation.rationale?.trim()) {
      errors.push("Active evaluations require a non-empty rationale.");
    }
  }

  return result(errors);
}

export function assessEvidenceRequirementCompatibility(
  attributeKey: string,
  evidenceRecords: readonly EquipmentDNAEvidenceRecord[]
): EquipmentEvidenceRequirementCompatibilityResult {
  const definition = getEquipmentDNAAttributeDefinition(attributeKey);
  const activeEvidence = evidenceRecords.filter((evidence) => evidence.status === "active");
  const reasons: string[] = [];

  if (!definition) {
    return {
      compatible: false,
      reasons: [`Unknown Equipment DNA attribute key: ${attributeKey}.`]
    };
  }
  if (activeEvidence.length === 0) {
    return {
      compatible: false,
      reasons: ["No active evidence is attached."]
    };
  }

  const hasManufacturerSpec = activeEvidence.some(
    (evidence) => evidence.sourceType === "manufacturer_specification" && evidence.method === "direct_specification"
  );
  const hasObjectiveMeasurement = activeEvidence.some(
    (evidence) => evidence.sourceType === "objective_measurement" && evidence.method === "instrument_measurement"
  );
  const hasStructuredEvaluation = activeEvidence.some(
    (evidence) =>
      evidence.sourceType === "structured_expert_evaluation" ||
      evidence.method === "standardized_rubric" ||
      evidence.method === "multi_evaluator_consensus"
  );
  const activeSourceTypes = new Set(activeEvidence.map((evidence) => evidence.sourceType));
  const independentSourceCount = activeSourceTypes.size;

  switch (definition.evidenceRequirement) {
    case "manufacturer_specification":
      if (hasManufacturerSpec) {
        return { compatible: true, reasons: ["Manufacturer specification evidence satisfies this requirement."] };
      }
      reasons.push("A direct manufacturer specification is required.");
      break;
    case "objective_measurement":
      if (hasObjectiveMeasurement) {
        return { compatible: true, reasons: ["Objective measurement evidence satisfies this requirement."] };
      }
      reasons.push("Objective measurement evidence is required.");
      break;
    case "structured_evaluation":
      if (hasStructuredEvaluation) {
        return { compatible: true, reasons: ["Structured evaluation evidence satisfies this requirement."] };
      }
      reasons.push("A standardized rubric, consensus review, or structured expert evaluation is required.");
      break;
    case "combined_evidence":
      if (hasStructuredEvaluation && independentSourceCount >= 2) {
        return {
          compatible: true,
          reasons: ["Combined evidence includes structured evaluation and at least two independent source types."]
        };
      }
      reasons.push("Combined evidence requires structured evaluation plus at least two independent source types.");
      break;
  }

  return {
    compatible: false,
    reasons
  };
}

export function nextEvaluationVersion(existing: readonly EquipmentDNAAttributeEvaluation[]): number {
  return Math.max(0, ...existing.map((evaluation) => evaluation.evaluationVersion)) + 1;
}

function validateTargetLevel(targetLevel: string, equipmentId?: string, equipmentVariantId?: string): string[] {
  const errors: string[] = [];
  if (targetLevel !== "equipment" && targetLevel !== "variant") {
    errors.push(`Invalid target level: ${targetLevel}.`);
  }
  if (!equipmentId && !equipmentVariantId) {
    errors.push("Evidence and evaluations require either equipmentId or equipmentVariantId.");
  }
  if (equipmentId && equipmentVariantId) {
    errors.push("Evidence and evaluations must target either equipment or variant, not both.");
  }
  if (targetLevel === "equipment" && !equipmentId) {
    errors.push("Equipment-level records require equipmentId.");
  }
  if (targetLevel === "variant" && !equipmentVariantId) {
    errors.push("Variant-level records require equipmentVariantId.");
  }
  return errors;
}

function containsSecretLikeValue(value: string): boolean {
  return /(password|token|secret|apikey|api_key|authorization)=/i.test(value);
}

function result(errors: string[]): EquipmentEvidenceValidationResult {
  return {
    valid: errors.length === 0,
    errors
  };
}
