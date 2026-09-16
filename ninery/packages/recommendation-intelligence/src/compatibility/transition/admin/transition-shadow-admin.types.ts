import type { CurrentEquipmentFamiliarityInput, CurrentEquipmentFamiliarityResult } from "@ninery/player-intelligence";
import type { TransitionCompatibilityInput, TransitionCompatibilityResult } from "../transition-compatibility.types.js";
import type { TransitionCompatibilityV1_1Result } from "../v1_1/index.js";
import type {
  TransitionAdjustmentObservation,
  TransitionExtendedShadowStudy,
  TransitionOutcomeComparison,
  TransitionShadowStudyStatus
} from "../extended-shadow/index.js";

export const TRANSITION_SHADOW_ADMIN_POLICY_VERSION = "1.0";
export const TRANSITION_SHADOW_ADMIN_WORKFLOW_VERSION = "1.0";
export const TRANSITION_SHADOW_AUDIT_EVENT_VERSION = "1.0";
export const TRANSITION_SHADOW_ELIGIBILITY_VERSION = "1.0";
export const TRANSITION_SHADOW_OPERATIONAL_SUMMARY_VERSION = "1.0";

export type TransitionShadowAdministrationDeliveryMode =
  | "protected_internal_web"
  | "protected_internal_api_and_web"
  | "internal_api_only"
  | "service_and_cli_only";

export const TRANSITION_SHADOW_ADMIN_DELIVERY_MODE: TransitionShadowAdministrationDeliveryMode = "service_and_cli_only";

export type TransitionShadowAdminCapability =
  | "transition_shadow_study_view"
  | "transition_shadow_study_create"
  | "transition_shadow_prediction_capture"
  | "transition_shadow_observation_add"
  | "transition_shadow_study_complete"
  | "transition_shadow_study_cancel"
  | "transition_shadow_study_invalidate"
  | "transition_shadow_audit_view"
  | "transition_shadow_fixture_view";

export type TransitionShadowInternalActor = {
  readonly actorId: string;
  readonly accountId?: string;
  readonly organizationId?: string;
  readonly roleCodes: readonly string[];
  readonly capabilityCodes: readonly string[];
  readonly active: boolean;
};

export type TransitionShadowAuthorizationDecision = {
  readonly allowed: boolean;
  readonly capability: TransitionShadowAdminCapability;
  readonly actorId?: string;
  readonly actorRole?: string;
  readonly reasons: readonly string[];
  readonly blockers: readonly string[];
  readonly policyVersion: typeof TRANSITION_SHADOW_ADMIN_POLICY_VERSION;
  readonly evaluatedAt: Date;
};

export type TransitionShadowEvidenceClassification =
  | "genuine_internal_observation"
  | "development_fixture"
  | "synthetic_observation"
  | "test_only";

export type TransitionShadowCaptureOrigin =
  | "internal_guided_entry"
  | "internal_phone_followup"
  | "internal_in_person_followup"
  | "internal_record_review";

export type TransitionShadowOperationalStage =
  | "eligibility_review"
  | "familiarity_capture"
  | "draft_ready"
  | "prediction_ready"
  | "observation_active"
  | "checkpoint_follow_up"
  | "completion_review"
  | "complete"
  | "cancelled"
  | "invalidated";

export type TransitionShadowStudyEligibilityResult = {
  readonly version: typeof TRANSITION_SHADOW_ELIGIBILITY_VERSION;
  readonly playerId: string;
  readonly currentEquipmentId?: string;
  readonly currentEquipmentVariantId?: string;
  readonly proposedEquipmentId?: string;
  readonly proposedEquipmentVariantId?: string;
  readonly eligible: boolean;
  readonly checks: readonly {
    readonly code: string;
    readonly passed: boolean;
    readonly required: boolean;
    readonly explanation: string;
  }[];
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
  readonly evaluatedAt: Date;
};

export type TransitionShadowEquipmentIdentity = {
  readonly equipmentId: string;
  readonly equipmentVariantId?: string;
  readonly label?: string;
  readonly variantLabel?: string;
};

export type TransitionShadowCheckpointStatus = {
  readonly checkpoint: "first_use" | "early_sessions" | "acclimation_period";
  readonly status: "not_due" | "due" | "completed" | "completed_low_confidence" | "missing" | "not_applicable";
  readonly observationCount: number;
  readonly targetWindow?: string;
  readonly warnings: readonly string[];
};

