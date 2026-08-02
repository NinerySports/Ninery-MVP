import type { CompatibilityResultItem } from "../compatibility.types.js";
import { compareRecommendationItems, deterministicTieBreakRules } from "./tie-breaker.js";
import { withRankTrace } from "../explainability/recommendation-trace-builder.js";

export function rankRecommendations(items: CompatibilityResultItem[]): CompatibilityResultItem[] {
  return [...items]
    .sort(compareRecommendationItems)
    .map((item, index) => labelItem(withRankTrace(item, index + 1, deterministicTieBreakRules), index));
}

function labelItem(item: CompatibilityResultItem, index: number): CompatibilityResultItem {
  const label =
    index === 0
      ? "Best Overall Match"
      : item.dimensions.find((dimension) => dimension.code === "BUDGET_FIT" && dimension.rawScore >= 90)
        ? "Budget-Conscious Alternative"
        : item.dimensions.find((dimension) => dimension.code === "TRANSITION_READINESS_FIT" && dimension.rawScore >= 85)
          ? "Transition-Focused Alternative"
          : index === 1
            ? "Strong Alternative"
            : "Development-Focused Alternative";
  return { ...item, label };
}
