import type { BehavioralEquipmentDNAAttributeKey } from "../../behavioral/index.js";
import type { PhysicalBatCondition, PhysicalBatEvaluatorCategory, PhysicalBatStandaloneObservationScale, PhysicalBatVerificationInput } from "../structured-physical-bat-evaluation.types.js";

export type PhysicalEvaluationEvaluatorRelationship = "independent_evaluator" | "repeat_evaluator";

export type PhysicalEvaluationProtocolV11Question = {
  readonly id: string;
  readonly order: number;
  readonly attributeKey: BehavioralEquipmentDNAAttributeKey;
  readonly construct: string;
  readonly dimensionKey: string;
  readonly prompt: string;
  readonly operatorInstruction: string;
  readonly responseScale: "five_level_absolute" | "five_level_inverse_degradation" | "categorical_observation";
  readonly trialBlock: "warm_up" | "dry_swing_block_1" | "dry_swing_block_2" | "dry_swing_block_3" | "centered_contact" | "near_center_handle_side" | "near_center_end_side" | "combined_near_center_misses" | "full_controlled_contact_set";
  readonly minimumTrials: number;
  readonly aggregationRole: "existing_attribute_dimension" | "candidate_subconstruct_only" | "qualitative_context_only";
  readonly required: true;
};

export type PhysicalEvaluationProtocolV11CalibrationSessionInput = {
  readonly sessionId: string;
  readonly protocolVersion: "1.1";
  readonly questionnaireVersion: "1.1";
  readonly studyClassification: "protocol_calibration_evidence";
  readonly equipmentId: string;
  readonly equipmentVariantId: string;
  readonly evaluationDate: string;
  readonly physicalVerification: PhysicalBatVerificationInput;
  readonly equipmentCondition: PhysicalBatCondition;
  readonly evaluator: {
    readonly evaluatorId: string;
    readonly category: PhysicalBatEvaluatorCategory;
    readonly confidence: "low" | "medium" | "high";
    readonly relationship: PhysicalEvaluationEvaluatorRelationship;
  };
  readonly testingLimitations: readonly string[];
  readonly drySwingBlocks: {
    readonly startupDemandTrials: number;
    readonly rotationalDemandTrials: number;
    readonly barrelRedirectDemandTrials: number;
  };
  readonly controlledContactBlocks: {
    readonly centeredContactTrials: number;
    readonly nearCenterHandleSideTrials: number;
    readonly nearCenterEndSideTrials: number;
  };
  readonly contactLocationControls: {
    readonly centeredContactVerified: boolean;
    readonly handleSideMissesModestAndNearCenter: boolean;
    readonly endSideMissesModestAndNearCenter: boolean;
    readonly methodNotes: string;
  };
  readonly responses: readonly {
    readonly questionId: string;
    readonly dimensionKey: string;
    readonly observation: PhysicalBatStandaloneObservationScale;
    readonly notes?: string;
  }[];
  readonly provenanceClassification: "real_protocol_calibration_observation";
};

export type PhysicalEvaluationProtocolV11CalibrationEvidenceRecord = {
  readonly id: string;
  readonly sourceReference: string;
  readonly equipmentId: string;
  readonly equipmentVariantId: string;
  readonly attributeKey: BehavioralEquipmentDNAAttributeKey;
  readonly dimensionKey: string;
  readonly construct: string;
  readonly evaluatorId: string;
  readonly evaluationDate: string;
  readonly rawValue: Readonly<Record<string, unknown>>;
  readonly normalizedValue: undefined;
  readonly canonicalEligible: false;
  readonly numericReferenceEligible: false;
  readonly recommendationEligible: false;
};

