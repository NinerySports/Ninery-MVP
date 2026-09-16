import type { EquipmentDNAAttributeKey } from "../attributes/index.js";
import type { EquipmentDNAMaturityLevel } from "../evidence/index.js";
import {
  CANONICAL_EQUIPMENT_DNA_PROFILE_VERSION,
  EQUIPMENT_DNA_SHADOW_COMPARISON_VERSION,
  EQUIPMENT_ORDINAL_TO_NUMERIC_COMPARISON_VERSION
} from "../profiles/index.js";
import { EQUIPMENT_SCORE_TO_ORDINAL_MAPPING_VERSION } from "../evaluations/index.js";
import { EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION } from "../attributes/index.js";
import {
  EQUIPMENT_ATTRIBUTE_CONFIDENCE_MODEL_VERSION,
  EQUIPMENT_DNA_READINESS_MODEL_VERSION
} from "../evidence/index.js";
import type { CanonicalEquipmentDNAAdmissionPolicy } from "./canonical-equipment-dna-admission.types.js";

export const CANONICAL_EQUIPMENT_DNA_ADMISSION_POLICY_VERSION = "1.0";

export const CANONICAL_EQUIPMENT_DNA_ADMISSION_BLOCKER_PRIORITY = [
  "blocked_invalid_profile",
  "blocked_unsupported_version",
  "blocked_conflict",
  "blocked_not_ready",
  "blocked_insufficient_confidence",
  "blocked_specification_mismatch",
  "blocked_insufficient_mapping_coverage",
  "blocked_material_disagreement",
  "blocked_insufficient_maturity",
  "approved_for_internal_candidate",
  "approved_for_shadow"
] as const;

const maturityRank: Record<EquipmentDNAMaturityLevel, number> = {
  basic: 0,
  evaluated: 1,
  validated: 2,
  trusted: 3,
  living_intelligence: 4
};

export function meetsMinimumEquipmentDNAMaturity(
  maturity: EquipmentDNAMaturityLevel,
  minimum: EquipmentDNAMaturityLevel
): boolean {
  return maturityRank[maturity] >= maturityRank[minimum];
}

export const canonicalEquipmentDNAAdmissionPolicy: CanonicalEquipmentDNAAdmissionPolicy = {
  version: CANONICAL_EQUIPMENT_DNA_ADMISSION_POLICY_VERSION,
  minimumInternalCandidateMaturity: "evaluated",
  requiredSpecificationKeys: ["length", "weight", "drop", "certification", "barrel_diameter"],
  requiredComparableBehaviorKeys: ["bat_control_support", "swing_effort", "forgiveness", "sweet_spot_support"],
  optionalComparableBehaviorKeys: [
    "power_potential",
    "balance_profile",
    "confidence_building_potential",
    "transition_difficulty"
  ],
  experimentalAttributeKeys: ["confidence_building_potential", "transition_difficulty"],
  minimumBehaviorMappingCoverage: 1,
  minimumConfidenceByDomain: {
    physical: "high",
    performance: "moderate",
    development: "moderate",
    compatibility: "moderate"
  },
  supportedVersions: {
    canonicalProfile: [CANONICAL_EQUIPMENT_DNA_PROFILE_VERSION],
    registry: [EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION],
    confidenceModel: [EQUIPMENT_ATTRIBUTE_CONFIDENCE_MODEL_VERSION],
    readinessModel: [EQUIPMENT_DNA_READINESS_MODEL_VERSION],
    scoreMapping: [EQUIPMENT_SCORE_TO_ORDINAL_MAPPING_VERSION],
    shadowComparison: [EQUIPMENT_DNA_SHADOW_COMPARISON_VERSION],
    ordinalComparison: [EQUIPMENT_ORDINAL_TO_NUMERIC_COMPARISON_VERSION]
  }
};

export function isRequiredAdmissionBehaviorKey(
  key: EquipmentDNAAttributeKey
): key is (typeof canonicalEquipmentDNAAdmissionPolicy.requiredComparableBehaviorKeys)[number] {
  return canonicalEquipmentDNAAdmissionPolicy.requiredComparableBehaviorKeys.includes(key);
}
