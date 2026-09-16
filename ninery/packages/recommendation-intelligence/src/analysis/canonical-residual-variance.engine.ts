import type { EquipmentDNAAttribute, EquipmentDNAProfile, EquipmentDNAScores } from "@ninery/equipment-intelligence";
import type { CompatibilityDimensionCode, CompatibilityInput, CompatibilityResultItem, CompatibilityRunResult } from "../compatibility.types.js";
import { compareCanonicalCandidateRecommendationRuns } from "../candidate/canonical-candidate.comparison.js";
import type { CanonicalCandidateRecommendationRequest } from "../candidate/index.js";
import { runCanonicalCandidateThreePathComparison, type CanonicalCandidateThreePathResult } from "../candidate-selection/index.js";
import { CompatibilityScoringEngine } from "../scoring/compatibility-scoring-engine.js";
import {
  CANONICAL_RESIDUAL_VARIANCE_ANALYSIS_VERSION,
  type CanonicalResidualCauseCode,
  type CanonicalResidualScenarioId,
  type CanonicalResidualScenarioSummary,
  type CanonicalResidualVarianceAnalysis,
  type DimensionResidualDelta,
  type OptionalLegacySignalInventoryItem,
  type OptionalLegacySignalKey,
  type OptionalSignalAttribution,
  type PairwiseResidualAnalysis,
  type ScoreResidualDecomposition
} from "./canonical-residual-variance.types.js";

const supportedLegacyFields = ["batControl", "swingWeight", "barrelForgiveness", "sweetSpotSize", "powerPotential"] as const satisfies readonly EquipmentDNAAttribute[];
const optionalSignals = [
  {
    signal: "balance",
    canonicalKey: "balance_profile",
    legacyField: "balance",
    dimensions: ["SWING_FEEL_BALANCE_FIT"],
    goalFit: false,
    role: "intrinsic_optional",
    causeCode: "MISSING_BALANCE_SIGNAL"
  },
  {
    signal: "confidenceBuilding",
    canonicalKey: "confidence_building_potential",
    legacyField: "confidenceBuilding",
    dimensions: ["CONFIDENCE_BUILDING_FIT", "DEVELOPMENT_GOAL_FIT"],
    goalFit: true,
    role: "relational_experimental",
    causeCode: "MISSING_CONFIDENCE_BUILDING_SIGNAL"
  },
  {
    signal: "transitionFriendliness",
    canonicalKey: "transition_difficulty",
    legacyField: "transitionFriendliness",
    dimensions: ["TRANSITION_READINESS_FIT"],
    goalFit: false,
    role: "relational_experimental",
    causeCode: "MISSING_TRANSITION_SIGNAL"
  }
] as const;

