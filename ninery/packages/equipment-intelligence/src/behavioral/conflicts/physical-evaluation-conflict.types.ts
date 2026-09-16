import type { BehavioralEquipmentDNAAttributeKey, BehavioralEvidenceRecord } from "../real-world-behavioral-evaluation.types.js";
import type { StandaloneAbsoluteAttributeSynthesis } from "../standalone/index.js";
import type { ComparativeEvidenceAttributeSynthesis } from "../synthesis/index.js";

export type PhysicalEvaluationConflictSeverity =
  | "none"
  | "minor"
  | "adjacent"
  | "material"
  | "severe";

export type PhysicalEvaluationConflictClassification =
  | "ordinal_disagreement"
  | "dimension_disagreement"
  | "directional_disagreement"
  | "possible_construct_conflation"
  | "possible_evaluator_outlier"
  | "possible_protocol_sensitivity"
  | "insufficient_evidence"
  | "resolved";

export type PhysicalEvaluationAdjudicationStatus =
  | "no_adjudication_required"
  | "targeted_retest_required"
  | "additional_independent_evidence_required"
  | "protocol_review_required"
  | "construct_review_required"
  | "adjudication_ready"
  | "adjudication_in_progress"
  | "resolved";

export type PhysicalEvaluationBlindingPolicy = {
  readonly version: "1.0";
  readonly priorEvaluatorCanonicalInterpretations: "hidden_before_evaluation";
  readonly priorEvaluatorRawObservations: "hidden_before_evaluation";
  readonly comparativeSynthesisResult: "hidden_before_evaluation";
  readonly currentCanonicalCandidate: "hidden_before_evaluation";
  readonly batIdentity: "may_be_known";
  readonly referenceBatIdentity: "may_be_known_when_intentionally_part_of_protocol";
  readonly rationale: readonly string[];
};

export type PhysicalEvaluationDimensionObservation = {
  readonly evidenceId: string;
  readonly sessionId: string;
  readonly evaluatorId: string;
  readonly rawObservation: string;
  readonly normalizedConstructValue: string;
  readonly normalizedRank: number;
  readonly inverseSemanticsApplied: boolean;
};

export type PhysicalEvaluationDimensionConflictSummary = {
  readonly dimensionKey: string;
  readonly observationCount: number;
  readonly independentSourceCount: number;
  readonly observations: readonly PhysicalEvaluationDimensionObservation[];
  readonly normalizedValues: readonly string[];
  readonly spread: number | undefined;
  readonly conflictSeverity: PhysicalEvaluationConflictSeverity;
  readonly stable: boolean;
};

export type PhysicalEvaluationEvidenceSourceSummary = {
  readonly evidenceId: string;
  readonly sessionId: string;
  readonly evaluatorId: string;
  readonly ordinalValue?: string;
  readonly evaluatorConfidence?: string;
  readonly limitations: readonly string[];
};

export type PhysicalEvaluationNextEvidencePrescription = {
  readonly attributeKey: BehavioralEquipmentDNAAttributeKey;
  readonly reason: string;
  readonly conflictSeverity: PhysicalEvaluationConflictSeverity;
  readonly conflictClassifications: readonly PhysicalEvaluationConflictClassification[];
  readonly targetDimensions: readonly string[];
  readonly stableDimensions: readonly string[];
  readonly recommendedEvaluationMode: "standalone_absolute_targeted" | "standalone_absolute_full" | "controlled_contact_targeted";
  readonly minimumTrials: {
    readonly drySwingTrialCount: number;
    readonly contactTrialCount: number;
    readonly referenceAlternationCount: number;
  };
  readonly referenceUse: "none_required" | "contextual_only_non_anchoring";
  readonly controls: readonly string[];
  readonly instructions: readonly string[];
  readonly successCriteria: readonly string[];
  readonly canonicalPromotionAllowedAfterCollection: false;
};

export type PhysicalEvaluationConflictAttributeAnalysis = {
  readonly attributeKey: BehavioralEquipmentDNAAttributeKey;
  readonly evidenceSources: readonly PhysicalEvaluationEvidenceSourceSummary[];
  readonly currentSynthesis?: Pick<
    StandaloneAbsoluteAttributeSynthesis,
    "classification" | "synthesisStatus" | "observedOrdinals" | "supportedCanonicalOrdinal" | "supportedOrdinalRange" | "materialConflict"
  >;
  readonly observedOrdinals: readonly string[];
  readonly ordinalSpread: number | undefined;
  readonly conflictSeverity: PhysicalEvaluationConflictSeverity;
  readonly conflictClassifications: readonly PhysicalEvaluationConflictClassification[];
  readonly dimensionAnalysis: readonly PhysicalEvaluationDimensionConflictSummary[];
  readonly comparativeCorroboration?: {
    readonly comparativeDirection: string;
    readonly consensusStrength: string;
    readonly canonicalInterpretationStatus: string;
    readonly nonDispositive: true;
    readonly summary: string;
  };
  readonly adjudicationStatus: PhysicalEvaluationAdjudicationStatus;
  readonly targetDimensions: readonly string[];
  readonly stableDimensions: readonly string[];
  readonly nextEvidence?: PhysicalEvaluationNextEvidencePrescription;
  readonly resolutionCandidate?: string;
  readonly canonicalPromotionStatus: "not_allowed_by_conflict_analysis" | "no_promotion_needed" | "controlled_workflow_required";
};

export type PhysicalEvaluationConflictAnalysisReport = {
  readonly version: "1.0";
  readonly equipmentId: string;
  readonly equipmentLabel: string;
  readonly variantLabel?: string;
  readonly policyVersion: "1.0";
  readonly blindingPolicy: PhysicalEvaluationBlindingPolicy;
  readonly qualifyingEvaluatorCount: number;
  readonly physicalSessionCount: number;
  readonly evidenceCount: number;
  readonly attributes: readonly PhysicalEvaluationConflictAttributeAnalysis[];
  readonly canonicalEvaluationsCreated: 0;
  readonly numericReferencesCreated: 0;
  readonly liveRecommendationActivationAllowed: false;
  readonly writesPerformed: false;
};

export type PhysicalEvaluationConflictAnalysisInput = {
  readonly equipmentId: string;
  readonly equipmentLabel: string;
  readonly variantLabel?: string;
  readonly evidence: readonly BehavioralEvidenceRecord[];
  readonly standaloneAttributes?: readonly StandaloneAbsoluteAttributeSynthesis[];
  readonly comparativeAttributes?: readonly ComparativeEvidenceAttributeSynthesis[];
};

export type PhysicalEvaluationAdjudicationPlan = {
  readonly version: "1.0";
  readonly equipmentId: string;
  readonly equipmentLabel: string;
  readonly variantLabel?: string;
  readonly policyVersion: "1.0";
  readonly blindingPolicy: PhysicalEvaluationBlindingPolicy;
  readonly attributes: readonly PhysicalEvaluationNextEvidencePrescription[];
  readonly evaluatorInstructions: readonly string[];
  readonly canonicalPromotionAllowedAfterCollection: false;
  readonly writesPerformed: false;
};
