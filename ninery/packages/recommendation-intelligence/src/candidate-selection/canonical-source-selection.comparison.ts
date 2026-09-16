import type { CompatibilityRunResult } from "../compatibility.types.js";
import type { CanonicalCandidatePrecisionRestorationAnalysis } from "./canonical-attribute-source-selection.types.js";

export function calculateRankingDistance(legacy: CompatibilityRunResult, candidate?: CompatibilityRunResult): number {
  if (!candidate) return Number.POSITIVE_INFINITY;
  const legacyRanks = rankMap(legacy);
  const candidateRanks = rankMap(candidate);
  let distance = 0;
  for (const [equipmentId, legacyRank] of legacyRanks) {
    const candidateRank = candidateRanks.get(equipmentId);
    distance += candidateRank === undefined ? legacyRanks.size : Math.abs(legacyRank - candidateRank);
  }
  return distance;
}

export function analyzePrecisionRestoration(input: {
  readonly legacy: CompatibilityRunResult;
  readonly ordinalCandidate?: CompatibilityRunResult;
  readonly numericReferenceCandidate?: CompatibilityRunResult;
}): CanonicalCandidatePrecisionRestorationAnalysis {
  const legacyWinnerId = input.legacy.primaryRecommendation?.equipment.equipmentId ?? "missing";
  const ordinalCandidateWinnerId = input.ordinalCandidate?.primaryRecommendation?.equipment.equipmentId;
  const numericReferenceCandidateWinnerId = input.numericReferenceCandidate?.primaryRecommendation?.equipment.equipmentId;
  const ordinalAverageScoreDelta = averageOverallDelta(input.legacy, input.ordinalCandidate);
  const numericReferenceAverageScoreDelta = averageOverallDelta(input.legacy, input.numericReferenceCandidate);
  const ordinalDimensionVariance = averageDimensionDelta(input.legacy, input.ordinalCandidate);
  const numericReferenceDimensionVariance = averageDimensionDelta(input.legacy, input.numericReferenceCandidate);
  const ordinalReasonAlignmentRatio = reasonAlignment(input.legacy, input.ordinalCandidate);
  const numericReferenceReasonAlignmentRatio = reasonAlignment(input.legacy, input.numericReferenceCandidate);
  const ordinalRankingDistance = calculateRankingDistance(input.legacy, input.ordinalCandidate);
  const numericReferenceRankingDistance = calculateRankingDistance(input.legacy, input.numericReferenceCandidate);
  const numericReferenceImprovedWinnerAlignment = ordinalCandidateWinnerId !== legacyWinnerId && numericReferenceCandidateWinnerId === legacyWinnerId;
  const numericReferenceImprovedRankingAlignment = numericReferenceRankingDistance < ordinalRankingDistance;
  const numericReferenceReducedScoreVariance = numericReferenceAverageScoreDelta < ordinalAverageScoreDelta;
  const numericReferenceReducedDimensionVariance = numericReferenceDimensionVariance < ordinalDimensionVariance;
  const numericReferenceImprovedReasonAlignment = numericReferenceReasonAlignmentRatio > ordinalReasonAlignmentRatio;
  const improvementCount = [
    numericReferenceImprovedWinnerAlignment,
    numericReferenceImprovedRankingAlignment,
    numericReferenceReducedScoreVariance,
    numericReferenceReducedDimensionVariance,
    numericReferenceImprovedReasonAlignment
  ].filter(Boolean).length;

  return {
    legacyWinnerId,
    ordinalCandidateWinnerId,
    numericReferenceCandidateWinnerId,
    ordinalWinnerMatchesLegacy: ordinalCandidateWinnerId === legacyWinnerId,
    numericReferenceWinnerMatchesLegacy: numericReferenceCandidateWinnerId === legacyWinnerId,
    ordinalRankingDistance,
    numericReferenceRankingDistance,
    ordinalAverageScoreDelta,
    numericReferenceAverageScoreDelta,
    ordinalMaximumScoreDelta: maximumOverallDelta(input.legacy, input.ordinalCandidate),
    numericReferenceMaximumScoreDelta: maximumOverallDelta(input.legacy, input.numericReferenceCandidate),
    ordinalDimensionVariance,
    numericReferenceDimensionVariance,
    ordinalReasonAlignmentRatio,
    numericReferenceReasonAlignmentRatio,
    numericReferenceImprovedWinnerAlignment,
    numericReferenceImprovedRankingAlignment,
    numericReferenceReducedScoreVariance,
    numericReferenceReducedDimensionVariance,
    numericReferenceImprovedReasonAlignment,
    conclusion: !input.ordinalCandidate || !input.numericReferenceCandidate
      ? "insufficient_data"
      : improvementCount >= 4
        ? "numeric_reference_materially_improved_alignment"
        : improvementCount >= 2
          ? "numeric_reference_modestly_improved_alignment"
          : improvementCount === 0 && (numericReferenceAverageScoreDelta > ordinalAverageScoreDelta || numericReferenceRankingDistance > ordinalRankingDistance)
            ? "numeric_reference_reduced_alignment"
            : "numeric_reference_no_meaningful_improvement"
  };
}