export async function analyzeCanonicalResidualVariance(input: {
  readonly request: CanonicalCandidateRecommendationRequest;
  readonly threePath?: CanonicalCandidateThreePathResult;
  readonly evaluatedAt?: Date;
}): Promise<CanonicalResidualVarianceAnalysis> {
  const threePath = input.threePath ?? await runCanonicalCandidateThreePathComparison(input.request);
  if (!threePath.numericReferenceCandidate) {
    return insufficientDataAnalysis(input.request, threePath, input.evaluatedAt ?? input.request.evaluatedAt ?? new Date());
  }

  const legacy = threePath.legacyAuthoritative;
  const numericCurrent = threePath.numericReferenceCandidate;
  const evaluatedAt = input.evaluatedAt ?? input.request.evaluatedAt ?? threePath.evaluatedAt;
  const scenarioResults = runScenarios(input.request, numericCurrent, legacy);
  const scenarios = scenarioResults.map(([id, result]) => summarizeScenario(id, result, legacy));
  const inventory = buildMissingSignalInventory(input.request.legacyEquipmentInputs, numericCurrent);
  const attribution = buildOptionalSignalAttribution(scenarioResults, legacy);
  const completeness = {
    profileCompletenessDeltaByEquipment: scoreDeltas(legacy, numericCurrent, (item) => item.equipment.profileCompleteness),
    evidenceConfidenceDeltaByEquipment: scoreDeltas(legacy, numericCurrent, (item) => item.equipment.evidenceConfidence.score),
    missingCharacteristicsDeltaByEquipment: scoreDeltas(
      legacy,
      numericCurrent,
      (item) => item.equipment.missingCharacteristics.length
    ),
    completenessPenaltyAffectsMatchScore: scenarioDeltaChanged(scenarioResults, "numeric_reference_current", "numeric_reference_without_completeness_penalty"),
    completenessPenaltyAffectsConfidence: confidenceScenarioDeltaChanged(scenarioResults, "numeric_reference_current", "numeric_reference_without_completeness_penalty"),
    evidenceConfidenceAffectsMatchScore: scenarioDeltaChanged(scenarioResults, "numeric_reference_current", "numeric_reference_legacy_confidence_reference"),
    evidenceConfidenceAffectsConfidence: confidenceScenarioDeltaChanged(scenarioResults, "numeric_reference_current", "numeric_reference_legacy_confidence_reference")
  };
  const variance = compareCanonicalCandidateRecommendationRuns({ legacy, candidate: numericCurrent });
  const decomposition = buildDecomposition(legacy, scenarioResults);
  const iconAtlasPairwise = buildIconAtlasPairwise(scenarioResults, legacy);
  const causeCodes = primaryCauseCodes(inventory, completeness, variance.reasons.added, variance.tradeoffs.added, threePath);

  return {
    version: CANONICAL_RESIDUAL_VARIANCE_ANALYSIS_VERSION,
    liveRecommendationSource: "legacy",
    candidateAffectsLiveResult: false,
    threePathConclusion: threePath.precisionRestoration.conclusion,
    missingSignalInventory: inventory,
    scenarios,
    optionalSignalAttribution: attribution,
    completeness,
    normalization: {
      missingOptionalSignalsAreTreatedAsZero: false,
      missingOptionalDimensionRawScore: 50,
      weightsRenormalizedWhenSignalsMissing: false,
      affectedDimensions: ["SWING_FEEL_BALANCE_FIT", "CONFIDENCE_BUILDING_FIT", "TRANSITION_READINESS_FIT"],
      explanation: "Missing legacy optional fields create neutral 50-point dimensions through buildDimension(), preserve the original weights, and add missing-information penalties to recommendation confidence."
    },
    thresholds: {
      reasonThresholdCrossings: [...variance.reasons.added, ...variance.reasons.removed],
      tradeoffThresholdCrossings: [...variance.tradeoffs.added, ...variance.tradeoffs.removed],
      alternativeSetChanges: [...variance.alternatives.added, ...variance.alternatives.removed]
    },
    trace: {
      expectedDifferences: variance.trace.expectedProvenanceDifference ? ["canonical-candidate equipmentDNAProfileId provenance"] : [],
      unexpectedDifferences: variance.trace.differences,
      provenanceOnly: variance.trace.expectedProvenanceDifference && variance.trace.differences.length === 0
    },
    decomposition,
    iconAtlasPairwise,
    primaryCauseCodes: causeCodes,
    architectureRecommendations: architectureRecommendations(causeCodes),
    activationReadiness: causeCodes.includes("MISSING_BALANCE_SIGNAL") || causeCodes.includes("MISSING_CONFIDENCE_BUILDING_SIGNAL") || causeCodes.includes("MISSING_TRANSITION_SIGNAL")
      ? "ready_after_optional_signal_policy"
      : "ready_for_shadow_only_observation",
    evaluatedAt
  };
}

