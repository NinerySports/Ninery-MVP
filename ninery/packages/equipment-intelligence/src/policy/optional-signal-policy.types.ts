import type { EquipmentDNAAttributeKey } from "../attributes/index.js";
import type { EquipmentAttributeConfidence, EquipmentEvidenceSourceType } from "../evidence/index.js";

export const OPTIONAL_SIGNAL_CANONICALIZATION_POLICY_VERSION = "1.0";
export const OPTIONAL_SIGNAL_ARCHITECTURE_DECISION_VERSION = "1.0";

export type OptionalSignalKey = "balance" | "confidence_building" | "transition";

export type OptionalSignalCanonicalizationOutcome =
  | "canonical_equipment_numeric_reference"
  | "canonical_equipment_ordinal_only"
  | "split_equipment_and_compatibility"
  | "compatibility_only"
  | "retire_from_future_engine"
  | "requires_more_definition";

export type OptionalSignalPolicyFindingCode =
  | "SIGNAL_INTRINSIC"
  | "SIGNAL_EVALUATED_INTRINSIC"
  | "SIGNAL_RELATIONAL"
  | "SIGNAL_MIXED"
  | "NUMERIC_REFERENCE_SUPPORTED"
  | "NUMERIC_REFERENCE_NOT_SUPPORTED"
  | "ORDINAL_REPRESENTATION_SUPPORTED"
  | "LEGACY_DIRECTION_CONFIRMED"
  | "LEGACY_DIRECTION_AMBIGUOUS"
  | "DIRECTION_INVERSION_REQUIRED"
  | "EVIDENCE_REQUIREMENT_DEFINED"
  | "MANUFACTURER_CLAIM_INSUFFICIENT"
  | "DIRECT_MIGRATION_ALLOWED"
  | "DIRECT_MIGRATION_BLOCKED"
  | "LEGACY_FIELD_DEPRECATED"
  | "HISTORICAL_REPRODUCIBILITY_REQUIRED"
  | "COMPATIBILITY_MODEL_REQUIRED"
  | "PLAYER_CONTEXT_REQUIRED"
  | "CURRENT_EQUIPMENT_REQUIRED"
  | "FUTURE_IMPLEMENTATION_REQUIRED"
  | "POLICY_APPROVED"
  | "POLICY_DEFERRED";

export type OptionalSignalPolicyFinding = {
  readonly code: OptionalSignalPolicyFindingCode;
  readonly severity: "info" | "warning" | "blocking";
  readonly message: string;
};

export type OptionalSignalIdentity = {
  readonly key: OptionalSignalKey;
  readonly legacyField: "balance" | "confidenceBuilding" | "transitionFriendliness";
  readonly legacyCharacteristicCode?: string;
  readonly existingCanonicalAttributeKey?: EquipmentDNAAttributeKey;
  readonly namingNotes: readonly string[];
};

export type OptionalSignalEngineUsage = {
  readonly usedByEligibility: boolean;
  readonly usedByMatchScoring: boolean;
  readonly usedByDimensionScoring: boolean;
  readonly usedByRecommendationConfidence: boolean;
  readonly usedByReasons: boolean;
  readonly usedByTradeoffs: boolean;
  readonly usedByAlternatives: boolean;
  readonly usedByTieBreaking: boolean;
  readonly dimensionNames: readonly string[];
  readonly weights?: Readonly<Record<string, number>>;
  readonly notes: readonly string[];
};

export type OptionalSignalNumericReferencePolicy = {
  readonly supported: boolean;
  readonly scale?: "0_100";
  readonly direction?: string;
  readonly minimumConfidence?: EquipmentAttributeConfidence;
  readonly requiredEvidence?: "objective_measurement" | "combined_evidence" | "relational_calculation" | "not_applicable";
  readonly ordinalConsistencyRequired: boolean;
  readonly ordinalConsistencyIntervals?: Readonly<Record<string, readonly [number, number]>>;
  readonly notes: readonly string[];
};

export type OptionalSignalEvidencePolicy = {
  readonly expectedEvidenceRequirement:
    | "manufacturer_specification"
    | "objective_measurement"
    | "structured_evaluation"
    | "combined_evidence"
    | "relational_calculation"
    | "not_applicable";
  readonly acceptableSourceTypes: readonly EquipmentEvidenceSourceType[];
  readonly minimumIndependentSources?: number;
  readonly objectiveMeasurementPreferred: boolean;
  readonly manufacturerClaimAloneSufficient: boolean;
  readonly notes: readonly string[];
};

