import type { PlayerDNAAttribute, PreferredSwingFeel, PrimaryHittingGoal } from "../player-dna.types.js";

export type RuleSourceType =
  | "player"
  | "player_profile"
  | "growth"
  | "batmatch_answer"
  | "batmatch_session"
  | "decision_signal"
  | "derived";

export type RuleCondition =
  | { type: "exists" }
  | { type: "equals"; value: string | number | boolean }
  | { type: "includes"; value: string }
  | { type: "oneOf"; values: Array<string | number | boolean> }
  | { type: "numberGte"; value: number }
  | { type: "numberLte"; value: number };

export type ScoringRule = {
  ruleId: string;
  version: string;
  targetAttribute: PlayerDNAAttribute;
  sourceType: RuleSourceType;
  sourceCode: string;
  condition: RuleCondition;
  scoreAdjustment: number;
  weight: number;
  confidenceContribution: number;
  rationaleTemplate: string;
  active: boolean;
  categoricalEffects?: {
    preferredSwingFeel?: PreferredSwingFeel;
    primaryHittingGoal?: PrimaryHittingGoal;
    currentEquipmentAssessment?: string;
  };
};

export type AppliedRule = {
  rule: ScoringRule;
  adjustment: number;
};