function insufficientDataAnalysis(
  request: CanonicalCandidateRecommendationRequest,
  threePath: CanonicalCandidateThreePathResult,
  evaluatedAt: Date
): CanonicalResidualVarianceAnalysis {
  const inventory = buildMissingSignalInventory(request.legacyEquipmentInputs, undefined);
  return {
    version: CANONICAL_RESIDUAL_VARIANCE_ANALYSIS_VERSION,
    liveRecommendationSource: "legacy",
    candidateAffectsLiveResult: false,
    threePathConclusion: threePath.precisionRestoration.conclusion,
    missingSignalInventory: inventory,
    scenarios: [],
    optionalSignalAttribution: [],
    completeness: {
      profileCompletenessDeltaByEquipment: [],
      evidenceConfidenceDeltaByEquipment: [],
      missingCharacteristicsDeltaByEquipment: [],
      completenessPenaltyAffectsMatchScore: false,
      completenessPenaltyAffectsConfidence: false,
      evidenceConfidenceAffectsMatchScore: false,
      evidenceConfidenceAffectsConfidence: false
    },
    normalization: {
      missingOptionalSignalsAreTreatedAsZero: false,
      missingOptionalDimensionRawScore: 50,
      weightsRenormalizedWhenSignalsMissing: false,
      affectedDimensions: ["SWING_FEEL_BALANCE_FIT", "CONFIDENCE_BUILDING_FIT", "TRANSITION_READINESS_FIT"],
      explanation: "Numeric-reference candidate did not complete, so residual scenario analysis could not run."
    },
    thresholds: { reasonThresholdCrossings: [], tradeoffThresholdCrossings: [], alternativeSetChanges: [] },
    trace: { expectedDifferences: [], unexpectedDifferences: ["numeric-reference candidate unavailable"], provenanceOnly: false },
    decomposition: [],
    iconAtlasPairwise: { sourceLabel: "Rawlings ICON", targetLabel: "Louisville Slugger Atlas", optionalCarryoverGapDeltas: [], rankingOrderRestored: false },
    primaryCauseCodes: ["SUPPORTED_NUMERIC_REFERENCE_PATH_RESTORES_RANKING"],
    architectureRecommendations: ["Keep the canonical candidate in shadow mode until the numeric-reference run completes consistently."],
    activationReadiness: "insufficient_data",
    evaluatedAt
  };
}

function runScenarios(
  request: CanonicalCandidateRecommendationRequest,
  numericCurrent: CompatibilityRunResult,
  legacy: CompatibilityRunResult
): Array<[CanonicalResidualScenarioId, CompatibilityRunResult]> {
  const numericEquipment = orderedItems(numericCurrent).map((item) => item.equipment);
  const legacyEquipment = orderedItems(legacy).map((item) => item.equipment);
  const score = (equipment: readonly EquipmentDNAProfile[]) =>
    new CompatibilityScoringEngine().score({ playerDNA: request.playerInput, equipment: [...equipment], context: request.requestContext });

  return [
    ["legacy_full", legacy],
    ["numeric_reference_current", numericCurrent],
    ["legacy_supported_only", score(legacyEquipment.map(legacySupportedOnly))],
    ["numeric_reference_supported_only", score(numericEquipment.map((equipment) => cloneEquipment(equipment)))],
    ["numeric_reference_with_balance_carryover", score(carryOverOptionalSignals(numericEquipment, legacyEquipment, ["balance"]))],
    ["numeric_reference_with_confidence_building_carryover", score(carryOverOptionalSignals(numericEquipment, legacyEquipment, ["confidenceBuilding"]))],
    ["numeric_reference_with_transition_carryover", score(carryOverOptionalSignals(numericEquipment, legacyEquipment, ["transitionFriendliness"]))],
    ["numeric_reference_with_all_optional_carryover", score(carryOverOptionalSignals(numericEquipment, legacyEquipment, ["balance", "confidenceBuilding", "transitionFriendliness"]))],
    ["numeric_reference_without_completeness_penalty", score(neutralizeCompleteness(numericEquipment, legacyEquipment))],
    ["numeric_reference_legacy_confidence_reference", score(neutralizeEvidenceConfidence(numericEquipment, legacyEquipment))]
  ];
}

function legacySupportedOnly(equipment: EquipmentDNAProfile): EquipmentDNAProfile {
  const scores = pickScores(equipment.scores, supportedLegacyFields);
  const missing = new Set(equipment.missingCharacteristics);
  for (const optional of optionalSignals) missing.add(optional.legacyField);
  return { ...cloneEquipment(equipment), scores, missingCharacteristics: [...missing].sort() };
}

