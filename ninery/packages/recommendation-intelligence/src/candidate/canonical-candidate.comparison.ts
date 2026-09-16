import type {
  CompatibilityResultItem,
  CompatibilityRunResult
} from "../compatibility.types.js";
import {
  CANONICAL_CANDIDATE_CLASSIFICATION_PRIORITY,
  CANONICAL_CANDIDATE_DUAL_RUN_COMPARISON_VERSION,
  CANONICAL_CANDIDATE_SCORE_THRESHOLDS,
  type CanonicalCandidateRecommendationVariance,
  type CanonicalCandidateVarianceClassification,
  type DimensionScoreVariance,
  type EquipmentEligibilityVariance,
  type EquipmentRankingVariance,
  type EquipmentScoreVariance,
  type ReasonVariance,
  type ScoreVarianceSeverity,
  type TraceVariance
} from "./canonical-candidate.types.js";

export function compareCanonicalCandidateRecommendationRuns(input: {
  readonly legacy: CompatibilityRunResult;
  readonly candidate?: CompatibilityRunResult;
  readonly candidateFailed?: boolean;
}): CanonicalCandidateRecommendationVariance {
  if (!input.candidate || input.candidateFailed) {
    return {
      classification: "candidate_failed",
      eligibility: [],
      ranking: [],
      overallScores: [],
      dimensionScores: [],
      confidenceScores: [],
      reasons: emptyReasonVariance(),
      tradeoffs: emptyReasonVariance(),
      alternatives: emptyReasonVariance(),
      trace: { comparable: false, expectedProvenanceDifference: false, differences: ["Candidate result is unavailable."] },
      summary: ["Candidate run did not complete safely."]
    };
  }

  const eligibility = compareEligibility(input.legacy, input.candidate);
  const ranking = compareRanking(input.legacy, input.candidate);
  const overallScores = compareOverallScores(input.legacy, input.candidate);
  const dimensionScores = compareDimensionScores(input.legacy, input.candidate);
  const confidenceScores = compareConfidenceScores(input.legacy, input.candidate);
  const reasons = compareReasons(input.legacy, input.candidate);
  const tradeoffs = compareTradeoffs(input.legacy, input.candidate);
  const alternatives = compareAlternatives(input.legacy, input.candidate);
  const trace = compareTrace(input.legacy, input.candidate);
  const classification = classifyVariance({
    eligibility,
    ranking,
    overallScores,
    dimensionScores,
    confidenceScores,
    reasons,
    tradeoffs,
    alternatives,
    trace
  });

  return {
    classification,
    eligibility,
    ranking,
    overallScores,
    dimensionScores,
    confidenceScores,
    reasons,
    tradeoffs,
    alternatives,
    trace,
    summary: buildSummary(classification, eligibility, ranking, overallScores, dimensionScores, confidenceScores, trace)
  };
}

export { CANONICAL_CANDIDATE_DUAL_RUN_COMPARISON_VERSION };

function compareEligibility(legacy: CompatibilityRunResult, candidate: CompatibilityRunResult): EquipmentEligibilityVariance[] {
  const keys = allEquipmentKeys(legacy, candidate);
  return keys.map((key) => {
    const legacyEligible = Boolean(findResultItem(legacy, key));
    const candidateEligible = Boolean(findResultItem(candidate, key));
    const legacyFiltered = legacy.filteredEquipment.find((item) => item.equipmentId === key.equipmentId);
    const candidateFiltered = candidate.filteredEquipment.find((item) => item.equipmentId === key.equipmentId);
    const legacyReasons = legacyFiltered?.reasons.map((reason) => reason.code) ?? [];
    const candidateReasons = candidateFiltered?.reasons.map((reason) => reason.code) ?? [];
    return {
      ...key,
      legacyEligible,
      candidateEligible,
      legacyReasons,
      candidateReasons,
      changed: legacyEligible !== candidateEligible || stableSetKey(legacyReasons) !== stableSetKey(candidateReasons)
    };
  });
}

