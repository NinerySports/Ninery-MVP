import type { PhysicalEvaluationQualifyingEvidence } from "./physical-evaluation-protocol-v1-1.types.js";

export type CalibrationConstruction = "one_piece_alloy" | "two_piece_alloy" | "two_piece_composite" | "hybrid" | "other" | "unknown";
export type CalibrationCertification = "USA" | "USSSA" | "BBCOR" | "other";
export type ProtocolParticipationRelationship = "first_protocol_participation" | "repeat_protocol_participant";
export type PilotContrastClassification = "insufficient_catalog_data" | "low_contrast" | "moderate_contrast" | "high_contrast";
export type PilotEligibility = "eligible" | "eligible_with_limited_contrast" | "blocked_missing_identity" | "blocked_missing_variant" | "blocked_insufficient_catalog_data" | "blocked_protocol_incompatible";
export type CrossEquipmentReadiness = "single_equipment_only" | "cross_equipment_started" | "construct_replication_pending" | "cross_equipment_support" | "protocol_revision_required";

export type CalibrationEquipmentArchetype = {
  readonly equipmentId: string;
  readonly equipmentVariantId?: string;
  readonly label: string;
  readonly sku?: string;
  readonly construction: CalibrationConstruction;
  readonly certification: CalibrationCertification;
  readonly material?: string;
  readonly lengthInches?: number;
  readonly weightOunces?: number;
  readonly dropWeight?: number;
  readonly barrelDiameter?: number;
  readonly physicalIdentityReady: boolean;
  readonly protocolCompatible: boolean;
  readonly requiredTrialBlocksCapable: boolean;
  readonly synthetic: boolean;
};

export type CrossEquipmentQualifyingEvidence = PhysicalEvaluationQualifyingEvidence & {
  readonly equipmentVariantId?: string;
  readonly studyClassification?: string;
  readonly provenanceClassification?: string;
  readonly dimensionKey?: string;
  readonly synthetic?: boolean;
};

export type PilotCandidateAssessment = {
  readonly candidate: CalibrationEquipmentArchetype;
  readonly eligibility: PilotEligibility;
  readonly contrast: PilotContrastClassification;
  readonly contrastReasons: readonly string[];
  readonly blockers: readonly string[];
  readonly calibrationOnly: true;
  readonly performanceInferenceMade: false;
  readonly numericContrastScore: undefined;
};

export type CrossEquipmentCalibrationStatus = {
  readonly version: "1.0";
  readonly genuineEquipmentModelCount: number;
  readonly genuineVariantCount: number;
  readonly genuineSessionCount: number;
  readonly uniqueProtocolEvaluatorCount: number;
  readonly equipmentLevelIndependentSourceCount: number;
  readonly repeatEvaluatorSessionCount: number;
  readonly repeatProtocolParticipantCount: number;
  readonly representedArchetypes: readonly CalibrationEquipmentArchetype[];
  readonly constructionCoverage: Readonly<Record<CalibrationConstruction, number>>;
  readonly certificationCoverage: Readonly<Record<CalibrationCertification, number>>;
  readonly readiness: CrossEquipmentReadiness;
  readonly readinessReason: string;
  readonly crossEquipmentComparisonAvailable: boolean;
  readonly protocolValidated: false;
  readonly safeguards: readonly string[];
  readonly canonicalFirewall: {
    readonly canonicalEvaluationsCreated: 0;
    readonly canonicalEvaluationsModified: 0;
    readonly numericReferencesCreated: 0;
    readonly recommendationScoringChanged: false;
    readonly recommendationRankingChanged: false;
    readonly liveEquipmentDNAChanged: false;
    readonly historicalEvidenceModified: false;
    readonly writesPerformed: false;
  };
};

