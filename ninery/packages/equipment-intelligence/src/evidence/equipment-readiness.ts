import {
  type EquipmentDNAAttributeKey,
  getEquipmentDNAAttributeDefinition,
  getRequiredEquipmentDNAAttributeDefinitions,
  isEquipmentDNAAttributeKey,
  validateEquipmentDNAAttributeValue
} from "../attributes/index.js";
import { assessEquipmentAttributeConfidence, meetsMinimumConfidence } from "./equipment-confidence.js";
import { detectEquipmentEvidenceConflict } from "./equipment-conflict.js";
import { assessEquipmentDNAMaturity } from "./equipment-maturity.js";
import {
  assessEvidenceRequirementCompatibility,
  validateEquipmentDNAAttributeEvaluation
} from "./equipment-evidence.validation.js";
import type {
  EquipmentAttributeConfidence,
  EquipmentDNAAttributeEvaluation,
  EquipmentDNAEvidenceRecord,
  EquipmentDNARecommendationReadinessAssessment
} from "./equipment-evidence.types.js";

export const EQUIPMENT_DNA_READINESS_MODEL_VERSION = "1.0";

export function assessEquipmentDNARecommendationReadiness(input: {
  evaluations: readonly EquipmentDNAAttributeEvaluation[];
  evidenceRecords?: readonly EquipmentDNAEvidenceRecord[];
}): EquipmentDNARecommendationReadinessAssessment {
  const requiredDefinitions = getRequiredEquipmentDNAAttributeDefinitions();
  const activeEvaluations = input.evaluations.filter((evaluation) => evaluation.status === "active");
  const evidenceRecords =
    input.evidenceRecords ?? input.evaluations.flatMap((evaluation) => evaluation.evidenceRecords ?? []);
  const reasons: string[] = [`readiness model ${EQUIPMENT_DNA_READINESS_MODEL_VERSION}`];
  const missingRequiredAttributes: EquipmentDNAAttributeKey[] = [];
  const insufficientConfidenceAttributes: EquipmentDNAAttributeKey[] = [];
  const invalidAttributes: EquipmentDNAAttributeKey[] = [];
  const experimentalAttributesIgnored = activeEvaluations
    .filter((evaluation) => getEquipmentDNAAttributeDefinition(evaluation.attributeKey)?.status === "experimental")
    .map((evaluation) => evaluation.attributeKey)
    .filter(isEquipmentDNAAttributeKey);

  for (const definition of requiredDefinitions) {
    const evaluation = activeEvaluations.find((candidate) => candidate.attributeKey === definition.key);
    if (!evaluation) {
      missingRequiredAttributes.push(definition.key);
      reasons.push(`${definition.key} is missing an active evaluation.`);
      continue;
    }

    const supportingEvidence = evaluation.evidenceRecords ?? evidenceRecords.filter((evidence) => evidence.attributeKey === definition.key);
    const validation = validateEquipmentDNAAttributeEvaluation(evaluation, supportingEvidence);
    const valueValidation = validateEquipmentDNAAttributeValue(definition.key, evaluation.value);
    const requirement = assessEvidenceRequirementCompatibility(definition.key, supportingEvidence);
    const conflict = detectEquipmentEvidenceConflict({
      attributeKey: definition.key,
      evidenceRecords: supportingEvidence,
      proposedValue: evaluation.value
    });
    const confidenceAssessment = assessEquipmentAttributeConfidence({
      evidenceRecords: supportingEvidence,
      evaluation,
      conflict
    });
    const minimumConfidence = minimumConfidenceForRequiredAttribute(definition.key);

    if (!validation.valid || !valueValidation.valid || !requirement.compatible || conflict.severity === "material") {
      invalidAttributes.push(definition.key);
      reasons.push(...validation.errors, ...(!valueValidation.valid ? valueValidation.errors : []), ...requirement.reasons);
      if (conflict.severity === "material") {
        reasons.push(`${definition.key} has a material unresolved evidence conflict.`);
      }
      continue;
    }

    if (
      evaluation.confidence === "estimated" ||
      !meetsMinimumConfidence(evaluation.confidence, minimumConfidence) ||
      !meetsMinimumConfidence(confidenceAssessment.confidence, minimumConfidence)
    ) {
      insufficientConfidenceAttributes.push(definition.key);
      reasons.push(`${definition.key} does not meet minimum confidence ${minimumConfidence}.`);
    }
  }

  if (experimentalAttributesIgnored.length > 0) {
    reasons.push(`Experimental attributes ignored for readiness: ${experimentalAttributesIgnored.join(", ")}.`);
  }

  const maturity = assessEquipmentDNAMaturity({ evaluations: input.evaluations, evidenceRecords }).maturity;
  const ready =
    missingRequiredAttributes.length === 0 &&
    insufficientConfidenceAttributes.length === 0 &&
    invalidAttributes.length === 0;

  if (ready) {
    reasons.push("All required active evaluations are valid, supported, and meet confidence thresholds.");
  }

  return {
    ready,
    maturity,
    missingRequiredAttributes,
    insufficientConfidenceAttributes,
    invalidAttributes,
    experimentalAttributesIgnored,
    reasons
  };
}

export function minimumConfidenceForRequiredAttribute(attributeKey: string): EquipmentAttributeConfidence {
  const definition = getEquipmentDNAAttributeDefinition(attributeKey);
  if (definition?.attributeNature === "intrinsic" && definition.domain === "physical") {
    return "high";
  }
  return "moderate";
}
