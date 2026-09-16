import type { BehavioralEquipmentDNAAttributeKey } from "../real-world-behavioral-evaluation.types.js";

export const CANONICAL_REFERENCE_ANCHOR_STRATEGY_VERSION = "1.0";
export const CANONICAL_REFERENCE_ANCHOR_POLICY_VERSION = "1.0";
export const CANONICAL_REFERENCE_ANCHOR_GATE_VERSION = "1.0";
export const CANONICAL_REFERENCE_BOUNDED_INFERENCE_VERSION = "1.0";

export const anchorStatusRank = {
  not_anchor_eligible: 0,
  provisional_anchor: 1,
  ordinal_anchor: 2,
  numeric_anchor: 3,
  validated_anchor: 4
} as const;

export const minimumApprovedAnchorStatus = "ordinal_anchor" as const;

export const behavioralAnchorAttributePolicy: Record<BehavioralEquipmentDNAAttributeKey, {
  readonly preferredAbsolutePath: "standalone_absolute" | "objective_measurement" | "combined_evidence";
  readonly minimumStandaloneIndependentSources: number;
  readonly objectiveMeasurementHelpful: boolean;
  readonly notes: string;
}> = {
  swing_effort: {
    preferredAbsolutePath: "objective_measurement",
    minimumStandaloneIndependentSources: 2,
    objectiveMeasurementHelpful: true,
    notes: "Swing effort can benefit from measured swing weight, balance point, MOI, or structured standalone swing-demand trials."
  },
  forgiveness: {
    preferredAbsolutePath: "standalone_absolute",
    minimumStandaloneIndependentSources: 2,
    objectiveMeasurementHelpful: false,
    notes: "Forgiveness requires structured contact testing or equivalent absolute barrel-response evidence."
  },
  sweet_spot_support: {
    preferredAbsolutePath: "standalone_absolute",
    minimumStandaloneIndependentSources: 2,
    objectiveMeasurementHelpful: false,
    notes: "Sweet-spot support requires structured contact-region evidence; dry swings alone are insufficient."
  },
  bat_control_support: {
    preferredAbsolutePath: "combined_evidence",
    minimumStandaloneIndependentSources: 2,
    objectiveMeasurementHelpful: true,
    notes: "Bat-control support is best established through combined swing/balance evidence and standalone control observations."
  }
};

export const ordinalScalesByAttribute: Record<BehavioralEquipmentDNAAttributeKey, readonly string[]> = {
  swing_effort: ["very_easy", "easy", "moderate", "demanding", "very_demanding"],
  forgiveness: ["very_low", "low", "moderate", "high", "very_high"],
  sweet_spot_support: ["very_low", "low", "moderate", "high", "very_high"],
  bat_control_support: ["very_low", "low", "moderate", "high", "very_high"]
};

