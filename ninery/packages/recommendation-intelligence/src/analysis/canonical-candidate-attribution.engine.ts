import type { EquipmentDNAAttribute, EquipmentDNAProfile } from "@ninery/equipment-intelligence";
import { CompatibilityScoringEngine } from "../scoring/compatibility-scoring-engine.js";
import type { CompatibilityRunResult } from "../compatibility.types.js";
import type {
  CanonicalCandidateDualRunResult,
  CanonicalCandidateMappedAttribute,
  CanonicalCandidateRecommendationRequest
} from "../candidate/index.js";
import {
  CANONICAL_CANDIDATE_ATTRIBUTION_VERSION,
  CANONICAL_CANDIDATE_CALIBRATION_VERSION,
  type CandidateAttributionCause,
  type CandidateAttributeContribution,
  type CandidateCalibrationScenarioName,
  type CandidateInputFieldVariance,
  type CandidateMappingCompressionEntry,
  type CandidateWeightedScoreContribution,
  type CanonicalCandidateEquipmentAttribution,
  type CanonicalCandidateVarianceAttribution,
  type EquipmentIdentity,
  type PairwiseWinnerAttribution
} from "./canonical-candidate-attribution.types.js";
import {
  runCalibrationScenario,
  supportedCandidateFields,
  unsupportedCandidateFields
} from "./canonical-candidate-calibration.js";

const fieldToCanonicalKey = {
  batControl: "bat_control_support",
  swingWeight: "swing_effort",
  barrelForgiveness: "forgiveness",
  sweetSpotSize: "sweet_spot_support",
  powerPotential: "power_potential"
} as const satisfies Partial<Record<EquipmentDNAAttribute, string>>;

