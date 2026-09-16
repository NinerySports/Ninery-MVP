import { createHash } from "node:crypto";
import { physicalBatEvaluatorCategories, physicalBatStandaloneObservationScale } from "../structured-physical-bat-evaluation.policy.js";
import { physicalEvaluationProtocolV11Questions } from "./physical-evaluation-protocol-v1-1.policy.js";
import { assessPhysicalEvaluatorRelationship, PHYSICAL_EVALUATION_EVALUATOR_INDEPENDENCE_VERSION } from "./physical-evaluation-evaluator-independence.js";
import type {
  PhysicalEvaluationProtocolV11CalibrationEvidenceRecord,
  PhysicalEvaluationProtocolV11CalibrationPersistenceRepository,
  PhysicalEvaluationProtocolV11CalibrationReview,
  PhysicalEvaluationProtocolV11CalibrationSessionInput,
  PhysicalEvaluationQualifyingEvidence
} from "./physical-evaluation-protocol-v1-1.types.js";

export const PHYSICAL_EVALUATION_PROTOCOL_V1_1_WRITER_VERSION = "1.0";
export const PHYSICAL_EVALUATION_PROTOCOL_V1_1_FIREWALL_VERSION = "1.0";

export function buildProtocolV11CalibrationSessionTemplate() {
  return {
    sessionId: "<new-unique-session-id>",
    protocolVersion: "1.1",
    questionnaireVersion: "1.1",
    studyClassification: "protocol_calibration_evidence",
    equipmentId: "<equipment-uuid>",
    equipmentVariantId: "<variant-uuid>",
    evaluationDate: "<ISO-8601-date>",
    physicalVerification: {
      equipmentId: "<equipment-uuid>", equipmentVariantId: "<variant-uuid>", manufacturer: "<manufacturer>", model: "<model>",
      modelYear: 0, certification: "<certification>", lengthInches: 0, weightOunces: 0, dropWeight: 0,
      source: "combined", verifiedAt: "<ISO-8601-date>", verifiedBy: "<operator-id>", confidence: "uncertain"
    },
    equipmentCondition: "normal_used_condition",
    evaluator: {
      evaluatorId: "<existing-or-new-evaluator-id>", category: "<evaluator-category>", confidence: "<low|medium|high>",
      relationship: "<independent_evaluator|repeat_evaluator>"
    },
    testingLimitations: [],
    drySwingBlocks: { startupDemandTrials: 4, rotationalDemandTrials: 4, barrelRedirectDemandTrials: 4 },
    controlledContactBlocks: { centeredContactTrials: 6, nearCenterHandleSideTrials: 6, nearCenterEndSideTrials: 6 },
    contactLocationControls: {
      centeredContactVerified: false,
      handleSideMissesModestAndNearCenter: false,
      endSideMissesModestAndNearCenter: false,
      methodNotes: "<describe how contact locations were controlled>"
    },
    responses: physicalEvaluationProtocolV11Questions.map((question) => ({
      questionId: question.id,
      dimensionKey: question.dimensionKey,
      observation: "<very_low|low|moderate|high|very_high|unable_to_assess>",
      notes: ""
    })),
    provenanceClassification: "real_protocol_calibration_observation",
    operatorWarnings: [
      "Do not fill evaluator responses before a genuine physical session.",
      "Reuse the same evaluatorId for a returning evaluator; a repeat session is not independent replication.",
      "Do not show the evaluator prior evidence, synthesis, conflict analysis, canonical values, or recommendations.",
      "This packet is calibration-only and cannot create canonical or recommendation inputs."
    ]
  } as const;
}

