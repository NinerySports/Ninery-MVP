import type { CompatibilityDimensionCode, DynamicWeightAdjustment } from "../compatibility.types.js";
import type { ScoringConfig } from "./scoring-config.types.js";
import type { PrimaryHittingGoal } from "@ninery/player-intelligence";

export function adjustedWeightsForGoal(config: ScoringConfig, goal: PrimaryHittingGoal): {
  weights: Record<CompatibilityDimensionCode, number>;
  adjustments: DynamicWeightAdjustment[];
} {
  const weights = { ...config.weights };
  const adjustments = (config.goalAdjustments[goal] ?? []).map((adjustment) => ({ ...adjustment, goal }));

  for (const adjustment of adjustments) {
    weights[adjustment.dimension] = Math.max(0.01, weights[adjustment.dimension] + adjustment.delta);
  }

  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  const normalizedEntries = Object.entries(weights).map(([key, value]) => [
    key,
    Math.round((value / total) * 10000) / 10000
  ]) as Array<[CompatibilityDimensionCode, number]>;
  const normalized = Object.fromEntries(normalizedEntries) as Record<CompatibilityDimensionCode, number>;
  const drift = Math.round((1 - Object.values(normalized).reduce((sum, value) => sum + value, 0)) * 10000) / 10000;
  normalized.BAT_CONTROL_FIT = Math.round((normalized.BAT_CONTROL_FIT + drift) * 10000) / 10000;

  return { weights: normalized, adjustments };
}