export function analyzeCanonicalCandidateVariance(input: {
  readonly request: CanonicalCandidateRecommendationRequest;
  readonly dualRun: CanonicalCandidateDualRunResult;
  readonly analyzedAt?: Date;
}): CanonicalCandidateVarianceAttribution {
  const legacyWinner = identity(input.dualRun.legacyAuthoritative.primaryRecommendation?.equipment ?? input.request.legacyEquipmentInputs[0]);
  const candidateWinner = input.dualRun.canonicalCandidate?.primaryRecommendation
    ? identity(input.dualRun.canonicalCandidate.primaryRecommendation.equipment)
    : undefined;
  const candidateEquipment = input.dualRun.canonicalCandidate ? orderedItems(input.dualRun.canonicalCandidate).map((item) => item.equipment) : [];
  const inputFields = inputVariance(input.request.legacyEquipmentInputs, candidateEquipment, input.dualRun.mappingSummary.mappedAttributes);
  const weightedContributions = weightedScoreContributions(input.dualRun.legacyAuthoritative, input.dualRun.canonicalCandidate);
  const attributeContributions = oneFactorContributions(input.request, candidateEquipment);
  const pairwise = candidateWinner && legacyWinner.equipmentId !== candidateWinner.equipmentId
    ? pairwiseWinnerAttribution(input.dualRun, attributeContributions, weightedContributions, legacyWinner, candidateWinner)
    : undefined;
  const calibrationScenarios = scenarioNames.map((name) =>
    runCalibrationScenario({
      name,
      legacyEquipment: input.request.legacyEquipmentInputs,
      candidateEquipment,
      playerDNA: input.request.playerInput,
      context: input.request.requestContext,
      legacyWinnerId: legacyWinner.equipmentId,
      currentCandidateWinnerId: candidateWinner?.equipmentId
    })
  );
  const mappingCompression = compressionAnalysis(input.request.legacyEquipmentInputs, candidateEquipment, input.dualRun.mappingSummary.mappedAttributes, Boolean(pairwise));
  const missingAttributeImpact = {
    unsupportedFields: [...unsupportedCandidateFields],
    supportedOnlySymmetryCompleted: scenario("supported_attributes_only", calibrationScenarios)?.completed ?? false,
    supportedOnlyWinner: scenario("supported_attributes_only", calibrationScenarios)?.winner,
    optionalLegacyCarryoverCompleted: scenario("optional_legacy_carryover_estimate", calibrationScenarios)?.completed ?? false,
    optionalLegacyCarryoverWinner: scenario("optional_legacy_carryover_estimate", calibrationScenarios)?.winner,
    conclusions: missingAttributeConclusions(calibrationScenarios, legacyWinner.equipmentId, candidateWinner?.equipmentId)
  };
  const winnerStability = winnerStabilityAnalysis(calibrationScenarios);
  const causes = rankedCauses({
    pairwise,
    mappingCompression: mappingCompression.entries,
    missingAttributeImpact,
    winnerStability,
    inputFields,
    dualRun: input.dualRun
  });

  return {
    version: "1.0",
    attributionVersion: CANONICAL_CANDIDATE_ATTRIBUTION_VERSION,
    calibrationVersion: CANONICAL_CANDIDATE_CALIBRATION_VERSION,
    legacyWinner,
    candidateWinner,
    winnerChanged: legacyWinner.equipmentId !== candidateWinner?.equipmentId,
    equipment: input.request.legacyEquipmentInputs.map((equipment) => ({
      equipment: identity(equipment),
      inputVariance: inputFields.filter((field) => field.equipmentId === equipment.equipmentId),
      attributeContributions: attributeContributions.filter((item) => item.equipmentId === equipment.equipmentId),
      weightedContributions: weightedContributions.filter((item) => item.equipmentId === equipment.equipmentId)
    })) satisfies CanonicalCandidateEquipmentAttribution[],
    pairwiseWinnerAttribution: pairwise,
    inputVariance: {
      fields: inputFields,
      changedCount: inputFields.filter((field) => field.direction === "increased" || field.direction === "decreased").length,
      missingCandidateCount: inputFields.filter((field) => field.direction === "missing_candidate").length,
      unsupportedFieldCount: inputFields.filter((field) => isUnsupportedCandidateField(field.recommendationField)).length
    },
    dimensionVariance: {
      contributions: weightedContributions,
      largestWeightedDeltas: [...weightedContributions].sort((a, b) => Math.abs(b.weightedDelta ?? 0) - Math.abs(a.weightedDelta ?? 0)).slice(0, 8)
    },
    scoreVariance: {
      overall: input.dualRun.variance.overallScores.map((item) => ({ equipmentId: item.equipmentId, legacyScore: item.legacyScore, candidateScore: item.candidateScore, delta: item.delta })),
      largestLosses: input.dualRun.variance.overallScores.filter((item) => (item.delta ?? 0) < 0).map((item) => ({ equipmentId: item.equipmentId, delta: item.delta ?? 0 })).sort((a, b) => a.delta - b.delta),
      largestGains: input.dualRun.variance.overallScores.filter((item) => (item.delta ?? 0) > 0).map((item) => ({ equipmentId: item.equipmentId, delta: item.delta ?? 0 })).sort((a, b) => b.delta - a.delta)
    },
    confidenceVariance: {
      items: input.dualRun.variance.confidenceScores.map((item) => ({ equipmentId: item.equipmentId, legacyConfidence: item.legacyScore, candidateConfidence: item.candidateScore, delta: item.delta })),
      influencedRanking: rankedItems(input.dualRun.legacyAuthoritative).some((item) => item.trace.tieBreakRulesUsed.includes("confidence"))
    },
    explanationVariance: {
      reasonAddedCount: input.dualRun.variance.reasons.added.length,
      reasonRemovedCount: input.dualRun.variance.reasons.removed.length,
      tradeoffAddedCount: input.dualRun.variance.tradeoffs.added.length,
      tradeoffRemovedCount: input.dualRun.variance.tradeoffs.removed.length,
      alternativeChanged: input.dualRun.variance.alternatives.added.length > 0 || input.dualRun.variance.alternatives.removed.length > 0
    },
    tieBreakerAttribution: tieBreakers(input.dualRun),
    mappingCompression,
    missingAttributeImpact,
    calibrationScenarios,
    winnerStability,
    numericValuePreservationRecommendation: winnerStability.winnerSensitiveToMapping || mappingCompression.compressionDetected
      ? "attribute_specific_numeric_reference_recommended"
      : "ordinal_only_sufficient",
    architectureRecommendations: {
      balance_profile: "remain_equipment_dna",
      confidence_building_potential: "split_intrinsic_and_relational",
      transition_difficulty: "move_to_compatibility_intelligence"
    },
    primaryCauses: causes.slice(0, 3).map((cause, index) => ({ ...cause, rank: index + 1 })),
    secondaryCauses: causes.slice(3).map((cause, index) => ({ ...cause, rank: index + 4 })),
    conclusions: conclusions(pairwise, winnerStability, missingAttributeImpact),
    cautions: [
      "All calibration scenarios are analytical only and do not change production mappings.",
      "Legacy recommendation output remains authoritative.",
      "One-factor attribution is directional; isolated effects may not sum exactly because the scoring engine has interactions and ranking thresholds."
    ],
    dualRunClassification: input.dualRun.variance.classification,
    mappedAttributes: input.dualRun.mappingSummary.mappedAttributes,
    analyzedAt: input.analyzedAt ?? new Date()
  };
}

