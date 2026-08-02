import type { ScoringRule } from "../scoring-rule.types.js";

export const currentEquipmentRules: ScoringRule[] = [
  {
    ruleId: "PDNA-EQUIPMENT-001",
    version: "1.0.0",
    targetAttribute: "batControl",
    sourceType: "batmatch_answer",
    sourceCode: "CURRENT_BAT_FEEL",
    condition: { type: "includes", value: "too_heavy" },
    scoreAdjustment: -18,
    weight: 1,
    confidenceContribution: 8,
    rationaleTemplate: "The current bat is reported as too heavy, which can limit control.",
    active: true,
    categoricalEffects: {
      preferredSwingFeel: "light",
      currentEquipmentAssessment: "Current bat may be too heavy for ideal control."
    }
  },
  {
    ruleId: "PDNA-EQUIPMENT-002",
    version: "1.0.0",
    targetAttribute: "transitionReadiness",
    sourceType: "batmatch_answer",
    sourceCode: "CURRENT_BAT_FEEL",
    condition: { type: "includes", value: "too_heavy" },
    scoreAdjustment: -12,
    weight: 1,
    confidenceContribution: 5,
    rationaleTemplate: "Struggling with current bat weight reduces readiness for a more demanding transition.",
    active: true
  },
  {
    ruleId: "PDNA-EQUIPMENT-003",
    version: "1.0.0",
    targetAttribute: "equipmentAwareness",
    sourceType: "batmatch_answer",
    sourceCode: "CURRENT_EQUIPMENT",
    condition: { type: "exists" },
    scoreAdjustment: 20,
    weight: 1,
    confidenceContribution: 8,
    rationaleTemplate: "Current equipment details are available for comparison.",
    active: true
  },
  {
    ruleId: "PDNA-EQUIPMENT-004",
    version: "1.0.0",
    targetAttribute: "confidence",
    sourceType: "batmatch_answer",
    sourceCode: "CURRENT_BAT_FEEL",
    condition: { type: "includes", value: "likes" },
    scoreAdjustment: 12,
    weight: 1,
    confidenceContribution: 5,
    rationaleTemplate: "The player reports positive current-bat feel.",
    active: true,
    categoricalEffects: { currentEquipmentAssessment: "Current bat feel is positive." }
  }
];
