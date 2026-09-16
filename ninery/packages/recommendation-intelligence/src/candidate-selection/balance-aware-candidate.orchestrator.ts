import {
  loadEquipmentDNANumericReferenceProfile,
  validateBalanceNumericReference,
  type EquipmentDNANumericReference
} from "@ninery/equipment-intelligence";
import { CompatibilityScoringEngine } from "../scoring/compatibility-scoring-engine.js";
import { compareCanonicalCandidateRecommendationRuns } from "../candidate/canonical-candidate.comparison.js";
import type { CanonicalCandidateRecommendationRequest } from "../candidate/index.js";
import type { CompatibilityResultItem, CompatibilityRunResult } from "../compatibility.types.js";
import { runCanonicalCandidateThreePathComparison } from "./three-path-recommendation.orchestrator.js";
import { selectCanonicalCandidateAttributeSourcesWithBalance } from "./canonical-attribute-source-selection.evaluator.js";
import { adaptCanonicalEquipmentDNAUsingSelectedSources } from "./numeric-reference-candidate.adapter.js";
import { bridgeCanonicalBalanceToRecommendationInput } from "./canonical-balance-recommendation-bridge.js";

export type CanonicalCandidateBalanceExecutionStatus =
  | "completed"
  | "blocked_semantic_ambiguity"
  | "blocked_invalid_reference"
  | "blocked_insufficient_confidence"
  | "failed";

export type CanonicalBalanceCandidateImpact = {
  readonly values: readonly {
    readonly equipmentId: string;
    readonly equipmentVariantId?: string;
    readonly legacyBalanceValue?: number;
    readonly canonicalBalanceValue?: number;
    readonly canonicalOrdinal?: string;
    readonly conversionStrategy?: string;
    readonly confidence?: string;
    readonly recommendationInputValue?: number;
    readonly bridgeStrategy?: string;
    readonly bridgeVersion?: string;
  }[];
  readonly averageScoreVarianceBefore?: number;
  readonly averageScoreVarianceAfter?: number;
  readonly maximumScoreVarianceBefore?: number;
  readonly maximumScoreVarianceAfter?: number;
  readonly averageDimensionVarianceBefore?: number;
  readonly averageDimensionVarianceAfter?: number;
  readonly balanceDimensionVarianceBefore?: number;
  readonly balanceDimensionVarianceAfter?: number;
  readonly iconAtlasGapBefore?: number;
  readonly iconAtlasGapAfter?: number;
  readonly rankingDistanceBefore?: number;
  readonly rankingDistanceAfter?: number;
  readonly reasonAlignmentBefore?: number;
  readonly reasonAlignmentAfter?: number;
  readonly tradeoffAlignmentBefore?: number;
  readonly tradeoffAlignmentAfter?: number;
  readonly confidenceVarianceBefore?: number;
  readonly confidenceVarianceAfter?: number;
  readonly residualReductionPercent?: number;
  readonly balanceReducedResidual: boolean;
  readonly balanceImprovedAlignment: boolean;
  readonly conclusion:
    | "balance_materially_reduced_residual"
    | "balance_modestly_reduced_residual"
    | "balance_no_meaningful_effect"
    | "balance_reduced_alignment"
    | "balance_conversion_blocked"
    | "insufficient_data";
};

export type CanonicalCandidateBalanceComparisonResult = {
  readonly legacyAuthoritative: CompatibilityRunResult;
  readonly ordinalCandidate?: CompatibilityRunResult;
  readonly numericReferenceCandidate?: CompatibilityRunResult;
  readonly balanceAwareCandidate?: CompatibilityRunResult;
  readonly balanceExecutionStatus: CanonicalCandidateBalanceExecutionStatus;
  readonly balanceImpact: CanonicalBalanceCandidateImpact;
  readonly liveRecommendationSource: "legacy";
  readonly candidateAffectsLiveResult: false;
};

