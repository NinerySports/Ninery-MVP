import type {
  EquipmentDNAAttributeKey,
  EquipmentDNAAttributeNormalizedValue
} from "../attributes/index.js";
import type { EquipmentAttributeConfidence } from "../evidence/index.js";
import type { EquipmentDNANumericReference } from "../profiles/index.js";

export const PREDICTABILITY_SUPPORT_ATTRIBUTE_VERSION = "1.0";
export const PREDICTABILITY_SUPPORT_EVALUATION_VERSION = "1.0";
export const PREDICTABILITY_SUPPORT_COMPOSITE_VERSION = "1.0";

export type PredictabilitySupportFindingCode =
  | "PREDICTABILITY_DEFINITION_APPROVED"
  | "LEGACY_CONFIDENCE_BUILDING_NOT_DIRECTLY_MIGRATABLE"
  | "COMPONENT_INCLUDED"
  | "COMPONENT_EXCLUDED"
  | "COMPONENT_COVERAGE_SUFFICIENT"
  | "COMPONENT_COVERAGE_INSUFFICIENT"
  | "COMPOSITE_VALID"
  | "COMPOSITE_INVALID"
  | "NUMERIC_REFERENCE_SUPPORTED"
  | "NUMERIC_REFERENCE_DEFERRED"
  | "CONFIDENCE_SUFFICIENT"
  | "CONFIDENCE_INSUFFICIENT"
  | "SHADOW_BRIDGE_ALLOWED"
  | "SHADOW_BRIDGE_BLOCKED"
  | "DOUBLE_COUNTING_RISK"
  | "PREDICTABILITY_REDUCED_RESIDUAL"
  | "PREDICTABILITY_DID_NOT_REDUCE_RESIDUAL"
  | "CONFIDENCE_COMPATIBILITY_STILL_REQUIRED";

export type PredictabilityRecommendationUsePolicy =
  | "profile_only"
  | "shadow_dimension_only"
  | "future_replacement_dimension"
  | "requires_weight_review";

export type PredictabilityCandidateBridgeStrategy =
  | "shadow_replace_confidence_building"
  | "shadow_parallel_dimension"
  | "profile_only"
  | "unsupported";

export type PredictabilitySupportOrdinal =
  | "very_low"
  | "low"
  | "moderate"
  | "high"
  | "very_high";

export type PredictabilitySupportCompositePolicy = {
  readonly version: typeof PREDICTABILITY_SUPPORT_COMPOSITE_VERSION;
  readonly recommendationUsePolicy: PredictabilityRecommendationUsePolicy;
  readonly bridgeStrategy: PredictabilityCandidateBridgeStrategy;
  readonly components: readonly {
    readonly attributeKey: EquipmentDNAAttributeKey;
    readonly weight: number;
    readonly direction: "direct" | "inverse";
    readonly required: boolean;
    readonly rationale: string;
  }[];
  readonly minimumComponentCoverage: number;
  readonly allowMissingOptionalComponents: boolean;
  readonly normalizationStrategy: "fixed_weight" | "renormalize_available_components" | "block_when_required_missing";
};

export type PredictabilitySupportComponentInput = {
  readonly attributeKey: EquipmentDNAAttributeKey;
  readonly sourceValue: EquipmentDNAAttributeNormalizedValue;
  readonly numericValue?: number;
  readonly confidence: EquipmentAttributeConfidence;
};

export type PredictabilitySupportComponentResult = {
  readonly attributeKey: EquipmentDNAAttributeKey;
  readonly sourceValue: EquipmentDNAAttributeNormalizedValue;
  readonly numericValue?: number;
  readonly transformedValue?: number;
  readonly weight: number;
  readonly weightedContribution?: number;
  readonly confidence: EquipmentAttributeConfidence;
  readonly included: boolean;
  readonly explanation: string;
};

export type PredictabilitySupportEvaluationResult = {
  readonly version: typeof PREDICTABILITY_SUPPORT_EVALUATION_VERSION;
  readonly ordinalValue: PredictabilitySupportOrdinal;
  readonly numericReference?: EquipmentDNANumericReference;
  readonly componentResults: readonly PredictabilitySupportComponentResult[];
  readonly componentCoverage: number;
  readonly confidence: EquipmentAttributeConfidence;
  readonly rationale: string;
  readonly warnings: readonly string[];
  readonly findings: readonly PredictabilitySupportFindingCode[];
};
