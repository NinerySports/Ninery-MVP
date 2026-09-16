import type { CanonicalEquipmentDNAProfile } from "@ninery/equipment-intelligence";
import type { CurrentEquipmentFamiliarityResult, PlayerDNAProfileResult } from "@ninery/player-intelligence";
import type { TransitionCompatibilityInput, TransitionCompatibilityResult } from "../transition-compatibility.types.js";
import type { TransitionCompatibilityV1_1Result } from "../v1_1/index.js";
import type { TransitionExtendedShadowStudy } from "../extended-shadow/index.js";
import type { TransitionShadowAuditEvent } from "../admin/index.js";

export const TRANSITION_CONTEXT_LOADER_VERSION = "1.0";
export const TRANSITION_PREDICTION_INPUT_ASSEMBLY_VERSION = "1.0";
export const TRANSITION_PREDICTION_INPUT_REVIEW_VERSION = "1.0";
export const TRANSITION_CONTEXT_PROVENANCE_VERSION = "1.0";

export type TransitionPredictionContextBlockerCode =
  | "MISSING_STUDY"
  | "STUDY_NOT_GENUINE"
  | "STUDY_STATUS_INVALID"
  | "OBSERVATIONS_ALREADY_STARTED"
  | "MISSING_PLAYER"
  | "SYNTHETIC_PLAYER"
  | "MISSING_PLAYER_DNA"
  | "AMBIGUOUS_PLAYER_DNA"
  | "UNSUPPORTED_PLAYER_DNA_VERSION"
  | "MISSING_CURRENT_EQUIPMENT"
  | "MISSING_CURRENT_VARIANT"
  | "MISSING_CURRENT_SPEC"
  | "MISSING_PROPOSED_EQUIPMENT"
  | "MISSING_PROPOSED_VARIANT"
  | "MISSING_PROPOSED_SPEC"
  | "MISSING_CURRENT_EQUIPMENT_DNA"
  | "MISSING_PROPOSED_EQUIPMENT_DNA"
  | "MISSING_EXPERIENCE_READINESS"
  | "MISSING_BAT_CONTROL_READINESS"
  | "MISSING_DEVELOPMENT_READINESS"
  | "MISSING_FAMILIARITY"
  | "AMBIGUOUS_FAMILIARITY"
  | "SOURCE_TEMPORALLY_INVALID"
  | "UNSUPPORTED_CONTEXT_VERSION";

export type TransitionPredictionContextWarningCode =
  | "MULTIPLE_PLAYER_DNA_PROFILES"
  | "MISSING_OPTIONAL_GROWTH_CONTEXT"
  | "MISSING_OPTIONAL_SWING_FEEL_CONTEXT"
  | "MISSING_OPTIONAL_CURRENT_BALANCE"
  | "MISSING_OPTIONAL_CURRENT_SWING_EFFORT"
  | "MISSING_OPTIONAL_PROPOSED_BALANCE"
  | "MISSING_OPTIONAL_PROPOSED_SWING_EFFORT"
  | "PLAYER_DNA_GENERATED_AFTER_CAPTURE"
  | "EQUIPMENT_DNA_GENERATED_AFTER_CAPTURE";

export type TransitionPredictionContextFinding = {
  readonly code: TransitionPredictionContextBlockerCode | TransitionPredictionContextWarningCode;
  readonly message: string;
  readonly sourceArea:
    | "study"
    | "player"
    | "player_dna"
    | "current_equipment"
    | "proposed_equipment"
    | "familiarity"
    | "prediction_input";
};

export type TransitionPredictionContextProvenance = {
  readonly version: typeof TRANSITION_CONTEXT_PROVENANCE_VERSION;
  readonly studyId: string;
  readonly studyKey: string;
  readonly playerId: string;
  readonly playerDNAProfileId?: string;
  readonly playerDNAVersion?: string;
  readonly currentEquipmentId: string;
  readonly currentEquipmentVariantId?: string;
  readonly currentEquipmentDNAProfileVersion?: string;
  readonly proposedEquipmentId: string;
  readonly proposedEquipmentVariantId?: string;
  readonly proposedEquipmentDNAProfileVersion?: string;
  readonly familiarityLevel?: CurrentEquipmentFamiliarityResult["level"];
  readonly familiarityConfidence?: CurrentEquipmentFamiliarityResult["confidence"];
  readonly sourceAuditEventIds: readonly string[];
  readonly assembledAt: Date;
};