export async function runCanonicalCandidateBalanceComparison(input: {
  readonly request: CanonicalCandidateRecommendationRequest;
  readonly balanceReferences?: readonly EquipmentDNANumericReference[];
}): Promise<CanonicalCandidateBalanceComparisonResult> {
  const threePath = await runCanonicalCandidateThreePathComparison(input.request);
  if (!threePath.numericReferenceCandidate) {
    return blockedResult(threePath.legacyAuthoritative, threePath.ordinalCandidate, threePath.numericReferenceCandidate, "insufficient_data", []);
  }

  const balanceEquipment = [];
  const observedBalanceReferences: Array<{ profile: typeof input.request.canonicalProfiles[number]; reference: EquipmentDNANumericReference }> = [];
  let status: CanonicalCandidateBalanceExecutionStatus = "completed";
  for (const profile of input.request.canonicalProfiles) {
    const admission = input.request.admissionDecisions.find((decision) => decision.equipmentId === profile.equipmentId && decision.equipmentVariantId === profile.equipmentVariantId);
    const baseline = input.request.legacyEquipmentInputs.find((equipment) => equipment.equipmentId === profile.equipmentId && equipment.variantId === profile.equipmentVariantId);
    const balanceAttribute = profile.attributes.find((attribute) => attribute.key === "balance_profile");
    if (!admission || !baseline || !balanceAttribute) {
      status = "blocked_invalid_reference";
      continue;
    }
    const numericProfile = loadEquipmentDNANumericReferenceProfile(profile);
    const profileReferences = numericProfile.references
      .map((reference) => reference.numericReference)
      .filter((reference): reference is NonNullable<typeof reference> => Boolean(reference));
    const balanceReference = profileReferences.find((reference) => reference.sourceReference?.includes("balance-profile") || reference.sourceReference?.includes("SWING_BALANCE"));
    if (!admission || !baseline || !balanceReference || !balanceAttribute) {
      status = "blocked_invalid_reference";
      continue;
    }
    const sourceValue = balanceReference.sourceScore;
    const validation = validateBalanceNumericReference({
      ordinal: String(balanceAttribute.value) as "very_balanced" | "balanced" | "slightly_end_loaded" | "end_loaded" | "very_end_loaded",
      numericReference: balanceReference,
      conversionExplanation: balanceAttribute.rationale,
      sourceValue
    });
    if (!validation.valid) {
      status = validation.findings.includes("CONFIDENCE_INSUFFICIENT") ? "blocked_insufficient_confidence" : "blocked_invalid_reference";
      continue;
    }
    observedBalanceReferences.push({ profile, reference: balanceReference });
    const selected = selectCanonicalCandidateAttributeSourcesWithBalance({
      canonicalProfile: profile,
      admissionDecision: admission,
      numericReferences: profileReferences,
      evaluatedAt: input.request.evaluatedAt
    });
    if (!selected.candidateInputAllowed) {
      status = "blocked_invalid_reference";
      continue;
    }
    try {
      balanceEquipment.push(adaptCanonicalEquipmentDNAUsingSelectedSources({
        canonicalProfile: profile,
        sourceSelection: selected,
        legacyBaseline: baseline
      }).equipment);
    } catch {
      status = "failed";
    }
  }

  let balanceAwareCandidate: CompatibilityRunResult | undefined;
  if (status === "completed" && balanceEquipment.length === input.request.canonicalProfiles.length) {
    try {
      balanceAwareCandidate = new CompatibilityScoringEngine().score({
        playerDNA: input.request.playerInput,
        equipment: balanceEquipment,
        context: input.request.requestContext
      });
    } catch {
      status = "failed";
    }
  } else if (status === "completed") {
    status = "blocked_invalid_reference";
  }

  return {
    legacyAuthoritative: threePath.legacyAuthoritative,
    ordinalCandidate: threePath.ordinalCandidate,
    numericReferenceCandidate: threePath.numericReferenceCandidate,
    balanceAwareCandidate,
    balanceExecutionStatus: status,
    balanceImpact: impact(threePath.legacyAuthoritative, threePath.numericReferenceCandidate, balanceAwareCandidate, observedBalanceReferences, status),
    liveRecommendationSource: "legacy",
    candidateAffectsLiveResult: false
  };
}

function blockedResult(
  legacy: CompatibilityRunResult,
  ordinal: CompatibilityRunResult | undefined,
  numeric: CompatibilityRunResult | undefined,
  conclusion: CanonicalBalanceCandidateImpact["conclusion"],
  references: readonly { profile: CanonicalCandidateRecommendationRequest["canonicalProfiles"][number]; reference: EquipmentDNANumericReference }[]
): CanonicalCandidateBalanceComparisonResult {
  return {
    legacyAuthoritative: legacy,
    ordinalCandidate: ordinal,
    numericReferenceCandidate: numeric,
    balanceExecutionStatus: "blocked_invalid_reference",
    balanceImpact: {
      values: references.map(referenceValue),
      balanceReducedResidual: false,
      balanceImprovedAlignment: false,
      conclusion
    },
    liveRecommendationSource: "legacy",
    candidateAffectsLiveResult: false
  };
}

