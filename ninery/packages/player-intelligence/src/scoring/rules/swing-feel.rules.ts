import type { ScoringRule } from "../scoring-rule.types.js";

export const swingFeelRules: ScoringRule[] = [
  {
    ruleId: "PDNA-SWINGFEEL-001",
    version: "1.0.0",
    targetAttribute: "batControl",
    sourceType: "batmatch_answer",
    sourceCode: "PREFERRED_SWING_FEEL",
    condition: { type: "oneOf", values: ["light", "balanced"] },
    scoreAdjustment: 18,
    weight: 1,
    confidenceContribution: 8,
    rationaleTemplate: "The player prefers a light or balanced swing feel.",
    active: true,
    categoricalEffects: { preferredSwingFeel: "balanced" }
  },
  {
    ruleId: "PDNA-SWINGFEEL-002",
    version: "1.0.0",
    targetAttribute: "powerPotential",
    sourceType: "batmatch_answer",
    sourceCode: "PREFERRED_SWING_FEEL",
    condition: { type: "includes", value: "end_loaded" },
    scoreAdjustment: 10,
    weight: 1,
    confidenceContribution: 5,
    rationaleTemplate: "An end-loaded preference can indicate comfort prioritizing mass through the zone.",
    active: true,
    categoricalEffects: { preferredSwingFeel: "end_loaded" }
  },
  {
    ruleId: "PDNA-SWINGFEEL-003",
    version: "1.0.0",
    targetAttribute: "swingSpeed",
    sourceType: "batmatch_answer",
    sourceCode: "PREFERRED_SWING_FEEL",
    condition: { type: "equals", value: "light" },
    scoreAdjustment: 12,
    weight: 1,
    confidenceContribution: 5,
    rationaleTemplate: "A light swing feel preference supports swing-speed comfort.",
    active: true,
    categoricalEffects: { preferredSwingFeel: "light" }
  }
];
