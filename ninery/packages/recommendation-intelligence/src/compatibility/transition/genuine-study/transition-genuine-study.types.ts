import type { CurrentEquipmentFamiliarityInput, CurrentEquipmentFamiliarityResult } from "@ninery/player-intelligence";
import type { TransitionCompatibilityInput } from "../transition-compatibility.types.js";
import type {
  TransitionAdjustmentObservation,
  TransitionObservationCheckpoint,
  TransitionObservationSource,
  TransitionOutcomeComparison
} from "../extended-shadow/index.js";
import type {
  TransitionShadowCaptureOrigin,
  TransitionShadowCreateDraftInput,
  TransitionShadowEvidenceClassification,
  TransitionShadowInternalActor,
  TransitionShadowStudyEligibilityResult
} from "../admin/index.js";

export const TRANSITION_GENUINE_STUDY_INTAKE_VERSION = "1.0";
export const TRANSITION_FIELD_OBSERVATION_PROTOCOL_VERSION = "1.0";
export const TRANSITION_GENUINE_EVIDENCE_POLICY_VERSION = "1.0";
export const TRANSITION_PARTICIPATION_ACKNOWLEDGEMENT_VERSION = "1.0";
export const TRANSITION_EVIDENCE_QUALITY_VERSION = "1.0";

export type TransitionAcknowledgementType =
  | "adult_player_acknowledgement"
  | "parent_or_guardian_acknowledgement"
  | "internal_operational_authorization";

export type TransitionAcknowledgedByRole =
  | "player"
  | "parent_or_guardian"
  | "internal_staff";

export type TransitionStudyParticipationAcknowledgement = {
  readonly version: typeof TRANSITION_PARTICIPATION_ACKNOWLEDGEMENT_VERSION;
  readonly playerId: string;
  readonly acknowledgementType: TransitionAcknowledgementType;
  readonly acknowledgedByRole: TransitionAcknowledgedByRole;
  readonly acknowledgedAt: Date;
  readonly purposeAcknowledged: boolean;
  readonly observationalNatureAcknowledged: boolean;
  readonly noRecommendationImpactAcknowledged: boolean;
  readonly voluntaryFeedbackAcknowledged: boolean;
  readonly sourceReference?: string;
  readonly capturedByActorId: string;
};

export type TransitionEquipmentVerificationSource =
  | "player"
  | "parent_or_guardian"
  | "coach"
  | "internal_staff"
  | "system_history"
  | "combined";

export type TransitionEquipmentVerification = {
  readonly equipmentId: string;
  readonly equipmentVariantId?: string;
  readonly lengthInches?: number;
  readonly weightOunces?: number;
  readonly dropWeight?: number;
  readonly certification?: string;
  readonly verifiedAsActualCurrentPrimary?: boolean;
  readonly expectedToBeUsed?: boolean;
  readonly availableForUse?: boolean;
  readonly sizeSpecificationMatched?: boolean;
  readonly source: TransitionEquipmentVerificationSource;
  readonly verifiedAt: Date;
};

export type TransitionStudyObserverPlan = {
  readonly firstUsePreferredSources: readonly TransitionObservationSource[];
  readonly earlySessionsPreferredSources: readonly TransitionObservationSource[];
  readonly acclimationPreferredSources: readonly TransitionObservationSource[];
};

export type TransitionGenuineStudyIntakeSnapshot = {
  readonly version: typeof TRANSITION_GENUINE_STUDY_INTAKE_VERSION;
  readonly playerId: string;
  readonly currentEquipmentVerification: TransitionEquipmentVerification;
  readonly proposedEquipmentVerification: TransitionEquipmentVerification;
  readonly familiarity: CurrentEquipmentFamiliarityResult;
  readonly participationAcknowledgement: TransitionStudyParticipationAcknowledgement;
  readonly playerDNAProfileId?: string;
  readonly playerDNAVersion?: string;
  readonly capturedByActorId: string;
  readonly capturedAt: Date;
  readonly evidenceClassification: "genuine_internal_observation";
};

export type TransitionGenuineStudyEligibilityResult = {
  readonly version: typeof TRANSITION_GENUINE_STUDY_INTAKE_VERSION;
  readonly eligible: boolean;
  readonly checks: readonly {
    readonly code: string;
    readonly passed: boolean;
    readonly required: boolean;
    readonly explanation: string;
  }[];
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
  readonly adminEligibility?: TransitionShadowStudyEligibilityResult;
  readonly evaluatedAt: Date;
};

export type TransitionFieldObservationReadinessResult = {
  readonly version: typeof TRANSITION_FIELD_OBSERVATION_PROTOCOL_VERSION;
  readonly ready: boolean;
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
  readonly reviewedAt: Date;
};

export type TransitionObservationEvidenceQuality =
  | "insufficient"
  | "limited"
  | "usable"
  | "strong";

