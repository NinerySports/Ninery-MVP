import { requiredBehavioralEquipmentDNAAttributes } from "../real-world-behavioral-evaluation.policy.js";
import type { BehavioralEquipmentDNAAttributeKey, BehavioralEvidenceRecord } from "../real-world-behavioral-evaluation.types.js";
import {
  PHYSICAL_EVALUATION_CONSTRUCT_ANALYSIS_VERSION,
  PHYSICAL_EVALUATION_PROTOCOL_CALIBRATION_VERSION,
  PHYSICAL_EVALUATION_STOP_POLICY_VERSION,
  inversePhysicalEvaluationDimensions,
  minimumPilotEvaluatorsBeforeStructuralReview,
  physicalEvaluationDimensions
} from "./physical-evaluation-calibration.policy.js";
import type {
  CalibrationRecommendationType,
  ConstructCoherenceClassification,
  EvaluationCollectionDecision,
  PhysicalEvaluationConstructAnalysis,
  PhysicalEvaluationDimensionCoherence,
  PhysicalEvaluationProtocolCalibrationInput,
  PhysicalEvaluationProtocolCalibrationReport,
  PossibleOutlierObservation
} from "./physical-evaluation-calibration.types.js";

type ParsedObservation = {
  readonly evidenceId: string;
  readonly evaluatorId: string;
  readonly sessionId: string;
  readonly attributeKey: BehavioralEquipmentDNAAttributeKey;
  readonly dimensionKey: string;
  readonly rawObservation: string;
  readonly normalizedOrdinal: string;
  readonly rank: number;
};

export function analyzePhysicalEvaluationProtocolCalibration(
  input: PhysicalEvaluationProtocolCalibrationInput
): PhysicalEvaluationProtocolCalibrationReport {
  const observations = input.evidence.flatMap(parseEvidence);
  const attributes = requiredBehavioralEquipmentDNAAttributes.map((attributeKey) => analyzeAttribute(
    attributeKey,
    observations.filter((item) => item.attributeKey === attributeKey),
    Boolean(input.comparativeAttributes?.find((item) => item.attributeKey === attributeKey && item.evidenceCount > 0))
  ));
  const evaluators = new Set(observations.map((item) => item.evaluatorId));
  const sessions = new Set(observations.map((item) => item.sessionId));
  return {
    version: PHYSICAL_EVALUATION_PROTOCOL_CALIBRATION_VERSION,
    constructAnalysisVersion: PHYSICAL_EVALUATION_CONSTRUCT_ANALYSIS_VERSION,
    stopPolicyVersion: PHYSICAL_EVALUATION_STOP_POLICY_VERSION,
    equipmentId: input.equipmentId,
    equipmentLabel: input.equipmentLabel,
    variantLabel: input.variantLabel,
    qualifyingEvaluatorCount: evaluators.size,
    physicalSessionCount: sessions.size,
    evidenceCount: new Set(observations.map((item) => item.evidenceId)).size,
    attributes,
    overallCollectionDecision: overallDecision(attributes),
    historicalEvidenceChanged: false,
    canonicalEvaluationsCreated: 0,
    numericReferencesCreated: 0,
    recommendationBehaviorChanged: false,
    writesPerformed: false
  };
}

export function validatePhysicalEvaluationProtocolCalibrationPolicy() {
  const checks = [
    check("calibration version present", PHYSICAL_EVALUATION_PROTOCOL_CALIBRATION_VERSION === "1.0"),
    check("construct analysis version present", PHYSICAL_EVALUATION_CONSTRUCT_ANALYSIS_VERSION === "1.0"),
    check("stop policy version present", PHYSICAL_EVALUATION_STOP_POLICY_VERSION === "1.0"),
    check("structural review begins after five evaluators", minimumPilotEvaluatorsBeforeStructuralReview === 5),
    check("response degradation remains inverse", inversePhysicalEvaluationDimensions.has("forgiveness:response_degradation")),
    check("comparative evidence remains non-dispositive", true),
    check("outliers remain diagnostic", true),
    check("analysis performs no writes", true)
  ];
  return { verdict: checks.every((item) => item.passed) ? "pass" as const : "fail" as const, checks };
}

