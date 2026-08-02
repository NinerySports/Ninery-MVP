import type {
  EquipmentAttributeConfidence,
  EquipmentAttributeConfidenceAssessment,
  EquipmentDNAAttributeEvaluation,
  EquipmentDNAEvidenceRecord,
  EquipmentEvidenceConflict
} from "./equipment-evidence.types.js";

export const EQUIPMENT_ATTRIBUTE_CONFIDENCE_MODEL_VERSION = "1.0";

const confidenceRank: Record<EquipmentAttributeConfidence, number> = {
  estimated: 0,
  moderate: 1,
  high: 2,
  validated: 3
};

export function assessEquipmentAttributeConfidence(input: {
  evidenceRecords: readonly EquipmentDNAEvidenceRecord[];
  evaluation?: EquipmentDNAAttributeEvaluation;
  conflict?: EquipmentEvidenceConflict;
}): EquipmentAttributeConfidenceAssessment {
  const activeEvidence = input.evidenceRecords.filter((evidence) => evidence.status === "active");
  const disputedEvidence = input.evidenceRecords.filter((evidence) => evidence.status === "disputed");
  const reasons: string[] = [`confidence model ${EQUIPMENT_ATTRIBUTE_CONFIDENCE_MODEL_VERSION}`];

  if (input.conflict?.severity === "material") {
    return {
      confidence: "estimated",
      reasons: [...reasons, "Material evidence conflict prevents automatic confidence above estimated."]
    };
  }
  if (disputedEvidence.length > 0) {
    return {
      confidence: "estimated",
      reasons: [...reasons, "Disputed evidence prevents automatic confidence above estimated."]
    };
  }
  if (activeEvidence.length === 0) {
    return {
      confidence: "estimated",
      reasons: [...reasons, "No active evidence is available."]
    };
  }

  const sourceTypes = new Set(activeEvidence.map((evidence) => evidence.sourceType));
  const hasManufacturerDirectSpec = activeEvidence.some(
    (evidence) => evidence.sourceType === "manufacturer_specification" && evidence.method === "direct_specification"
  );
  const hasObjectiveMeasurement = activeEvidence.some(
    (evidence) => evidence.sourceType === "objective_measurement" && evidence.method === "instrument_measurement"
  );
  const hasStructuredRubric = activeEvidence.some(
    (evidence) => evidence.method === "standardized_rubric" || evidence.sourceType === "structured_expert_evaluation"
  );
  const hasConsensus = activeEvidence.some((evidence) => evidence.method === "multi_evaluator_consensus");
  const hasOutcomeEvidence = activeEvidence.some(
    (evidence) => evidence.sourceType === "historical_outcome" || evidence.sourceType === "field_observation"
  );
  const manufacturerOnly = sourceTypes.size === 1 && sourceTypes.has("manufacturer_specification");
  const isSpecificationLike = input.evaluation
    ? ["length", "weight", "drop", "certification", "barrel_diameter", "construction", "material"].includes(
        input.evaluation.attributeKey
      )
    : false;

  if (isSpecificationLike && hasManufacturerDirectSpec) {
    reasons.push("A direct manufacturer specification supports an objective catalog value.");
    if (hasObjectiveMeasurement || activeEvidence.length > 1) {
      reasons.push("Additional active evidence confirms the specification.");
    }
    return {
      confidence: hasObjectiveMeasurement || activeEvidence.length > 1 ? "validated" : "validated",
      reasons
    };
  }

  if (hasObjectiveMeasurement && hasStructuredRubric && sourceTypes.size >= 2) {
    return {
      confidence: "validated",
      reasons: [...reasons, "Objective measurement and structured evaluation support the attribute."]
    };
  }

  if (hasConsensus || (hasStructuredRubric && sourceTypes.size >= 2) || sourceTypes.size >= 3) {
    return {
      confidence: "high",
      reasons: [...reasons, "Multiple reliable or consensus sources support the attribute."]
    };
  }

  if (hasObjectiveMeasurement) {
    return {
      confidence: "high",
      reasons: [...reasons, "An objective measurement supports the attribute."]
    };
  }

  if (hasStructuredRubric || hasOutcomeEvidence) {
    return {
      confidence: "moderate",
      reasons: [...reasons, "Credible structured or field evidence exists, with remaining uncertainty."]
    };
  }

  if (manufacturerOnly) {
    return {
      confidence: "estimated",
      reasons: [...reasons, "A single manufacturer statement does not validate qualitative equipment behavior."]
    };
  }

  return {
    confidence: "estimated",
    reasons: [...reasons, "Evidence is preliminary or limited."]
  };
}

export function meetsMinimumConfidence(
  confidence: EquipmentAttributeConfidence,
  minimum: EquipmentAttributeConfidence
): boolean {
  return confidenceRank[confidence] >= confidenceRank[minimum];
}
