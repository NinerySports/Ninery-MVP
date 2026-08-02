import { getRequiredEquipmentDNAAttributeDefinitions } from "../attributes/index.js";
import type {
  EquipmentDNAAttributeEvaluation,
  EquipmentDNAEvidenceRecord,
  EquipmentDNAMaturityAssessment
} from "./equipment-evidence.types.js";

export function assessEquipmentDNAMaturity(input: {
  evaluations: readonly EquipmentDNAAttributeEvaluation[];
  evidenceRecords?: readonly EquipmentDNAEvidenceRecord[];
}): EquipmentDNAMaturityAssessment {
  const evidenceRecords =
    input.evidenceRecords ?? input.evaluations.flatMap((evaluation) => evaluation.evidenceRecords ?? []);
  const activeEvaluations = input.evaluations.filter((evaluation) => evaluation.status === "active");
  const activeEvidence = evidenceRecords.filter((evidence) => evidence.status === "active");
  const requiredKeys = getRequiredEquipmentDNAAttributeDefinitions().map((definition) => definition.key);
  const hasAllRequiredEvaluated = requiredKeys.every((key) =>
    activeEvaluations.some((evaluation) => evaluation.attributeKey === key && evaluation.confidence !== "estimated")
  );
  const hasObjectiveBehavioralEvidence = activeEvidence.some(
    (evidence) =>
      evidence.sourceType === "objective_measurement" &&
      ["swing_effort", "forgiveness", "sweet_spot_support", "bat_control_support"].includes(evidence.attributeKey)
  );
  const hasFieldValidation = activeEvidence.some(
    (evidence) => evidence.sourceType === "historical_outcome" || evidence.sourceType === "field_observation"
  );
  const hasRevisionHistory = activeEvaluations.some((evaluation) => evaluation.evaluationVersion > 1);

  if (hasFieldValidation && hasRevisionHistory) {
    return {
      maturity: "living_intelligence",
      reasons: ["Field or outcome evidence and revision history support living intelligence maturity."]
    };
  }
  if (hasFieldValidation) {
    return {
      maturity: "trusted",
      reasons: ["Field or historical outcome evidence supports trusted maturity."]
    };
  }
  if (hasAllRequiredEvaluated && hasObjectiveBehavioralEvidence) {
    return {
      maturity: "validated",
      reasons: ["Required attributes are evaluated and objective behavioral evidence is present."]
    };
  }
  if (hasAllRequiredEvaluated) {
    return {
      maturity: "evaluated",
      reasons: ["Required qualitative attributes have structured non-estimated evaluations."]
    };
  }
  return {
    maturity: "basic",
    reasons: ["Profile maturity is based primarily on specifications or incomplete evaluations."]
  };
}
