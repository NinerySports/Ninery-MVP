import { physicalEvaluationProtocolV11Questions, reviewProtocolV11CalibrationSession, type PhysicalEvaluationProtocolV11CalibrationSessionInput, type StrongerEvidenceCandidate } from "@ninery/equipment-intelligence";

export function protocolCandidate(equipmentId: string, equipmentVariantId: string, sessionId = "test-session", evaluatorId = "test-evaluator"): StrongerEvidenceCandidate {
  const session: PhysicalEvaluationProtocolV11CalibrationSessionInput = {
    sessionId, protocolVersion: "1.1", questionnaireVersion: "1.1", studyClassification: "protocol_calibration_evidence",
    equipmentId, equipmentVariantId, evaluationDate: "2026-10-01T12:00:00.000Z",
    physicalVerification: { equipmentId, equipmentVariantId, manufacturer: "Test", model: "Test", modelYear: 2026,
      certification: "USA", lengthInches: 30, weightOunces: 20, dropWeight: -10, source: "combined", verifiedAt: "2026-10-01T11:00:00.000Z", verifiedBy: "operator", confidence: "confident" },
    equipmentCondition: "normal_used_condition", evaluator: { evaluatorId, category: "technical_evaluator", confidence: "medium", relationship: "independent_evaluator" },
    testingLimitations: [], drySwingBlocks: { startupDemandTrials: 4, rotationalDemandTrials: 4, barrelRedirectDemandTrials: 4 },
    controlledContactBlocks: { centeredContactTrials: 6, nearCenterHandleSideTrials: 6, nearCenterEndSideTrials: 6 },
    contactLocationControls: { centeredContactVerified: true, handleSideMissesModestAndNearCenter: true, endSideMissesModestAndNearCenter: true, methodNotes: "Observed contact locations." },
    responses: physicalEvaluationProtocolV11Questions.map(question => ({ questionId: question.id, dimensionKey: question.dimensionKey, observation: "moderate", notes: "Disposable fixture." })),
    provenanceClassification: "real_protocol_calibration_observation"
  };
  const review = reviewProtocolV11CalibrationSession(session);
  if (!review.complete) throw new Error(review.blockers.join(","));
  const record = review.evidence[0]!;
  return { id: record.id, equipmentId, equipmentVariantId, targetLevel: "equipment", attributeKey: record.attributeKey,
    attributeDefinitionVersion: "1.0", sourceType: "structured_expert_evaluation", sourceName: "Ninery Protocol v1.1 calibration",
    sourceReference: record.sourceReference, sourceDate: record.evaluationDate, method: "standardized_rubric", rawValue: record.rawValue,
    status: "active", evaluatorReference: record.evaluatorId };
}
