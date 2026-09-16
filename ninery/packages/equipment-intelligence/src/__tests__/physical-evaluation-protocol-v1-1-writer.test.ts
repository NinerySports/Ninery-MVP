import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProtocolV11CalibrationSessionTemplate,
  getProtocolV11CalibrationFirewallDisposition,
  isProtocolV11CalibrationEvidence,
  persistProtocolV11CalibrationSession,
  physicalEvaluationProtocolV11Questions,
  reviewProtocolV11CalibrationSession,
  validateProtocolV11CalibrationFirewall,
  type PhysicalEvaluationProtocolV11CalibrationEvidenceRecord,
  type PhysicalEvaluationProtocolV11CalibrationSessionInput
} from "../physical-evaluation/index.js";

test("session template contains no fabricated evaluator answers", () => {
  const template = buildProtocolV11CalibrationSessionTemplate();
  assert.equal(template.protocolVersion, "1.1");
  assert.equal(template.questionnaireVersion, "1.1");
  assert.equal(template.studyClassification, "protocol_calibration_evidence");
  assert.ok(template.responses.every((item) => item.observation.startsWith("<")));
});

test("complete session preserves raw dimensions identity trial counts and provenance", () => {
  const session = completeSession();
  const review = reviewProtocolV11CalibrationSession(session);
  assert.equal(review.complete, true);
  assert.equal(review.evidence.length, 13);
  const breadth = review.evidence.find((item) => item.dimensionKey === "usable_contact_region_breadth");
  assert.ok(breadth);
  assert.equal(breadth.sourceReference, `physical-bat-evaluation:1.1:${session.sessionId}:usable_contact_region_breadth`);
  assert.equal(breadth.evaluatorId, session.evaluator.evaluatorId);
  assert.equal(breadth.normalizedValue, undefined);
  const raw = breadth.rawValue;
  assert.equal(raw.totalControlledContactTrials, 18);
  assert.equal(raw.observation, "low");
  assert.equal(raw.constructStatus, "candidate_subconstruct");
  assert.equal(raw.canonicalEligible, false);
  assert.equal(isProtocolV11CalibrationEvidence(breadth), true);
});

test("trial requirements enforce three dry blocks and 18 controlled contacts", () => {
  const session = completeSession();
  const review = reviewProtocolV11CalibrationSession({
    ...session,
    drySwingBlocks: { startupDemandTrials: 3, rotationalDemandTrials: 4, barrelRedirectDemandTrials: 4 },
    controlledContactBlocks: { centeredContactTrials: 6, nearCenterHandleSideTrials: 6, nearCenterEndSideTrials: 5 }
  });
  assert.equal(review.complete, false);
  assert.ok(review.blockers.includes("insufficient_trials:startup_demand"));
  assert.ok(review.blockers.includes("insufficient_trials:near_center_end_side"));
  assert.ok(review.blockers.includes("insufficient_trials:full_controlled_contact_set"));
});

test("contact controls block breadth extrapolation and extreme mishit ambiguity", () => {
  const session = completeSession();
  const review = reviewProtocolV11CalibrationSession({ ...session, contactLocationControls: { ...session.contactLocationControls, handleSideMissesModestAndNearCenter: false } });
  assert.equal(review.persistenceEligible, false);
  assert.ok(review.blockers.includes("handle_side_contact_control_unverified"));
  const breadthQuestion = physicalEvaluationProtocolV11Questions.find((item) => item.dimensionKey === "usable_contact_region_breadth");
  assert.ok(breadthQuestion?.operatorInstruction.includes("Do not infer barrel coverage beyond"));
});

test("response degradation remains inverse and candidate constructs remain noncanonical", () => {
  const review = reviewProtocolV11CalibrationSession(completeSession());
  const degradation = review.evidence.find((item) => item.dimensionKey === "response_degradation");
  assert.equal(degradation?.rawValue.inverseSemantics, true);
  assert.ok(review.evidence.filter((item) => item.construct.includes("candidate")).every((item) => item.canonicalEligible === false));
});

test("no-confirm writes zero and confirmed persistence is idempotent", async () => {
  const review = reviewProtocolV11CalibrationSession(completeSession());
  const records = new Map<string, PhysicalEvaluationProtocolV11CalibrationEvidenceRecord>();
  let calls = 0;
  const repository = {
    async persistPacketAtomically(items: readonly PhysicalEvaluationProtocolV11CalibrationEvidenceRecord[]) {
      calls += 1; let created = 0; let unchanged = 0;
      for (const item of items) { if (records.has(item.id)) unchanged += 1; else { records.set(item.id, item); created += 1; } }
      return { created, unchanged };
    }
  };
  assert.deepEqual(await persistProtocolV11CalibrationSession(review, repository, false), { created: 0, unchanged: 0, writesPerformed: false });
  assert.equal(calls, 0);
  assert.deepEqual(await persistProtocolV11CalibrationSession(review, repository, true), { created: 13, unchanged: 0, writesPerformed: true });
  assert.deepEqual(await persistProtocolV11CalibrationSession(review, repository, true), { created: 0, unchanged: 13, writesPerformed: true });
});

