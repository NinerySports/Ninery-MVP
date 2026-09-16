import type { EquipmentDNAAttributeNormalizedValue } from "../attributes/index.js";
import type { BehavioralEquipmentDNAAttributeKey, BehavioralEvidenceRecord } from "../behavioral/index.js";

export type PhysicalBatEvaluationProtocolVersion = "1.0";

export type PhysicalBatEvaluationMode = "comparative" | "standalone";

export type PhysicalBatVerificationSource =
  | "physical_label"
  | "manufacturer_model_marking"
  | "certification_stamp"
  | "catalog_match"
  | "combined";

export type PhysicalBatCondition =
  | "new_or_near_new"
  | "normal_used_condition"
  | "materially_worn"
  | "damaged"
  | "unknown";

export type PhysicalBatEvaluatorCategory =
  | "internal_equipment_evaluator"
  | "coach_evaluator"
  | "experienced_player_evaluator"
  | "technical_evaluator"
  | "other_qualified_evaluator";

export type PhysicalBatReferenceType = "catalog_reference" | "verified_external_reference";

export type PhysicalBatComparisonScale =
  | "clearly_less"
  | "somewhat_less"
  | "similar"
  | "somewhat_more"
  | "clearly_more"
  | "unable_to_assess";

export type PhysicalBatStandaloneObservationScale =
  | "very_low"
  | "low"
  | "moderate"
  | "high"
  | "very_high"
  | "unable_to_assess";

export type PhysicalBatRubricCompleteness = "complete" | "partial" | "insufficient";

export type PhysicalBatCanonicalInterpretationStatus = "available" | "deferred";

export type PhysicalBatComparativeInterpretationMode = "relative_only" | "reference_anchored";

export type PhysicalBatEvidenceEligibility = "eligible" | "not_eligible";

export type PhysicalBatReferenceUnavailableReason =
  | "no_suitable_verified_reference_available"
  | "reference_identity_unverified"
  | "reference_not_physically_available"
  | "reference_not_comparable"
  | "other_documented_reason";

export type PhysicalBatEvaluationBlockerCode =
  | "identity_uncertain"
  | "manufacturer_mismatch"
  | "model_mismatch"
  | "model_year_mismatch"
  | "variant_mismatch"
  | "certification_mismatch"
  | "damaged_bat"
  | "missing_evaluator"
  | "unsupported_protocol_version"
  | "reference_identity_uncertain"
  | "reference_type_missing"
  | "external_reference_identity_insufficient"
  | "external_reference_certification_missing"
  | "external_reference_size_missing"
  | "external_reference_condition_blocked"
  | "missing_reference_context"
  | "mode_observation_mismatch"
  | "insufficient_trials"
  | "player_specific_contamination"
  | "pilot_study_contamination"
  | "transition_score_contamination"
  | "arbitrary_canonical_score"
  | "testing_conditions_invalid";

export type PhysicalBatCatalogIdentity = {
  readonly equipmentId: string;
  readonly equipmentVariantId: string;
  readonly manufacturer: string;
  readonly model: string;
  readonly modelYear: number;
  readonly certification: string;
  readonly lengthInches: number;
  readonly weightOunces: number;
  readonly dropWeight: number;
  readonly barrelDiameter?: number;
  readonly sku?: string;
};

export type PhysicalBatVerificationInput = {
  readonly equipmentId: string;
  readonly equipmentVariantId: string;
  readonly manufacturer: string;
  readonly model: string;
  readonly modelYear: number;
  readonly certification: string;
  readonly lengthInches: number;
  readonly weightOunces: number;
  readonly dropWeight: number;
  readonly barrelDiameter?: number;
  readonly source: PhysicalBatVerificationSource;
  readonly verifiedAt: string;
  readonly verifiedBy: string;
  readonly productIdentifier?: string;
  readonly confidence: "confident" | "uncertain";
};

export type PhysicalBatVerificationResult = {
  readonly verified: boolean;
  readonly matched: readonly string[];
  readonly mismatched: readonly string[];
  readonly unresolved: readonly string[];
  readonly blockers: readonly PhysicalBatEvaluationBlockerCode[];
  readonly warnings: readonly string[];
};

export type PhysicalBatEvaluator = {
  readonly evaluatorId: string;
  readonly category: PhysicalBatEvaluatorCategory;
};

export type PhysicalBatReferenceEquipment = {
  readonly referenceType?: PhysicalBatReferenceType;
  readonly referenceId: string;
  readonly equipmentId?: string;
  readonly equipmentVariantId?: string;
  readonly label: string;
  readonly manufacturer?: string;
  readonly model?: string;
  readonly modelYear?: number;
  readonly certification?: string;
  readonly lengthInches?: number;
  readonly weightOunces?: number;
  readonly dropWeight?: number;
  readonly barrelDiameter?: number;
  readonly productIdentifier?: string;
  readonly condition?: PhysicalBatCondition;
  readonly verificationSource?: PhysicalBatVerificationSource;
  readonly verifiedAt?: string;
  readonly verifiedBy?: string;
  readonly identityVerified: boolean;
  readonly limitations?: readonly string[];
};

export type PhysicalBatReferenceContext = {
  readonly referenceAvailable: boolean;
  readonly reason?: PhysicalBatReferenceUnavailableReason;
  readonly notes?: string;
};

export type PhysicalBatTrialCounts = {
  readonly drySwingTrialCount: number;
  readonly contactTrialCount: number;
  readonly referenceAlternationCount: number;
};