export type TransitionShadowStudyAdminView = {
  readonly study: TransitionExtendedShadowStudy;
  readonly evidenceClassification: TransitionShadowEvidenceClassification;
  readonly playerSummary: {
    readonly playerId: string;
    readonly displayLabel?: string;
  };
  readonly currentEquipmentSummary: TransitionShadowEquipmentIdentity;
  readonly proposedEquipmentSummary: TransitionShadowEquipmentIdentity;
  readonly familiaritySummary: CurrentEquipmentFamiliarityResult;
  readonly predictionSummary?: {
    readonly score: number;
    readonly band: string;
    readonly confidence: string;
    readonly predictedAt: Date;
    readonly modelVersion: string;
  };
  readonly checkpointStatuses: readonly TransitionShadowCheckpointStatus[];
  readonly observationSummary: {
    readonly total: number;
    readonly meaningfulUseCount: number;
    readonly sourceCounts: Record<string, number>;
    readonly conflictsDetected: boolean;
  };
  readonly outcomeComparison?: TransitionOutcomeComparison;
  readonly lifecycleActions: readonly {
    readonly action: string;
    readonly allowed: boolean;
    readonly blockers: readonly string[];
  }[];
  readonly auditSummary: {
    readonly eventCount: number;
    readonly latestEventAt?: Date;
  };
};

export type TransitionShadowCompletionReview = {
  readonly studyId: string;
  readonly meaningfulUseObservationCount: number;
  readonly checkpointStatuses: readonly TransitionShadowCheckpointStatus[];
  readonly unresolvedConflicts: boolean;
  readonly observationConfidence: "low" | "moderate" | "high";
  readonly outcomeComparison?: TransitionOutcomeComparison;
  readonly completionEligible: boolean;
  readonly warnings: readonly string[];
  readonly blockers: readonly string[];
  readonly overrideReasonRequired: boolean;
  readonly reviewedAt: Date;
};

export type TransitionShadowOperationalSummary = {
  readonly version: typeof TRANSITION_SHADOW_OPERATIONAL_SUMMARY_VERSION;
  readonly studyCounts: {
    readonly total: number;
    readonly genuine: number;
    readonly synthetic: number;
    readonly draft: number;
    readonly predictionCaptured: number;
    readonly observationActive: number;
    readonly observationComplete: number;
    readonly cancelled: number;
    readonly invalidated: number;
  };
  readonly checkpointCounts: {
    readonly due: number;
    readonly missing: number;
    readonly completed: number;
    readonly lowConfidence: number;
  };
  readonly outcomeCounts: Record<string, number>;
  readonly conflictCount: number;
  readonly insufficientObservationCount: number;
  readonly modelVersions: Record<string, number>;
  readonly generatedAt: Date;
};

export type TransitionShadowAdminErrorCode =
  | "UNAUTHORIZED"
  | "CAPABILITY_REQUIRED"
  | "PLAYER_NOT_FOUND"
  | "CURRENT_EQUIPMENT_NOT_FOUND"
  | "PROPOSED_EQUIPMENT_NOT_FOUND"
  | "STUDY_NOT_FOUND"
  | "STUDY_NOT_ELIGIBLE"
  | "ACTIVE_STUDY_EXISTS"
  | "FAMILIARITY_REQUIRED"
  | "PREDICTION_BLOCKED"
  | "PREDICTION_ALREADY_CAPTURED"
  | "INVALID_STATUS_TRANSITION"
  | "OBSERVATION_INVALID"
  | "OBSERVATION_WINDOW_NOT_ACTIVE"
  | "COMPLETION_REQUIREMENTS_NOT_MET"
  | "CANCELLATION_REASON_REQUIRED"
  | "INVALIDATION_REASON_REQUIRED"
  | "SYNTHETIC_GENUINE_MISMATCH"
  | "AUDIT_WRITE_FAILED"
  | "CONCURRENCY_CONFLICT"
  | "INTERNAL_ERROR";

export type TransitionShadowInvalidationReasonCode =
  | "incorrect_player"
  | "incorrect_current_equipment"
  | "incorrect_proposed_equipment"
  | "prediction_snapshot_inconsistent"
  | "proposed_equipment_not_used"
  | "observation_integrity_issue"
  | "authorization_or_consent_missing"
  | "duplicate_or_conflicting_study"
  | "other";

export class TransitionShadowAdminError extends Error {
  constructor(readonly code: TransitionShadowAdminErrorCode, message: string) {
    super(message);
    this.name = "TransitionShadowAdminError";
  }
}

