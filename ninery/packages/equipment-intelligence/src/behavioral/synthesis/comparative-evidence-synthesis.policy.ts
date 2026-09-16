import type { BehavioralEquipmentDNAAttributeKey } from "../real-world-behavioral-evaluation.types.js";

export const COMPARATIVE_EVIDENCE_SYNTHESIS_VERSION = "1.0";
export const COMPARATIVE_CONSENSUS_POLICY_VERSION = "1.0";
export const CANONICAL_INTERPRETATION_GATE_VERSION = "1.0";
export const COMPARATIVE_OBSERVATION_NORMALIZATION_VERSION = "1.0";

export const comparativeObservationScores = {
  clearly_less: -2,
  somewhat_less: -1,
  similar: 0,
  somewhat_more: 1,
  clearly_more: 2
} as const;

export const behavioralAttributeDirection: Record<BehavioralEquipmentDNAAttributeKey, "demand" | "support"> = {
  swing_effort: "demand",
  forgiveness: "support",
  sweet_spot_support: "support",
  bat_control_support: "support"
};

export const comparativeSynthesisRequiredIndependentSources = 2;