function carryOverOptionalSignals(
  numericEquipment: readonly EquipmentDNAProfile[],
  legacyEquipment: readonly EquipmentDNAProfile[],
  signals: readonly OptionalLegacySignalKey[]
): EquipmentDNAProfile[] {
  return numericEquipment.map((equipment) => {
    const legacy = findMatchingEquipment(legacyEquipment, equipment);
    const clone = cloneEquipment(equipment);
    const scores: EquipmentDNAScores = { ...clone.scores };
    const missing = new Set(clone.missingCharacteristics);
    for (const signal of signals) {
      const legacyValue = legacy?.scores[signal];
      if (legacyValue !== undefined) {
        scores[signal] = legacyValue;
        missing.delete(signal);
      }
    }
    return { ...clone, scores, missingCharacteristics: [...missing].sort() };
  });
}

function neutralizeCompleteness(
  numericEquipment: readonly EquipmentDNAProfile[],
  legacyEquipment: readonly EquipmentDNAProfile[]
): EquipmentDNAProfile[] {
  return numericEquipment.map((equipment) => {
    const legacy = findMatchingEquipment(legacyEquipment, equipment);
    return { ...cloneEquipment(equipment), profileCompleteness: legacy?.profileCompleteness ?? equipment.profileCompleteness };
  });
}

function neutralizeEvidenceConfidence(
  numericEquipment: readonly EquipmentDNAProfile[],
  legacyEquipment: readonly EquipmentDNAProfile[]
): EquipmentDNAProfile[] {
  return numericEquipment.map((equipment) => {
    const legacy = findMatchingEquipment(legacyEquipment, equipment);
    return { ...cloneEquipment(equipment), evidenceConfidence: { ...(legacy?.evidenceConfidence ?? equipment.evidenceConfidence) } };
  });
}

function buildMissingSignalInventory(
  legacyEquipment: readonly EquipmentDNAProfile[],
  numericCandidate?: CompatibilityRunResult
): OptionalLegacySignalInventoryItem[] {
  const numericEquipment = numericCandidate ? orderedItems(numericCandidate).map((item) => item.equipment) : [];
  return optionalSignals.map((signal) => ({
    signal: signal.signal,
    canonicalKey: signal.canonicalKey,
    legacyField: signal.legacyField,
    presentInLegacyCount: legacyEquipment.filter((equipment) => equipment.scores[signal.legacyField] !== undefined).length,
    presentInNumericReferenceCount: numericEquipment.filter((equipment) => equipment.scores[signal.legacyField] !== undefined).length,
    affectedDimensions: signal.dimensions,
    affectsDevelopmentGoalFit: signal.goalFit,
    affectsConfidence: true,
    affectsReasonSelection: true,
    affectsTradeoffSelection: true,
    affectsTieBreakReference: false,
    recommendationRole: signal.role,
    causeCode: signal.causeCode
  }));
}

function buildOptionalSignalAttribution(
  scenarios: readonly [CanonicalResidualScenarioId, CompatibilityRunResult][],
  legacy: CompatibilityRunResult
): OptionalSignalAttribution[] {
  const current = scenarioResult(scenarios, "numeric_reference_current");
  const mappings = [
    { signal: "balance", scenarioId: "numeric_reference_with_balance_carryover", causeCodes: ["MISSING_BALANCE_SIGNAL"] },
    { signal: "confidenceBuilding", scenarioId: "numeric_reference_with_confidence_building_carryover", causeCodes: ["MISSING_CONFIDENCE_BUILDING_SIGNAL"] },
    { signal: "transitionFriendliness", scenarioId: "numeric_reference_with_transition_carryover", causeCodes: ["MISSING_TRANSITION_SIGNAL"] },
    { signal: "all_optional", scenarioId: "numeric_reference_with_all_optional_carryover", causeCodes: ["OPTIONAL_SIGNAL_CARRYOVER_REDUCES_RESIDUAL"] }
  ] as const;

  return mappings.map((mapping) => {
    const after = scenarioResult(scenarios, mapping.scenarioId);
    return {
      signal: mapping.signal,
      scenarioId: mapping.scenarioId,
      overallScoreDeltaByEquipment: scoreDeltas(current, after, (item) => item.overallMatchScore),
      confidenceDeltaByEquipment: scoreDeltas(current, after, (item) => item.confidence.score),
      dimensionDeltaByEquipment: dimensionDeltas(current, after),
      iconAtlasGapDelta: subtract(gap(after, "Rawlings", "ICON", "Louisville Slugger", "Atlas"), gap(current, "Rawlings", "ICON", "Louisville Slugger", "Atlas")),
      rankingChangedFromNumericReferenceCurrent: rankingDistance(current, after) > 0,
      reasonAlignmentDelta: round(reasonAlignmentRatio(legacy, after) - reasonAlignmentRatio(legacy, current)),
      tradeoffAlignmentDelta: round(tradeoffAlignmentRatio(legacy, after) - tradeoffAlignmentRatio(legacy, current)),
      causeCodes: mapping.causeCodes
    };
  });
}

