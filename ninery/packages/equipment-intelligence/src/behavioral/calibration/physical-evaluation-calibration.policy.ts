import type { BehavioralEquipmentDNAAttributeKey } from "../real-world-behavioral-evaluation.types.js";

export const PHYSICAL_EVALUATION_PROTOCOL_CALIBRATION_VERSION = "1.0";
export const PHYSICAL_EVALUATION_CONSTRUCT_ANALYSIS_VERSION = "1.0";
export const PHYSICAL_EVALUATION_STOP_POLICY_VERSION = "1.0";

export const minimumPilotEvaluatorsBeforeStructuralReview = 5;

export const physicalEvaluationDimensions = {
  swing_effort: ["startup_demand", "rotational_demand", "barrel_redirect_demand"],
  bat_control_support: ["directional_controllability", "barrel_path_manageability", "start_stop_controllability"],
  forgiveness: ["off_center_response_consistency", "handle_side_miss_tolerance", "end_side_miss_tolerance", "response_degradation"],
  sweet_spot_support: ["usable_contact_region", "centered_response_consistency", "near_center_response_consistency"]
} as const satisfies Record<BehavioralEquipmentDNAAttributeKey, readonly string[]>;

export const inversePhysicalEvaluationDimensions = new Set(["forgiveness:response_degradation"]);

