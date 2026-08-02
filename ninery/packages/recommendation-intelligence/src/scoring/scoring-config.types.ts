import type { CompatibilityDimensionCode, DynamicWeightAdjustment } from "../compatibility.types.js";
import type { PrimaryHittingGoal } from "@ninery/player-intelligence";

export type ScoringConfig = {
  version: string;
  minimumProfileCompleteness: number;
  minimumEvidenceConfidence: number;
  minimumRequiredCharacteristics: number;
  maturityConfidenceCap: number;
  weights: Record<CompatibilityDimensionCode, number>;
  goalAdjustments: Partial<Record<PrimaryHittingGoal, Array<Omit<DynamicWeightAdjustment, "goal">>>>;
};