function summarizeScenario(
  id: CanonicalResidualScenarioId,
  result: CompatibilityRunResult,
  legacy: CompatibilityRunResult
): CanonicalResidualScenarioSummary {
  const winner = result.primaryRecommendation;
  return {
    id,
    result,
    ranking: orderedItems(result).map((item) => label(item.equipment)),
    winnerEquipmentId: winner?.equipment.equipmentId,
    winnerLabel: winner ? label(winner.equipment) : undefined,
    winnerMatchesLegacy: winner?.equipment.equipmentId === legacy.primaryRecommendation?.equipment.equipmentId,
    rankingDistanceFromLegacy: rankingDistance(legacy, result),
    averageOverallScoreDeltaFromLegacy: averageAbs(scoreDeltas(legacy, result, (item) => item.overallMatchScore)),
    maximumOverallScoreDeltaFromLegacy: maxAbs(scoreDeltas(legacy, result, (item) => item.overallMatchScore)),
    averageDimensionDeltaFromLegacy: averageAbs(dimensionDeltas(legacy, result)),
    averageConfidenceDeltaFromLegacy: averageAbs(scoreDeltas(legacy, result, (item) => item.confidence.score)),
    reasonAlignmentRatio: reasonAlignmentRatio(legacy, result),
    tradeoffAlignmentRatio: tradeoffAlignmentRatio(legacy, result),
    iconAtlasGap: gap(result, "Rawlings", "ICON", "Louisville Slugger", "Atlas")
  };
}

function buildDecomposition(
  legacy: CompatibilityRunResult,
  scenarios: readonly [CanonicalResidualScenarioId, CompatibilityRunResult][]
): ScoreResidualDecomposition[] {
  const current = scenarioResult(scenarios, "numeric_reference_current");
  const optional = scenarioResult(scenarios, "numeric_reference_with_all_optional_carryover");
  const completeness = scenarioResult(scenarios, "numeric_reference_without_completeness_penalty");
  const evidence = scenarioResult(scenarios, "numeric_reference_legacy_confidence_reference");

  return orderedItems(legacy).map((legacyItem) => {
    const key = resultKey(legacyItem);
    const currentScore = findItem(current, key)?.overallMatchScore;
    const legacyScore = legacyItem.overallMatchScore;
    const allOptionalSignalContribution = subtract(findItem(optional, key)?.overallMatchScore, currentScore) ?? 0;
    const completenessContribution = subtract(findItem(completeness, key)?.overallMatchScore, currentScore) ?? 0;
    const evidenceConfidenceContribution = subtract(findItem(evidence, key)?.overallMatchScore, currentScore) ?? 0;
    const totalResidual = subtract(currentScore, legacyScore) ?? 0;
    return {
      equipmentId: legacyItem.equipment.equipmentId,
      equipmentVariantId: legacyItem.equipment.variantId,
      label: label(legacyItem.equipment),
      totalResidual: round(totalResidual),
      allOptionalSignalContribution: round(allOptionalSignalContribution),
      completenessContribution: round(completenessContribution),
      evidenceConfidenceContribution: round(evidenceConfidenceContribution),
      unexplainedResidual: round(totalResidual + allOptionalSignalContribution + completenessContribution + evidenceConfidenceContribution)
    };
  });
}