const scenarioNames: CandidateCalibrationScenarioName[] = [
  "current_midpoint",
  "lower_bound",
  "upper_bound",
  "interval_center",
  "legacy_preserving_reference",
  "supported_attributes_only",
  "optional_legacy_carryover_estimate"
];

function inputVariance(
  legacyEquipment: readonly EquipmentDNAProfile[],
  candidateEquipment: readonly EquipmentDNAProfile[],
  mappedAttributes: readonly CanonicalCandidateMappedAttribute[]
): CandidateInputFieldVariance[] {
  return legacyEquipment.flatMap((legacy) => {
    const candidate = candidateEquipment.find((item) => item.equipmentId === legacy.equipmentId);
    const fields = [...supportedCandidateFields, ...unsupportedCandidateFields];
    return fields.map((field) => {
      const mapped = mappedAttributes.find((item) => item.targetRecommendationField === field && item.equipmentId === legacy.equipmentId);
      const legacyValue = legacy.scores[field];
      const candidateValue = candidate?.scores[field];
      const numericDelta = typeof legacyValue === "number" && typeof candidateValue === "number" ? round(candidateValue - legacyValue) : undefined;
      return {
        equipmentId: legacy.equipmentId,
        equipmentVariantId: legacy.variantId,
        recommendationField: field,
        canonicalAttributeKey: canonicalKeyForField(field),
        legacyValue,
        candidateValue,
        numericDelta,
        absoluteDelta: numericDelta === undefined ? undefined : Math.abs(numericDelta),
        direction: direction(legacyValue, candidateValue),
        sourceCanonicalValue: mapped?.canonicalValue,
        mappingStrategy: mapped?.strategy,
        mappingVersion: mapped?.mappingVersion,
        confidence: mapped?.confidence
      };
    });
  });
}

function oneFactorContributions(
  request: CanonicalCandidateRecommendationRequest,
  candidateEquipment: readonly EquipmentDNAProfile[]
): CandidateAttributeContribution[] {
  const baseline = new CompatibilityScoringEngine().score({
    playerDNA: request.playerInput,
    equipment: [...request.legacyEquipmentInputs],
    context: request.requestContext
  });
  return request.legacyEquipmentInputs.flatMap((legacy) => {
    const candidate = candidateEquipment.find((item) => item.equipmentId === legacy.equipmentId);
    if (!candidate) return [];
    const baseItem = findItem(baseline, legacy.equipmentId);
    return supportedCandidateFields.map((field) => {
      const legacyValue = legacy.scores[field];
      const candidateValue = candidate.scores[field];
      const canonicalKey = fieldToCanonicalKey[field] as CandidateAttributeContribution["canonicalKey"];
      if (legacyValue === undefined || candidateValue === undefined || legacyValue === candidateValue || !baseItem) {
        return {
          equipmentId: legacy.equipmentId,
          canonicalKey,
          recommendationField: field,
          legacyValue,
          candidateValue,
          isolatedOverallScoreDelta: 0,
          isolatedDimensionDeltas: {},
          isolatedConfidenceDelta: 0,
          contributionDirection: "neutral" as const
        };
      }
      const scenarioEquipment = request.legacyEquipmentInputs.map((item) =>
        item.equipmentId === legacy.equipmentId
          ? { ...item, scores: { ...item.scores, [field]: candidateValue } }
          : item
      );
      const result = new CompatibilityScoringEngine().score({
        playerDNA: request.playerInput,
        equipment: scenarioEquipment,
        context: request.requestContext
      });
      const scenarioItem = findItem(result, legacy.equipmentId);
      const isolatedOverallScoreDelta = round((scenarioItem?.overallMatchScore ?? baseItem.overallMatchScore) - baseItem.overallMatchScore);
      return {
        equipmentId: legacy.equipmentId,
        canonicalKey,
        recommendationField: field,
        legacyValue,
        candidateValue,
        isolatedOverallScoreDelta,
        isolatedDimensionDeltas: dimensionDeltas(baseItem, scenarioItem),
        isolatedConfidenceDelta: scenarioItem ? round(scenarioItem.confidence.score - baseItem.confidence.score) : undefined,
        contributionDirection: isolatedOverallScoreDelta > 0 ? "favored_candidate" : isolatedOverallScoreDelta < 0 ? "favored_legacy" : "neutral",
        interactionWarning: "One-factor effect may not sum to total variance because other candidate inputs remain legacy values in this scenario."
      };
    });
  });
}

