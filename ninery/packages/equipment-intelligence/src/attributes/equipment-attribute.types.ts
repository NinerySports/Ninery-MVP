import type { EquipmentDNAAttribute } from "../equipment-dna.types.js";

export type EquipmentDNAAttributeRegistryVersion = "1.0";

export type EquipmentDNAAttributeDomain = "physical" | "performance" | "compatibility" | "development";

export type EquipmentDNAAttributeDataType = "number" | "boolean" | "enum" | "ordinal";

export type EquipmentDNAAttributeRecommendationImpact = "critical" | "high" | "medium" | "low";

export type EquipmentDNAAttributeEvidenceRequirement =
  | "manufacturer_specification"
  | "objective_measurement"
  | "structured_evaluation"
  | "combined_evidence";

export type EquipmentDNAAttributeApplicableLevel = "equipment" | "variant";

export type EquipmentDNAAttributeStatus = "active" | "experimental" | "deprecated";

export type EquipmentDNAAttributeNature = "intrinsic" | "evaluated_intrinsic" | "relational_candidate";

export type EquipmentDNAAttributeKey =
  | "length"
  | "weight"
  | "drop"
  | "certification"
  | "barrel_diameter"
  | "construction"
  | "material"
  | "balance_profile"
  | "swing_effort"
  | "forgiveness"
  | "sweet_spot_support"
  | "power_potential"
  | "barrel_stability"
  | "predictability_support"
  | "transition_difficulty"
  | "confidence_building_potential"
  | "bat_control_support";

export type EquipmentDNAAttributeCompatibility = {
  existingCharacteristicCode?: string;
  seededCharacteristicCode?: string;
  existingScoreAttribute?: EquipmentDNAAttribute;
  sourceCode?: string;
  notes?: string;
};

type EquipmentDNAAttributeDefinitionBase = {
  key: EquipmentDNAAttributeKey;
  version: EquipmentDNAAttributeRegistryVersion;
  displayName: string;
  shortLabel: string;
  domain: EquipmentDNAAttributeDomain;
  description: string;
  parentExplanation: string;
  recommendationImpact: EquipmentDNAAttributeRecommendationImpact;
  evidenceRequirement: EquipmentDNAAttributeEvidenceRequirement;
  requiredForRecommendationReady: boolean;
  applicableLevel: EquipmentDNAAttributeApplicableLevel;
  status: EquipmentDNAAttributeStatus;
  attributeNature: EquipmentDNAAttributeNature;
  order: number;
  compatibility?: EquipmentDNAAttributeCompatibility;
};

export type EquipmentDNANumberAttributeDefinition = EquipmentDNAAttributeDefinitionBase & {
  dataType: "number";
  unit: string;
  min: number;
  max: number;
  integer: boolean;
};

export type EquipmentDNABooleanAttributeDefinition = EquipmentDNAAttributeDefinitionBase & {
  dataType: "boolean";
};

export type EquipmentDNAEnumAttributeDefinition = EquipmentDNAAttributeDefinitionBase & {
  dataType: "enum";
  allowedValues: readonly string[];
};

export type EquipmentDNAOrdinalAttributeDefinition = EquipmentDNAAttributeDefinitionBase & {
  dataType: "ordinal";
  allowedValues: readonly string[];
};

export type EquipmentDNAAttributeDefinition =
  | EquipmentDNANumberAttributeDefinition
  | EquipmentDNABooleanAttributeDefinition
  | EquipmentDNAEnumAttributeDefinition
  | EquipmentDNAOrdinalAttributeDefinition;

export type EquipmentDNAAttributeNormalizedValue = string | number | boolean;

export type EquipmentDNAAttributeValidationResult =
  | {
      valid: true;
      normalizedValue: EquipmentDNAAttributeNormalizedValue;
    }
  | {
      valid: false;
      errors: string[];
    };
