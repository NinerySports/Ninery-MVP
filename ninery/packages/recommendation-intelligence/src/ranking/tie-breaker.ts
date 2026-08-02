import type { CompatibilityResultItem } from "../compatibility.types.js";

export const deterministicTieBreakRules = [
  "overallMatchScore",
  "recommendationConfidence",
  "developmentGoalFit",
  "evidenceConfidence",
  "profileCompleteness",
  "equipmentId"
];

export function compareRecommendationItems(a: CompatibilityResultItem, b: CompatibilityResultItem): number {
  const scoreDelta = b.overallMatchScore - a.overallMatchScore;
  if (scoreDelta !== 0) return scoreDelta;
  const confidenceDelta = b.confidence.score - a.confidence.score;
  if (confidenceDelta !== 0) return confidenceDelta;
  const aGoal = a.dimensions.find((dimension) => dimension.code === "DEVELOPMENT_GOAL_FIT")?.rawScore ?? 0;
  const bGoal = b.dimensions.find((dimension) => dimension.code === "DEVELOPMENT_GOAL_FIT")?.rawScore ?? 0;
  if (bGoal - aGoal !== 0) return bGoal - aGoal;
  if (b.equipment.evidenceConfidence.score - a.equipment.evidenceConfidence.score !== 0) {
    return b.equipment.evidenceConfidence.score - a.equipment.evidenceConfidence.score;
  }
  if (b.equipment.profileCompleteness - a.equipment.profileCompleteness !== 0) {
    return b.equipment.profileCompleteness - a.equipment.profileCompleteness;
  }
  return a.equipment.equipmentId.localeCompare(b.equipment.equipmentId);
}