function buildIconAtlasPairwise(
  scenarios: readonly [CanonicalResidualScenarioId, CompatibilityRunResult][],
  legacy: CompatibilityRunResult
): PairwiseResidualAnalysis {
  const current = scenarioResult(scenarios, "numeric_reference_current");
  return {
    sourceLabel: "Rawlings ICON",
    targetLabel: "Louisville Slugger Atlas",
    legacyGap: gap(legacy, "Rawlings", "ICON", "Louisville Slugger", "Atlas"),
    numericReferenceGap: gap(current, "Rawlings", "ICON", "Louisville Slugger", "Atlas"),
    gapResidual: subtract(gap(current, "Rawlings", "ICON", "Louisville Slugger", "Atlas"), gap(legacy, "Rawlings", "ICON", "Louisville Slugger", "Atlas")),
    optionalCarryoverGapDeltas: [
      { signal: "balance", delta: gapDelta(scenarios, "numeric_reference_with_balance_carryover", current) },
      { signal: "confidenceBuilding", delta: gapDelta(scenarios, "numeric_reference_with_confidence_building_carryover", current) },
      { signal: "transitionFriendliness", delta: gapDelta(scenarios, "numeric_reference_with_transition_carryover", current) },
      { signal: "all_optional", delta: gapDelta(scenarios, "numeric_reference_with_all_optional_carryover", current) }
    ],
    rankingOrderRestored: current.primaryRecommendation?.equipment.manufacturer === "Rawlings"
  };
}

function primaryCauseCodes(
  inventory: readonly OptionalLegacySignalInventoryItem[],
  completeness: { readonly completenessPenaltyAffectsMatchScore: boolean; readonly evidenceConfidenceAffectsMatchScore: boolean },
  reasonCrossings: readonly string[],
  tradeoffCrossings: readonly string[],
  threePath: CanonicalCandidateThreePathResult
): CanonicalResidualCauseCode[] {
  const codes = new Set<CanonicalResidualCauseCode>();
  if (threePath.precisionRestoration.numericReferenceWinnerMatchesLegacy) codes.add("SUPPORTED_NUMERIC_REFERENCE_PATH_RESTORES_RANKING");
  for (const item of inventory) {
    if (item.presentInLegacyCount > item.presentInNumericReferenceCount) codes.add(item.causeCode);
  }
  if (completeness.completenessPenaltyAffectsMatchScore) codes.add("INPUT_COMPLETENESS_CHANGED");
  if (completeness.evidenceConfidenceAffectsMatchScore) codes.add("EVIDENCE_CONFIDENCE_CHANGED");
  if (reasonCrossings.length > 0) codes.add("REASON_THRESHOLD_CROSSING");
  if (tradeoffCrossings.length > 0) codes.add("TRADEOFF_THRESHOLD_CROSSING");
  codes.add("NEUTRAL_MISSING_DIMENSION_SCORE");
  codes.add("EXPECTED_CANONICAL_PROVENANCE_TRACE");
  return [...codes].sort();
}

function architectureRecommendations(codes: readonly CanonicalResidualCauseCode[]): string[] {
  const recommendations = [
    "Keep the canonical numeric-reference candidate in shadow mode; Ticket #027 restored ranking order but not full score parity.",
    "Define an explicit canonical balance_profile numeric-reference policy before allowing canonical profiles to replace legacy balance scoring."
  ];
  if (codes.includes("MISSING_CONFIDENCE_BUILDING_SIGNAL")) {
    recommendations.push("Treat confidence-building as a relational compatibility signal until an approved intrinsic model exists.");
  }
  if (codes.includes("MISSING_TRANSITION_SIGNAL")) {
    recommendations.push("Treat transition friendliness/difficulty as a relational transition model rather than a direct intrinsic equipment fact.");
  }
  recommendations.push("Add parity thresholds for score, confidence, reasons, tradeoffs, and trace before any source-of-truth switch.");
  return recommendations;
}

