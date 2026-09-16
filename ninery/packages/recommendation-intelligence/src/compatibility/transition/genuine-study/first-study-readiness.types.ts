import type { CanonicalEquipmentDNAAdmissionDecision } from "@ninery/equipment-intelligence";
import type { TransitionExtendedShadowStudy } from "../extended-shadow/index.js";
import type { TransitionShadowCheckpointStatus, TransitionShadowInternalActor } from "../admin/index.js";
import type { TransitionPredictionContextLoaderRepository, TransitionPredictionInputAssemblyResult } from "./transition-prediction-context.types.js";

export const FIRST_GENUINE_STUDY_READINESS_VERSION = "1.0";
export const FIRST_GENUINE_STUDY_PREFLIGHT_POLICY_VERSION = "1.0";
export const FIRST_GENUINE_STUDY_NEXT_ACTION_VERSION = "1.0";
export const TRANSITION_STUDY_OBSERVER_PLAN_VERSION = "1.0";
export const TRANSITION_STUDY_RUNBOOK_VERSION = "1.0";

export type FirstGenuineStudyReadinessStatus =
  | "ready_to_prepare"
  | "ready_to_create"
  | "study_already_exists"
  | "blocked";

export type FirstGenuineStudyCheckStatus =
  | "ready"
  | "required_action"
  | "warning"
  | "blocked"
  | "not_applicable"
  | "complete"
  | "not_ready";

export type FirstGenuineStudyNextActionCode =
  | "AUTHORIZE_OPERATOR"
  | "VERIFY_PLAYER"
  | "VERIFY_CURRENT_EQUIPMENT"
  | "VERIFY_PROPOSED_EQUIPMENT"
  | "UPDATE_PLAYER_DNA"
  | "REPAIR_EQUIPMENT_DNA"
  | "CAPTURE_FAMILIARITY"
  | "CAPTURE_ACKNOWLEDGEMENT"
  | "COMPLETE_OBSERVER_PLAN"
  | "CREATE_STUDY_DRAFT"
  | "CAPTURE_PREDICTION"
  | "BEGIN_OBSERVATION"
  | "RECORD_CHECKPOINT_OBSERVATION"
  | "COMPLETE_STUDY"
  | "NONE_BLOCKED"
  | "NONE_COMPLETE";

export type FirstGenuineStudyReadinessCheck = {
  readonly code: string;
  readonly status: FirstGenuineStudyCheckStatus;
  readonly summary: string;
  readonly source?: string;
  readonly nextAction?: string;
};

export type FirstGenuineStudyBlocker = {
  readonly code: string;
  readonly message: string;
  readonly recoveryDomain: "authorization" | "player" | "equipment" | "player_dna" | "equipment_dna" | "familiarity" | "acknowledgement" | "observer_plan" | "study_lifecycle" | "context";
  readonly nextAction: string;
};

export type FirstGenuineStudyWarning = {
  readonly code: string;
  readonly message: string;
  readonly nextAction?: string;
};

export type TransitionStudyObserverPlanResult = {
  readonly version: typeof TRANSITION_STUDY_OBSERVER_PLAN_VERSION;
  readonly status: "ready" | "incomplete" | "blocked";
  readonly checkpoints: readonly {
    readonly checkpoint: "first_use" | "early_sessions" | "acclimation_period";
    readonly required: boolean;
    readonly plannedSourceTypes: readonly string[];
    readonly status: "planned" | "missing_source" | "unsupported_source";
  }[];
  readonly warnings: readonly string[];
};

export type FirstGenuineStudyNextAction = {
  readonly version: typeof FIRST_GENUINE_STUDY_NEXT_ACTION_VERSION;
  readonly code: FirstGenuineStudyNextActionCode;
  readonly summary: string;
  readonly command?: string;
};

export type FirstGenuineStudyLifecycleReadiness = {
  readonly draftReadiness: FirstGenuineStudyCheckStatus;
  readonly predictionReadiness: FirstGenuineStudyCheckStatus;
  readonly observationReadiness: FirstGenuineStudyCheckStatus;
  readonly checkpointReadiness: FirstGenuineStudyCheckStatus;
  readonly completionReadiness: FirstGenuineStudyCheckStatus;
  readonly checkpoints: readonly TransitionShadowCheckpointStatus[];
};

export type FirstGenuineStudyPreflightRequest = {
  readonly actor: TransitionShadowInternalActor | undefined;
  readonly playerId?: string;
  readonly currentEquipmentId?: string;
  readonly currentVariantId?: string;
  readonly proposedEquipmentId?: string;
  readonly proposedVariantId?: string;
  readonly studyId?: string;
};

export type FirstGenuineStudyPreflightResult = {
  readonly version: typeof FIRST_GENUINE_STUDY_READINESS_VERSION;
  readonly policyVersion: typeof FIRST_GENUINE_STUDY_PREFLIGHT_POLICY_VERSION;
  readonly status: FirstGenuineStudyReadinessStatus;
  readonly checks: readonly FirstGenuineStudyReadinessCheck[];
  readonly blockers: readonly FirstGenuineStudyBlocker[];
  readonly warnings: readonly FirstGenuineStudyWarning[];
  readonly observerPlan: TransitionStudyObserverPlanResult;
  readonly nextAction: FirstGenuineStudyNextAction;
  readonly model: {
    readonly version: "1.1";
    readonly mode: "extended_shadow";
    readonly liveUseAllowed: false;
  };
  readonly contextAssembly?: TransitionPredictionInputAssemblyResult;
  readonly lifecycle?: FirstGenuineStudyLifecycleReadiness;
  readonly study?: TransitionExtendedShadowStudy;
  readonly generatedAt: Date;
};

export type FirstGenuineStudyReadinessRepository = TransitionPredictionContextLoaderRepository & {
  readonly hasActiveStudyForTransition: (input: {
    readonly playerId: string;
    readonly currentEquipmentId: string;
    readonly currentVariantId?: string;
    readonly proposedEquipmentId: string;
    readonly proposedVariantId?: string;
  }) => Promise<boolean>;
  readonly getVariantSpecification: (variantId: string) => Promise<{ readonly id: string; readonly equipmentId: string; readonly length?: number; readonly weight?: number; readonly drop?: number } | undefined>;
  readonly getAdmissionDecision?: (equipmentId: string, variantId?: string) => Promise<CanonicalEquipmentDNAAdmissionDecision | undefined>;
  readonly hasAcknowledgement?: (studyId: string) => Promise<boolean>;
};