export type TransitionPredictionInputAssemblyMode = "capture" | "diagnostic";

export type TransitionPredictionInputAssemblyResult = {
  readonly version: typeof TRANSITION_PREDICTION_INPUT_ASSEMBLY_VERSION;
  readonly loaderVersion: typeof TRANSITION_CONTEXT_LOADER_VERSION;
  readonly mode: TransitionPredictionInputAssemblyMode;
  readonly study?: TransitionExtendedShadowStudy;
  readonly input?: TransitionCompatibilityInput;
  readonly playerDNA?: PlayerDNAProfileResult;
  readonly currentEquipmentProfile?: CanonicalEquipmentDNAProfile;
  readonly proposedEquipmentProfile?: CanonicalEquipmentDNAProfile;
  readonly familiarity?: CurrentEquipmentFamiliarityResult;
  readonly provenance?: TransitionPredictionContextProvenance;
  readonly semanticInputHash?: string;
  readonly blockers: readonly TransitionPredictionContextFinding[];
  readonly warnings: readonly TransitionPredictionContextFinding[];
  readonly ready: boolean;
  readonly assembledAt: Date;
};

export type TransitionPredictionInputReview = {
  readonly version: typeof TRANSITION_PREDICTION_INPUT_REVIEW_VERSION;
  readonly studyId: string;
  readonly ready: boolean;
  readonly semanticInputHash?: string;
  readonly blockerCodes: readonly TransitionPredictionContextBlockerCode[];
  readonly warningCodes: readonly TransitionPredictionContextWarningCode[];
  readonly playerDNA: "ready" | "blocked";
  readonly currentEquipmentDNA: "ready" | "blocked";
  readonly proposedEquipmentDNA: "ready" | "blocked";
  readonly familiarity: "ready" | "blocked";
  readonly predictionInput: "ready" | "blocked";
  readonly reviewedAt: Date;
};

export type TransitionPredictionDryRunResult = {
  readonly review: TransitionPredictionInputReview;
  readonly prediction?: TransitionCompatibilityV1_1Result;
  readonly wouldPersist: false;
  readonly liveRecommendationUseAllowed: false;
  readonly modelAutomaticallyChanged: false;
};

export type TransitionPredictionContextDriftResult = {
  readonly studyId: string;
  readonly capturedInputHash?: string;
  readonly currentSemanticInputHash?: string;
  readonly driftDetected: boolean;
  readonly changedAreas: readonly string[];
  readonly blockers: readonly TransitionPredictionContextFinding[];
  readonly warnings: readonly TransitionPredictionContextFinding[];
  readonly evaluatedAt: Date;
};

export type TransitionPredictionContextLoaderRepository = {
  readonly getStudy: (studyId: string) => Promise<TransitionExtendedShadowStudy | undefined>;
  readonly getPlayer: (playerId: string) => Promise<{ readonly id: string; readonly status?: string; readonly label?: string; readonly synthetic?: boolean } | undefined>;
  readonly getEquipment: (equipmentId: string) => Promise<{ readonly id: string; readonly label?: string; readonly synthetic?: boolean } | undefined>;
  readonly getEquipmentVariant: (variantId: string) => Promise<{ readonly id: string; readonly equipmentId: string; readonly label?: string; readonly synthetic?: boolean } | undefined>;
  readonly listPlayerDNAProfiles: (playerId: string) => Promise<readonly PlayerDNAProfileResult[]>;
  readonly loadCanonicalEquipmentDNAProfile: (input: { readonly equipmentId: string; readonly equipmentVariantId?: string; readonly generatedAt?: Date }) => Promise<CanonicalEquipmentDNAProfile | undefined>;
  readonly listAuditEvents?: (studyId: string) => Promise<readonly TransitionShadowAuditEvent[]>;
};

export type TransitionPredictionInputAssemblyRequest = {
  readonly studyId: string;
  readonly mode?: TransitionPredictionInputAssemblyMode;
  readonly assembledAt?: Date;
};

export type TransitionPredictionInputHashInput = {
  readonly input: TransitionCompatibilityInput;
  readonly provenance: TransitionPredictionContextProvenance;
  readonly result?: TransitionCompatibilityResult;
};