function scoreDeltas(
  before: CompatibilityRunResult,
  after: CompatibilityRunResult,
  selector: (item: CompatibilityResultItem) => number | undefined
) {
  return orderedItems(before).map((item) => {
    const next = findItem(after, resultKey(item));
    const beforeValue = selector(item);
    const afterValue = next ? selector(next) : undefined;
    return {
      equipmentId: item.equipment.equipmentId,
      equipmentVariantId: item.equipment.variantId,
      label: label(item.equipment),
      before: beforeValue,
      after: afterValue,
      delta: subtract(afterValue, beforeValue)
    };
  });
}

function dimensionDeltas(before: CompatibilityRunResult, after: CompatibilityRunResult): DimensionResidualDelta[] {
  return orderedItems(before).flatMap((item) => {
    const next = findItem(after, resultKey(item));
    return item.dimensions.map((dimension) => {
      const afterDimension = next?.dimensions.find((candidate) => candidate.code === dimension.code);
      return {
        equipmentId: item.equipment.equipmentId,
        equipmentVariantId: item.equipment.variantId,
        label: label(item.equipment),
        dimension: dimension.code,
        before: dimension.rawScore,
        after: afterDimension?.rawScore,
        delta: subtract(afterDimension?.rawScore, dimension.rawScore)
      };
    });
  });
}

function scenarioDeltaChanged(
  scenarios: readonly [CanonicalResidualScenarioId, CompatibilityRunResult][],
  beforeId: CanonicalResidualScenarioId,
  afterId: CanonicalResidualScenarioId
): boolean {
  return scoreDeltas(scenarioResult(scenarios, beforeId), scenarioResult(scenarios, afterId), (item) => item.overallMatchScore)
    .some((delta) => Math.abs(delta.delta ?? 0) > 0.01);
}

function confidenceScenarioDeltaChanged(
  scenarios: readonly [CanonicalResidualScenarioId, CompatibilityRunResult][],
  beforeId: CanonicalResidualScenarioId,
  afterId: CanonicalResidualScenarioId
): boolean {
  return scoreDeltas(scenarioResult(scenarios, beforeId), scenarioResult(scenarios, afterId), (item) => item.confidence.score)
    .some((delta) => Math.abs(delta.delta ?? 0) > 0.01);
}

function rankingDistance(a: CompatibilityRunResult, b: CompatibilityRunResult): number {
  const aOrder = new Map(orderedItems(a).map((item, index) => [resultKey(item), index + 1]));
  return orderedItems(b).reduce((sum, item, index) => {
    const previous = aOrder.get(resultKey(item));
    return previous === undefined ? sum + orderedItems(b).length : sum + Math.abs(previous - (index + 1));
  }, 0);
}

function reasonAlignmentRatio(a: CompatibilityRunResult, b: CompatibilityRunResult): number {
  return setAlignment(reasonCodes(a), reasonCodes(b));
}

function tradeoffAlignmentRatio(a: CompatibilityRunResult, b: CompatibilityRunResult): number {
  return setAlignment(tradeoffCodes(a), tradeoffCodes(b));
}

function setAlignment(a: readonly string[], b: readonly string[]): number {
  const left = new Set(a);
  const right = new Set(b);
  const union = new Set([...left, ...right]);
  if (union.size === 0) return 1;
  return round([...union].filter((item) => left.has(item) && right.has(item)).length / union.size);
}

function reasonCodes(result: CompatibilityRunResult): string[] {
  return orderedItems(result).flatMap((item) => item.explanation.topReasons.map((reason) => `${item.equipment.equipmentId}:${reason.dimension}`));
}

function tradeoffCodes(result: CompatibilityRunResult): string[] {
  return orderedItems(result).flatMap((item) => item.explanation.tradeoffs.map((tradeoff) => `${item.equipment.equipmentId}:${tradeoff}`));
}

function gapDelta(
  scenarios: readonly [CanonicalResidualScenarioId, CompatibilityRunResult][],
  scenarioId: CanonicalResidualScenarioId,
  current: CompatibilityRunResult
): number | undefined {
  return subtract(gap(scenarioResult(scenarios, scenarioId), "Rawlings", "ICON", "Louisville Slugger", "Atlas"), gap(current, "Rawlings", "ICON", "Louisville Slugger", "Atlas"));
}

