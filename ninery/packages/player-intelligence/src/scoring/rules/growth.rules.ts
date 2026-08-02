import type { ScoringRule } from "../scoring-rule.types.js";

export const growthRules: ScoringRule[] = [
  {
    ruleId: "PDNA-GROWTH-001",
    version: "1.0.0",
    targetAttribute: "growthStability",
    sourceType: "growth",
    sourceCode: "GROWTH_STATUS",
    condition: { type: "equals", value: "stable" },
    scoreAdjustment: 22,
    weight: 1,
    confidenceContribution: 8,
    rationaleTemplate: "Recent measurements suggest growth is stable, reducing near-term fit volatility.",
    active: true
  },
  {
    ruleId: "PDNA-GROWTH-002",
    version: "1.0.0",
    targetAttribute: "growthStability",
    sourceType: "growth",
    sourceCode: "GROWTH_STATUS",
    condition: { type: "equals", value: "rapid_growth" },
    scoreAdjustment: -24,
    weight: 1,
    confidenceContribution: 8,
    rationaleTemplate: "Recent rapid growth may make equipment recommendations age faster.",
    active: true
  },
  {
    ruleId: "PDNA-STRENGTH-001",
    version: "1.0.0",
    targetAttribute: "physicalStrength",
    sourceType: "growth",
    sourceCode: "LATEST_WEIGHT_KG",
    condition: { type: "numberGte", value: 45 },
    scoreAdjustment: 8,
    weight: 1,
    confidenceContribution: 3,
    rationaleTemplate: "Current weight modestly supports physical strength for bat handling.",
    active: true
  }
];
