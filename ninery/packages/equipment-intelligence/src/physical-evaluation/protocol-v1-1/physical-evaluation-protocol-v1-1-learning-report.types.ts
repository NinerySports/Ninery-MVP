import type { BehavioralEvidenceRecord } from "../../behavioral/index.js";
import type { PhysicalEvaluationEvidenceIndependenceSummary, PhysicalEvaluationQualifyingEvidence } from "./physical-evaluation-protocol-v1-1.types.js";

export type ProtocolV11InformationGain =
  | "no_additional_separation_observed"
  | "limited_separation_observed"
  | "meaningful_separation_observed"
  | "conflicting_signal"
  | "insufficient_evidence";

export type ProtocolV11LearningState =
  | "insufficient_evidence"
  | "early_support"
  | "mixed_support"
  | "construct_specific_support"
  | "protocol_revision_needed";

export type ProtocolV11HistoricalExplanation =
  | "consistent_with_construct_conflation"
  | "potentially_explains_prior_disagreement"
  | "does_not_explain_prior_disagreement"
  | "insufficient_evidence";

export type ProtocolV11NextStep =
  | "collect_additional_v1_1_calibration"
  | "refine_specific_dimensions"
  | "preserve_protocol_and_expand_pilot"
  | "construct_review_required"
  | "insufficient_evidence";

export type ProtocolV11LearningEvidenceRecord = {
  readonly id: string;
  readonly equipmentId: string;
  readonly equipmentVariantId?: string;
  readonly sourceReference: string;
  readonly evaluatorId: string;
  readonly evaluatedAt?: string;
  readonly rawValue: unknown;
};

export type ProtocolV11ConstructLearning = {
  readonly construct: "swing_demand" | "bat_control" | "forgiveness" | "sweet_spot";
  readonly dimensions: readonly { readonly key: string; readonly observation?: string }[];
  readonly informationGain: ProtocolV11InformationGain;
  readonly separationObserved: boolean;
  readonly interpretation: string;
  readonly limitations: readonly string[];
  readonly inverseDegradationProtected: boolean;
  readonly candidateSubconstructsOnly: boolean;
};

export type ProtocolV11SameEvaluatorReview = {
  readonly available: boolean;
  readonly evaluatorId?: string;
  readonly v10SessionIds: readonly string[];
  readonly v11SessionId?: string;
  readonly v10ConstructObservations: Readonly<Record<string, readonly string[]>>;
  readonly v11DimensionObservations: Readonly<Record<string, string>>;
  readonly observedDifferences: readonly string[];
  readonly independentReplication: false;
  readonly causalInterpretation: "prohibited";
  readonly classification: "descriptive_within_evaluator_calibration_only";
};

export type ProtocolV11LearningReportInput = {
  readonly equipmentId: string;
  readonly equipmentLabel: string;
  readonly variantLabels: readonly string[];
  readonly historicalV10Evidence: readonly BehavioralEvidenceRecord[];
  readonly protocolV11Evidence: readonly ProtocolV11LearningEvidenceRecord[];
  readonly qualifyingPhysicalEvidence: readonly PhysicalEvaluationQualifyingEvidence[];
};

export type ProtocolV11LearningReport = {
  readonly version: "1.0";
  readonly equipmentId: string;
  readonly equipmentLabel: string;
  readonly variantLabels: readonly string[];
  readonly evidenceCoverage: PhysicalEvaluationEvidenceIndependenceSummary & {
    readonly protocolV10Sessions: number;
    readonly protocolV11Sessions: number;
    readonly protocolV11CalibrationRecords: number;
  };
  readonly constructs: readonly ProtocolV11ConstructLearning[];
  readonly sameEvaluatorReview: ProtocolV11SameEvaluatorReview;
  readonly historicalCohort: readonly {
    readonly attributeKey: string;
    readonly priorDisagreementPattern: string;
    readonly explanation: ProtocolV11HistoricalExplanation;
    readonly evidenceStrength: "historical_cohort_plus_one_repeat_v1_1_session" | "historical_only";
    readonly limitation: string;
  }[];
  readonly protocolWeaknesses: readonly string[];
  readonly currentLearningState: ProtocolV11LearningState;
  readonly nextProtocolStep: {
    readonly decision: ProtocolV11NextStep;
    readonly reason: string;
    readonly additionalEvidenceNeeded: readonly string[];
    readonly independentEvaluatorRequiredImmediately: false;
  };
  readonly crossEquipmentGeneralization: {
    readonly allowed: false;
    readonly equipmentModelCount: 1;
    readonly limitation: string;
  };
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
