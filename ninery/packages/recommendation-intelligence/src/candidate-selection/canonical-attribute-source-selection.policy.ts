import type { EquipmentAttributeConfidence } from "@ninery/equipment-intelligence";
import type { CanonicalAttributeSourceSelectionPolicy } from "./canonical-attribute-source-selection.types.js";

export const confidenceOrder: readonly EquipmentAttributeConfidence[] = ["estimated", "moderate", "high", "validated"];

export const canonicalAttributeSourceSelectionPolicy: CanonicalAttributeSourceSelectionPolicy = {
  version: "1.0",
  supportedAttributes: [
    "bat_control_support",
    "swing_effort",
    "forgiveness",
    "sweet_spot_support",
    "power_potential"
  ],
  numericReference: {
    enabledAttributes: [
      "bat_control_support",
      "swing_effort",
      "forgiveness",
      "sweet_spot_support",
      "power_potential"
    ],
    supportedScales: ["0_100"],
    supportedMethods: ["legacy_preserved", "derived_from_evaluation", "structured_evaluation"],
    supportedVersions: ["1.0"],
    minimumConfidenceByAttribute: {
      bat_control_support: "moderate",
      swing_effort: "moderate",
      forgiveness: "moderate",
      sweet_spot_support: "moderate",
      power_potential: "moderate"
    },
    requireOrdinalConsistency: true
  },
  ordinalFallback: {
    allowedAttributes: [
      "bat_control_support",
      "swing_effort",
      "forgiveness",
      "sweet_spot_support",
      "power_potential"
    ],
    allowedWhenReferenceMissing: true,
    allowedWhenReferenceInvalid: true,
    allowedWhenConfidenceInsufficient: true,
    allowedWhenVersionUnsupported: false
  },
  requiredCandidateAttributes: [
    "bat_control_support",
    "swing_effort",
    "forgiveness",
    "sweet_spot_support",
    "power_potential"
  ]
};

export const canonicalAttributeSourceSelectionPolicyWithBalance: CanonicalAttributeSourceSelectionPolicy = {
  ...canonicalAttributeSourceSelectionPolicy,
  supportedAttributes: [
    ...canonicalAttributeSourceSelectionPolicy.supportedAttributes,
    "balance_profile"
  ],
  numericReference: {
    ...canonicalAttributeSourceSelectionPolicy.numericReference,
    enabledAttributes: [
      ...canonicalAttributeSourceSelectionPolicy.numericReference.enabledAttributes,
      "balance_profile"
    ],
    minimumConfidenceByAttribute: {
      ...canonicalAttributeSourceSelectionPolicy.numericReference.minimumConfidenceByAttribute,
      balance_profile: "moderate"
    }
  },
  ordinalFallback: {
    ...canonicalAttributeSourceSelectionPolicy.ordinalFallback,
    allowedAttributes: canonicalAttributeSourceSelectionPolicy.ordinalFallback.allowedAttributes,
    allowedWhenReferenceMissing: false,
    allowedWhenReferenceInvalid: false,
    allowedWhenConfidenceInsufficient: false
  },
  requiredCandidateAttributes: [
    ...canonicalAttributeSourceSelectionPolicy.requiredCandidateAttributes,
    "balance_profile"
  ]
};

export function meetsMinimumEquipmentAttributeConfidence(
  actual: EquipmentAttributeConfidence | string,
  minimum: EquipmentAttributeConfidence
): boolean {
  const actualIndex = confidenceOrder.indexOf(actual as EquipmentAttributeConfidence);
  const minimumIndex = confidenceOrder.indexOf(minimum);
  return actualIndex >= 0 && actualIndex >= minimumIndex;
}
