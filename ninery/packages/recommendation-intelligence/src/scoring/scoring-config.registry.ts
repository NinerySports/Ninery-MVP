import type { ScoringConfig } from "./scoring-config.types.js";
import { COMPATIBILITY_SCORING_CONFIG_VERSION } from "../compatibility.types.js";

export const mvpCompatibilityScoringConfig: ScoringConfig = {
  version: COMPATIBILITY_SCORING_CONFIG_VERSION,
  minimumProfileCompleteness: 70,
  minimumEvidenceConfidence: 40,
  minimumRequiredCharacteristics: 5,
  maturityConfidenceCap: 89,
  weights: {
    BAT_CONTROL_FIT: 0.15,
    SWING_FEEL_BALANCE_FIT: 0.1,
    SWING_WEIGHT_FIT: 0.1,
    BARREL_FORGIVENESS_FIT: 0.1,
    SWEET_SPOT_FIT: 0.08,
    POWER_POTENTIAL_FIT: 0.08,
    CONFIDENCE_BUILDING_FIT: 0.1,
    TRANSITION_READINESS_FIT: 0.07,
    DEVELOPMENT_GOAL_FIT: 0.08,
    GROWTH_USEFUL_LIFE_FIT: 0.05,
    EQUIPMENT_PREFERENCE_FIT: 0.03,
    BUDGET_FIT: 0.02,
    EVIDENCE_QUALITY: 0.02,
    PROFILE_COMPLETENESS: 0.02
  },
  goalAdjustments: {
    improve_bat_control: [
      { dimension: "BAT_CONTROL_FIT", delta: 0.04, reason: "Primary goal emphasizes control." },
      { dimension: "SWING_WEIGHT_FIT", delta: 0.02, reason: "Control goals depend on manageable swing weight." },
      { dimension: "CONFIDENCE_BUILDING_FIT", delta: 0.02, reason: "Control progress should build confidence." },
      { dimension: "POWER_POTENTIAL_FIT", delta: -0.03, reason: "Power is less important than control for this run." }
    ],
    improve_power: [
      { dimension: "POWER_POTENTIAL_FIT", delta: 0.05, reason: "Primary goal emphasizes power." },
      { dimension: "SWEET_SPOT_FIT", delta: 0.02, reason: "Power development benefits from useful impact area." },
      { dimension: "BAT_CONTROL_FIT", delta: -0.01, reason: "Control remains protected by a small reduction only." }
    ],
    build_confidence: [
      { dimension: "CONFIDENCE_BUILDING_FIT", delta: 0.04, reason: "Primary goal emphasizes confidence." },
      { dimension: "BARREL_FORGIVENESS_FIT", delta: 0.03, reason: "Forgiveness supports confidence." },
      { dimension: "SWEET_SPOT_FIT", delta: 0.02, reason: "A larger sweet spot supports positive outcomes." }
    ],
    prepare_for_transition: [
      { dimension: "TRANSITION_READINESS_FIT", delta: 0.05, reason: "Primary goal emphasizes transition readiness." },
      { dimension: "SWING_WEIGHT_FIT", delta: 0.02, reason: "Transition runs need swing-weight management." },
      { dimension: "GROWTH_USEFUL_LIFE_FIT", delta: 0.02, reason: "Transition runs should account for useful life." }
    ]
  }
};

export function getScoringConfig(version?: string): ScoringConfig {
  if (!version || version === mvpCompatibilityScoringConfig.version) {
    return mvpCompatibilityScoringConfig;
  }

  throw new Error(`Unknown compatibility scoring configuration version: ${version}`);
}
