import assert from "node:assert/strict";
import test from "node:test";
import {
  assessPhysicalEvaluatorRelationship,
  buildPhysicalEvaluationEvidenceIndependenceSummary,
  type PhysicalEvaluationQualifyingEvidence
} from "../physical-evaluation/index.js";

const equipmentId = "equipment-1";

test("first evaluator session is independent and a false repeat declaration is blocked", () => {
  const independent = assessPhysicalEvaluatorRelationship({
    equipmentId, sessionId: "session-1", evaluatorId: "evaluator-a",
    declaredRelationship: "independent_evaluator", existingEvidence: []
  });
  assert.equal(independent.valid, true);
  assert.equal(independent.derivedRelationship, "independent_evaluator");
  assert.equal(independent.independentSourceContribution, 1);

  const falseRepeat = assessPhysicalEvaluatorRelationship({
    equipmentId, sessionId: "session-1", evaluatorId: "evaluator-a",
    declaredRelationship: "repeat_evaluator", existingEvidence: []
  });
  assert.equal(falseRepeat.valid, false);
});

test("same evaluator across v1.0 and v1.1 is repeat evidence", () => {
  const prior = [record("record-a", "session-1", "evaluator-a", "1.0", "2026-01-01")];
  const review = assessPhysicalEvaluatorRelationship({
    equipmentId, sessionId: "session-4", evaluatorId: "evaluator-a",
    declaredRelationship: "repeat_evaluator", existingEvidence: prior
  });
  assert.equal(review.valid, true);
  assert.equal(review.derivedRelationship, "repeat_evaluator");
  assert.equal(review.priorQualifyingSessionCount, 1);
  assert.equal(review.independentSourceContribution, 0);

  const falseIndependent = assessPhysicalEvaluatorRelationship({
    equipmentId, sessionId: "session-4", evaluatorId: "evaluator-a",
    declaredRelationship: "independent_evaluator", existingEvidence: prior
  });
  assert.equal(falseIndependent.valid, false);
});

test("four sessions from three evaluators produce three independent sources", () => {
  const evidence = [
    record("record-a-1", "session-1", "evaluator-a", "1.0", "2026-01-01"),
    record("record-a-2", "session-1", "evaluator-a", "1.0", "2026-01-01"),
    record("record-b", "session-2", "evaluator-b", "1.0", "2026-01-02"),
    record("record-c", "session-3", "evaluator-c", "1.0", "2026-01-03"),
    record("record-a-4", "session-4", "evaluator-a", "1.1", "2026-01-04")
  ];
  const frozenHistorical = JSON.stringify(evidence);
  const summary = buildPhysicalEvaluationEvidenceIndependenceSummary(equipmentId, evidence);
  assert.equal(summary.totalQualifyingPhysicalSessions, 4);
  assert.equal(summary.uniqueEvaluatorCount, 3);
  assert.equal(summary.independentEvaluatorSourceCount, 3);
  assert.equal(summary.repeatEvaluatorSessionCount, 1);
  assert.equal(summary.sessions[3]?.relationship, "repeat_evaluator");
  assert.equal(summary.sessions[3]?.protocolVersion, "1.1");
  assert.deepEqual(summary.sessionsByEvaluator["evaluator-a"], ["session-1", "session-4"]);
  assert.equal(JSON.stringify(evidence), frozenHistorical);
});

test("same session evidence records do not inflate session or evaluator counts", () => {
  const evidence = [
    record("dimension-1", "same-session", "evaluator-a", "1.1", "2026-01-01"),
    record("dimension-2", "same-session", "evaluator-a", "1.1", "2026-01-01")
  ];
  const summary = buildPhysicalEvaluationEvidenceIndependenceSummary(equipmentId, evidence);
  assert.equal(summary.totalQualifyingPhysicalSessions, 1);
  assert.equal(summary.uniqueEvaluatorCount, 1);
  assert.equal(summary.sessions[0]?.evidenceRecordCount, 2);
});

function record(
  evidenceRecordId: string,
  sessionId: string,
  evaluatorId: string,
  protocolVersion: string,
  evaluatedAt: string
): PhysicalEvaluationQualifyingEvidence {
  return {
    evidenceRecordId, equipmentId, sessionId, evaluatorId, protocolVersion, evaluatedAt,
    sourceReference: `physical-bat-evaluation:${protocolVersion}:${sessionId}:${evidenceRecordId}`
  };
}
