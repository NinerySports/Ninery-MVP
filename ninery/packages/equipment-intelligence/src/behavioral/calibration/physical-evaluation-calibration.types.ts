import type { BehavioralEquipmentDNAAttributeKey, BehavioralEvidenceRecord } from "../real-world-behavioral-evaluation.types.js";
import type { ComparativeEvidenceAttributeSynthesis } from "../synthesis/index.js";

export type ConstructCoherenceClassification =
  | "coherent"
  | "mostly_coherent"
  | "mixed_construct_signal"
  | "possible_construct_conflation"
  | "protocol_sensitive"
  | "insufficient_evidence";

export type EvaluationCollectionDecision =
  | "collect_additional_evaluator"
  | "pause_for_protocol_review"
  | "construct_review_required"
  | "sufficient_for_policy_decision";

export type CalibrationRecommendationType =
  | "retain_dimension"
  | "clarify_dimension_wording"
  | "separate_subconstruct"
  | "candidate_new_attribute"
  | "revise_trial_structure"
  | "require_contact_location_control"
  | "require_multiple_swing_blocks"
  | "add_qualitative_observation"
  | "retain_inverse_scoring"
  | "review_aggregation_policy";

export type DimensionOrdinalDistribution = {
  readonly ordinal: string;
  readonly count: number;
  readonly percentage: number;
};

export type PossibleOutlierObservation = {
  readonly classification: "possible_outlier_observation";
  readonly evaluatorId: string;
  readonly sessionId: string;
  readonly dimension: string;
  readonly observation: string;
  readonly modalObservation: string;
  readonly ordinalDistanceFromMode: number;
  readonly otherEvaluatorsSupportingMode: number;
  readonly diagnosticOnly: true;
};

export type PhysicalEvaluationDimensionCoherence = {
  readonly dimensionKey: string;
  readonly observationCount: number;
  readonly ordinalDistribution: readonly DimensionOrdinalDistribution[];
  readonly dimensionSpread?: number;
  readonly modalOrdinal?: string;
  readonly modalSupportCount: number;
  readonly modalSupportPercentage: number;
  readonly adjacentSupportPercentage: number;
  readonly inverseDimensionHandling: boolean;
  readonly possibleOutliers: readonly PossibleOutlierObservation[];
};

export type PhysicalEvaluationConstructAnalysis = {
  readonly attributeKey: BehavioralEquipmentDNAAttributeKey;
  readonly qualifyingEvaluatorCount: number;
  readonly physicalSessionCount: number;
  readonly dimensions: readonly PhysicalEvaluationDimensionCoherence[];
  readonly crossDimensionDivergence: boolean;
  readonly disagreementType: "none" | "evaluator_disagreement" | "construct_divergence" | "combined";
  readonly constructCoherence: ConstructCoherenceClassification;
  readonly comparativeEvidenceRole: "corroborating_non_dispositive" | "not_available";
  readonly recommendations: readonly { readonly type: CalibrationRecommendationType; readonly rationale: string }[];
  readonly collectionDecision: EvaluationCollectionDecision;
  readonly evaluationSixRecommended: boolean;
  readonly findings: readonly string[];
};

export type PhysicalEvaluationProtocolCalibrationReport = {
  readonly version: "1.0";
  readonly constructAnalysisVersion: "1.0";
  readonly stopPolicyVersion: "1.0";
  readonly equipmentId: string;
  readonly equipmentLabel: string;
  readonly variantLabel?: string;
  readonly qualifyingEvaluatorCount: number;
  readonly physicalSessionCount: number;
  readonly evidenceCount: number;
  readonly attributes: readonly PhysicalEvaluationConstructAnalysis[];
  readonly overallCollectionDecision: EvaluationCollectionDecision;
  readonly historicalEvidenceChanged: false;
  readonly canonicalEvaluationsCreated: 0;
  readonly numericReferencesCreated: 0;
  readonly recommendationBehaviorChanged: false;
  readonly writesPerformed: false;
};

export type PhysicalEvaluationProtocolCalibrationInput = {
  readonly equipmentId: string;
  readonly equipmentLabel: string;
  readonly variantLabel?: string;
  readonly evidence: readonly BehavioralEvidenceRecord[];
  readonly comparativeAttributes?: readonly ComparativeEvidenceAttributeSynthesis[];
};

