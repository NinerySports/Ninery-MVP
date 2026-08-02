import type { CompatibilityExplanation, DimensionScore } from "../compatibility.types.js";

export function buildCompatibilityExplanation(input: {
  manufacturer: string;
  model: string;
  dimensions: DimensionScore[];
}): CompatibilityExplanation {
  const topReasons = [...input.dimensions]
    .sort((a, b) => b.weightedContribution - a.weightedContribution)
    .slice(0, 3)
    .map((dimension) => ({
      dimension: dimension.code,
      contribution: dimension.weightedContribution,
      reason: dimension.reason
    }));
  const tradeoffs = input.dimensions
    .filter((dimension) => dimension.tradeoff)
    .slice(0, 3)
    .map((dimension) => `${dimension.code} is a trade-off: ${dimension.reason}`);
  const uncertainties = [...new Set(input.dimensions.flatMap((dimension) => dimension.missingInformation))];

  return {
    summary: `${input.manufacturer} ${input.model} is scored from Player DNA, Equipment DNA, evidence quality, and request constraints.`,
    topReasons,
    tradeoffs,
    uncertainties,
    whatCouldChange: uncertainties.length
      ? ["More complete Player DNA or verified Equipment DNA could change this result."]
      : ["Verified outcome data could calibrate future scoring."]
  };
}
