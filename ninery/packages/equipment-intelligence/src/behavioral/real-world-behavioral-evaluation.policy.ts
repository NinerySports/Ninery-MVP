import type { BehavioralEquipmentDNAAttributeKey, BehavioralEvidenceGap } from "./real-world-behavioral-evaluation.types.js";

export const REAL_WORLD_BEHAVIORAL_EVALUATION_VERSION = "1.0";

export const requiredBehavioralEquipmentDNAAttributes = [
  "swing_effort",
  "forgiveness",
  "sweet_spot_support",
  "bat_control_support"
] as const satisfies readonly BehavioralEquipmentDNAAttributeKey[];

export const behavioralEvidenceGapRecommendations: Record<BehavioralEquipmentDNAAttributeKey, BehavioralEvidenceGap> = {
  swing_effort: {
    attributeKey: "swing_effort",
    needed: [
      "measured swing-weight, balance point, or MOI evidence with method",
      "independent comparative swing-demand evaluation",
      "structured Ninery physical evaluation against reference bats"
    ]
  },
  forgiveness: {
    attributeKey: "forgiveness",
    needed: [
      "controlled off-center contact testing",
      "independent structured evaluation of mishit response",
      "structured Ninery barrel-response evaluation against reference bats"
    ]
  },
  sweet_spot_support: {
    attributeKey: "sweet_spot_support",
    needed: [
      "measured or controlled usable-hitting-region evidence",
      "independent structured sweet-spot evaluation",
      "structured Ninery comparative barrel evaluation"
    ]
  },
  bat_control_support: {
    attributeKey: "bat_control_support",
    needed: [
      "structured barrel-control evaluation",
      "measured balance or swing-demand evidence paired with design review",
      "independent comparative control evaluation against reference bats"
    ]
  }
};

export const behavioralEvaluationStatusOrder = [
  "rejected_contaminated",
  "blocked_conflict",
  "insufficient_evidence",
  "resolved_ordinal",
  "resolved_numeric"
] as const;