function compareRanking(legacy: CompatibilityRunResult, candidate: CompatibilityRunResult): EquipmentRankingVariance[] {
  const keys = allEquipmentKeys(legacy, candidate);
  const legacyOrder = orderedRankMap(legacy);
  const candidateOrder = orderedRankMap(candidate);
  return keys.map((key) => {
    const legacyRank = legacyOrder.get(resultKey(key));
    const candidateRank = candidateOrder.get(resultKey(key));
    return {
      ...key,
      legacyRank,
      candidateRank,
      rankDelta: legacyRank !== undefined && candidateRank !== undefined ? candidateRank - legacyRank : undefined
    };
  });
}

function compareOverallScores(legacy: CompatibilityRunResult, candidate: CompatibilityRunResult): EquipmentScoreVariance[] {
  return allEquipmentKeys(legacy, candidate).map((key) =>
    scoreVariance(key, findResultItem(legacy, key)?.overallMatchScore, findResultItem(candidate, key)?.overallMatchScore, "overall")
  );
}

function compareDimensionScores(legacy: CompatibilityRunResult, candidate: CompatibilityRunResult): DimensionScoreVariance[] {
  return allEquipmentKeys(legacy, candidate).flatMap((key) => {
    const legacyItem = findResultItem(legacy, key);
    const candidateItem = findResultItem(candidate, key);
    const dimensions = [...new Set([...(legacyItem?.dimensions.map((dimension) => dimension.code) ?? []), ...(candidateItem?.dimensions.map((dimension) => dimension.code) ?? [])])];
    return dimensions.map((dimension) => ({
      ...scoreVariance(
        key,
        legacyItem?.dimensions.find((item) => item.code === dimension)?.rawScore,
        candidateItem?.dimensions.find((item) => item.code === dimension)?.rawScore,
        "dimension"
      ),
      dimension
    }));
  });
}

function compareConfidenceScores(legacy: CompatibilityRunResult, candidate: CompatibilityRunResult): EquipmentScoreVariance[] {
  return allEquipmentKeys(legacy, candidate).map((key) =>
    scoreVariance(key, findResultItem(legacy, key)?.confidence.score, findResultItem(candidate, key)?.confidence.score, "confidence")
  );
}

function compareReasons(legacy: CompatibilityRunResult, candidate: CompatibilityRunResult): ReasonVariance {
  return reasonSetVariance(reasonCodes(legacy), reasonCodes(candidate));
}

function compareTradeoffs(legacy: CompatibilityRunResult, candidate: CompatibilityRunResult): ReasonVariance {
  return reasonSetVariance(tradeoffCodes(legacy), tradeoffCodes(candidate));
}

function compareAlternatives(legacy: CompatibilityRunResult, candidate: CompatibilityRunResult): ReasonVariance {
  return reasonSetVariance(
    legacy.alternatives.map((item) => item.equipment.equipmentId),
    candidate.alternatives.map((item) => item.equipment.equipmentId)
  );
}

function compareTrace(legacy: CompatibilityRunResult, candidate: CompatibilityRunResult): TraceVariance {
  const differences: string[] = [];
  if (legacy.scoringConfigVersion !== candidate.scoringConfigVersion) differences.push("scoringConfigVersion");
  if (legacy.playerDNAProfileId !== candidate.playerDNAProfileId) differences.push("playerDNAProfileId");
  if (legacy.playerId !== candidate.playerId) differences.push("playerId");
  const legacyItems = orderedItems(legacy);
  const candidateItems = orderedItems(candidate);
  const expectedProvenanceDifference = candidateItems.some((item) => item.trace.equipmentDNAProfileId.startsWith("canonical-candidate:"));
  for (const item of legacyItems) {
    const candidateItem = candidateItems.find((candidate) => candidate.equipment.equipmentId === item.equipment.equipmentId);
    if (!candidateItem) continue;
    if (item.trace.scoringConfigVersion !== candidateItem.trace.scoringConfigVersion) differences.push(`trace.config:${item.equipment.equipmentId}`);
    if (item.trace.playerDNAProfileId !== candidateItem.trace.playerDNAProfileId) differences.push(`trace.player:${item.equipment.equipmentId}`);
  }
  return {
    comparable: differences.length === 0,
    expectedProvenanceDifference,
    differences
  };
}