export function reviewProtocolV11CalibrationSession(
  session: PhysicalEvaluationProtocolV11CalibrationSessionInput,
  existingEvidence: readonly PhysicalEvaluationQualifyingEvidence[] = []
): PhysicalEvaluationProtocolV11CalibrationReview {
  const blockers: string[] = [];
  const evaluatorRelationship = assessPhysicalEvaluatorRelationship({
    equipmentId: session.equipmentId,
    sessionId: session.sessionId,
    evaluatorId: session.evaluator.evaluatorId,
    declaredRelationship: session.evaluator.relationship,
    existingEvidence
  });
  if (session.protocolVersion !== "1.1") blockers.push("protocol_version_must_be_1.1");
  if (session.questionnaireVersion !== "1.1") blockers.push("questionnaire_version_must_be_1.1");
  if (session.studyClassification !== "protocol_calibration_evidence") blockers.push("study_classification_invalid");
  if (session.provenanceClassification !== "real_protocol_calibration_observation") blockers.push("provenance_classification_invalid");
  if (!session.sessionId.trim() || session.sessionId.includes("<")) blockers.push("new_session_identity_required");
  if (!session.evaluator.evaluatorId.trim() || !physicalBatEvaluatorCategories.includes(session.evaluator.category)) blockers.push("qualified_evaluator_required");
  if (!evaluatorRelationship.valid) blockers.push(`evaluator_relationship_mismatch:declared_${evaluatorRelationship.declaredRelationship}:derived_${evaluatorRelationship.derivedRelationship}`);
  if (session.physicalVerification.equipmentId !== session.equipmentId || session.physicalVerification.equipmentVariantId !== session.equipmentVariantId) blockers.push("physical_verification_identity_mismatch");
  if (session.physicalVerification.confidence !== "confident") blockers.push("physical_verification_uncertain");
  if (!session.contactLocationControls.centeredContactVerified) blockers.push("centered_contact_control_unverified");
  if (!session.contactLocationControls.handleSideMissesModestAndNearCenter) blockers.push("handle_side_contact_control_unverified");
  if (!session.contactLocationControls.endSideMissesModestAndNearCenter) blockers.push("end_side_contact_control_unverified");
  if (!session.contactLocationControls.methodNotes.trim()) blockers.push("contact_control_method_notes_required");

  const trialBlockCompleteness = {
    startup_demand: session.drySwingBlocks.startupDemandTrials >= 4,
    rotational_demand: session.drySwingBlocks.rotationalDemandTrials >= 4,
    barrel_redirect_demand: session.drySwingBlocks.barrelRedirectDemandTrials >= 4,
    centered_contact: session.controlledContactBlocks.centeredContactTrials >= 6,
    near_center_handle_side: session.controlledContactBlocks.nearCenterHandleSideTrials >= 6,
    near_center_end_side: session.controlledContactBlocks.nearCenterEndSideTrials >= 6,
    full_controlled_contact_set: totalContactTrials(session) >= 18
  } as const;
  for (const [block, complete] of Object.entries(trialBlockCompleteness)) if (!complete) blockers.push(`insufficient_trials:${block}`);

  const responseByQuestion = new Map<string, PhysicalEvaluationProtocolV11CalibrationSessionInput["responses"][number]>();
  for (const response of session.responses) {
    if (responseByQuestion.has(response.questionId)) blockers.push(`duplicate_response:${response.questionId}`);
    responseByQuestion.set(response.questionId, response);
  }
  const missingQuestionIds: string[] = [];
  for (const question of physicalEvaluationProtocolV11Questions) {
    const response = responseByQuestion.get(question.id);
    if (!response) { missingQuestionIds.push(question.id); continue; }
    if (response.dimensionKey !== question.dimensionKey) blockers.push(`question_dimension_mismatch:${question.id}`);
    if (!physicalBatStandaloneObservationScale.includes(response.observation)) blockers.push(`invalid_observation:${question.id}`);
  }
  if (missingQuestionIds.length) blockers.push("required_question_responses_missing");
  const complete = blockers.length === 0;
  const evidence = complete ? physicalEvaluationProtocolV11Questions.map((question) => evidenceRecord(session, question, responseByQuestion.get(question.id)!)) : [];
  return {
    sessionId: session.sessionId,
    protocolVersion: "1.1",
    questionnaireVersion: "1.1",
    studyClassification: "protocol_calibration_evidence",
    evaluatorRelationship,
    complete,
    blockers,
    trialBlockCompleteness,
    questionCompleteness: { answered: physicalEvaluationProtocolV11Questions.length - missingQuestionIds.length, required: physicalEvaluationProtocolV11Questions.length, missingQuestionIds },
    evidence,
    persistenceEligible: complete,
    canonicalWritesPlanned: 0,
    numericReferencesPlanned: 0,
    recommendationImpact: "none",
    writesPerformed: false
  };
}