test("calibration firewall excludes canonical numeric recommendation and v1.0 mutation", () => {
  const review = reviewProtocolV11CalibrationSession(completeSession());
  assert.ok(review.evidence.every((item) => item.sourceReference.startsWith("physical-bat-evaluation:1.1:")));
  assert.ok(review.evidence.every((item) => !item.sourceReference.startsWith("physical-bat-evaluation:1.0:")));
  assert.equal(review.canonicalWritesPlanned, 0);
  assert.equal(review.numericReferencesPlanned, 0);
  assert.equal(review.recommendationImpact, "none");
  const disposition = getProtocolV11CalibrationFirewallDisposition(review.evidence[0]!);
  assert.deepEqual(disposition, {
    canonicalOrdinalPromotionEligible: false,
    canonicalNumericReferenceEligible: false,
    liveEquipmentDNAEligible: false,
    recommendationScoringEligible: false,
    recommendationRankingEligible: false,
    genuineTransitionActivationEligible: false
  });
  assert.equal(validateProtocolV11CalibrationFirewall().verdict, "pass");
});

test("repeated packet creation is deterministic", () => {
  assert.deepEqual(reviewProtocolV11CalibrationSession(completeSession()), reviewProtocolV11CalibrationSession(completeSession()));
});

test("review blocks contradictory repeat-evaluator provenance before persistence", async () => {
  const session = completeSession();
  const priorEvidence = [{
    evidenceRecordId: "historical-v1-record",
    equipmentId: session.equipmentId,
    evaluatorId: session.evaluator.evaluatorId,
    sessionId: "historical-v1-session",
    protocolVersion: "1.0",
    sourceReference: "physical-bat-evaluation:1.0:historical-v1-session:swing_effort",
    evaluatedAt: "2026-08-20T15:00:00.000Z"
  }];
  const contradictory = reviewProtocolV11CalibrationSession(session, priorEvidence);
  assert.equal(contradictory.persistenceEligible, false);
  assert.equal(contradictory.evaluatorRelationship.derivedRelationship, "repeat_evaluator");
  assert.ok(contradictory.blockers.some((blocker) => blocker.startsWith("evaluator_relationship_mismatch:")));

  const validRepeat = reviewProtocolV11CalibrationSession({
    ...session,
    evaluator: { ...session.evaluator, relationship: "repeat_evaluator" }
  }, priorEvidence);
  assert.equal(validRepeat.persistenceEligible, true);
  assert.equal(validRepeat.evaluatorRelationship.independentSourceContribution, 0);
  assert.ok(validRepeat.evidence.every((record) => record.rawValue.evaluatorRelationship === "repeat_evaluator"));
  assert.ok(validRepeat.evidence.every((record) => record.rawValue.independentSourceContribution === 0));

  let calls = 0;
  await assert.rejects(() => persistProtocolV11CalibrationSession(contradictory, {
    async persistPacketAtomically() { calls += 1; return { created: 0, unchanged: 0 }; }
  }, true), /commit blocked/);
  assert.equal(calls, 0);
});

function completeSession(): PhysicalEvaluationProtocolV11CalibrationSessionInput {
  return {
    sessionId: "physical-v1-1-calibration-independent-06",
    protocolVersion: "1.1",
    questionnaireVersion: "1.1",
    studyClassification: "protocol_calibration_evidence",
    equipmentId: "6cf0f7fa-c8c2-4ce7-a36e-6ad1c52cc56c",
    equipmentVariantId: "a88df6f4-f33c-4a3d-9f5d-e77f4ae83daf",
    evaluationDate: "2026-08-27T15:00:00.000Z",
    physicalVerification: {
      equipmentId: "6cf0f7fa-c8c2-4ce7-a36e-6ad1c52cc56c", equipmentVariantId: "a88df6f4-f33c-4a3d-9f5d-e77f4ae83daf",
      manufacturer: "DeMarini", model: "The Goods", modelYear: 2023, certification: "USA", lengthInches: 30, weightOunces: 20,
      dropWeight: -10, source: "combined", verifiedAt: "2026-08-27T14:55:00.000Z", verifiedBy: "operator-01", confidence: "confident"
    },
    equipmentCondition: "normal_used_condition",
    evaluator: { evaluatorId: "independent-evaluator-06", category: "technical_evaluator", confidence: "medium", relationship: "independent_evaluator" },
    testingLimitations: ["Calibration session fixture for deterministic tests."],
    drySwingBlocks: { startupDemandTrials: 4, rotationalDemandTrials: 4, barrelRedirectDemandTrials: 4 },
    controlledContactBlocks: { centeredContactTrials: 6, nearCenterHandleSideTrials: 6, nearCenterEndSideTrials: 6 },
    contactLocationControls: { centeredContactVerified: true, handleSideMissesModestAndNearCenter: true, endSideMissesModestAndNearCenter: true, methodNotes: "Contact locations directly observed and categorized." },
    responses: physicalEvaluationProtocolV11Questions.map((question) => ({ questionId: question.id, dimensionKey: question.dimensionKey, observation: question.dimensionKey === "usable_contact_region_breadth" ? "low" as const : "moderate" as const, notes: "Raw evaluator observation." })),
    provenanceClassification: "real_protocol_calibration_observation"
  };
}