export type PhysicalEvaluationProtocolV11CalibrationReview = {
  readonly sessionId: string;
  readonly protocolVersion: "1.1";
  readonly questionnaireVersion: "1.1";
  readonly studyClassification: "protocol_calibration_evidence";
  readonly evaluatorRelationship: PhysicalEvaluationEvaluatorRelationshipReview;
  readonly complete: boolean;
  readonly blockers: readonly string[];
  readonly trialBlockCompleteness: Readonly<Record<string, boolean>>;
  readonly questionCompleteness: { readonly answered: number; readonly required: number; readonly missingQuestionIds: readonly string[] };
  readonly evidence: readonly PhysicalEvaluationProtocolV11CalibrationEvidenceRecord[];
  readonly persistenceEligible: boolean;
  readonly canonicalWritesPlanned: 0;
  readonly numericReferencesPlanned: 0;
  readonly recommendationImpact: "none";
  readonly writesPerformed: false;
};

export type PhysicalEvaluationQualifyingEvidence = {
  readonly evidenceRecordId: string;
  readonly equipmentId: string;
  readonly evaluatorId: string;
  readonly sessionId: string;
  readonly protocolVersion: string;
  readonly sourceReference: string;
  readonly evaluatedAt?: string;
  readonly declaredRelationship?: PhysicalEvaluationEvaluatorRelationship;
};

export type PhysicalEvaluationEvaluatorRelationshipReview = {
  readonly evaluatorId: string;
  readonly declaredRelationship: PhysicalEvaluationEvaluatorRelationship;
  readonly derivedRelationship: PhysicalEvaluationEvaluatorRelationship;
  readonly priorQualifyingSessionCount: number;
  readonly priorSessionIds: readonly string[];
  readonly valid: boolean;
  readonly independentSourceContribution: 0 | 1;
};

export type PhysicalEvaluationEvidenceIndependenceSession = {
  readonly sessionId: string;
  readonly evaluatorId: string;
  readonly protocolVersion: string;
  readonly relationship: PhysicalEvaluationEvaluatorRelationship;
  readonly evidenceRecordCount: number;
  readonly evidenceRecordIds: readonly string[];
};

export type PhysicalEvaluationEvidenceIndependenceSummary = {
  readonly equipmentId: string;
  readonly totalQualifyingPhysicalSessions: number;
  readonly uniqueEvaluatorCount: number;
  readonly independentEvaluatorSourceCount: number;
  readonly repeatEvaluatorSessionCount: number;
  readonly evaluatorIds: readonly string[];
  readonly protocolVersions: readonly string[];
  readonly sessions: readonly PhysicalEvaluationEvidenceIndependenceSession[];
  readonly sessionsByEvaluator: Readonly<Record<string, readonly string[]>>;
};

export type PhysicalEvaluationProtocolV11CalibrationPersistenceRepository = {
  persistPacketAtomically(records: readonly PhysicalEvaluationProtocolV11CalibrationEvidenceRecord[]): Promise<{ readonly created: number; readonly unchanged: number }>;
};

export type PhysicalEvaluationProtocolV11Construct = {
  readonly attributeKey: BehavioralEquipmentDNAAttributeKey;
  readonly constructCode: string;
  readonly name: string;
  readonly status: "existing_construct_refined" | "candidate_subconstruct";
  readonly canonicalAttributeCreated: false;
  readonly dimensions: readonly string[];
  readonly aggregationPolicy: "no_automatic_aggregation" | "dimension_preserving_preview";
};

export type PhysicalEvaluationProtocolV11Preview = {
  readonly protocolVersion: "1.1-preview";
  readonly questionnaireVersion: "1.1";
  readonly provenanceVersion: "1.1";
  readonly status: "operator_preview_only";
  readonly studyClassification: "protocol_calibration_evidence";
  readonly priorProtocolVersion: "1.0";
  readonly historicalEvidencePolicy: "immutable_and_version_distinct";
  readonly constructs: readonly PhysicalEvaluationProtocolV11Construct[];
  readonly questions: readonly PhysicalEvaluationProtocolV11Question[];
  readonly operatorSequence: readonly string[];
  readonly futureEvidenceRules: readonly string[];
  readonly evaluationSixPerformed: false;
  readonly persistenceAllowed: false;
  readonly canonicalEvaluationsCreated: 0;
  readonly numericReferencesCreated: 0;
  readonly recommendationBehaviorChanged: false;
};
