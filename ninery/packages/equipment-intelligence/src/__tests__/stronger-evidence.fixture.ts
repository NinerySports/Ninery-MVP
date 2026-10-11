import { physicalEvaluationProtocolV11Questions, reviewProtocolV11CalibrationSession, type PhysicalEvaluationProtocolV11CalibrationSessionInput } from "../physical-evaluation/index.js";
import { buildPhysicalMeasurementEvidence, buildPhysicalMeasurementSessionTemplate } from "../evidence/physical-measurement/index.js";
import type { StrongerEvidenceCandidate } from "../evidence/stronger-construct-evidence-admissibility.js";

export function calibrationSession(equipmentId = "equipment", equipmentVariantId = "variant", evaluatorId = "evaluator"): PhysicalEvaluationProtocolV11CalibrationSessionInput {
  return {
    sessionId: "session", protocolVersion: "1.1", questionnaireVersion: "1.1", studyClassification: "protocol_calibration_evidence",
    equipmentId, equipmentVariantId, evaluationDate: "2026-10-01T12:00:00.000Z",
    physicalVerification: { equipmentId, equipmentVariantId, manufacturer: "Test", model: "Test", modelYear: 2026,
      certification: "USA", lengthInches: 30, weightOunces: 20, dropWeight: -10, source: "combined",
      verifiedAt: "2026-10-01T11:00:00.000Z", verifiedBy: "operator", confidence: "confident" },
    equipmentCondition: "normal_used_condition", evaluator: { evaluatorId, category: "technical_evaluator", confidence: "medium", relationship: "independent_evaluator" },
    testingLimitations: [], drySwingBlocks: { startupDemandTrials: 4, rotationalDemandTrials: 4, barrelRedirectDemandTrials: 4 },
    controlledContactBlocks: { centeredContactTrials: 6, nearCenterHandleSideTrials: 6, nearCenterEndSideTrials: 6 },
    contactLocationControls: { centeredContactVerified: true, handleSideMissesModestAndNearCenter: true, endSideMissesModestAndNearCenter: true, methodNotes: "Observed contact locations." },
    responses: physicalEvaluationProtocolV11Questions.map(question => ({ questionId: question.id, dimensionKey: question.dimensionKey, observation: "moderate", notes: "Test observation." })),
    provenanceClassification: "real_protocol_calibration_observation"
  };
}

export function calibrationCandidate(): StrongerEvidenceCandidate {
  const session = calibrationSession();
  const record = reviewProtocolV11CalibrationSession(session).evidence[0]!;
  return { id: record.id, equipmentId: record.equipmentId, equipmentVariantId: record.equipmentVariantId, targetLevel: "equipment",
    attributeKey: record.attributeKey, attributeDefinitionVersion: "1.0", sourceType: "structured_expert_evaluation",
    sourceName: "Ninery Physical Bat Evaluation Protocol v1.1 Calibration", sourceReference: record.sourceReference,
    sourceDate: record.evaluationDate, method: "standardized_rubric", rawValue: record.rawValue,
    status: "active", evaluatorReference: record.evaluatorId };
}

export function measurementCandidate(): StrongerEvidenceCandidate {
  const template = buildPhysicalMeasurementSessionTemplate({ equipmentId: "equipment", equipmentVariantId: "variant", manufacturer: "Test", model: "Test", modelYear: 2026, certification: "USA", nominalLengthInches: 30, nominalWeightOunces: 20, nominalDrop: -10 });
  const session = { ...template, measurementSessionId: "measurement-session", specimenReference: "specimen", measurementDate: "2026-10-01T12:00:00.000Z", operatorId: "operator",
    physicalVerification: { ...template.physicalVerification, confidence: "confident" as const, verifiedAt: "2026-10-01T11:00:00.000Z", verifiedBy: "operator" }, equipmentCondition: "normal_used_condition" as const };
  const block = { ...template.measurementBlocks[0]!, methodCompliant: true,
    instrument: { instrumentType: "digital_scale", instrumentReference: "scale", calibrationStatus: "operator_checked" as const },
    trials: [1, 2, 3].map(trialNumber => ({ trialNumber, value: 570, repositioned: true })) };
  const record = buildPhysicalMeasurementEvidence(session, block, "complete_repeatable");
  return { id: record.id, equipmentId: record.equipmentId, equipmentVariantId: record.equipmentVariantId, targetLevel: "variant", attributeKey: record.attributeKey,
    attributeDefinitionVersion: "physical-measurement-1.0", sourceType: "objective_measurement", sourceName: "Ninery physical measurement", sourceReference: record.sourceReference,
    sourceDate: record.sourceDate, method: "instrument_measurement", rawValue: record.rawValue, normalizedValue: record.normalizedValue, unit: record.unit, status: "active", evaluatorReference: record.operatorId };
}