function impact(
  legacy: CompatibilityRunResult,
  before: CompatibilityRunResult,
  after: CompatibilityRunResult | undefined,
  references: readonly { profile: CanonicalCandidateRecommendationRequest["canonicalProfiles"][number]; reference: EquipmentDNANumericReference }[],
  status: CanonicalCandidateBalanceExecutionStatus
): CanonicalBalanceCandidateImpact {
  if (!after || status !== "completed") {
    return {
      values: references.map(referenceValue),
      averageScoreVarianceBefore: averageScoreVariance(legacy, before),
      maximumScoreVarianceBefore: maximumScoreVariance(legacy, before),
      averageDimensionVarianceBefore: averageDimensionVariance(legacy, before),
      balanceDimensionVarianceBefore: dimensionVariance(legacy, before, "SWING_FEEL_BALANCE_FIT"),
      iconAtlasGapBefore: iconAtlasGap(before),
      rankingDistanceBefore: rankingDistance(legacy, before),
      reasonAlignmentBefore: reasonAlignment(legacy, before),
      tradeoffAlignmentBefore: tradeoffAlignment(legacy, before),
      confidenceVarianceBefore: confidenceVariance(legacy, before),
      balanceReducedResidual: false,
      balanceImprovedAlignment: false,
      conclusion: status === "blocked_insufficient_confidence" || status === "blocked_invalid_reference" ? "balance_conversion_blocked" : "insufficient_data"
    };
  }
  const scoreBefore = averageScoreVariance(legacy, before);
  const scoreAfter = averageScoreVariance(legacy, after);
  const dimensionBefore = averageDimensionVariance(legacy, before);
  const dimensionAfter = averageDimensionVariance(legacy, after);
  const rankingBefore = rankingDistance(legacy, before);
  const rankingAfter = rankingDistance(legacy, after);
  const reasonBefore = reasonAlignment(legacy, before);
  const reasonAfter = reasonAlignment(legacy, after);
  const reduced = scoreAfter < scoreBefore;
  const improved = rankingAfter <= rankingBefore && reasonAfter >= reasonBefore && scoreAfter < scoreBefore;
  return {
    values: references.map(referenceValue),
    averageScoreVarianceBefore: scoreBefore,
    averageScoreVarianceAfter: scoreAfter,
    maximumScoreVarianceBefore: maximumScoreVariance(legacy, before),
    maximumScoreVarianceAfter: maximumScoreVariance(legacy, after),
    averageDimensionVarianceBefore: dimensionBefore,
    averageDimensionVarianceAfter: dimensionAfter,
    balanceDimensionVarianceBefore: dimensionVariance(legacy, before, "SWING_FEEL_BALANCE_FIT"),
    balanceDimensionVarianceAfter: dimensionVariance(legacy, after, "SWING_FEEL_BALANCE_FIT"),
    iconAtlasGapBefore: iconAtlasGap(before),
    iconAtlasGapAfter: iconAtlasGap(after),
    rankingDistanceBefore: rankingBefore,
    rankingDistanceAfter: rankingAfter,
    reasonAlignmentBefore: reasonBefore,
    reasonAlignmentAfter: reasonAfter,
    tradeoffAlignmentBefore: tradeoffAlignment(legacy, before),
    tradeoffAlignmentAfter: tradeoffAlignment(legacy, after),
    confidenceVarianceBefore: confidenceVariance(legacy, before),
    confidenceVarianceAfter: confidenceVariance(legacy, after),
    residualReductionPercent: scoreBefore === 0 ? 0 : round(((scoreBefore - scoreAfter) / scoreBefore) * 100),
    balanceReducedResidual: reduced,
    balanceImprovedAlignment: improved,
    conclusion: !reduced
      ? "balance_no_meaningful_effect"
      : scoreBefore - scoreAfter >= 2
        ? "balance_materially_reduced_residual"
        : "balance_modestly_reduced_residual"
  };
}

function referenceValue(input: { profile: CanonicalCandidateRecommendationRequest["canonicalProfiles"][number]; reference: EquipmentDNANumericReference }) {
  const bridge = bridgeCanonicalBalanceToRecommendationInput(input.reference.numericValue);
  return {
    equipmentId: input.profile.equipmentId,
    equipmentVariantId: input.profile.equipmentVariantId,
    legacyBalanceValue: input.reference.sourceScore,
    canonicalBalanceValue: input.reference.numericValue,
    canonicalOrdinal: String(input.profile.attributes.find((attribute) => attribute.key === "balance_profile")?.value ?? "missing"),
    conversionStrategy: "inverse",
    confidence: input.reference.confidence,
    recommendationInputValue: bridge.recommendationInputValue,
    bridgeStrategy: bridge.strategy,
    bridgeVersion: bridge.version
  };
}