export type PhysicalBatRubricResponse = {
  readonly attributeKey: BehavioralEquipmentDNAAttributeKey | "balance_profile";
  readonly dimensions: readonly PhysicalBatRubricDimension[];
  readonly canonicalInterpretation?: EquipmentDNAAttributeNormalizedValue;
  readonly evaluatorConfidence: "low" | "medium" | "high";
  readonly limitations: readonly string[];
};

export type PhysicalBatRubricDimension = {
  readonly key: string;
  readonly observation: PhysicalBatComparisonScale | PhysicalBatStandaloneObservationScale;
  readonly referenceId?: string;
  readonly notes?: string;
};

export type PhysicalBatEvaluationSession = {
  readonly version: PhysicalBatEvaluationProtocolVersion;
  readonly evaluationMode?: PhysicalBatEvaluationMode;
  readonly sessionId: string;
  readonly equipmentId: string;
  readonly equipmentVariantId: string;
  readonly evaluationDate: string;
  readonly physicalVerification: PhysicalBatVerificationInput;
  readonly equipmentCondition: PhysicalBatCondition;
  readonly evaluator: PhysicalBatEvaluator;
  readonly referenceContext?: PhysicalBatReferenceContext;
  readonly referenceEquipment: readonly PhysicalBatReferenceEquipment[];
  readonly trialCounts: PhysicalBatTrialCounts;
  readonly rubricResponses: readonly PhysicalBatRubricResponse[];
  readonly limitations: readonly string[];
  readonly notes?: readonly string[];
  readonly provenanceClassification:
    | "real_structured_physical_evaluation"
    | "real_observation"
    | "development_fixture"
    | "synthetic_physical_evaluation"
    | "not_real_world_evidence";
  readonly pilotStudyReference?: string;
  readonly playerSpecificConclusion?: string;
  readonly transitionScoreUsed?: boolean;
  readonly testingConditionsValid?: boolean;
};

export type PhysicalBatAttributeReview = {
  readonly attributeKey: BehavioralEquipmentDNAAttributeKey | "balance_profile";
  readonly completeness: PhysicalBatRubricCompleteness;
  readonly observationCompleteness: PhysicalBatRubricCompleteness;
  readonly evidenceEligibility: PhysicalBatEvidenceEligibility;
  readonly interpretationMode: PhysicalBatComparativeInterpretationMode | "standalone_absolute";
  readonly canonicalInterpretationStatus: PhysicalBatCanonicalInterpretationStatus;
  readonly canonicalInterpretation?: EquipmentDNAAttributeNormalizedValue;
  readonly evaluationMode: PhysicalBatEvaluationMode;
  readonly evidenceCreated: boolean;
  readonly blockers: readonly PhysicalBatEvaluationBlockerCode[];
  readonly warnings: readonly string[];
  readonly observations: readonly (PhysicalBatComparisonScale | PhysicalBatStandaloneObservationScale)[];
  readonly comparisonObservations: readonly PhysicalBatComparisonScale[];
  readonly standaloneObservations: readonly PhysicalBatStandaloneObservationScale[];
  readonly limitations: readonly string[];
};

export type PhysicalBatEvidenceCoverage = {
  readonly attributeKey: BehavioralEquipmentDNAAttributeKey;
  readonly sessionCount: number;
  readonly evaluatorCount: number;
  readonly independentSourceCount: number;
  readonly status: "none" | "partial" | "complete" | "conflict";
  readonly notes: readonly string[];
};

export type PhysicalBatEvaluationSessionReview = {
  readonly version: PhysicalBatEvaluationProtocolVersion;
  readonly sessionId: string;
  readonly complete: PhysicalBatRubricCompleteness;
  readonly evaluationMode: PhysicalBatEvaluationMode;
  readonly referenceContext?: PhysicalBatReferenceContext;
  readonly physicalVerification: PhysicalBatVerificationResult;
  readonly condition: {
    readonly value: PhysicalBatCondition;
    readonly blocksEvaluation: boolean;
    readonly warnings: readonly string[];
  };
  readonly evaluator: {
    readonly valid: boolean;
    readonly independenceGroup: string;
    readonly category?: PhysicalBatEvaluatorCategory;
  };
  readonly references: {
    readonly validCount: number;
    readonly warnings: readonly string[];
    readonly blockers: readonly PhysicalBatEvaluationBlockerCode[];
  };
  readonly attributes: readonly PhysicalBatAttributeReview[];
  readonly blockers: readonly PhysicalBatEvaluationBlockerCode[];
  readonly warnings: readonly string[];
  readonly evidence: readonly BehavioralEvidenceRecord[];
  readonly writesPerformed: false;
};

export type PhysicalBatEvaluationReadinessReport = {
  readonly version: PhysicalBatEvaluationProtocolVersion;
  readonly equipmentId: string;
  readonly equipmentVariantId?: string;
  readonly equipmentLabel: string;
  readonly variantLabel?: string;
  readonly physicalIdentityReady: boolean;
  readonly catalogSpecsReady: boolean;
  readonly comparativeModeSupported: boolean;
  readonly standaloneModeSupported: boolean;
  readonly suitableReferenceBatAvailable: boolean;
  readonly readyToPerformPhysicalEvaluation: boolean;
  readonly readyToPerformStandaloneEvaluation: boolean;
  readonly canonicalProfileReady: boolean;
  readonly genuineStudyReady: boolean;
  readonly liveRecommendationActivationAllowed: false;
  readonly existingPhysicalSessionCount: number;
  readonly coverage: readonly PhysicalBatEvidenceCoverage[];
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
};
