import type { ScoringRule } from "../scoring-rule.types.js";

export const performanceObservationRules: ScoringRule[] = [
  {
    ruleId: "PDNA-PERFORMANCE-001",
    version: "1.0.0",
    targetAttribute: "confidence",
    sourceType: "batmatch_answer",
    sourceCode: "PLATE_CONFIDENCE",
    condition: { type: "numberGte", value: 4 },
    scoreAdjustment: 20,
    weight: 1,
    confidenceContribution: 8,
    rationaleTemplate: "The player reports strong confidence in the batter's box.",
    active: true
  },
  {
    ruleId: "PDNA-PERFORMANCE-002",
    version: "1.0.0",
    targetAttribute: "confidence",
    sourceType: "batmatch_answer",
    sourceCode: "PLATE_CONFIDENCE",
    condition: { type: "numberLte", value: 2 },
    scoreAdjustment: -22,
    weight: 1,
    confidenceContribution: 8,
    rationaleTemplate: "The player reports low confidence at the plate.",
    active: true
  },
  {
    ruleId: "PDNA-PERFORMANCE-003",
    version: "1.0.0",
    targetAttribute: "contactConsistency",
    sourceType: "batmatch_answer",
    sourceCode: "HARDEST_AT_PLATE",
    condition: { type: "includes", value: "consistent_contact" },
    scoreAdjustment: -14,
    weight: 1,
    confidenceContribution: 6,
    rationaleTemplate: "Consistent contact is reported as a challenge.",
    active: true
  },
  {
    ruleId: "PDNA-PERFORMANCE-004",
    version: "1.0.0",
    targetAttribute: "swingSpeed",
    sourceType: "batmatch_answer",
    sourceCode: "HARDEST_AT_PLATE",
    condition: { type: "includes", value: "late_on_fastballs" },
    scoreAdjustment: -12,
    weight: 1,
    confidenceContribution: 6,
    rationaleTemplate: "Being late on velocity can indicate a swing-speed or bat-fit challenge.",
    active: true
  }
];