function averageScoreVariance(legacy: CompatibilityRunResult, candidate: CompatibilityRunResult): number {
  return round(average(orderedItems(legacy).map((item) => Math.abs((findItem(candidate, item)?.overallMatchScore ?? 0) - item.overallMatchScore))));
}

function maximumScoreVariance(legacy: CompatibilityRunResult, candidate: CompatibilityRunResult): number {
  return round(Math.max(...orderedItems(legacy).map((item) => Math.abs((findItem(candidate, item)?.overallMatchScore ?? 0) - item.overallMatchScore)), 0));
}

function averageDimensionVariance(legacy: CompatibilityRunResult, candidate: CompatibilityRunResult): number {
  return round(average(orderedItems(legacy).flatMap((item) => item.dimensions.map((dimension) => Math.abs((findItem(candidate, item)?.dimensions.find((candidateDimension) => candidateDimension.code === dimension.code)?.rawScore ?? 0) - dimension.rawScore)))));
}

function dimensionVariance(legacy: CompatibilityRunResult, candidate: CompatibilityRunResult, dimensionCode: string): number {
  return round(average(orderedItems(legacy).map((item) => {
    const legacyDimension = item.dimensions.find((dimension) => dimension.code === dimensionCode);
    const candidateDimension = findItem(candidate, item)?.dimensions.find((dimension) => dimension.code === dimensionCode);
    if (!legacyDimension || !candidateDimension) return 0;
    return Math.abs(candidateDimension.rawScore - legacyDimension.rawScore);
  })));
}

function rankingDistance(legacy: CompatibilityRunResult, candidate: CompatibilityRunResult): number {
  const legacyRanks = new Map(orderedItems(legacy).map((item, index) => [key(item), index + 1]));
  return orderedItems(candidate).reduce((sum, item, index) => sum + Math.abs((legacyRanks.get(key(item)) ?? orderedItems(candidate).length) - (index + 1)), 0);
}

function reasonAlignment(legacy: CompatibilityRunResult, candidate: CompatibilityRunResult): number {
  const left = new Set(orderedItems(legacy).flatMap((item) => item.explanation.topReasons.map((reason) => `${item.equipment.equipmentId}:${reason.dimension}`)));
  const right = new Set(orderedItems(candidate).flatMap((item) => item.explanation.topReasons.map((reason) => `${item.equipment.equipmentId}:${reason.dimension}`)));
  const union = new Set([...left, ...right]);
  if (union.size === 0) return 1;
  return round([...union].filter((item) => left.has(item) && right.has(item)).length / union.size);
}

function tradeoffAlignment(legacy: CompatibilityRunResult, candidate: CompatibilityRunResult): number {
  const left = new Set(orderedItems(legacy).flatMap((item) => item.explanation.tradeoffs.map((tradeoff) => `${item.equipment.equipmentId}:${tradeoff}`)));
  const right = new Set(orderedItems(candidate).flatMap((item) => item.explanation.tradeoffs.map((tradeoff) => `${item.equipment.equipmentId}:${tradeoff}`)));
  const union = new Set([...left, ...right]);
  if (union.size === 0) return 1;
  return round([...union].filter((item) => left.has(item) && right.has(item)).length / union.size);
}

function confidenceVariance(legacy: CompatibilityRunResult, candidate: CompatibilityRunResult): number {
  return round(average(orderedItems(legacy).map((item) => Math.abs((findItem(candidate, item)?.confidence.score ?? 0) - item.confidence.score))));
}

function iconAtlasGap(result: CompatibilityRunResult): number | undefined {
  const icon = orderedItems(result).find((item) => item.equipment.manufacturer === "Rawlings" && item.equipment.model === "ICON");
  const atlas = orderedItems(result).find((item) => item.equipment.manufacturer === "Louisville Slugger" && item.equipment.model === "Atlas");
  return icon && atlas ? round(icon.overallMatchScore - atlas.overallMatchScore) : undefined;
}

function findItem(result: CompatibilityRunResult, item: CompatibilityResultItem) {
  return orderedItems(result).find((candidate) => key(candidate) === key(item));
}

function orderedItems(result: CompatibilityRunResult): CompatibilityResultItem[] {
  return [...(result.primaryRecommendation ? [result.primaryRecommendation] : []), ...result.alternatives, ...result.nonRecommended];
}

function key(item: CompatibilityResultItem): string {
  return `${item.equipment.equipmentId}:${item.equipment.variantId ?? ""}`;
}

function average(values: readonly number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