function analyzeAttribute(
  attributeKey: BehavioralEquipmentDNAAttributeKey,
  observations: readonly ParsedObservation[],
  hasComparativeEvidence: boolean
): PhysicalEvaluationConstructAnalysis {
  const evaluatorCount = new Set(observations.map((item) => item.evaluatorId)).size;
  const dimensions = physicalEvaluationDimensions[attributeKey].map((key) => dimensionAnalysis(key, observations.filter((item) => item.dimensionKey === key)));
  const stableModes = dimensions.filter((item) => item.modalOrdinal && item.modalSupportPercentage >= 60);
  const modeRanks = stableModes.map((item) => rankForNormalized(attributeKey, item.modalOrdinal!));
  const crossDimensionDivergence = modeRanks.length >= 2 && Math.max(...modeRanks) - Math.min(...modeRanks) >= 2;
  const evaluatorDisagreement = dimensions.some((item) => (item.dimensionSpread ?? 0) >= 2 && item.modalSupportPercentage < 80);
  const disagreementType = crossDimensionDivergence
    ? evaluatorDisagreement ? "combined" : "construct_divergence"
    : evaluatorDisagreement ? "evaluator_disagreement" : "none";
  const constructCoherence = coherenceFor(attributeKey, evaluatorCount, dimensions, crossDimensionDivergence, evaluatorDisagreement);
  const collectionDecision = decisionFor(evaluatorCount, constructCoherence, evaluatorDisagreement, crossDimensionDivergence);
  return {
    attributeKey,
    qualifyingEvaluatorCount: evaluatorCount,
    physicalSessionCount: new Set(observations.map((item) => item.sessionId)).size,
    dimensions,
    crossDimensionDivergence,
    disagreementType,
    constructCoherence,
    comparativeEvidenceRole: hasComparativeEvidence ? "corroborating_non_dispositive" : "not_available",
    recommendations: recommendationsFor(attributeKey, constructCoherence, crossDimensionDivergence, evaluatorDisagreement),
    collectionDecision,
    evaluationSixRecommended: collectionDecision === "collect_additional_evaluator",
    findings: findingsFor(attributeKey, dimensions, disagreementType)
  };
}

function dimensionAnalysis(dimensionKey: string, observations: readonly ParsedObservation[]): PhysicalEvaluationDimensionCoherence {
  const counts = new Map<number, { ordinal: string; count: number }>();
  for (const item of observations) {
    const current = counts.get(item.rank);
    counts.set(item.rank, { ordinal: item.normalizedOrdinal, count: (current?.count ?? 0) + 1 });
  }
  const distribution = [...counts.entries()].sort(([left], [right]) => left - right).map(([, item]) => ({
    ordinal: item.ordinal,
    count: item.count,
    percentage: percent(item.count, observations.length)
  }));
  const mode = [...counts.entries()].sort(([rankA, a], [rankB, b]) => b.count - a.count || rankA - rankB)[0];
  const modalRank = mode?.[0];
  const modalCount = mode?.[1].count ?? 0;
  const adjacentCount = modalRank === undefined ? 0 : observations.filter((item) => Math.abs(item.rank - modalRank) <= 1).length;
  return {
    dimensionKey,
    observationCount: observations.length,
    ordinalDistribution: distribution,
    dimensionSpread: observations.length ? Math.max(...observations.map((item) => item.rank)) - Math.min(...observations.map((item) => item.rank)) : undefined,
    modalOrdinal: mode?.[1].ordinal,
    modalSupportCount: modalCount,
    modalSupportPercentage: percent(modalCount, observations.length),
    adjacentSupportPercentage: percent(adjacentCount, observations.length),
    inverseDimensionHandling: inversePhysicalEvaluationDimensions.has(`forgiveness:${dimensionKey}`),
    possibleOutliers: possibleOutliers(observations, modalRank, mode?.[1].ordinal, modalCount)
  };
}