export type TransitionShadowAuditAction =
  | "study_eligibility_reviewed"
  | "study_draft_created"
  | "familiarity_captured"
  | "prediction_captured"
  | "observation_started"
  | "observation_added"
  | "study_completion_reviewed"
  | "study_completed"
  | "study_cancelled"
  | "study_invalidated"
  | "study_viewed";

export type TransitionShadowAuditEvent = {
  readonly version: typeof TRANSITION_SHADOW_AUDIT_EVENT_VERSION;
  readonly id: string;
  readonly studyId?: string;
  readonly studyKey?: string;
  readonly actorId: string;
  readonly actorRole?: string;
  readonly capability: TransitionShadowAdminCapability;
  readonly action: TransitionShadowAuditAction;
  readonly reason?: string;
  readonly beforeSummary?: Record<string, unknown>;
  readonly afterSummary?: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
  readonly createdAt: Date;
};

export type TransitionShadowStudyListFilters = {
  readonly includeSynthetic?: boolean;
  readonly status?: TransitionShadowStudyStatus;
  readonly playerId?: string;
  readonly currentEquipmentId?: string;
  readonly proposedEquipmentId?: string;
  readonly evidenceClassification?: TransitionShadowEvidenceClassification;
  readonly modelVersion?: string;
  readonly comparisonStatus?: TransitionOutcomeComparison["comparisonStatus"];
  readonly checkpoint?: "due" | "missing";
  readonly createdFrom?: Date;
  readonly createdTo?: Date;
  readonly limit?: number;
  readonly offset?: number;
};

export type TransitionShadowAdminRepository = {
  readonly getPlayer: (playerId: string) => Promise<{ readonly id: string; readonly status?: string; readonly label?: string; readonly synthetic?: boolean } | undefined>;
  readonly hasPlayerDNA: (playerId: string) => Promise<boolean>;
  readonly getEquipment: (equipmentId: string) => Promise<{ readonly id: string; readonly label?: string; readonly synthetic?: boolean } | undefined>;
  readonly getEquipmentVariant: (variantId: string) => Promise<{ readonly id: string; readonly equipmentId: string; readonly label?: string; readonly synthetic?: boolean } | undefined>;
  readonly getStudy: (studyId: string) => Promise<TransitionExtendedShadowStudy | undefined>;
  readonly listStudies: (filters?: TransitionShadowStudyListFilters) => Promise<readonly TransitionExtendedShadowStudy[]>;
  readonly findActiveStudyByKey: (studyKey: string) => Promise<TransitionExtendedShadowStudy | undefined>;
  readonly createStudy: (study: TransitionExtendedShadowStudy) => Promise<TransitionExtendedShadowStudy>;
  readonly updateStudy: (study: TransitionExtendedShadowStudy, expectedUpdatedAt?: Date) => Promise<TransitionExtendedShadowStudy>;
  readonly writeAuditEvent: (event: TransitionShadowAuditEvent) => Promise<void>;
  readonly listAuditEvents: (studyId?: string) => Promise<readonly TransitionShadowAuditEvent[]>;
};

export type TransitionShadowCreateDraftInput = {
  readonly id: string;
  readonly playerId: string;
  readonly currentEquipmentId: string;
  readonly currentEquipmentVariantId?: string;
  readonly proposedEquipmentId: string;
  readonly proposedEquipmentVariantId?: string;
  readonly observationPeriodKey: string;
  readonly evidenceClassification: TransitionShadowEvidenceClassification;
  readonly studyPurpose: string;
  readonly captureOrigin?: TransitionShadowCaptureOrigin;
  readonly intendedObservationStartAt?: Date;
  readonly familiarityInput: CurrentEquipmentFamiliarityInput;
  readonly allowSameEquipmentStudy?: boolean;
  readonly internalNote?: string;
  readonly createdAt: Date;
};

export type TransitionShadowPredictionCaptureInput = {
  readonly studyId: string;
  readonly compatibilityInput: TransitionCompatibilityInput;
  readonly familiarity: CurrentEquipmentFamiliarityResult;
  readonly predictedAt: Date;
};

export type TransitionShadowPredictionCaptureResult = {
  readonly study: TransitionExtendedShadowStudy;
  readonly prediction: TransitionCompatibilityV1_1Result;
  readonly reasons: TransitionCompatibilityResult["reasons"];
  readonly tradeoffs: TransitionCompatibilityResult["tradeoffs"];
  readonly missingInformation: TransitionCompatibilityResult["missingInformation"];
};
