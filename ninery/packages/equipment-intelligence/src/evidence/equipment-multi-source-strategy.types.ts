export const multiSourceEvidenceClassValues = ["verified_catalog_fact", "direct_physical_measurement", "controlled_mechanical_test", "structured_human_evaluation", "structured_field_observation", "modeled_estimate"] as const;
export type MultiSourceEvidenceClass = (typeof multiSourceEvidenceClassValues)[number];
export type EvidenceSupportRole = "primary_candidate" | "supporting_candidate" | "validation_candidate" | "future_validation_candidate" | "not_applicable" | "unknown";
export type MeasurementFeasibility = "easy_low_cost" | "moderate_setup" | "specialized_equipment" | "laboratory_grade" | "method_not_yet_defined";
export type ConstructLifecycleState = "experimental" | "candidate" | "supported" | "redefinition_candidate" | "redundant_candidate" | "retirement_candidate" | "retired";
export type CorroborationState = "single_source" | "multi_source_uncorroborated" | "directionally_correlated" | "cross_method_support" | "conflicting_evidence" | "insufficient_evidence";
export type MultiSourceConflictType = "measurement_observation_conflict" | "human_observation_conflict" | "field_controlled_conflict" | "model_observation_conflict" | "methodological_review_required";

export type EvidenceSourcePolicy = {
  readonly sourceClass: MultiSourceEvidenceClass;
  readonly claimKind: "fact" | "measurement" | "controlled_test_result" | "human_observation" | "field_observation" | "inference";
  readonly supports: string;
  readonly requiredProvenance: readonly string[];
  readonly reproducibility: string;
  readonly independenceSemantics: string;
  readonly uncertainty: string;
  readonly canonicalEligibility: "false" | "deferred";
  readonly corroborationRequired: boolean;
  readonly recommendationParticipation: "not_allowed" | "future_policy_required";
  readonly trustLabel: string;
};

export type ConstructEvidenceStrategy = {
  readonly construct: string;
  readonly lifecycle: ConstructLifecycleState;
  readonly canonicalAttribute: boolean;
  readonly sourceRoles: Readonly<Record<MultiSourceEvidenceClass, EvidenceSupportRole>>;
  readonly currentEvidence: string;
  readonly canonicalReadiness: "not_evaluated";
  readonly causalityWarning?: string;
};

export type PhysicalMeasurementDefinition = {
  readonly key: string;
  readonly evidenceClass: "direct_physical_measurement";
  readonly feasibility: MeasurementFeasibility;
  readonly equipment: readonly string[];
  readonly supportedRawUnits: readonly string[];
  readonly normalizedUnit?: string;
  readonly repeatedTrials: "required" | "recommended";
  readonly methodStatus: string;
  readonly potentialClaim: string;
  readonly behavioralInferenceAllowed: false;
};

export type DirectMeasurementRecord = {
  readonly sourceClass: "direct_physical_measurement";
  readonly equipmentId: string;
  readonly equipmentVariantId: string;
  readonly measurementType: string;
  readonly rawValue: number;
  readonly rawUnit: string;
  readonly measuredAt: string;
  readonly operatorId: string;
  readonly method: string;
  readonly instrument: { readonly type: string; readonly identifier?: string; readonly resolution?: number; readonly calibrationStatus: "known_current" | "known_expired" | "unknown" };
  readonly trialValues: readonly number[];
  readonly aggregateValue?: number;
  readonly environmentNotes?: string;
  readonly equipmentCondition: string;
  readonly quality: "provisional" | "controlled" | "review_required";
  readonly limitations: readonly string[];
  readonly protocolVersion: string;
};

export type MeasurementIndependence = "same_operator_same_instrument" | "same_operator_different_instrument" | "different_operator_same_instrument" | "different_operator_different_instrument";

