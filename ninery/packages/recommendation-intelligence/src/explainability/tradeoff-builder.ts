import type { DimensionScore } from "../compatibility.types.js";

export function buildTradeoffs(dimensions: DimensionScore[]): string[] {
  return dimensions
    .filter((dimension) => dimension.tradeoff)
    .sort((a, b) => a.rawScore - b.rawScore)
    .slice(0, 3)
    .map((dimension) => `${dimension.code}: ${dimension.reason}`);
}