function classifyVariance(input: {
  readonly eligibility: readonly EquipmentEligibilityVariance[];
  readonly ranking: readonly EquipmentRankingVariance[];
  readonly overallScores: readonly EquipmentScoreVariance[];
  readonly dimensionScores: readonly DimensionScoreVariance[];
  readonly confidenceScores: readonly EquipmentScoreVariance[];
  readonly reasons: ReasonVariance;
  readonly tradeoffs: ReasonVariance;
  readonly alternatives: ReasonVariance;
  readonly trace: TraceVariance;
}): CanonicalCandidateVarianceClassification {
  const candidates: CanonicalCandidateVarianceClassification[] = [];
  if (!input.trace.comparable) candidates.push("candidate_failed");
  if (input.eligibility.some((item) => item.changed)) candidates.push("eligibility_changed");
  if (input.ranking.some((item) => item.rankDelta !== undefined && item.rankDelta !== 0)) candidates.push("ranking_changed");
  if (input.overallScores.some(isMaterial) || input.dimensionScores.some(isMaterial) || input.confidenceScores.some(isMaterial) || input.reasons.removed.length > 0 || input.tradeoffs.removed.length > 0) {
    candidates.push("material_variance");
  }
  if (input.overallScores.some(isMinor) || input.dimensionScores.some(isMinor) || input.confidenceScores.some(isMinor) || input.reasons.added.length > 0 || input.tradeoffs.added.length > 0 || input.alternatives.added.length > 0 || input.alternatives.removed.length > 0) {
    candidates.push("minor_variance");
  }
  if (candidates.length === 0) candidates.push("equivalent");
  return CANONICAL_CANDIDATE_CLASSIFICATION_PRIORITY.find((classification) => candidates.includes(classification)) ?? "equivalent";
}

function scoreVariance(
  key: { readonly equipmentId: string; readonly equipmentVariantId?: string },
  legacyScore: number | undefined,
  candidateScore: number | undefined,
  thresholdType: keyof typeof CANONICAL_CANDIDATE_SCORE_THRESHOLDS
): EquipmentScoreVariance {
  if (legacyScore === undefined || candidateScore === undefined) {
    return { ...key, legacyScore, candidateScore, severity: "missing" };
  }
  const delta = round(candidateScore - legacyScore);
  return {
    ...key,
    legacyScore,
    candidateScore,
    delta,
    severity: classifyScoreDelta(Math.abs(delta), thresholdType)
  };
}

function classifyScoreDelta(
  delta: number,
  thresholdType: keyof typeof CANONICAL_CANDIDATE_SCORE_THRESHOLDS
): ScoreVarianceSeverity {
  const thresholds = CANONICAL_CANDIDATE_SCORE_THRESHOLDS[thresholdType];
  if (delta <= thresholds.negligibleMaximum) return "negligible";
  if (delta <= thresholds.minorMaximum) return "minor";
  return "material";
}

function isMaterial(item: EquipmentScoreVariance) {
  return item.severity === "material" || item.severity === "missing";
}

function isMinor(item: EquipmentScoreVariance) {
  return item.severity === "minor";
}