function gap(
  result: CompatibilityRunResult,
  sourceManufacturer: string,
  sourceModel: string,
  targetManufacturer: string,
  targetModel: string
): number | undefined {
  const source = orderedItems(result).find((item) => item.equipment.manufacturer === sourceManufacturer && item.equipment.model === sourceModel);
  const target = orderedItems(result).find((item) => item.equipment.manufacturer === targetManufacturer && item.equipment.model === targetModel);
  return subtract(source?.overallMatchScore, target?.overallMatchScore);
}

function scenarioResult(
  scenarios: readonly [CanonicalResidualScenarioId, CompatibilityRunResult][],
  id: CanonicalResidualScenarioId
): CompatibilityRunResult {
  const match = scenarios.find(([scenarioId]) => scenarioId === id);
  if (!match) throw new Error(`Missing residual scenario ${id}.`);
  return match[1];
}

function findMatchingEquipment(equipment: readonly EquipmentDNAProfile[], target: EquipmentDNAProfile): EquipmentDNAProfile | undefined {
  return equipment.find((item) => item.equipmentId === target.equipmentId && item.variantId === target.variantId);
}

function findItem(result: CompatibilityRunResult, key: string): CompatibilityResultItem | undefined {
  return orderedItems(result).find((item) => resultKey(item) === key);
}

function resultKey(item: CompatibilityResultItem | EquipmentDNAProfile): string {
  if ("equipment" in item) return `${item.equipment.equipmentId}:${item.equipment.variantId ?? ""}`;
  return `${item.equipmentId}:${item.variantId ?? ""}`;
}

function orderedItems(result: CompatibilityRunResult): CompatibilityResultItem[] {
  return [
    ...(result.primaryRecommendation ? [result.primaryRecommendation] : []),
    ...result.alternatives,
    ...result.nonRecommended
  ];
}

function pickScores(scores: EquipmentDNAScores, fields: readonly EquipmentDNAAttribute[]): EquipmentDNAScores {
  const picked: EquipmentDNAScores = {};
  for (const field of fields) {
    if (scores[field] !== undefined) picked[field] = scores[field];
  }
  return picked;
}

function cloneEquipment(equipment: EquipmentDNAProfile): EquipmentDNAProfile {
  return {
    ...equipment,
    evidenceConfidence: { ...equipment.evidenceConfidence },
    secondaryPersonalities: equipment.secondaryPersonalities.map((personality) => ({ ...personality })),
    fitProfiles: equipment.fitProfiles.map((fit) => ({ ...fit })),
    specifications: equipment.specifications.map((specification) => ({ ...specification })),
    availableVariants: equipment.availableVariants.map((variant) => ({ ...variant })),
    selectedVariant: equipment.selectedVariant ? { ...equipment.selectedVariant } : undefined,
    scores: { ...equipment.scores },
    missingCharacteristics: [...equipment.missingCharacteristics],
    explanations: equipment.explanations.map((explanation) => ({ ...explanation, evidence: explanation.evidence.map((evidence) => ({ ...evidence })) })),
    eligibility: { ...equipment.eligibility, reasons: [...equipment.eligibility.reasons] }
  };
}

function label(equipment: { manufacturer: string; model: string; modelYear?: number }): string {
  return `${equipment.manufacturer} ${equipment.model}${equipment.modelYear ? ` ${equipment.modelYear}` : ""}`;
}

function subtract(a: number | undefined, b: number | undefined): number | undefined {
  if (a === undefined || b === undefined) return undefined;
  return round(a - b);
}

function averageAbs(values: readonly { readonly delta?: number }[]): number {
  const numbers = values.map((value) => Math.abs(value.delta ?? 0));
  return round(numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : 0);
}

function maxAbs(values: readonly { readonly delta?: number }[]): number {
  return round(Math.max(0, ...values.map((value) => Math.abs(value.delta ?? 0))));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function createResidualAnalysisInput(input: CompatibilityInput): CompatibilityInput {
  return input;
}