function weightedScoreContributions(
  legacy: CompatibilityRunResult,
  candidate?: CompatibilityRunResult
): CandidateWeightedScoreContribution[] {
  if (!candidate) return [];
  return rankedItems(legacy).flatMap((legacyItem) => {
    const candidateItem = findItem(candidate, legacyItem.equipment.equipmentId);
    return legacyItem.dimensions.map((dimension) => {
      const candidateDimension = candidateItem?.dimensions.find((item) => item.code === dimension.code);
      return {
        equipmentId: legacyItem.equipment.equipmentId,
        dimension: dimension.code,
        legacyRawScore: dimension.rawScore,
        candidateRawScore: candidateDimension?.rawScore,
        rawDelta: candidateDimension ? round(candidateDimension.rawScore - dimension.rawScore) : undefined,
        weight: dimension.weight,
        legacyWeightedContribution: dimension.weightedContribution,
        candidateWeightedContribution: candidateDimension?.weightedContribution,
        weightedDelta: candidateDimension ? round(candidateDimension.weightedContribution - dimension.weightedContribution) : undefined
      };
    });
  });
}

function pairwiseWinnerAttribution(
  dualRun: CanonicalCandidateDualRunResult,
  attributeContributions: readonly CandidateAttributeContribution[],
  weightedContributions: readonly CandidateWeightedScoreContribution[],
  legacyWinner: EquipmentIdentity,
  candidateWinner: EquipmentIdentity
): PairwiseWinnerAttribution | undefined {
  if (!dualRun.canonicalCandidate) return undefined;
  const legacyWinnerLegacy = findItem(dualRun.legacyAuthoritative, legacyWinner.equipmentId);
  const candidateWinnerLegacy = findItem(dualRun.legacyAuthoritative, candidateWinner.equipmentId);
  const legacyWinnerCandidate = findItem(dualRun.canonicalCandidate, legacyWinner.equipmentId);
  const candidateWinnerCandidate = findItem(dualRun.canonicalCandidate, candidateWinner.equipmentId);
  if (!legacyWinnerLegacy || !candidateWinnerLegacy || !legacyWinnerCandidate || !candidateWinnerCandidate) return undefined;
  const legacyScoreGap = round(legacyWinnerLegacy.overallMatchScore - candidateWinnerLegacy.overallMatchScore);
  const candidateScoreGap = round(legacyWinnerCandidate.overallMatchScore - candidateWinnerCandidate.overallMatchScore);
  const gapSwing = round(legacyScoreGap - candidateScoreGap);
  const attributeGapContributions = supportedCandidateFields.map((field) => {
    const key = fieldToCanonicalKey[field] as CandidateAttributeContribution["canonicalKey"];
    const legacyEffect = attributeContributions.find((item) => item.equipmentId === legacyWinner.equipmentId && item.recommendationField === field)?.isolatedOverallScoreDelta ?? 0;
    const candidateEffect = attributeContributions.find((item) => item.equipmentId === candidateWinner.equipmentId && item.recommendationField === field)?.isolatedOverallScoreDelta ?? 0;
    const contributionToGapSwing = round(candidateEffect - legacyEffect);
    return { canonicalKey: key, contributionToGapSwing, favoredEquipmentId: contributionToGapSwing > 0 ? candidateWinner.equipmentId : contributionToGapSwing < 0 ? legacyWinner.equipmentId : undefined };
  });
  const dimensionGapContributions = legacyWinnerLegacy.dimensions.map((dimension) => {
    const legacyDelta = weightedContributions.find((item) => item.equipmentId === legacyWinner.equipmentId && item.dimension === dimension.code)?.weightedDelta ?? 0;
    const candidateDelta = weightedContributions.find((item) => item.equipmentId === candidateWinner.equipmentId && item.dimension === dimension.code)?.weightedDelta ?? 0;
    const contributionToGapSwing = round(candidateDelta - legacyDelta);
    return { dimension: dimension.code, contributionToGapSwing, favoredEquipmentId: contributionToGapSwing > 0 ? candidateWinner.equipmentId : contributionToGapSwing < 0 ? legacyWinner.equipmentId : undefined };
  });
  const known = attributeGapContributions.reduce((sum, item) => sum + item.contributionToGapSwing, 0);
  return {
    legacyWinner,
    candidateWinner,
    legacyScoreGap,
    candidateScoreGap,
    gapSwing,
    attributeGapContributions,
    dimensionGapContributions,
    confidenceGapContribution: round((candidateWinnerCandidate.confidence.score - candidateWinnerLegacy.confidence.score) - (legacyWinnerCandidate.confidence.score - legacyWinnerLegacy.confidence.score)),
    tieBreakerContribution: Math.abs(candidateScoreGap) <= 0.01
      ? "Candidate winner was selected after an effectively tied candidate score gap; deterministic ranking tie-breakers influenced final order."
      : "No tie-breaker contribution was detected because score gap was nonzero.",
    residualGapSwing: round(gapSwing - known)
  };
}

