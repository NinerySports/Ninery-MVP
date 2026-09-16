import { assessPhysicalEvaluatorRelationship, buildPhysicalEvaluationEvidenceIndependenceSummary } from "./physical-evaluation-evaluator-independence.js";
import type {
  CalibrationConstruction,
  CalibrationEquipmentArchetype,
  CrossEquipmentCalibrationStatus,
  CrossEquipmentQualifyingEvidence,
  PilotCandidateAssessment,
  PilotContrastClassification,
  ProtocolParticipationRelationship
} from "./physical-evaluation-cross-equipment.types.js";

export const PHYSICAL_EVALUATION_CROSS_EQUIPMENT_FRAMEWORK_VERSION = "1.0";
export const PROTOCOL_V1_1_CROSS_EQUIPMENT_COMPARISON_CONTRACT_VERSION = "1.0";

export const protocolV11CrossEquipmentComparisonContract = Object.freeze({
  version: PROTOCOL_V1_1_CROSS_EQUIPMENT_COMPARISON_CONTRACT_VERSION,
  question: "Does Protocol v1.1 continue to produce interpretable construct separation across different equipment?",
  dimensions: ["construct_coverage", "dimension_separation", "protocol_completion", "response_inversion_handling", "sweet_spot_candidate_separation", "equipment_evaluator_independence", "protocol_participation", "testing_limitations", "contact_location_controls"] as const,
  performanceRankingAllowed: false,
  canonicalPromotionAllowed: false
});

export function normalizeCalibrationConstruction(value?: string, material?: string): CalibrationConstruction {
  const normalized = value?.trim().toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
  const normalizedMaterial = material?.trim().toLowerCase();
  if (!normalized) return "unknown";
  if (normalized.includes("hybrid") || normalized.includes("composite_handle") && normalized.includes("alloy")) return "hybrid";
  if (normalized.includes("one_piece") && (normalized.includes("alloy") || normalizedMaterial?.includes("alloy"))) return "one_piece_alloy";
  if (normalized.includes("two_piece") && (normalized.includes("alloy") || normalizedMaterial?.includes("alloy"))) return "two_piece_alloy";
  if (normalized.includes("two_piece") && (normalized.includes("composite") || normalizedMaterial?.includes("composite"))) return "two_piece_composite";
  return "other";
}

export function assessProtocolV11Participation(input: {
  readonly equipmentId: string;
  readonly sessionId: string;
  readonly evaluatorId: string;
  readonly evidence: readonly CrossEquipmentQualifyingEvidence[];
}) {
  const genuine = genuineV11Evidence(input.evidence);
  const equipmentReview = assessPhysicalEvaluatorRelationship({
    ...input,
    declaredRelationship: input.evidence.some((record) => record.equipmentId === input.equipmentId && record.evaluatorId === input.evaluatorId && record.sessionId !== input.sessionId)
      ? "repeat_evaluator"
      : "independent_evaluator",
    existingEvidence: input.evidence
  });
  const priorProtocolSessions = uniqueSessions(genuine.filter((record) => record.evaluatorId === input.evaluatorId && record.sessionId !== input.sessionId));
  const protocolParticipationRelationship: ProtocolParticipationRelationship = priorProtocolSessions.length
    ? "repeat_protocol_participant"
    : "first_protocol_participation";
  return {
    equipmentEvidenceRelationship: equipmentReview.derivedRelationship,
    protocolParticipationRelationship,
    priorSessionsOnEquipment: equipmentReview.priorSessionIds,
    priorProtocolV11SessionsAcrossEquipment: priorProtocolSessions.map((session) => session.sessionId),
    independentSourceContributionForEquipment: equipmentReview.independentSourceContribution
  } as const;
}

export function assessPilotCandidate(baseline: CalibrationEquipmentArchetype, candidate: CalibrationEquipmentArchetype): PilotCandidateAssessment {
  const blockers: string[] = [];
  if (!candidate.equipmentId || candidate.synthetic || !candidate.physicalIdentityReady) blockers.push("missing_or_non_genuine_physical_identity");
  if (!candidate.equipmentVariantId) blockers.push("missing_variant_uuid");
  if (!candidate.protocolCompatible || !candidate.requiredTrialBlocksCapable) blockers.push("protocol_v1_1_trial_blocks_not_supported");
  const contrast = assessPilotContrast(baseline, candidate);
  if (contrast.classification === "insufficient_catalog_data") blockers.push("insufficient_catalog_data");
  const eligibility = blockers.includes("missing_or_non_genuine_physical_identity") ? "blocked_missing_identity"
    : blockers.includes("missing_variant_uuid") ? "blocked_missing_variant"
      : blockers.includes("protocol_v1_1_trial_blocks_not_supported") ? "blocked_protocol_incompatible"
        : blockers.includes("insufficient_catalog_data") ? "blocked_insufficient_catalog_data"
          : contrast.classification === "low_contrast" ? "eligible_with_limited_contrast"
            : "eligible";
  return { candidate, eligibility, contrast: contrast.classification, contrastReasons: contrast.reasons, blockers, calibrationOnly: true, performanceInferenceMade: false, numericContrastScore: undefined };
}