function orderedItems(result: CompatibilityRunResult) {
  return [...(result.primaryRecommendation ? [result.primaryRecommendation] : []), ...result.alternatives, ...result.nonRecommended];
}

function rankMap(result: CompatibilityRunResult): Map<string, number> {
  return new Map(orderedItems(result).map((item, index) => [item.equipment.equipmentId, index + 1]));
}

function averageOverallDelta(legacy: CompatibilityRunResult, candidate?: CompatibilityRunResult): number {
  const deltas = overallDeltas(legacy, candidate);
  return round(deltas.reduce((sum, value) => sum + value, 0) / (deltas.length || 1));
}

function maximumOverallDelta(legacy: CompatibilityRunResult, candidate?: CompatibilityRunResult): number {
  return round(Math.max(0, ...overallDeltas(legacy, candidate)));
}

function overallDeltas(legacy: CompatibilityRunResult, candidate?: CompatibilityRunResult): number[] {
  if (!candidate) return [];
  return orderedItems(legacy).map((legacyItem) => {
    const candidateItem = orderedItems(candidate).find((item) => item.equipment.equipmentId === legacyItem.equipment.equipmentId);
    return candidateItem ? Math.abs(candidateItem.overallMatchScore - legacyItem.overallMatchScore) : 100;
  });
}

function averageDimensionDelta(legacy: CompatibilityRunResult, candidate?: CompatibilityRunResult): number {
  if (!candidate) return 0;
  const deltas = orderedItems(legacy).flatMap((legacyItem) => {
    const candidateItem = orderedItems(candidate).find((item) => item.equipment.equipmentId === legacyItem.equipment.equipmentId);
    return legacyItem.dimensions.map((dimension) => Math.abs((candidateItem?.dimensions.find((item) => item.code === dimension.code)?.rawScore ?? 0) - dimension.rawScore));
  });
  return round(deltas.reduce((sum, value) => sum + value, 0) / (deltas.length || 1));
}

function reasonAlignment(legacy: CompatibilityRunResult, candidate?: CompatibilityRunResult): number {
  if (!candidate) return 0;
  const legacyReasons = new Set(orderedItems(legacy).flatMap((item) => item.explanation.topReasons.map((reason) => `${item.equipment.equipmentId}:${reason.dimension}`)));
  const candidateReasons = new Set(orderedItems(candidate).flatMap((item) => item.explanation.topReasons.map((reason) => `${item.equipment.equipmentId}:${reason.dimension}`)));
  const intersection = [...legacyReasons].filter((reason) => candidateReasons.has(reason)).length;
  const union = new Set([...legacyReasons, ...candidateReasons]).size;
  return round(union ? intersection / union : 1);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