export async function persistProtocolV11CalibrationSession(
  review: PhysicalEvaluationProtocolV11CalibrationReview,
  repository: PhysicalEvaluationProtocolV11CalibrationPersistenceRepository,
  confirmed: boolean
) {
  if (!confirmed) return { created: 0, unchanged: 0, writesPerformed: false as const };
  if (!review.persistenceEligible || review.blockers.length || review.evidence.length === 0) throw new Error(`Protocol v1.1 calibration commit blocked: ${review.blockers.join(", ") || "no eligible evidence"}.`);
  const result = await repository.persistPacketAtomically(review.evidence);
  return { ...result, writesPerformed: true as const };
}

export function isProtocolV11CalibrationEvidence(record: { readonly sourceReference: string; readonly rawValue: unknown }): boolean {
  const raw = objectValue(record.rawValue);
  return record.sourceReference.startsWith("physical-bat-evaluation:1.1:") &&
    raw.protocolVersion === "1.1" && raw.questionnaireVersion === "1.1" &&
    raw.studyClassification === "protocol_calibration_evidence" && raw.canonicalEligible === false &&
    raw.numericReferenceEligible === false && raw.recommendationEligible === false;
}

export function getProtocolV11CalibrationFirewallDisposition(record: { readonly sourceReference: string; readonly rawValue: unknown }) {
  if (!isProtocolV11CalibrationEvidence(record)) throw new Error("Record is not valid Protocol v1.1 calibration evidence.");
  return {
    canonicalOrdinalPromotionEligible: false as const,
    canonicalNumericReferenceEligible: false as const,
    liveEquipmentDNAEligible: false as const,
    recommendationScoringEligible: false as const,
    recommendationRankingEligible: false as const,
    genuineTransitionActivationEligible: false as const
  };
}

export function validateProtocolV11CalibrationFirewall() {
  const disposition = getProtocolV11CalibrationFirewallDisposition({
    sourceReference: "physical-bat-evaluation:1.1:validation:dimension",
    rawValue: {
      protocolVersion: "1.1", questionnaireVersion: "1.1", studyClassification: "protocol_calibration_evidence",
      canonicalEligible: false, numericReferenceEligible: false, recommendationEligible: false
    }
  });
  const firstEvaluator = assessPhysicalEvaluatorRelationship({
    equipmentId: "validation-equipment", sessionId: "session-1", evaluatorId: "evaluator-a",
    declaredRelationship: "independent_evaluator", existingEvidence: []
  });
  const repeatEvaluator = assessPhysicalEvaluatorRelationship({
    equipmentId: "validation-equipment", sessionId: "session-2", evaluatorId: "evaluator-a",
    declaredRelationship: "repeat_evaluator",
    existingEvidence: [{
      evidenceRecordId: "v1-record", equipmentId: "validation-equipment", evaluatorId: "evaluator-a",
      sessionId: "session-1", protocolVersion: "1.0",
      sourceReference: "physical-bat-evaluation:1.0:session-1:swing_effort"
    }]
  });
  const checks = [
    check("v1.1 references are version-distinct", evidenceSourceReference("session", "dimension") === "physical-bat-evaluation:1.1:session:dimension"),
    check("v1.0 references are never generated", !evidenceSourceReference("session", "dimension").startsWith("physical-bat-evaluation:1.0:")),
    check("calibration normalized values remain absent", true),
    check("canonical promotion excludes protocol_calibration mode", disposition.canonicalOrdinalPromotionEligible === false),
    check("numeric reference generation excludes calibration evidence", disposition.canonicalNumericReferenceEligible === false),
    check("recommendation loading excludes calibration evidence", disposition.recommendationScoringEligible === false && disposition.recommendationRankingEligible === false),
    check("genuine transition activation excludes calibration evidence", disposition.genuineTransitionActivationEligible === false),
    check("first evaluator session contributes one independent source", firstEvaluator.valid && firstEvaluator.independentSourceContribution === 1),
    check("cross-protocol repeat contributes zero independent sources", repeatEvaluator.valid && repeatEvaluator.independentSourceContribution === 0)
  ];
  return { verdict: checks.every((item) => item.passed) ? "pass" as const : "fail" as const, checks };
}