export function assessPilotContrast(baseline: CalibrationEquipmentArchetype, candidate: CalibrationEquipmentArchetype): { classification: PilotContrastClassification; reasons: string[] } {
  if (![baseline, candidate].every(hasMinimumCatalogFacts)) return { classification: "insufficient_catalog_data", reasons: ["Construction, certification, length, weight, and drop must be catalog-supported for both variants."] };
  const reasons = [
    baseline.construction !== candidate.construction ? `construction differs: ${baseline.construction} vs ${candidate.construction}` : undefined,
    baseline.certification !== candidate.certification ? `certification differs: ${baseline.certification} vs ${candidate.certification}` : undefined,
    baseline.lengthInches !== candidate.lengthInches ? `length differs: ${baseline.lengthInches} vs ${candidate.lengthInches}` : undefined,
    baseline.weightOunces !== candidate.weightOunces ? `weight differs: ${baseline.weightOunces} vs ${candidate.weightOunces}` : undefined,
    baseline.dropWeight !== candidate.dropWeight ? `drop differs: ${baseline.dropWeight} vs ${candidate.dropWeight}` : undefined,
    baseline.material && candidate.material && baseline.material !== candidate.material ? `catalog material differs: ${baseline.material} vs ${candidate.material}` : undefined,
    baseline.barrelDiameter !== undefined && candidate.barrelDiameter !== undefined && baseline.barrelDiameter !== candidate.barrelDiameter ? `barrel diameter differs: ${baseline.barrelDiameter} vs ${candidate.barrelDiameter}` : undefined
  ].filter((reason): reason is string => Boolean(reason));
  return { classification: reasons.length >= 3 ? "high_contrast" : reasons.length >= 1 ? "moderate_contrast" : "low_contrast", reasons: reasons.length ? reasons : ["No catalog-supported archetype difference was found."] };
}

export function buildCrossEquipmentCalibrationStatus(input: {
  readonly catalog: readonly CalibrationEquipmentArchetype[];
  readonly evidence: readonly CrossEquipmentQualifyingEvidence[];
}): CrossEquipmentCalibrationStatus {
  const evidence = genuineV11Evidence(input.evidence);
  const sessions = uniqueSessions(evidence);
  const equipmentIds = [...new Set(sessions.map((session) => session.equipmentId))].sort();
  const representedArchetypes = equipmentIds.flatMap((id) => input.catalog.find((item) => item.equipmentId === id) ?? []);
  const evaluatorIds = [...new Set(sessions.map((session) => session.evaluatorId))];
  const summaries = equipmentIds.map((id) => buildPhysicalEvaluationEvidenceIndependenceSummary(id, input.evidence));
  const sessionOrder = [...sessions].sort((a, b) => (a.evaluatedAt ?? "").localeCompare(b.evaluatedAt ?? "") || a.sessionId.localeCompare(b.sessionId));
  const repeatProtocolParticipantCount = sessionOrder.filter((session, index) => sessionOrder.findIndex((prior) => prior.evaluatorId === session.evaluatorId) < index).length;
  const constructionCoverage = countCoverage(["one_piece_alloy", "two_piece_alloy", "two_piece_composite", "hybrid", "other", "unknown"] as const, representedArchetypes.map((item) => item.construction));
  const certificationCoverage = countCoverage(["USA", "USSSA", "BBCOR", "other"] as const, representedArchetypes.map((item) => item.certification));
  const readiness = equipmentIds.length <= 1 ? "single_equipment_only" : equipmentIds.length === 2 ? "cross_equipment_started" : "construct_replication_pending";
  return {
    version: PHYSICAL_EVALUATION_CROSS_EQUIPMENT_FRAMEWORK_VERSION,
    genuineEquipmentModelCount: equipmentIds.length,
    genuineVariantCount: new Set(sessions.map((session) => session.equipmentVariantId).filter(Boolean)).size,
    genuineSessionCount: sessions.length,
    uniqueProtocolEvaluatorCount: evaluatorIds.length,
    equipmentLevelIndependentSourceCount: summaries.reduce((total, summary) => total + summary.independentEvaluatorSourceCount, 0),
    repeatEvaluatorSessionCount: summaries.reduce((total, summary) => total + summary.repeatEvaluatorSessionCount, 0),
    repeatProtocolParticipantCount,
    representedArchetypes,
    constructionCoverage,
    certificationCoverage,
    readiness,
    readinessReason: equipmentIds.length <= 1 ? "only_one_equipment_model_represented" : equipmentIds.length === 2 ? "second_equipment_started_but_construct_replication_pending" : "broader_construct_replication_still_required",
    crossEquipmentComparisonAvailable: equipmentIds.length >= 2,
    protocolValidated: false,
    safeguards: ["No result validates Protocol v1.1.", "Construction does not imply performance.", "Cross-equipment evidence does not increase canonical Equipment DNA confidence.", "Sweet-spot subconstructs remain candidate-only.", "response_degradation remains inverse."],
    canonicalFirewall: { canonicalEvaluationsCreated: 0, canonicalEvaluationsModified: 0, numericReferencesCreated: 0, recommendationScoringChanged: false, recommendationRankingChanged: false, liveEquipmentDNAChanged: false, historicalEvidenceModified: false, writesPerformed: false }
  };
}

function genuineV11Evidence(evidence: readonly CrossEquipmentQualifyingEvidence[]) {
  return evidence.filter((record) => record.protocolVersion === "1.1" && record.studyClassification === "protocol_calibration_evidence" && record.provenanceClassification === "real_protocol_calibration_observation" && !record.synthetic);
}
function uniqueSessions(evidence: readonly CrossEquipmentQualifyingEvidence[]) {
  const sessions = new Map<string, CrossEquipmentQualifyingEvidence>();
  for (const record of evidence) sessions.set(`${record.equipmentId}\0${record.sessionId}`, record);
  return [...sessions.values()];
}
function hasMinimumCatalogFacts(value: CalibrationEquipmentArchetype) { return value.construction !== "unknown" && value.lengthInches !== undefined && value.weightOunces !== undefined && value.dropWeight !== undefined; }
function countCoverage<const T extends readonly string[]>(keys: T, values: readonly string[]): Record<T[number], number> { return Object.fromEntries(keys.map((key) => [key, values.filter((value) => value === key).length])) as Record<T[number], number>; }