function compressionAnalysis(
  legacyEquipment: readonly EquipmentDNAProfile[],
  candidateEquipment: readonly EquipmentDNAProfile[],
  mappedAttributes: readonly CanonicalCandidateMappedAttribute[],
  rankingChanged: boolean
) {
  const entries: CandidateMappingCompressionEntry[] = supportedCandidateFields.map((field) => {
    const key = fieldToCanonicalKey[field] as CandidateMappingCompressionEntry["canonicalKey"];
    const equipmentValues = legacyEquipment.map((legacy) => {
      const candidate = candidateEquipment.find((item) => item.equipmentId === legacy.equipmentId);
      const mapped = mappedAttributes.find((item) => item.canonicalKey === key && candidate?.scores[field] === item.candidateNumericValue);
      return {
        equipmentId: legacy.equipmentId,
        legacyValue: legacy.scores[field],
        canonicalOrdinal: mapped?.canonicalValue,
        candidateNumericValue: candidate?.scores[field]
      };
    });
    const legacyValues = uniqueNumbers(equipmentValues.map((item) => item.legacyValue));
    const candidateValues = uniqueNumbers(equipmentValues.map((item) => item.candidateNumericValue));
    const ordinals = [...new Set(equipmentValues.map((item) => String(item.canonicalOrdinal)).filter(Boolean))];
    const maximumLegacyGap = maxGap(legacyValues);
    const maximumCandidateGap = maxGap(candidateValues);
    const gapRetainedRatio = maximumLegacyGap && maximumCandidateGap !== undefined ? round(maximumCandidateGap / maximumLegacyGap) : undefined;
    return {
      canonicalKey: key,
      equipmentValues,
      distinctLegacyValueCount: legacyValues.length,
      distinctCanonicalOrdinalCount: ordinals.length,
      distinctCandidateValueCount: candidateValues.length,
      maximumLegacyGap,
      maximumCandidateGap,
      gapRetainedRatio,
      compressionDetected: legacyValues.length > candidateValues.length,
      boundaryAmplificationDetected: (maximumCandidateGap ?? 0) > (maximumLegacyGap ?? 0),
      materiallyAffectedRanking: rankingChanged && (legacyValues.length > candidateValues.length || (maximumCandidateGap ?? 0) > (maximumLegacyGap ?? 0))
    };
  });
  return {
    entries,
    compressionDetected: entries.some((item) => item.compressionDetected),
    boundaryAmplificationDetected: entries.some((item) => item.boundaryAmplificationDetected)
  };
}

