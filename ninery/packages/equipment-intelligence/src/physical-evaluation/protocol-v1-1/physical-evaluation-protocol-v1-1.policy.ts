import type { PhysicalEvaluationProtocolV11Construct, PhysicalEvaluationProtocolV11Question } from "./physical-evaluation-protocol-v1-1.types.js";

export const PHYSICAL_EVALUATION_PROTOCOL_V1_1_PREVIEW_VERSION = "1.1-preview";
export const PHYSICAL_EVALUATION_QUESTIONNAIRE_V1_1_VERSION = "1.1";
export const PHYSICAL_EVALUATION_PROVENANCE_V1_1_VERSION = "1.1";
export const PHYSICAL_EVALUATION_CALIBRATION_STUDY_VERSION = "1.0";

export const physicalEvaluationProtocolV11Constructs = [
  construct("swing_effort", "swing_effort", "Swing Effort", "existing_construct_refined", ["startup_demand", "rotational_demand", "barrel_redirect_demand"]),
  construct("bat_control_support", "bat_control_support", "Bat Control Support", "existing_construct_refined", ["directional_adjustment_control", "barrel_path_repeatability", "start_stop_redirect_control"]),
  construct("forgiveness", "forgiveness", "Forgiveness", "existing_construct_refined", ["center_response_baseline", "handle_side_miss_tolerance", "end_side_miss_tolerance", "response_degradation"]),
  construct("sweet_spot_support", "sweet_spot_breadth_candidate", "Sweet Spot Breadth", "candidate_subconstruct", ["usable_contact_region_breadth"]),
  construct("sweet_spot_support", "sweet_spot_response_quality_candidate", "Sweet Spot Response Quality", "candidate_subconstruct", ["centered_response_consistency", "near_center_response_consistency"])
] as const satisfies readonly PhysicalEvaluationProtocolV11Construct[];

export const physicalEvaluationProtocolV11Questions = [
  question(1, "swing_effort", "swing_effort", "startup_demand", "How much effort is required to start the bat moving from the launch position?", "Rate the initial move only. Do not use an overall heavy/light judgment.", "five_level_absolute", "dry_swing_block_1", 4),
  question(2, "swing_effort", "swing_effort", "rotational_demand", "How much effort is required to keep the bat rotating through the swing path?", "Rate sustained rotational demand independently from startup demand.", "five_level_absolute", "dry_swing_block_2", 4),
  question(3, "swing_effort", "swing_effort", "barrel_redirect_demand", "How much effort is required to redirect the barrel after intentionally changing the planned path?", "Use the prescribed redirect task and rate redirection demand only.", "five_level_absolute", "dry_swing_block_3", 4),
  question(4, "bat_control_support", "bat_control_support", "directional_adjustment_control", "How controllable is the barrel during a deliberate inside-to-outside directional adjustment?", "Use the same two target paths for every recorded block.", "five_level_absolute", "dry_swing_block_1", 4),
  question(5, "bat_control_support", "bat_control_support", "barrel_path_repeatability", "How consistently can the evaluator repeat the prescribed barrel path?", "Rate bat-side path manageability, not contact outcome or player skill.", "five_level_absolute", "dry_swing_block_2", 4),
  question(6, "bat_control_support", "bat_control_support", "start_stop_redirect_control", "How controllable is the bat during the prescribed start, check, and redirect task?", "Record control through the sequence; do not collapse this into swing effort.", "five_level_absolute", "dry_swing_block_3", 4),
  question(7, "forgiveness", "forgiveness", "center_response_baseline", "How consistent is the bat's response on verified centered contact?", "Establish the response baseline using at least six centered contacts before evaluating misses.", "five_level_absolute", "centered_contact", 6),
  question(8, "forgiveness", "forgiveness", "handle_side_miss_tolerance", "How much usable response is retained on controlled handle-side misses?", "Use at least six intentional modest near-center handle-side misses; do not use extreme mishits.", "five_level_absolute", "near_center_handle_side", 6),
  question(9, "forgiveness", "forgiveness", "end_side_miss_tolerance", "How much usable response is retained on controlled end-side misses?", "Use at least six intentional modest near-center end-side misses; do not use extreme mishits.", "five_level_absolute", "near_center_end_side", 6),
  question(10, "forgiveness", "forgiveness", "response_degradation", "How much does response quality degrade as contact moves away from center?", "Use the full 18-contact controlled set. Higher degradation means less forgiveness.", "five_level_inverse_degradation", "full_controlled_contact_set", 18),
  question(11, "sweet_spot_support", "sweet_spot_breadth_candidate", "usable_contact_region_breadth", "Across controlled contact locations, how broad is the region that produces a usable response?", "Do not infer barrel coverage beyond the contact locations actually tested. Rate the apparent breadth supported by the controlled contact observations only.", "five_level_absolute", "full_controlled_contact_set", 18, "candidate_subconstruct_only"),
  question(12, "sweet_spot_support", "sweet_spot_response_quality_candidate", "centered_response_consistency", "How consistent is response quality across verified centered contacts?", "Rate response quality across the six centered contacts only; do not infer region breadth.", "five_level_absolute", "centered_contact", 6, "candidate_subconstruct_only"),
  question(13, "sweet_spot_support", "sweet_spot_response_quality_candidate", "near_center_response_consistency", "How consistent is response quality across verified near-center contacts?", "Use the combined 12 modest near-center handle-side and end-side misses.", "five_level_absolute", "combined_near_center_misses", 12, "candidate_subconstruct_only")
] as const satisfies readonly PhysicalEvaluationProtocolV11Question[];

function construct(attributeKey: PhysicalEvaluationProtocolV11Construct["attributeKey"], constructCode: string, name: string, status: PhysicalEvaluationProtocolV11Construct["status"], dimensions: readonly string[]): PhysicalEvaluationProtocolV11Construct {
  return { attributeKey, constructCode, name, status, canonicalAttributeCreated: false, dimensions, aggregationPolicy: status === "candidate_subconstruct" ? "no_automatic_aggregation" : "dimension_preserving_preview" };
}

function question(order: number, attributeKey: PhysicalEvaluationProtocolV11Question["attributeKey"], constructCode: string, dimensionKey: string, prompt: string, operatorInstruction: string, responseScale: PhysicalEvaluationProtocolV11Question["responseScale"], trialBlock: PhysicalEvaluationProtocolV11Question["trialBlock"], minimumTrials: number, aggregationRole: PhysicalEvaluationProtocolV11Question["aggregationRole"] = "existing_attribute_dimension"): PhysicalEvaluationProtocolV11Question {
  return { id: `v1.1-q${String(order).padStart(2, "0")}`, order, attributeKey, construct: constructCode, dimensionKey, prompt, operatorInstruction, responseScale, trialBlock, minimumTrials, aggregationRole, required: true };
}
