import type { ScoringRule } from "../scoring-rule.types.js";

export const batMatchGoalRules: ScoringRule[] = [
  {
    ruleId: "PDNA-GOAL-001",
    version: "1.0.0",
    targetAttribute: "contactConsistency",
    sourceType: "batmatch_answer",
    sourceCode: "PRIMARY_GOAL",
    condition: { type: "includes", value: "contact" },
    scoreAdjustment: 18,
    weight: 1,
    confidenceContribution: 7,
    rationaleTemplate: "Improving contact is a stated hitting goal.",
    active: true,
    categoricalEffects: { primaryHittingGoal: "improve_contact" }
  },
  {
    ruleId: "PDNA-GOAL-002",
    version: "1.0.0",
    targetAttribute: "powerPotential",
    sourceType: "batmatch_answer",
    sourceCode: "PRIMARY_GOAL",
    condition: { type: "includes", value: "power" },
    scoreAdjustment: 18,
    weight: 1,
    confidenceContribution: 7,
    rationaleTemplate: "More power is a stated hitting goal.",
    active: true,
    categoricalEffects: { primaryHittingGoal: "improve_power" }
  },
  {
    ruleId: "PDNA-GOAL-003",
    version: "1.0.0",
    targetAttribute: "batControl",
    sourceType: "batmatch_answer",
    sourceCode: "PRIMARY_GOAL",
    condition: { type: "includes", value: "control" },
    scoreAdjustment: 20,
    weight: 1,
    confidenceContribution: 7,
    rationaleTemplate: "Better bat control is a stated hitting goal.",
    active: true,
    categoricalEffects: { primaryHittingGoal: "improve_bat_control" }
  },
  {
    ruleId: "PDNA-GOAL-004",
    version: "1.0.0",
    targetAttribute: "confidence",
    sourceType: "batmatch_answer",
    sourceCode: "PRIMARY_GOAL",
    condition: { type: "includes", value: "confidence" },
    scoreAdjustment: 14,
    weight: 1,
    confidenceContribution: 6,
    rationaleTemplate: "Building confidence is a stated priority.",
    active: true,
    categoricalEffects: { primaryHittingGoal: "build_confidence" }
  },
  {
    ruleId: "PDNA-GOAL-005",
    version: "1.0.0",
    targetAttribute: "transitionReadiness",
    sourceType: "batmatch_answer",
    sourceCode: "PRIMARY_GOAL",
    condition: { type: "includes", value: "bbcor" },
    scoreAdjustment: 16,
    weight: 1,
    confidenceContribution: 7,
    rationaleTemplate: "Preparing for BBCOR or a similar transition is a stated goal.",
    active: true,
    categoricalEffects: { primaryHittingGoal: "prepare_for_transition" }
  }
];
