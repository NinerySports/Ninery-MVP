import type { TransitionObservationSource } from "../extended-shadow/index.js";
import {
  FIRST_GENUINE_STUDY_NEXT_ACTION_VERSION,
  TRANSITION_STUDY_OBSERVER_PLAN_VERSION,
  type FirstGenuineStudyBlocker,
  type FirstGenuineStudyNextAction,
  type FirstGenuineStudyReadinessCheck,
  type FirstGenuineStudyWarning,
  type TransitionStudyObserverPlanResult
} from "./first-study-readiness.types.js";

export const FIRST_GENUINE_STUDY_CHECK_CODES = [
  "operator_authorization",
  "player_eligibility",
  "genuine_study_classification",
  "duplicate_active_study",
  "current_equipment_identity",
  "current_variant_identity",
  "current_equipment_specifications",
  "proposed_equipment_identity",
  "proposed_variant_identity",
  "proposed_equipment_specifications",
  "player_dna_supported",
  "player_dna_ambiguity",
  "experience_readiness",
  "bat_control_readiness",
  "development_readiness",
  "current_equipment_dna",
  "proposed_equipment_dna",
  "equipment_dna_admission",
  "familiarity_availability",
  "familiarity_confidence",
  "context_loader_readiness",
  "transition_v1_1_input_readiness",
  "observer_plan_readiness",
  "acknowledgement_readiness",
  "lifecycle_creation_readiness"
] as const;

export const firstGenuineStudyNextActionPriority = [
  "AUTHORIZE_OPERATOR",
  "VERIFY_PLAYER",
  "VERIFY_CURRENT_EQUIPMENT",
  "VERIFY_PROPOSED_EQUIPMENT",
  "UPDATE_PLAYER_DNA",
  "REPAIR_EQUIPMENT_DNA",
  "CAPTURE_FAMILIARITY",
  "CAPTURE_ACKNOWLEDGEMENT",
  "COMPLETE_OBSERVER_PLAN",
  "CREATE_STUDY_DRAFT",
  "CAPTURE_PREDICTION",
  "BEGIN_OBSERVATION",
  "RECORD_CHECKPOINT_OBSERVATION",
  "COMPLETE_STUDY",
  "NONE_BLOCKED",
  "NONE_COMPLETE"
] as const satisfies readonly FirstGenuineStudyNextAction["code"][];

export const supportedObserverSources = [
  "parent_or_guardian",
  "coach",
  "internal_staff",
  "combined"
] as const satisfies readonly TransitionObservationSource[];

export function defaultObserverPlan(): TransitionStudyObserverPlanResult {
  return observerPlan(["parent_or_guardian", "coach"]);
}

export function observerPlan(plannedSourceTypes: readonly string[]): TransitionStudyObserverPlanResult {
  const warnings: string[] = [];
  const supported = new Set<string>(supportedObserverSources);
  const unsupported = plannedSourceTypes.filter((source) => !supported.has(source));
  if (unsupported.length) warnings.push(`Unsupported observer source type(s): ${unsupported.join(", ")}.`);
  const sourceStatus = unsupported.length ? "unsupported_source" : plannedSourceTypes.length ? "planned" : "missing_source";
  return {
    version: TRANSITION_STUDY_OBSERVER_PLAN_VERSION,
    status: unsupported.length ? "blocked" : plannedSourceTypes.length ? "ready" : "incomplete",
    checkpoints: [
      { checkpoint: "first_use", required: true, plannedSourceTypes, status: sourceStatus },
      { checkpoint: "early_sessions", required: true, plannedSourceTypes, status: sourceStatus },
      { checkpoint: "acclimation_period", required: true, plannedSourceTypes, status: sourceStatus }
    ],
    warnings
  };
}

export function check(code: string, status: FirstGenuineStudyReadinessCheck["status"], summary: string, nextAction?: string, source?: string): FirstGenuineStudyReadinessCheck {
  return { code, status, summary, nextAction, source };
}

export function blocker(code: string, message: string, recoveryDomain: FirstGenuineStudyBlocker["recoveryDomain"], nextAction: string): FirstGenuineStudyBlocker {
  return { code, message, recoveryDomain, nextAction };
}

export function warning(code: string, message: string, nextAction?: string): FirstGenuineStudyWarning {
  return { code, message, nextAction };
}

export function nextAction(code: FirstGenuineStudyNextAction["code"], summary: string, command?: string): FirstGenuineStudyNextAction {
  return { version: FIRST_GENUINE_STUDY_NEXT_ACTION_VERSION, code, summary, command };
}
