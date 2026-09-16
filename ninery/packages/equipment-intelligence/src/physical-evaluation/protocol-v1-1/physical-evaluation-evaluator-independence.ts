import type {
  PhysicalEvaluationEvidenceIndependenceSession,
  PhysicalEvaluationEvidenceIndependenceSummary,
  PhysicalEvaluationEvaluatorRelationship,
  PhysicalEvaluationEvaluatorRelationshipReview,
  PhysicalEvaluationQualifyingEvidence
} from "./physical-evaluation-protocol-v1-1.types.js";

export const PHYSICAL_EVALUATION_EVALUATOR_INDEPENDENCE_VERSION = "1.0";

export function assessPhysicalEvaluatorRelationship(input: {
  readonly equipmentId: string;
  readonly sessionId: string;
  readonly evaluatorId: string;
  readonly declaredRelationship: PhysicalEvaluationEvaluatorRelationship;
  readonly existingEvidence: readonly PhysicalEvaluationQualifyingEvidence[];
}): PhysicalEvaluationEvaluatorRelationshipReview {
  const priorSessions = qualifyingSessions(input.existingEvidence)
    .filter((session) => session.equipmentId === input.equipmentId)
    .filter((session) => session.evaluatorId === input.evaluatorId)
    .filter((session) => session.sessionId !== input.sessionId);
  const derivedRelationship = priorSessions.length === 0 ? "independent_evaluator" : "repeat_evaluator";
  return {
    evaluatorId: input.evaluatorId,
    declaredRelationship: input.declaredRelationship,
    derivedRelationship,
    priorQualifyingSessionCount: priorSessions.length,
    priorSessionIds: priorSessions.map((session) => session.sessionId).sort(),
    valid: input.declaredRelationship === derivedRelationship,
    independentSourceContribution: derivedRelationship === "independent_evaluator" ? 1 : 0
  };
}

export function buildPhysicalEvaluationEvidenceIndependenceSummary(
  equipmentId: string,
  evidence: readonly PhysicalEvaluationQualifyingEvidence[]
): PhysicalEvaluationEvidenceIndependenceSummary {
  const sessions = qualifyingSessions(evidence)
    .filter((session) => session.equipmentId === equipmentId)
    .sort(compareSessions)
    .map<PhysicalEvaluationEvidenceIndependenceSession>((session, index, all) => {
      const firstForEvaluator = all.findIndex((candidate) => candidate.evaluatorId === session.evaluatorId) === index;
      return {
        sessionId: session.sessionId,
        evaluatorId: session.evaluatorId,
        protocolVersion: session.protocolVersion,
        relationship: firstForEvaluator ? "independent_evaluator" : "repeat_evaluator",
        evidenceRecordCount: session.evidenceRecordIds.length,
        evidenceRecordIds: [...session.evidenceRecordIds].sort()
      };
    });
  const evaluatorIds = [...new Set(sessions.map((session) => session.evaluatorId))].sort();
  const sessionsByEvaluator = Object.fromEntries(evaluatorIds.map((evaluatorId) => [
    evaluatorId,
    sessions.filter((session) => session.evaluatorId === evaluatorId).map((session) => session.sessionId)
  ]));
  return {
    equipmentId,
    totalQualifyingPhysicalSessions: sessions.length,
    uniqueEvaluatorCount: evaluatorIds.length,
    independentEvaluatorSourceCount: evaluatorIds.length,
    repeatEvaluatorSessionCount: sessions.filter((session) => session.relationship === "repeat_evaluator").length,
    evaluatorIds,
    protocolVersions: [...new Set(sessions.map((session) => session.protocolVersion))].sort(),
    sessions,
    sessionsByEvaluator
  };
}

function qualifyingSessions(evidence: readonly PhysicalEvaluationQualifyingEvidence[]) {
  const bySession = new Map<string, {
    equipmentId: string; sessionId: string; evaluatorId: string; protocolVersion: string;
    evaluatedAt?: string; sourceReference: string; evidenceRecordIds: string[];
  }>();
  for (const record of evidence) {
    if (!record.equipmentId || !record.sessionId || !record.evaluatorId || !record.protocolVersion) continue;
    const key = `${record.equipmentId}\u0000${record.protocolVersion}\u0000${record.sessionId}`;
    const existing = bySession.get(key);
    if (existing) existing.evidenceRecordIds.push(record.evidenceRecordId);
    else bySession.set(key, {
      equipmentId: record.equipmentId, sessionId: record.sessionId, evaluatorId: record.evaluatorId,
      protocolVersion: record.protocolVersion, evaluatedAt: record.evaluatedAt,
      sourceReference: record.sourceReference, evidenceRecordIds: [record.evidenceRecordId]
    });
  }
  return [...bySession.values()];
}

function compareSessions(left: { evaluatedAt?: string; sourceReference: string }, right: { evaluatedAt?: string; sourceReference: string }) {
  return (left.evaluatedAt ?? "").localeCompare(right.evaluatedAt ?? "") || left.sourceReference.localeCompare(right.sourceReference);
}
