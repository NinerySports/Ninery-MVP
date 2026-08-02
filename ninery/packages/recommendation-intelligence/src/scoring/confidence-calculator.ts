import type { EquipmentDNAProfile } from "@ninery/equipment-intelligence";
import type { PlayerDNAProfileResult } from "@ninery/player-intelligence";
import type { DimensionScore, RecommendationConfidence } from "../compatibility.types.js";
import type { ScoringConfig } from "./scoring-config.types.js";
import { clampScore } from "./score-normalization.js";

export function calculateRecommendationConfidence(input: {
  playerDNA: PlayerDNAProfileResult;
  equipment: EquipmentDNAProfile;
  dimensions: DimensionScore[];
  config: ScoringConfig;
}): RecommendationConfidence {
  const missing = [
    ...input.playerDNA.missingInformation,
    ...input.equipment.missingCharacteristics.map((item) => `equipment:${item}`),
    ...input.dimensions.flatMap((dimension) => dimension.missingInformation)
  ];
  const scoredDimensions = input.dimensions.filter((dimension) => dimension.missingInformation.length === 0).length;
  const scoredRatio = scoredDimensions / input.dimensions.length;
  const sourcePenalty = input.equipment.sourceLevel === "model" ? 4 : 0;
  const raw =
    input.playerDNA.confidence.score * 0.25 +
    input.playerDNA.scores.profileCompleteness * 0.15 +
    input.equipment.profileCompleteness * 0.2 +
    input.equipment.evidenceConfidence.score * 0.25 +
    scoredRatio * 100 * 0.15 -
    Math.min(20, missing.length * 1.5) -
    sourcePenalty;
  const score = Math.min(input.config.maturityConfidenceCap, clampScore(raw));

  return {
    score,
    band: score >= 80 ? "high" : score >= 55 ? "medium" : "low",
    reasons: [
      `Player DNA confidence ${Math.round(input.playerDNA.confidence.score)}.`,
      `Equipment evidence confidence ${Math.round(input.equipment.evidenceConfidence.score)}.`,
      `${scoredDimensions} of ${input.dimensions.length} dimensions scored without missing inputs.`
    ],
    missingInformation: [...new Set(missing)]
  };
}
