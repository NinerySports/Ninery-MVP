import type {
  LegacyTransitionDimensionComparison,
  LegacyTransitionDimensionInput,
  TransitionCompatibilityResult
} from "./transition-compatibility.types.js";

export const TRANSITION_COMPATIBILITY_LEGACY_COMPARISON_VERSION = "1.0";

export function compareTransitionCompatibilityWithLegacyDimension(input: {
  readonly result: TransitionCompatibilityResult;
  readonly legacy: LegacyTransitionDimensionInput;
}): LegacyTransitionDimensionComparison {
  const legacyTransitionFit = input.legacy.dimensions.find((dimension) => dimension.code === "TRANSITION_READINESS_FIT")?.rawScore;
  const canonical = input.result.score;
  const friendlinessDelta = subtract(canonical, input.legacy.legacyTransitionFriendliness);
  const fitDelta = subtract(canonical, legacyTransitionFit);
  const status = classify(input.legacy.legacyTransitionFriendliness, canonical, friendlinessDelta);

  return {
    equipmentId: input.result.proposedEquipmentId,
    equipmentVariantId: input.result.proposedEquipmentVariantId,
    legacyTransitionFriendliness: input.legacy.legacyTransitionFriendliness,
    legacyTransitionFit,
    canonicalTransitionCompatibility: canonical,
    scoreDeltas: {
      friendliness: friendlinessDelta,
      fit: fitDelta
    },
    reasonOverlap: overlap(input.result.reasons.map((reason) => reason.code), input.legacy.reasonCodes ?? []),
    tradeoffOverlap: overlap(input.result.tradeoffs.map((tradeoff) => tradeoff.code), input.legacy.tradeoffCodes ?? []),
    status,
    explanation: explanation(status)
  };
}

function classify(legacy: number | undefined, canonical: number | undefined, delta: number | undefined) {
  if (legacy === undefined || canonical === undefined || delta === undefined) return "insufficient_data";
  const absolute = Math.abs(delta);
  if (absolute <= 10) return "aligned";
  if (absolute <= 20) return "minor_difference";
  return "material_difference";
}

function explanation(status: LegacyTransitionDimensionComparison["status"]): string {
  if (status === "aligned") return "Canonical transition compatibility is numerically close to legacy transition friendliness, but the concepts are not equivalent.";
  if (status === "minor_difference") return "Canonical transition compatibility differs modestly from the legacy product-level transition approximation.";
  if (status === "material_difference") return "Canonical transition compatibility materially differs from the legacy product-level transition approximation and should remain shadow-only.";
  if (status === "incomparable") return "The legacy product-level approximation and relational transition compatibility are not comparable.";
  return "Insufficient data prevents transition comparison.";
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