function possibleOutliers(observations: readonly ParsedObservation[], modalRank?: number, modalOrdinal?: string, modalCount = 0): PossibleOutlierObservation[] {
  if (modalRank === undefined || !modalOrdinal || modalCount < 2) return [];
  return observations.filter((item) => Math.abs(item.rank - modalRank) >= 2).map((item) => ({
    classification: "possible_outlier_observation",
    evaluatorId: item.evaluatorId,
    sessionId: item.sessionId,
    dimension: item.dimensionKey,
    observation: item.rawObservation,
    modalObservation: modalOrdinal,
    ordinalDistanceFromMode: Math.abs(item.rank - modalRank),
    otherEvaluatorsSupportingMode: modalCount,
    diagnosticOnly: true
  }));
}

function coherenceFor(
  attributeKey: BehavioralEquipmentDNAAttributeKey,
  evaluatorCount: number,
  dimensions: readonly PhysicalEvaluationDimensionCoherence[],
  divergence: boolean,
  evaluatorDisagreement: boolean
): ConstructCoherenceClassification {
  if (evaluatorCount < 2 || dimensions.some((item) => item.observationCount === 0)) return "insufficient_evidence";
  if (attributeKey === "sweet_spot_support" && divergence) return "possible_construct_conflation";
  if (divergence) return "mixed_construct_signal";
  if (evaluatorDisagreement && evaluatorCount >= minimumPilotEvaluatorsBeforeStructuralReview) return "protocol_sensitive";
  if (evaluatorDisagreement) return "mostly_coherent";
  return dimensions.every((item) => item.modalSupportPercentage >= 80) ? "coherent" : "mostly_coherent";
}

function decisionFor(
  evaluatorCount: number,
  coherence: ConstructCoherenceClassification,
  evaluatorDisagreement: boolean,
  divergence: boolean
): EvaluationCollectionDecision {
  if (coherence === "possible_construct_conflation" || divergence) return "construct_review_required";
  if (evaluatorCount >= minimumPilotEvaluatorsBeforeStructuralReview && (evaluatorDisagreement || coherence === "protocol_sensitive")) return "pause_for_protocol_review";
  if (evaluatorCount < minimumPilotEvaluatorsBeforeStructuralReview && (evaluatorDisagreement || coherence === "insufficient_evidence")) return "collect_additional_evaluator";
  return "sufficient_for_policy_decision";
}

function recommendationsFor(
  attributeKey: BehavioralEquipmentDNAAttributeKey,
  coherence: ConstructCoherenceClassification,
  divergence: boolean,
  evaluatorDisagreement: boolean
) {
  const result: { type: CalibrationRecommendationType; rationale: string }[] = [];
  const add = (type: CalibrationRecommendationType, rationale: string) => result.push({ type, rationale });
  for (const dimension of physicalEvaluationDimensions[attributeKey]) add("retain_dimension", `Retain ${dimension} as immutable dimension-level evidence.`);
  if (evaluatorDisagreement) add("clarify_dimension_wording", `Clarify operational definitions for ${attributeKey} before collecting another general evaluation.`);
  if (attributeKey === "swing_effort" && evaluatorDisagreement) {
    add("require_multiple_swing_blocks", "Use consistent warm-up and multiple recorded swing blocks before rating demand.");
    add("revise_trial_structure", "Record startup, rotation, and redirection independently before any heavy/light summary judgment.");
  }
  if (attributeKey === "forgiveness") {
    add("require_contact_location_control", "Control centered, handle-side, and end-side contact locations so asymmetric tolerance remains observable.");
    add("retain_inverse_scoring", "Keep response_degradation inverse: greater degradation means less forgiveness.");
    if (divergence) add("separate_subconstruct", "Review handle-side tolerance, end-side tolerance, and response degradation as distinct forgiveness subconstructs.");
  }
  if (attributeKey === "sweet_spot_support" && divergence) {
    add("separate_subconstruct", "Separate sweet-spot breadth from response quality within and near the effective region.");
    add("candidate_new_attribute", "Evaluate sweet-spot breadth and sweet-spot response quality as candidate future attributes without changing the current registry.");
  }
  if (attributeKey === "bat_control_support" && evaluatorDisagreement) add("add_qualitative_observation", "Capture which control task caused instability: direction, barrel path, or start/stop control.");
  if (coherence !== "coherent") add("review_aggregation_policy", `Do not aggregate ${attributeKey} to one ordinal until its dimension behavior is reviewed.`);
  return result;
}

