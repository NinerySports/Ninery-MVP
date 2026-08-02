import type { ScoringRule } from "../scoring-rule.types.js";

export const playerProfileRules: ScoringRule[] = [
  {
    ruleId: "PDNA-PROFILE-001",
    version: "1.0.0",
    targetAttribute: "profileCompleteness",
    sourceType: "player_profile",
    sourceCode: "COMPETITION_LEVEL",
    condition: { type: "exists" },
    scoreAdjustment: 12,
    weight: 1,
    confidenceContribution: 6,
    rationaleTemplate: "Competition level is available, improving profile completeness.",
    active: true
  },
  {
    ruleId: "PDNA-STAGE-001",
    version: "1.0.0",
    targetAttribute: "transitionReadiness",
    sourceType: "player_profile",
    sourceCode: "COMPETITION_LEVEL",
    condition: { type: "oneOf", values: ["travel", "elite", "Elite Travel", "Showcase"] },
    scoreAdjustment: 8,
    weight: 1,
    confidenceContribution: 4,
    rationaleTemplate: "Higher competition context can support readiness for more specific equipment fit decisions.",
    active: true
  },
  {
    ruleId: "PDNA-POWER-001",
    version: "1.0.0",
    targetAttribute: "powerPotential",
    sourceType: "player_profile",
    sourceCode: "EXPERIENCE_YEARS",
    condition: { type: "numberGte", value: 4 },
    scoreAdjustment: 7,
    weight: 1,
    confidenceContribution: 3,
    rationaleTemplate: "Several years of playing experience modestly supports power expression potential.",
    active: true
  },
  {
    ruleId: "PDNA-AWARENESS-001",
    version: "1.0.0",
    targetAttribute: "equipmentAwareness",
    sourceType: "player_profile",
    sourceCode: "BATTING_SIDE",
    condition: { type: "exists" },
    scoreAdjustment: 5,
    weight: 1,
    confidenceContribution: 2,
    rationaleTemplate: "Batting-side information improves equipment fit awareness.",
    active: true
  }
];