export type TransitionGenuineEvidenceQualityResult = {
  readonly version: typeof TRANSITION_EVIDENCE_QUALITY_VERSION;
  readonly quality: TransitionObservationEvidenceQuality;
  readonly checkpointCoverage: Record<"firstUse" | "earlySessions" | "acclimationPeriod", boolean>;
  readonly meaningfulUseConfirmed: boolean;
  readonly observerAgreement: TransitionOutcomeComparison["observerAgreement"] | "not_compared";
  readonly familiarityConfidence: CurrentEquipmentFamiliarityResult["confidence"];
  readonly predictionCapturedProspectively: boolean;
  readonly equipmentIdentityVerified: boolean;
  readonly warnings: readonly string[];
};

export type TransitionGenuineEvidenceRegistryEntry = {
  readonly studyId: string;
  readonly playerId: string;
  readonly currentEquipmentId: string;
  readonly proposedEquipmentId: string;
  readonly predictedScore: number;
  readonly predictedBand: string;
  readonly comparisonStatus: TransitionOutcomeComparison["comparisonStatus"];
  readonly evidenceQuality: TransitionObservationEvidenceQuality;
  readonly checkpointCoverage: TransitionGenuineEvidenceQualityResult["checkpointCoverage"];
  readonly outcomeConfidence: TransitionOutcomeComparison["outcomeConfidence"];
  readonly modelVersion: "1.1";
  readonly completedAt?: Date;
};

export type TransitionGenuineStudyCreateInput = {
  readonly id: string;
  readonly playerId: string;
  readonly observationPeriodKey: string;
  readonly currentEquipmentVerification: TransitionEquipmentVerification;
  readonly proposedEquipmentVerification: TransitionEquipmentVerification;
  readonly familiarityInput: CurrentEquipmentFamiliarityInput;
  readonly participationAcknowledgement: TransitionStudyParticipationAcknowledgement;
  readonly observerPlan?: TransitionStudyObserverPlan;
  readonly outcomeAlreadyKnownBeforePrediction?: boolean;
  readonly playerDNAProfileId?: string;
  readonly playerDNAVersion?: string;
  readonly captureOrigin: TransitionShadowCaptureOrigin;
  readonly internalNote?: string;
  readonly createdAt: Date;
};

export type TransitionGenuineStudyCreationResult = {
  readonly eligibility: TransitionGenuineStudyEligibilityResult;
  readonly intakeSnapshot: TransitionGenuineStudyIntakeSnapshot;
  readonly adminDraftInput: TransitionShadowCreateDraftInput;
  readonly studyId: string;
};

export type TransitionGenuineStudyRepositoryView = {
  readonly id: string;
  readonly studyKey: string;
  readonly playerId: string;
  readonly currentEquipmentId: string;
  readonly currentEquipmentVariantId?: string;
  readonly proposedEquipmentId: string;
  readonly proposedEquipmentVariantId?: string;
  readonly status: string;
  readonly fixtureKind?: string;
  readonly prediction?: {
    readonly transitionModelVersion?: string;
    readonly predictedScore?: number;
    readonly predictedBand?: string;
    readonly predictedAt?: Date;
  };
  readonly observations: readonly TransitionAdjustmentObservation[];
  readonly familiarity: CurrentEquipmentFamiliarityResult;
  readonly observationWindowCompletedAt?: Date;
};

export type TransitionGenuineStudyReadinessReport = {
  readonly deliveryMode: "service_and_cli_only";
  readonly authorization: "pass" | "fail";
  readonly acknowledgementProtocol: "available";
  readonly currentEquipmentVerification: "available";
  readonly proposedEquipmentVerification: "available";
  readonly familiarityIntake: "available";
  readonly prospectiveV1_1Prediction: "available";
  readonly fieldObservationProtocol: "available";
  readonly evidenceQualityEvaluation: "available";
  readonly genuineEvidenceRegistry: "available";
  readonly syntheticGenuineSeparation: "pass" | "fail";
  readonly modelAutomaticallyChanged: false;
  readonly livePromotionAutomaticallyRecommended: false;
  readonly readinessVerdict: "pass" | "fail";
};

export type TransitionGenuineStudyRegistrySummary = {
  readonly genuineCompletedStudies: number;
  readonly registryEligible: number;
  readonly insufficientEvidence: number;
  readonly cancelled: number;
  readonly invalidated: number;
  readonly evidenceQualityCounts: Record<TransitionObservationEvidenceQuality, number>;
  readonly comparisonStatusCounts: Record<string, number>;
  readonly modelVersionsRepresented: Record<string, number>;
  readonly entries: readonly TransitionGenuineEvidenceRegistryEntry[];
};

export type TransitionGenuineStudyValidationResult = {
  readonly verdict: "pass" | "fail";
  readonly checks: readonly {
    readonly code: string;
    readonly passed: boolean;
    readonly explanation: string;
  }[];
};

export type GenuineStudyDryRunResult = {
  readonly fixtureClassification: Exclude<TransitionShadowEvidenceClassification, "genuine_internal_observation">;
  readonly deterministic: boolean;
  readonly wouldCreateGenuineEvidence: false;
  readonly modelAutomaticallyChanged: false;
  readonly livePromotionAutomaticallyRecommended: false;
  readonly eligibility: TransitionGenuineStudyEligibilityResult;
};
