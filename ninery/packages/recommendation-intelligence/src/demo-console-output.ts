import type { CompatibilityRunResult } from "./compatibility.types.js";
import type { PlayerDNAProfileResult } from "@ninery/player-intelligence";

export function formatDemoRecommendationConsole(input: {
  player: { firstName: string; lastName: string };
  playerDNA: PlayerDNAProfileResult;
  recommendations: CompatibilityRunResult;
}): string {
  const items = [
    input.recommendations.primaryRecommendation,
    ...input.recommendations.alternatives
  ].filter(Boolean);

  return [
    "================================================",
    "PLAYER DNA SUMMARY",
    "================================================",
    `Player: ${input.player.firstName} ${input.player.lastName}`,
    `Development Goal: ${input.playerDNA.categories.primaryHittingGoal}`,
    `Top DNA Scores: ${topScores(input.playerDNA).join(", ")}`,
    `Confidence: ${input.playerDNA.confidence.score} (${input.playerDNA.confidence.level})`,
    "================================================",
    "TOP RECOMMENDATIONS",
    "================================================",
    ...items.flatMap((item, index) => [
      `${index + 1}. ${item?.equipment.manufacturer} ${item?.equipment.model}`,
      `Match Score: ${item?.overallMatchScore}`,
      `Recommendation Confidence: ${item?.confidence.score} (${item?.confidence.band})`,
      `Top Reasons: ${item?.explanation.topReasons.map((reason) => reason.dimension).join(", ")}`,
      `Tradeoffs: ${item?.explanation.tradeoffs.join("; ") || "None surfaced"}`
    ]),
    "================================================",
    "FILTERED EQUIPMENT",
    "================================================",
    ...input.recommendations.filteredEquipment.map((item) =>
      `${item.equipmentId}: ${item.reasons.map((reason) => reason.code).join(", ")}`
    )
  ].join("\n");
}

function topScores(playerDNA: PlayerDNAProfileResult): string[] {
  return Object.entries(playerDNA.scores)
    .filter(([attribute]) => attribute !== "profileCompleteness")
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([attribute, score]) => `${attribute} ${score}`);
}
