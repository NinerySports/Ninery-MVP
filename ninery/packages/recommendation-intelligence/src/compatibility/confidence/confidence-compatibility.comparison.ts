import type {
  ConfidenceCompatibilityResult,
  LegacyConfidenceDimensionComparison,
  LegacyConfidenceDimensionInput
} from "./confidence-compatibility.types.js";

export const CONFIDENCE_COMPATIBILITY_LEGACY_COMPARISON_VERSION = "1.0";

export function compareConfidenceCompatibilityWithLegacyDimension(input: {
  readonly result: ConfidenceCompatibilityResult;
  readonly legacy: LegacyConfidenceDimensionInput;
}): LegacyConfidenceDimensionComparison {
  const legacyConfidenceBuildingFit = input.legacy.dimensions.find((dimension) => dimension.code === "CONFIDENCE_BUILDING_FIT")?.rawScore;
  const legacyDevelopmentGoalFit = input.legacy.dimensions.find((dimension) => dimension.code === "DEVELOPMENT_GOAL_FIT")?.rawScore;
  const canonical = input.result.score;
  const confidenceBuildingDelta = subtract(canonical, legacyConfidenceBuildingFit);
  const developmentGoalDelta = subtract(canonical, legacyDevelopmentGoalFit);
  const status = classify(legacyConfidenceBuildingFit, canonical, confidenceBuildingDelta);

  return {
    equipmentId: input.result.equipmentId,
    equipmentVariantId: input.result.equipmentVariantId,
    legacyConfidenceBuildingFit,
    legacyDevelopmentGoalFit,
    canonicalConfidenceCompatibility: canonical,
    scoreDeltas: {
      confidenceBuilding: confidenceBuildingDelta,
      developmentGoal: developmentGoalDelta
    },
    reasonOverlap: overlap(
      input.result.reasons.map((reason) => reason.code),
      input.legacy.reasonCodes ?? []
    ),
    tradeoffOverlap: overlap(
      input.result.tradeoffs.map((tradeoff) => tradeoff.code),
      input.legacy.tradeoffCodes ?? []
    ),
    status,
    explanation: explanation(status)
  };
}

function classify(legacy: number | undefined, canonical: number | undefined, delta: number | undefined) {
  if (legacy === undefined || canonical === undefined) return "insufficient_data";
  if (delta === undefined) return "insufficient_data";
  const absolute = Math.abs(delta);
  if (absolute <= 10) return "aligned";
  if (absolute <= 20) return "minor_difference";
  return "material_difference";
}

function explanation(status: LegacyConfidenceDimensionComparison["status"]): string {
  if (status === "aligned") return "Canonical confidence compatibility is numerically close to the legacy confidence-building dimension, but the concepts are not equivalent.";
  if (status === "minor_difference") return "Canonical confidence compatibility differs modestly from the legacy confidence-building dimension; the legacy dimension remains semantically broader.";
  if (status === "material_difference") return "Canonical confidence compatibility materially differs from the legacy confidence-building dimension and should remain shadow-only.";
  if (status === "incomparable") return "The legacy dimension and canonical compatibility result are not semantically comparable.";
  return "Insufficient data prevents comparison with the legacy confidence-building dimension.";
}

function subtract(a: number | undefined, b: number | undefined): number | undefined {
  if (a === undefined || b === undefined) return undefined;
  return Math.round((a - b) * 100) / 100;
}

function overlap(a: readonly string[], b: readonly string[]): number {
  const left = new Set(a);
  const right = new Set(b);
  const union = new Set([...left, ...right]);
  if (!union.size) return 1;
  return Math.round(([...union].filter((item) => left.has(item) && right.has(item)).length / union.size) * 100) / 100;
}
