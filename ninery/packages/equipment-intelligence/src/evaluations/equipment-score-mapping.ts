export const EQUIPMENT_SCORE_TO_ORDINAL_MAPPING_VERSION = "1.0";

export type ScoreScale = "zero_to_hundred" | "one_to_ten";

export type SupportOrdinal = "very_low" | "low" | "moderate" | "high" | "very_high";

export type SwingEffortOrdinal = "very_easy" | "easy" | "moderate" | "demanding" | "very_demanding";

export type ScoreToOrdinalMappingResult<TOrdinal extends string> = {
  sourceScore: number;
  normalizedScore: number;
  scale: ScoreScale;
  ordinal: TOrdinal;
  mappingVersion: typeof EQUIPMENT_SCORE_TO_ORDINAL_MAPPING_VERSION;
  mappingFunction: "five_level_support" | "swing_weight_to_swing_effort";
};

export function normalizeEquipmentScore(score: number, scale: ScoreScale = "zero_to_hundred"): number {
  if (!Number.isFinite(score)) {
    throw new Error("Equipment score must be finite.");
  }
  if (scale === "one_to_ten") {
    if (score < 0 || score > 10) {
      throw new Error("One-to-ten Equipment DNA scores must be between 0 and 10.");
    }
    return score * 10;
  }
  if (score < 0 || score > 100) {
    throw new Error("Zero-to-hundred Equipment DNA scores must be between 0 and 100.");
  }
  return score;
}

export function mapEquipmentScoreToSupportOrdinal(
  score: number,
  scale: ScoreScale = "zero_to_hundred"
): ScoreToOrdinalMappingResult<SupportOrdinal> {
  const normalizedScore = normalizeEquipmentScore(score, scale);
  return {
    sourceScore: score,
    normalizedScore,
    scale,
    ordinal: mapFiveLevelSupport(normalizedScore),
    mappingVersion: EQUIPMENT_SCORE_TO_ORDINAL_MAPPING_VERSION,
    mappingFunction: "five_level_support"
  };
}

export function mapSwingWeightScoreToSwingEffort(
  score: number,
  scale: ScoreScale = "zero_to_hundred"
): ScoreToOrdinalMappingResult<SwingEffortOrdinal> {
  const normalizedScore = normalizeEquipmentScore(score, scale);
  return {
    sourceScore: score,
    normalizedScore,
    scale,
    ordinal: mapSwingEffort(normalizedScore),
    mappingVersion: EQUIPMENT_SCORE_TO_ORDINAL_MAPPING_VERSION,
    mappingFunction: "swing_weight_to_swing_effort"
  };
}

function mapFiveLevelSupport(score: number): SupportOrdinal {
  if (score <= 19) return "very_low";
  if (score <= 39) return "low";
  if (score <= 59) return "moderate";
  if (score <= 79) return "high";
  return "very_high";
}

function mapSwingEffort(score: number): SwingEffortOrdinal {
  if (score <= 19) return "very_easy";
  if (score <= 39) return "easy";
  if (score <= 59) return "moderate";
  if (score <= 79) return "demanding";
  return "very_demanding";
}