export type OptionalSignalConfidencePolicy = {
  readonly minimumForInternalCandidate?: EquipmentAttributeConfidence;
  readonly confidenceAppliesTo:
    | "equipment_evaluation"
    | "compatibility_calculation"
    | "both"
    | "not_applicable";
  readonly estimatedAllowedForShadow: boolean;
  readonly estimatedAllowedForInternalCandidate: boolean;
  readonly notes: readonly string[];
};

export type OptionalSignalRecommendationPolicy = {
  readonly currentLegacyUse:
    | "continue_authoritative"
    | "deprecated_but_preserved"
    | "not_used";
  readonly futureCanonicalUse:
    | "equipment_input"
    | "compatibility_input"
    | "equipment_and_compatibility"
    | "retired"
    | "deferred";
  readonly futureCandidateEligibility:
    | "eligible_after_implementation"
    | "shadow_only"
    | "not_eligible"
    | "requires_separate_policy";
  readonly affectsEligibility: boolean;
  readonly mayAffectRanking: boolean;
  readonly mayAffectConfidence: boolean;
  readonly mayAffectReasons: boolean;
  readonly notes: readonly string[];
};

export type OptionalSignalMigrationGuidance = {
  readonly legacyFieldDisposition: "preserve" | "deprecate" | "retire";
  readonly historicalReproducibilityRequired: boolean;
  readonly directValueMigrationAllowed: boolean;
  readonly migrationDisposition:
    | "preserve_legacy_history"
    | "do_not_copy_to_intrinsic_profile"
    | "replace_with_split_model"
    | "replace_with_compatibility_model";
  readonly futureReplacementKeys: readonly string[];
  readonly steps: readonly string[];
  readonly warnings: readonly string[];
};

export type OptionalSignalCanonicalizationDecision = {
  readonly version: typeof OPTIONAL_SIGNAL_ARCHITECTURE_DECISION_VERSION;
  readonly policyVersion: typeof OPTIONAL_SIGNAL_CANONICALIZATION_POLICY_VERSION;
  readonly registryVersion: string;
  readonly reviewedAt: Date;
  readonly signal: OptionalSignalIdentity;
  readonly outcome: OptionalSignalCanonicalizationOutcome;
  readonly currentState: {
    readonly legacyMeaning: string;
    readonly currentEngineUsage: OptionalSignalEngineUsage;
    readonly currentDirectionality: string;
    readonly currentScale: string;
    readonly knownAmbiguities: readonly string[];
  };
  readonly futureState: {
    readonly canonicalTechnicalName?: string;
    readonly canonicalAttributeKey?: string;
    readonly compatibilityConceptKey?: string;
    readonly ownership: "equipment_intelligence" | "compatibility_intelligence" | "split";
    readonly attributeNature: "intrinsic" | "evaluated_intrinsic" | "relational" | "mixed";
    readonly valueRepresentation:
      | "ordinal"
      | "ordinal_and_numeric_reference"
      | "calculated_compatibility_score"
      | "none";
    readonly relationalInputs?: readonly string[];
    readonly transitionComponents?: readonly string[];
  };
  readonly definitions: {
    readonly technical: string;
    readonly parentFriendly: string;
    readonly explicitlyNot: readonly string[];
  };
  readonly numericReferencePolicy: OptionalSignalNumericReferencePolicy;
  readonly evidencePolicy: OptionalSignalEvidencePolicy;
  readonly confidencePolicy: OptionalSignalConfidencePolicy;
  readonly recommendationPolicy: OptionalSignalRecommendationPolicy;
  readonly migrationGuidance: OptionalSignalMigrationGuidance;
  readonly blockers: readonly OptionalSignalPolicyFinding[];
  readonly warnings: readonly OptionalSignalPolicyFinding[];
  readonly rationale: readonly string[];
  readonly effectiveStatus: "approved" | "approved_with_future_work" | "deferred" | "retired";
};

export type OptionalSignalPolicyValidationResult = {
  readonly valid: boolean;
  readonly errors: readonly string[];
};