function winnerStabilityAnalysis(scenarios: readonly ReturnType<typeof runCalibrationScenario>[]) {
  const completed = scenarios.filter((item) => item.completed && item.winner);
  const counts = new Map<string, number>();
  for (const item of completed) counts.set(item.winner?.equipmentId ?? "", (counts.get(item.winner?.equipmentId ?? "") ?? 0) + 1);
  const winnerFrequency = [...counts.entries()].map(([equipmentId, count]) => ({ equipmentId, count, ratio: completed.length ? round(count / completed.length) : 0 })).sort((a, b) => b.count - a.count || a.equipmentId.localeCompare(b.equipmentId));
  const stableWinner = winnerFrequency.length === 1 ? completed[0]?.winner : undefined;
  const lower = scenario("lower_bound", scenarios)?.winner?.equipmentId;
  const upper = scenario("upper_bound", scenarios)?.winner?.equipmentId;
  const supported = scenario("supported_attributes_only", scenarios)?.winner?.equipmentId;
  const current = scenario("current_midpoint", scenarios)?.winner?.equipmentId;
  const carryover = scenario("optional_legacy_carryover_estimate", scenarios)?.winner?.equipmentId;
  return {
    scenarioCount: scenarios.length,
    completedScenarioCount: completed.length,
    winnerFrequency,
    stableWinner,
    winnerSensitiveToMapping: new Set(completed.map((item) => item.winner?.equipmentId)).size > 1,
    winnerSensitiveToMissingAttributes: Boolean(supported && current && supported !== current) || Boolean(carryover && current && carryover !== current),
    winnerSensitiveToBoundarySelection: Boolean(lower && upper && lower !== upper),
    conclusions: [
      stableWinner ? `${stableWinner.label} wins every completed scenario.` : "Winner changes across calibration scenarios.",
      lower && upper && lower !== upper ? "Winner is sensitive to ordinal boundary selection." : "Lower and upper bound scenarios do not independently prove boundary instability.",
      supported && current && supported !== current ? "Supported-only symmetry changes the winner, suggesting unsupported-field omission materially affects the candidate result." : "Supported-only symmetry did not by itself change the winner relative to current candidate."
    ]
  };
}

