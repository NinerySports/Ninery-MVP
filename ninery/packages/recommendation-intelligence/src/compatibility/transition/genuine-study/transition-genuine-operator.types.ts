import type { TransitionCompatibilityInput } from "../transition-compatibility.types.js";
import type { TransitionAdjustmentObservation, TransitionObservationCheckpoint } from "../extended-shadow/index.js";
import type {
  TransitionShadowCompletionReview,
  TransitionShadowInternalActor,
  TransitionShadowInvalidationReasonCode,
  TransitionShadowStudyAdminView
} from "../admin/index.js";
import type {
  TransitionFieldObservationReadinessResult,
  TransitionGenuineStudyCreateInput,
  TransitionGenuineStudyEligibilityResult
} from "./transition-genuine-study.types.js";
import type {
  TransitionPredictionInputAssemblyResult,
  TransitionPredictionInputReview
} from "./transition-prediction-context.types.js";
import type {
  TransitionPredictionContextLoaderService
} from "./transition-prediction-context.service.js";

export const TRANSITION_GENUINE_OPERATOR_WORKFLOW_VERSION = "1.0";
export const TRANSITION_GENUINE_OPERATOR_REVIEW_VERSION = "1.0";
export const TRANSITION_GENUINE_OPERATOR_CLI_VERSION = "1.0";
export const TRANSITION_GENUINE_OBSERVATION_ENTRY_VERSION = "1.0";

export type TransitionGenuineOperatorEnvironment =
  | "development"
  | "test"
  | "internal"
  | "unsupported";

export type TransitionGenuineOperatorEnvironmentDecision = {
  readonly allowed: boolean;
  readonly environment: TransitionGenuineOperatorEnvironment;
  readonly blockers: readonly string[];
};

export type TransitionGenuineOperatorContext = {
  readonly actorId?: string;
  readonly environment?: TransitionGenuineOperatorEnvironment;
};

export type GenuineTransitionOperatorIntakeInput = TransitionGenuineStudyCreateInput & {
  readonly actorId: string;
  readonly studyPurpose:
    | "extended_shadow_validation"
    | "equipment_transition_observation";
};

export type TransitionGenuineOperatorReview = {
  readonly version: typeof TRANSITION_GENUINE_OPERATOR_REVIEW_VERSION;
  readonly evidenceClassification: "genuine_internal_observation";
  readonly actorAuthorized: boolean;
  readonly environmentAllowed: boolean;
  readonly player: "verified" | "blocked";
  readonly currentEquipment: "verified" | "blocked";
  readonly currentVariant: "verified" | "blocked";
  readonly proposedEquipment: "verified" | "blocked";
  readonly proposedVariant: "verified" | "blocked";
  readonly acknowledgement: "captured" | "missing";
  readonly familiarity: {
    readonly level: string;
    readonly confidence: string;
  };
  readonly playerDNA: "available" | "blocked";
  readonly transitionV1_1Dependencies: "ready" | "blocked";
  readonly duplicateActiveStudy: "yes" | "no";
  readonly prospectiveStudy: "yes" | "no";
  readonly syntheticFixture: "yes" | "no";
  readonly warnings: readonly string[];
  readonly blockers: readonly string[];
  readonly readyToCommit: boolean;
  readonly eligibility: TransitionGenuineStudyEligibilityResult;
};

export type TransitionGenuineOperatorPrepareResult = {
  readonly version: typeof TRANSITION_GENUINE_OPERATOR_WORKFLOW_VERSION;
  readonly actor: TransitionShadowInternalActor;
  readonly review: TransitionGenuineOperatorReview;
  readonly wouldPersist: false;
};

export type TransitionGenuineOperatorCreateResult = {
  readonly version: typeof TRANSITION_GENUINE_OPERATOR_WORKFLOW_VERSION;
  readonly dryRun: boolean;
  readonly confirmed: boolean;
  readonly review: TransitionGenuineOperatorReview;
  readonly studyId?: string;
  readonly persisted: boolean;
};

export type TransitionGenuineOperatorPredictionInput = {
  readonly studyId: string;
  readonly actorId: string;
  readonly compatibilityInput?: TransitionCompatibilityInput;
  readonly predictedAt: Date;
  readonly confirm?: boolean;
  readonly manualInputOverride?: boolean;
  readonly showTraceSummary?: boolean;
};