function allEquipmentKeys(legacy: CompatibilityRunResult, candidate: CompatibilityRunResult) {
  const keys = new Map<string, { equipmentId: string; equipmentVariantId?: string }>();
  for (const item of [...orderedItems(legacy), ...orderedItems(candidate)]) {
    const key = `${item.equipment.equipmentId}:${item.equipment.variantId ?? ""}`;
    keys.set(key, { equipmentId: item.equipment.equipmentId, equipmentVariantId: item.equipment.variantId });
  }
  for (const item of [...legacy.filteredEquipment, ...candidate.filteredEquipment]) {
    if (![...keys.values()].some((key) => key.equipmentId === item.equipmentId)) {
      keys.set(`${item.equipmentId}:`, { equipmentId: item.equipmentId });
    }
  }
  return [...keys.values()].sort((a, b) => a.equipmentId.localeCompare(b.equipmentId));
}

function orderedItems(result: CompatibilityRunResult): CompatibilityResultItem[] {
  return [
    ...(result.primaryRecommendation ? [result.primaryRecommendation] : []),
    ...result.alternatives,
    ...result.nonRecommended
  ];
}

function findResultItem(result: CompatibilityRunResult, key: { readonly equipmentId: string; readonly equipmentVariantId?: string }) {
  return orderedItems(result).find((item) => item.equipment.equipmentId === key.equipmentId && item.equipment.variantId === key.equipmentVariantId);
}

function orderedRankMap(result: CompatibilityRunResult): Map<string, number> {
  return new Map(orderedItems(result).map((item, index) => [resultKey({ equipmentId: item.equipment.equipmentId, equipmentVariantId: item.equipment.variantId }), index + 1]));
}

function resultKey(key: { readonly equipmentId: string; readonly equipmentVariantId?: string }): string {
  return `${key.equipmentId}:${key.equipmentVariantId ?? ""}`;
}

function reasonCodes(result: CompatibilityRunResult): string[] {
  return orderedItems(result).flatMap((item) => item.explanation.topReasons.map((reason) => `${item.equipment.equipmentId}:${reason.dimension}`));
}

function tradeoffCodes(result: CompatibilityRunResult): string[] {
  return orderedItems(result).flatMap((item) => item.explanation.tradeoffs.map((tradeoff) => `${item.equipment.equipmentId}:${tradeoff}`));
}

function reasonSetVariance(legacyValues: readonly string[], candidateValues: readonly string[]): ReasonVariance {
  const legacy = new Set(legacyValues);
  const candidate = new Set(candidateValues);
  return {
    added: [...candidate].filter((value) => !legacy.has(value)).sort(),
    removed: [...legacy].filter((value) => !candidate.has(value)).sort(),
    unchanged: [...legacy].filter((value) => candidate.has(value)).sort()
  };
}

function emptyReasonVariance(): ReasonVariance {
  return { added: [], removed: [], unchanged: [] };
}

function stableSetKey(values: readonly string[]): string {
  return [...values].sort().join("|");
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildSummary(
  classification: CanonicalCandidateVarianceClassification,
  eligibility: readonly EquipmentEligibilityVariance[],
  ranking: readonly EquipmentRankingVariance[],
  overallScores: readonly EquipmentScoreVariance[],
  dimensionScores: readonly DimensionScoreVariance[],
  confidenceScores: readonly EquipmentScoreVariance[],
  trace: TraceVariance
): string[] {
  return [
    `comparison ${CANONICAL_CANDIDATE_DUAL_RUN_COMPARISON_VERSION}`,
    `classification ${classification}`,
    `${eligibility.filter((item) => !item.changed).length}/${eligibility.length} eligibility outcomes unchanged`,
    `${ranking.filter((item) => item.rankDelta === 0).length}/${ranking.length} ranked items unchanged`,
    `${overallScores.filter((item) => item.severity === "negligible").length}/${overallScores.length} overall score deltas negligible`,
    `${dimensionScores.filter((item) => item.severity === "negligible").length}/${dimensionScores.length} dimension score deltas negligible`,
    `${confidenceScores.filter((item) => item.severity === "negligible").length}/${confidenceScores.length} confidence deltas negligible`,
    trace.expectedProvenanceDifference ? "candidate trace uses canonical-candidate provenance as expected" : "candidate trace provenance was not distinguishable"
  ];
}