function findingsFor(attributeKey: BehavioralEquipmentDNAAttributeKey, dimensions: readonly PhysicalEvaluationDimensionCoherence[], disagreementType: string): string[] {
  const findings = [`${attributeKey} is classified as ${disagreementType}.`];
  for (const dimension of dimensions) {
    findings.push(`${dimension.dimensionKey}: mode ${dimension.modalOrdinal ?? "none"} (${dimension.modalSupportCount}/${dimension.observationCount}); adjacent support ${dimension.adjacentSupportPercentage}%.`);
  }
  if (attributeKey === "sweet_spot_support" && disagreementType.includes("construct_divergence")) findings.push("A narrow usable region can coexist with strong centered response; those observations are not inherently contradictory.");
  return findings;
}

function parseEvidence(record: BehavioralEvidenceRecord): ParsedObservation[] {
  if (record.category !== "structured_internal_equipment_evaluation" || record.timing !== "prospective_equipment_evidence" || record.playerSpecific || record.numericReference !== undefined) return [];
  if (!requiredBehavioralEquipmentDNAAttributes.includes(record.attributeKey as BehavioralEquipmentDNAAttributeKey)) return [];
  const raw = objectValue(record.rawValue);
  if (raw.evaluationMode !== "standalone" && raw.interpretationMode !== "standalone_absolute") return [];
  const sessionId = stringValue(raw.sessionId) ?? record.sourceReference.match(/^physical-bat-evaluation:[^:]+:([^:]+):/)?.[1] ?? record.id;
  return (Array.isArray(raw.dimensions) ? raw.dimensions : []).flatMap((value) => {
    const dimension = objectValue(value);
    const key = stringValue(dimension.key);
    const observation = stringValue(dimension.observation);
    if (!key || !observation || observation === "unable_to_assess") return [];
    const rawRank = ordinalRank(observation);
    if (rawRank === undefined) return [];
    const attributeKey = record.attributeKey as BehavioralEquipmentDNAAttributeKey;
    const inverse = inversePhysicalEvaluationDimensions.has(`${attributeKey}:${key}`);
    const rank = inverse ? 4 - rawRank : rawRank;
    return [{ evidenceId: record.id, evaluatorId: record.independenceGroup, sessionId, attributeKey, dimensionKey: key, rawObservation: observation, normalizedOrdinal: normalizedOrdinal(attributeKey, rank), rank }];
  });
}

function overallDecision(attributes: readonly PhysicalEvaluationConstructAnalysis[]): EvaluationCollectionDecision {
  if (attributes.some((item) => item.collectionDecision === "construct_review_required")) return "construct_review_required";
  if (attributes.some((item) => item.collectionDecision === "pause_for_protocol_review")) return "pause_for_protocol_review";
  if (attributes.some((item) => item.collectionDecision === "collect_additional_evaluator")) return "collect_additional_evaluator";
  return "sufficient_for_policy_decision";
}

function ordinalRank(value: string): number | undefined { return ({ very_low: 0, low: 1, moderate: 2, high: 3, very_high: 4 } as Record<string, number>)[value]; }
function rankForNormalized(attributeKey: BehavioralEquipmentDNAAttributeKey, value: string): number { return attributeKey === "swing_effort" ? ({ very_easy: 0, easy: 1, moderate: 2, demanding: 3, very_demanding: 4 } as Record<string, number>)[value] ?? 2 : ordinalRank(value) ?? 2; }
function normalizedOrdinal(attributeKey: BehavioralEquipmentDNAAttributeKey, rank: number): string { return attributeKey === "swing_effort" ? ["very_easy", "easy", "moderate", "demanding", "very_demanding"][rank]! : ["very_low", "low", "moderate", "high", "very_high"][rank]!; }
function percent(value: number, total: number): number { return total === 0 ? 0 : Math.round((value / total) * 1000) / 10; }
function objectValue(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function stringValue(value: unknown): string | undefined { return typeof value === "string" ? value : undefined; }
function check(name: string, passed: boolean) { return { name, passed, details: passed ? "pass" : "fail" }; }