export type TransitionGenuineOperatorPredictionResult = {
  readonly score: number;
  readonly band: string;
  readonly confidence: string;
  readonly modelVersion: "1.1";
  readonly missingInformation: readonly unknown[];
  readonly reasons: readonly unknown[];
  readonly tradeoffs: readonly unknown[];
  readonly predictionHash?: string;
  readonly inputAssembly?: TransitionPredictionInputAssemblyResult;
  readonly inputReview?: TransitionPredictionInputReview;
  readonly manualInputOverride: boolean;
};

export type TransitionGenuineObservationEntryInput = {
  readonly studyId: string;
  readonly actorId: string;
  readonly observation: TransitionAdjustmentObservation;
  readonly correctionReason?: string;
};

export type TransitionGenuineOperatorObservationResult = {
  readonly version: typeof TRANSITION_GENUINE_OBSERVATION_ENTRY_VERSION;
  readonly studyId: string;
  readonly observationCount: number;
  readonly checkpoint: TransitionObservationCheckpoint;
  readonly appendOnly: true;
};

export type TransitionGenuineOperatorCompletionResult = {
  readonly studyId: string;
  readonly completed: boolean;
  readonly review: TransitionShadowCompletionReview;
};

export type TransitionGenuineOperatorStudyView = TransitionShadowStudyAdminView & {
  readonly acknowledgementPresent: boolean;
  readonly registryEligible: boolean;
};

export type TransitionGenuineOperatorReadinessReport = {
  readonly deliveryMode: "service_and_cli_only";
  readonly playerLookup: "available";
  readonly equipmentLookup: "available";
  readonly genuineIntakePreparation: "available";
  readonly explicitCommitConfirmation: "required";
  readonly acknowledgementCapture: "available";
  readonly familiarityCapture: "available";
  readonly prospectiveV1_1Prediction: "available";
  readonly observationStart: "available";
  readonly firstUseEntry: "available";
  readonly earlySessionEntry: "available";
  readonly acclimationEntry: "available";
  readonly completionReview: "available";
  readonly completion: "available";
  readonly cancellation: "available";
  readonly invalidation: "available";
  readonly audit: "available";
  readonly dryRun: "available";
  readonly syntheticGenuineProtection: "pass";
  readonly noFakeGenuineEvidence: "pass";
  readonly modelAutomaticallyChanged: false;
  readonly livePromotionAutomaticallyRecommended: false;
  readonly operatorReadinessVerdict: "pass" | "fail";
};

export type TransitionGenuineOperatorValidationResult = {
  readonly verdict: "pass" | "fail";
  readonly checks: readonly {
    readonly code: string;
    readonly passed: boolean;
    readonly explanation: string;
  }[];
};

export type TransitionGenuineOperatorErrorCode =
  | "UNAUTHORIZED"
  | "UNSUPPORTED_ENVIRONMENT"
  | "INPUT_VALIDATION_FAILED"
  | "CONFIRMATION_REQUIRED"
  | "STUDY_NOT_GENUINE"
  | "ACKNOWLEDGEMENT_REQUIRED"
  | "PREDICTION_NOT_READY"
  | "OBSERVATION_NOT_READY"
  | "CORRECTION_REASON_REQUIRED"
  | "INTERNAL_ERROR";

export class TransitionGenuineOperatorError extends Error {
  constructor(readonly code: TransitionGenuineOperatorErrorCode, message: string, readonly blockers: readonly string[] = []) {
    super(message);
    this.name = "TransitionGenuineOperatorError";
  }
}

export type TransitionGenuineOperatorServiceInput = {
  readonly actorResolver?: (actorId: string) => TransitionShadowInternalActor | undefined;
  readonly contextLoader?: TransitionPredictionContextLoaderService;
};

export type TransitionGenuineOperatorCancelInput = {
  readonly studyId: string;
  readonly actorId: string;
  readonly reason: string;
  readonly cancelledAt: Date;
};

export type TransitionGenuineOperatorInvalidateInput = {
  readonly studyId: string;
  readonly actorId: string;
  readonly reasonCode: TransitionShadowInvalidationReasonCode;
  readonly reason: string;
  readonly invalidatedAt: Date;
};