function rankedCauses(input: {
  pairwise?: PairwiseWinnerAttribution;
  mappingCompression: readonly CandidateMappingCompressionEntry[];
  missingAttributeImpact: { readonly supportedOnlyWinner?: EquipmentIdentity; readonly optionalLegacyCarryoverWinner?: EquipmentIdentity };
  winnerStability: { readonly winnerSensitiveToMapping: boolean; readonly winnerSensitiveToMissingAttributes: boolean };
  inputFields: readonly CandidateInputFieldVariance[];
  dualRun: CanonicalCandidateDualRunResult;
}): CandidateAttributionCause[] {
  const causes: CandidateAttributionCause[] = [];
  const compression = input.mappingCompression.filter((item) => item.compressionDetected || item.boundaryAmplificationDetected);
  if (compression.length > 0) {
    causes.push({
      code: compression.some((item) => item.boundaryAmplificationDetected) ? "ORDINAL_BOUNDARY_EFFECT" : "ORDINAL_MIDPOINT_COMPRESSION",
      rank: 0,
      confidence: input.winnerStability.winnerSensitiveToMapping ? "high" : "moderate",
      summary: "Canonical ordinal mapping changes or compresses numeric gaps between demo bats.",
      affectedEquipmentIds: input.inputFields.map((item) => item.equipmentId),
      affectedAttributes: compression.map((item) => item.canonicalKey),
      estimatedGapContribution: input.pairwise?.gapSwing,
      supportingScenarioNames: ["lower_bound", "upper_bound", "interval_center", "legacy_preserving_reference"]
    });
  }
  if (input.winnerStability.winnerSensitiveToMissingAttributes) {
    causes.push({
      code: "UNSUPPORTED_MAPPING",
      rank: 0,
      confidence: "high",
      summary: "Unsupported optional fields change the analytical winner in at least one symmetry or carryover scenario.",
      affectedEquipmentIds: input.inputFields.map((item) => item.equipmentId),
      affectedAttributes: [],
      supportingScenarioNames: ["supported_attributes_only", "optional_legacy_carryover_estimate"]
    });
  }
  const largestDimension = input.pairwise?.dimensionGapContributions.slice().sort((a, b) => Math.abs(b.contributionToGapSwing) - Math.abs(a.contributionToGapSwing))[0];
  if (largestDimension && Math.abs(largestDimension.contributionToGapSwing) > 1) {
    causes.push({
      code: "DIMENSION_WEIGHT_AMPLIFICATION",
      rank: 0,
      confidence: "moderate",
      summary: `${largestDimension.dimension} creates the largest weighted gap swing.`,
      affectedEquipmentIds: [input.pairwise?.legacyWinner.equipmentId, input.pairwise?.candidateWinner.equipmentId].filter(Boolean) as string[],
      affectedAttributes: [],
      estimatedGapContribution: largestDimension.contributionToGapSwing,
      supportingScenarioNames: ["current_midpoint"]
    });
  }
  if (input.dualRun.variance.reasons.added.length > 0 || input.dualRun.variance.reasons.removed.length > 0) {
    causes.push({
      code: "REASON_SET_CHANGED",
      rank: 0,
      confidence: "moderate",
      summary: "Changed score dimensions altered primary reason selection.",
      affectedEquipmentIds: [],
      affectedAttributes: [],
      supportingScenarioNames: ["current_midpoint"]
    });
  }
  if (causes.length === 0) {
    causes.push({
      code: "NO_MATERIAL_CAUSE_IDENTIFIED",
      rank: 0,
      confidence: "low",
      summary: "No material cause was identified from available trace data.",
      affectedEquipmentIds: [],
      affectedAttributes: [],
      supportingScenarioNames: []
    });
  }
  return causes.sort((a, b) => Math.abs(b.estimatedGapContribution ?? 0) - Math.abs(a.estimatedGapContribution ?? 0) || a.code.localeCompare(b.code));
}

function conclusions(pairwise: PairwiseWinnerAttribution | undefined, stability: ReturnType<typeof winnerStabilityAnalysis>, missing: { readonly conclusions: readonly string[] }) {
  return [
    pairwise ? `The legacy winner gap moved ${pairwise.gapSwing.toFixed(2)} points toward ${pairwise.candidateWinner.label}.` : "No pairwise winner change was available for attribution.",
    ...stability.conclusions,
    ...missing.conclusions
  ];
}

function missingAttributeConclusions(scenarios: readonly ReturnType<typeof runCalibrationScenario>[], legacyWinnerId: string, candidateWinnerId?: string): string[] {
  const supported = scenario("supported_attributes_only", scenarios)?.winner?.equipmentId;
  const carryover = scenario("optional_legacy_carryover_estimate", scenarios)?.winner?.equipmentId;
  return [
    supported === legacyWinnerId ? "Supported-only symmetry restores the legacy winner." : "Supported-only symmetry does not restore the legacy winner.",
    carryover === legacyWinnerId ? "Optional legacy carryover estimate restores the legacy winner." : "Optional legacy carryover estimate does not restore the legacy winner.",
    candidateWinnerId && carryover && carryover !== candidateWinnerId ? "Unsupported optional attributes are plausible contributors to the ranking change." : "Unsupported optional attributes are not proven as the sole cause."
  ];
}