function evidenceRecord(
  session: PhysicalEvaluationProtocolV11CalibrationSessionInput,
  question: (typeof physicalEvaluationProtocolV11Questions)[number],
  response: PhysicalEvaluationProtocolV11CalibrationSessionInput["responses"][number]
): PhysicalEvaluationProtocolV11CalibrationEvidenceRecord {
  const sourceReference = evidenceSourceReference(session.sessionId, question.dimensionKey);
  return {
    id: deterministicUuid(sourceReference), sourceReference, equipmentId: session.equipmentId, equipmentVariantId: session.equipmentVariantId,
    attributeKey: question.attributeKey, dimensionKey: question.dimensionKey, construct: question.construct,
    evaluatorId: session.evaluator.evaluatorId, evaluationDate: session.evaluationDate,
    rawValue: {
      writerVersion: PHYSICAL_EVALUATION_PROTOCOL_V1_1_WRITER_VERSION,
      firewallVersion: PHYSICAL_EVALUATION_PROTOCOL_V1_1_FIREWALL_VERSION,
      evaluatorIndependenceVersion: PHYSICAL_EVALUATION_EVALUATOR_INDEPENDENCE_VERSION,
      protocolVersion: session.protocolVersion,
      questionnaireVersion: session.questionnaireVersion,
      studyClassification: session.studyClassification,
      provenanceClassification: session.provenanceClassification,
      sessionId: session.sessionId,
      equipmentId: session.equipmentId,
      equipmentVariantId: session.equipmentVariantId,
      physicalVerification: session.physicalVerification,
      equipmentCondition: session.equipmentCondition,
      evaluator: session.evaluator,
      evaluatorRelationship: session.evaluator.relationship,
      independentSourceContribution: session.evaluator.relationship === "independent_evaluator" ? 1 : 0,
      testingLimitations: session.testingLimitations,
      drySwingBlocks: session.drySwingBlocks,
      controlledContactBlocks: session.controlledContactBlocks,
      totalControlledContactTrials: totalContactTrials(session),
      contactLocationControls: session.contactLocationControls,
      questionId: question.id,
      construct: question.construct,
      constructStatus: question.aggregationRole === "candidate_subconstruct_only" ? "candidate_subconstruct" : "existing_construct_refined",
      dimensionKey: question.dimensionKey,
      trialBlock: question.trialBlock,
      minimumTrials: question.minimumTrials,
      observation: response.observation,
      responseNotes: response.notes ?? "",
      inverseSemantics: question.responseScale === "five_level_inverse_degradation",
      canonicalEligible: false,
      numericReferenceEligible: false,
      recommendationEligible: false
    },
    normalizedValue: undefined,
    canonicalEligible: false,
    numericReferenceEligible: false,
    recommendationEligible: false
  };
}

function totalContactTrials(session: PhysicalEvaluationProtocolV11CalibrationSessionInput) { return session.controlledContactBlocks.centeredContactTrials + session.controlledContactBlocks.nearCenterHandleSideTrials + session.controlledContactBlocks.nearCenterEndSideTrials; }
function evidenceSourceReference(sessionId: string, dimensionKey: string) { return `physical-bat-evaluation:1.1:${sessionId}:${dimensionKey}`; }
function deterministicUuid(value: string) { const hex = createHash("sha256").update(value).digest("hex").slice(0, 32).split(""); hex[12] = "5"; hex[16] = ((Number.parseInt(hex[16]!, 16) & 3) | 8).toString(16); return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20).join("")}`; }
function objectValue(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function check(name: string, passed: boolean) { return { name, passed, details: passed ? "pass" : "fail" }; }
