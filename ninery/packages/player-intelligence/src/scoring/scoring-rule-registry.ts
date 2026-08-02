import { batMatchGoalRules } from "./rules/batmatch-goals.rules.js";
import { currentEquipmentRules } from "./rules/current-equipment.rules.js";
import { growthRules } from "./rules/growth.rules.js";
import { performanceObservationRules } from "./rules/performance-observation.rules.js";
import { playerProfileRules } from "./rules/player-profile.rules.js";
import { swingFeelRules } from "./rules/swing-feel.rules.js";
import type { ScoringRule } from "./scoring-rule.types.js";

export const PLAYER_DNA_RULE_VERSION = "player-dna-rules-v1";

export function getPlayerDNAScoringRules(): ScoringRule[] {
  return [
    ...playerProfileRules,
    ...growthRules,
    ...batMatchGoalRules,
    ...swingFeelRules,
    ...currentEquipmentRules,
    ...performanceObservationRules
  ].filter((rule) => rule.active);
}