function tieBreakers(dualRun: CanonicalCandidateDualRunResult) {
  const legacyTieBreakers = rankedItems(dualRun.legacyAuthoritative).flatMap((item) => item.trace.tieBreakRulesUsed);
  const candidateTieBreakers = dualRun.canonicalCandidate ? rankedItems(dualRun.canonicalCandidate).flatMap((item) => item.trace.tieBreakRulesUsed) : [];
  const legacyWinnerId = dualRun.legacyAuthoritative.primaryRecommendation?.equipment.equipmentId;
  const candidateWinnerId = dualRun.canonicalCandidate?.primaryRecommendation?.equipment.equipmentId;
  const legacyWinnerCandidateScore = dualRun.canonicalCandidate && legacyWinnerId ? findItem(dualRun.canonicalCandidate, legacyWinnerId)?.overallMatchScore : undefined;
  const candidateWinnerCandidateScore = dualRun.canonicalCandidate && candidateWinnerId ? findItem(dualRun.canonicalCandidate, candidateWinnerId)?.overallMatchScore : undefined;
  const effectivelyTiedWinnerChange = Boolean(
    legacyWinnerId &&
      candidateWinnerId &&
      legacyWinnerId !== candidateWinnerId &&
      legacyWinnerCandidateScore !== undefined &&
      candidateWinnerCandidateScore !== undefined &&
      Math.abs(legacyWinnerCandidateScore - candidateWinnerCandidateScore) <= 0.01
  );
  return {
    influencedFinalRanking: effectivelyTiedWinnerChange,
    legacyTieBreakers: [...new Set(legacyTieBreakers)],
    candidateTieBreakers: [...new Set(candidateTieBreakers)],
    changed: stableKey(legacyTieBreakers) !== stableKey(candidateTieBreakers)
  };
}

function dimensionDeltas(legacyItem: ReturnType<typeof findItem>, candidateItem: ReturnType<typeof findItem>) {
  if (!legacyItem || !candidateItem) return {};
  return Object.fromEntries(legacyItem.dimensions.map((dimension) => {
    const candidate = candidateItem.dimensions.find((item) => item.code === dimension.code);
    return [dimension.code, candidate ? round(candidate.rawScore - dimension.rawScore) : undefined];
  }));
}

function rankedItems(result: CompatibilityRunResult) {
  return [
    ...(result.primaryRecommendation ? [result.primaryRecommendation] : []),
    ...result.alternatives,
    ...result.nonRecommended
  ];
}

function orderedItems(result: CompatibilityRunResult) {
  return rankedItems(result);
}

function findItem(result: CompatibilityRunResult, equipmentId: string) {
  return rankedItems(result).find((item) => item.equipment.equipmentId === equipmentId);
}

function identity(equipment: EquipmentDNAProfile | undefined): EquipmentIdentity {
  return {
    equipmentId: equipment?.equipmentId ?? "missing",
    equipmentVariantId: equipment?.variantId,
    label: equipment ? `${equipment.manufacturer} ${equipment.model}${equipment.modelYear ? ` ${equipment.modelYear}` : ""}` : "Missing equipment"
  };
}

function direction(legacyValue: unknown, candidateValue: unknown): CandidateInputFieldVariance["direction"] {
  if (legacyValue === undefined && candidateValue === undefined) return "incomparable";
  if (legacyValue === undefined) return "missing_legacy";
  if (candidateValue === undefined) return "missing_candidate";
  if (typeof legacyValue === "number" && typeof candidateValue === "number") {
    if (candidateValue > legacyValue) return "increased";
    if (candidateValue < legacyValue) return "decreased";
    return "unchanged";
  }
  return legacyValue === candidateValue ? "unchanged" : "incomparable";
}

function canonicalKeyForField(field: EquipmentDNAAttribute): CandidateInputFieldVariance["canonicalAttributeKey"] {
  return Object.hasOwn(fieldToCanonicalKey, field)
    ? fieldToCanonicalKey[field as keyof typeof fieldToCanonicalKey]
    : undefined;
}

function isUnsupportedCandidateField(field: string): boolean {
  return unsupportedCandidateFields.some((candidate) => candidate === field);
}

function uniqueNumbers(values: readonly (number | undefined)[]): number[] {
  return [...new Set(values.filter((value): value is number => value !== undefined))].sort((a, b) => a - b);
}

function maxGap(values: readonly number[]): number | undefined {
  return values.length < 2 ? 0 : round(Math.max(...values) - Math.min(...values));
}

function scenario(name: CandidateCalibrationScenarioName, scenarios: readonly ReturnType<typeof runCalibrationScenario>[]) {
  return scenarios.find((item) => item.name === name);
}

function stableKey(values: readonly string[]) {
  return [...values].sort().join("|");
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
