import type { BehavioralEquipmentDNAAttributeKey } from "../behavioral/index.js";
import type {
  PhysicalBatCondition,
  PhysicalBatEvaluatorCategory,
  PhysicalBatComparisonScale,
  PhysicalBatReferenceUnavailableReason,
  PhysicalBatStandaloneObservationScale
} from "./structured-physical-bat-evaluation.types.js";

export const PHYSICAL_BAT_EVALUATION_PROTOCOL_VERSION = "1.0";
export const PHYSICAL_BAT_EVALUATION_SESSION_VERSION = "1.0";
export const PHYSICAL_BAT_EVALUATION_RUBRIC_VERSION = "1.0";
export const PHYSICAL_BAT_REFERENCE_COMPARISON_VERSION = "1.0";
export const PHYSICAL_BAT_EVIDENCE_OUTPUT_VERSION = "1.0";
export const PHYSICAL_BAT_STANDALONE_EVALUATION_MODE_VERSION = "1.0";
export const STANDALONE_ORDINAL_PERSISTENCE_VERSION = "1.0";
export const STANDALONE_ORDINAL_REPAIR_VERSION = "1.0";

export const physicalBatEvaluatorCategories = [
  "internal_equipment_evaluator",
  "coach_evaluator",
  "experienced_player_evaluator",
  "technical_evaluator",
  "other_qualified_evaluator"
] as const satisfies readonly PhysicalBatEvaluatorCategory[];

export const physicalBatComparisonScale = [
  "clearly_less",
  "somewhat_less",
  "similar",
  "somewhat_more",
  "clearly_more",
  "unable_to_assess"
] as const satisfies readonly PhysicalBatComparisonScale[];

export const physicalBatStandaloneObservationScale = [
  "very_low",
  "low",
  "moderate",
  "high",
  "very_high",
  "unable_to_assess"
] as const satisfies readonly PhysicalBatStandaloneObservationScale[];

export const physicalBatReferenceUnavailableReasons = [
  "no_suitable_verified_reference_available",
  "reference_identity_unverified",
  "reference_not_physically_available",
  "reference_not_comparable",
  "other_documented_reason"
] as const satisfies readonly PhysicalBatReferenceUnavailableReason[];

export const physicalBatConditionPolicy: Record<PhysicalBatCondition, { blocksEvaluation: boolean; warning?: string }> = {
  new_or_near_new: { blocksEvaluation: false },
  normal_used_condition: { blocksEvaluation: false },
  materially_worn: {
    blocksEvaluation: false,
    warning: "Material wear must be documented because it can lower evidence quality."
  },
  damaged: {
    blocksEvaluation: true,
    warning: "Damaged bats block behavioral evaluation in protocol v1.0."
  },
  unknown: {
    blocksEvaluation: false,
    warning: "Unknown condition lowers evidence quality until inspected."
  }
};

export const physicalBatRequiredBehavioralAttributes = [
  "swing_effort",
  "forgiveness",
  "sweet_spot_support",
  "bat_control_support"
] as const satisfies readonly BehavioralEquipmentDNAAttributeKey[];

export const physicalBatRubricRequirements: Record<
  BehavioralEquipmentDNAAttributeKey,
  { readonly minimumDimensions: number; readonly contactTestingRecommended: boolean; readonly requiredDimensions: readonly string[] }
> = {
  swing_effort: {
    minimumDimensions: 3,
    contactTestingRecommended: false,
    requiredDimensions: ["startup_demand", "rotational_demand", "barrel_redirect"]
  },
  bat_control_support: {
    minimumDimensions: 3,
    contactTestingRecommended: false,
    requiredDimensions: ["direction_changes", "start_stop_manageability", "path_consistency"]
  },
  forgiveness: {
    minimumDimensions: 3,
    contactTestingRecommended: true,
    requiredDimensions: ["varied_contact_regions", "mishit_response", "vibration_feedback"]
  },
  sweet_spot_support: {
    minimumDimensions: 3,
    contactTestingRecommended: true,
    requiredDimensions: ["usable_response_region", "barrel_response_consistency", "contact_location_variation"]
  }
};

export const physicalBatStandaloneRubricRequirements: Record<
  BehavioralEquipmentDNAAttributeKey,
  {
    readonly minimumDimensions: number;
    readonly minimumDrySwingTrials: number;
    readonly minimumContactTrials: number;
    readonly requiredDimensions: readonly string[];
    readonly direction: "demand" | "support" | "support_with_inverse_degradation";
  }
> = {
  swing_effort: {
    minimumDimensions: 3,
    minimumDrySwingTrials: 8,
    minimumContactTrials: 0,
    requiredDimensions: ["startup_demand", "rotational_demand", "barrel_redirect_demand"],
    direction: "demand"
  },
  bat_control_support: {
    minimumDimensions: 3,
    minimumDrySwingTrials: 8,
    minimumContactTrials: 0,
    requiredDimensions: [
      "directional_controllability",
      "barrel_path_manageability",
      "start_stop_controllability"
    ],
    direction: "support"
  },
  forgiveness: {
    minimumDimensions: 4,
    minimumDrySwingTrials: 0,
    minimumContactTrials: 8,
    requiredDimensions: [
      "off_center_response_consistency",
      "handle_side_miss_tolerance",
      "end_side_miss_tolerance",
      "response_degradation"
    ],
    direction: "support_with_inverse_degradation"
  },
  sweet_spot_support: {
    minimumDimensions: 3,
    minimumDrySwingTrials: 0,
    minimumContactTrials: 8,
    requiredDimensions: [
      "usable_contact_region",
      "centered_response_consistency",
      "near_center_response_consistency"
    ],
    direction: "support"
  }
};

export const physicalBatStandaloneTrialPolicy = {
  minimumDrySwingTrials: 8,
  recommendedDrySwingTrials: "10-12",
  minimumContactTrialsForContactAttributes: 8,
  recommendedContactTrialsForContactAttributes: "12-15",
  referenceAlternationAllowed: 0
} as const;

export const physicalBatOperatorProtocolSections = [
  "Purpose: evaluate bat-side physical behavior, not player compatibility.",
  "Verify the physical bat identity against the catalog variant before any behavioral observation.",
  "Record condition and stop if the bat is materially damaged.",
  "Use safe evaluator identifiers and one of the protocol evaluator categories.",
  "Use reference bats with verified identity; prefer similar size and certification where practical.",
  "Use standalone mode when no suitable verified reference bat is physically available.",
  "Collect structured observations using rubric labels, not arbitrary 0-100 canonical scores.",
  "Comparative relative-only evidence may defer canonical ordinal interpretation.",
  "Standalone mode uses absolute labels: very_low, low, moderate, high, very_high, unable_to_assess.",
  "Separate dry-swing observations from contact-testing observations.",
  "Preserve raw observations before deriving any canonical ordinal interpretation.",
  "Stop if the evaluator begins making player-specific, outcome, transition, or recommendation claims.",
  "Commit evidence only after explicit confirmation; do not activate live recommendations."
] as const;
