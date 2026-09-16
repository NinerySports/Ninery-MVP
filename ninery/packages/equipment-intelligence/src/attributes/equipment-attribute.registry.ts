import {
  equipmentCertificationValues,
  type EquipmentDNAAttribute
} from "../equipment-dna.types.js";
import type {
  EquipmentDNAAttributeDefinition,
  EquipmentDNAAttributeDomain,
  EquipmentDNAAttributeKey,
  EquipmentDNAAttributeRegistryVersion
} from "./equipment-attribute.types.js";

export const EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION: EquipmentDNAAttributeRegistryVersion = "1.0";

const fivePointSupportValues = ["very_low", "low", "moderate", "high", "very_high"] as const;

const equipmentDNAAttributeDefinitions = [
  {
    key: "length",
    version: EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION,
    displayName: "Length",
    shortLabel: "Length",
    domain: "physical",
    dataType: "number",
    unit: "inches",
    min: 24,
    max: 35,
    integer: false,
    description: "The bat length listed for a specific purchasable variant.",
    parentExplanation: "Length helps show whether the bat size can fit the player's body, coverage needs, and league context.",
    recommendationImpact: "critical",
    evidenceRequirement: "manufacturer_specification",
    requiredForRecommendationReady: true,
    applicableLevel: "variant",
    status: "active",
    attributeNature: "intrinsic",
    order: 10,
    compatibility: {
      sourceCode: "equipment.variant.lengthInches",
      notes: "Uses the existing EquipmentVariant.lengthInches field."
    }
  },
  {
    key: "weight",
    version: EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION,
    displayName: "Weight",
    shortLabel: "Weight",
    domain: "physical",
    dataType: "number",
    unit: "ounces",
    min: 14,
    max: 40,
    integer: false,
    description: "The listed scale weight for a specific purchasable variant.",
    parentExplanation: "Weight helps explain how much bat the player is being asked to move before swing-feel scores are considered.",
    recommendationImpact: "critical",
    evidenceRequirement: "manufacturer_specification",
    requiredForRecommendationReady: true,
    applicableLevel: "variant",
    status: "active",
    attributeNature: "intrinsic",
    order: 20,
    compatibility: {
      sourceCode: "equipment.variant.weightOunces",
      notes: "Uses the existing EquipmentVariant.weightOunces field."
    }
  },
  {
    key: "drop",
    version: EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION,
    displayName: "Drop",
    shortLabel: "Drop",
    domain: "physical",
    dataType: "number",
    unit: "drop",
    min: -15,
    max: 5,
    integer: true,
    description: "The signed length-minus-weight relationship for a variant, stored with the current Ninery convention such as -8.",
    parentExplanation: "Drop helps compare whether the bat is lighter or heavier for its length, which affects transitions between sizes and standards.",
    recommendationImpact: "critical",
    evidenceRequirement: "manufacturer_specification",
    requiredForRecommendationReady: true,
    applicableLevel: "variant",
    status: "active",
    attributeNature: "intrinsic",
    order: 30,
    compatibility: {
      sourceCode: "equipment.variant.dropWeight",
      notes: "Uses the existing signed EquipmentVariant.dropWeight convention."
    }
  },
  {
    key: "certification",
    version: EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION,
    displayName: "Certification",
    shortLabel: "Cert.",
    domain: "physical",
    dataType: "enum",
    allowedValues: equipmentCertificationValues,
    description: "The league or rules certification attached to the equipment model.",
    parentExplanation: "Certification is the first eligibility check because a great bat still has to be legal for the player's league.",
    recommendationImpact: "critical",
    evidenceRequirement: "manufacturer_specification",
    requiredForRecommendationReady: true,
    applicableLevel: "equipment",
    status: "active",
    attributeNature: "intrinsic",
    order: 40,
    compatibility: {
      sourceCode: "equipment.certification",
      notes: "Reuses the generated Prisma EquipmentCertification vocabulary exposed by Equipment DNA filters."
    }
  },
  {
    key: "barrel_diameter",
    version: EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION,
    displayName: "Barrel Diameter",
    shortLabel: "Barrel",
    domain: "physical",
    dataType: "number",
    unit: "inches",
    min: 2,
    max: 3,
    integer: false,
    description: "The listed barrel diameter for the equipment model.",
    parentExplanation: "Barrel diameter helps compare league fit and contact surface without implying the bat will fix swing mechanics by itself.",
    recommendationImpact: "high",
    evidenceRequirement: "manufacturer_specification",
    requiredForRecommendationReady: true,
    applicableLevel: "equipment",
    status: "active",
    attributeNature: "intrinsic",
    order: 50,
    compatibility: {
      sourceCode: "equipment.barrelDiameter",
      notes: "Uses the existing Equipment.barrelDiameter catalog field."
    }
  },
  {
    key: "construction",
    version: EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION,
    displayName: "Construction",
    shortLabel: "Build",
    domain: "physical",
    dataType: "enum",
    allowedValues: ["one_piece", "two_piece", "hybrid"],
    description: "The structural build family for the equipment model.",
    parentExplanation: "Construction gives context for feel, feedback, and comfort, but it is not enough on its own to choose a bat.",
    recommendationImpact: "medium",
    evidenceRequirement: "manufacturer_specification",
    requiredForRecommendationReady: false,
    applicableLevel: "equipment",
    status: "active",
    attributeNature: "intrinsic",
    order: 60,
    compatibility: {
      sourceCode: "equipment.construction",
      notes: "Uses the existing free-text Equipment.construction field when present."
    }
  },
  {
    key: "material",
    version: EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION,
    displayName: "Material",
    shortLabel: "Material",
    domain: "physical",
    dataType: "enum",
    allowedValues: ["alloy", "composite", "hybrid", "wood"],
    description: "The primary material family for the equipment model.",
    parentExplanation: "Material helps explain broad feel and durability expectations while keeping the final recommendation evidence-based.",
    recommendationImpact: "medium",
    evidenceRequirement: "manufacturer_specification",
    requiredForRecommendationReady: false,
    applicableLevel: "equipment",
    status: "active",
    attributeNature: "intrinsic",
    order: 70,
    compatibility: {
      sourceCode: "equipment.material",
      notes: "Uses the existing free-text Equipment.material field when present."
    }
  },
  {
    key: "balance_profile",
    version: EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION,
    displayName: "Balance Profile",
    shortLabel: "Balance",
    domain: "performance",
    dataType: "ordinal",
    allowedValues: ["very_balanced", "balanced", "slightly_end_loaded", "end_loaded", "very_end_loaded"],
    description: "The evaluated balance behavior of the bat model.",
    parentExplanation: "Balance profile describes how the bat tends to feel in motion so families can compare feel, not just listed ounces.",
    recommendationImpact: "high",
    evidenceRequirement: "combined_evidence",
    requiredForRecommendationReady: false,
    applicableLevel: "equipment",
    status: "active",
    attributeNature: "evaluated_intrinsic",
    order: 80,
    compatibility: characteristicCompatibility("balance", "SWING_BALANCE", "swing-balance")
  },
  {
    key: "swing_effort",
    version: EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION,
    displayName: "Swing Effort",
    shortLabel: "Effort",
    domain: "performance",
    dataType: "ordinal",
    allowedValues: ["very_easy", "easy", "moderate", "demanding", "very_demanding"],
    description: "The evaluated effort required to get the bat moving through the zone.",
    parentExplanation: "Swing effort helps identify whether a bat may feel manageable for the player's current strength and timing.",
    recommendationImpact: "critical",
    evidenceRequirement: "combined_evidence",
    requiredForRecommendationReady: true,
    applicableLevel: "equipment",
    status: "active",
    attributeNature: "evaluated_intrinsic",
    order: 90,
    compatibility: characteristicCompatibility("swingWeight", "SWING_WEIGHT", "swing-weight")
  },
  {
    key: "forgiveness",
    version: EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION,
    displayName: "Forgiveness",
    shortLabel: "Forgive",
    domain: "performance",
    dataType: "ordinal",
    allowedValues: fivePointSupportValues,
    description: "The evaluated ability to preserve useful contact quality away from perfect barrel contact.",
    parentExplanation: "Forgiveness helps families understand how supportive the barrel may be when contact is not perfect.",
    recommendationImpact: "critical",
    evidenceRequirement: "combined_evidence",
    requiredForRecommendationReady: true,
    applicableLevel: "equipment",
    status: "active",
    attributeNature: "evaluated_intrinsic",
    order: 100,
    compatibility: characteristicCompatibility("barrelForgiveness", "BARREL_FORGIVENESS", "barrel-forgiveness")
  },
  {
    key: "sweet_spot_support",
    version: EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION,
    displayName: "Sweet Spot Support",
    shortLabel: "Sweet Spot",
    domain: "performance",
    dataType: "ordinal",
    allowedValues: fivePointSupportValues,
    description: "The evaluated support for a useful hitting area across the barrel.",
    parentExplanation: "Sweet spot support explains how much room for productive contact the bat profile appears to provide.",
    recommendationImpact: "high",
    evidenceRequirement: "combined_evidence",
    requiredForRecommendationReady: true,
    applicableLevel: "equipment",
    status: "active",
    attributeNature: "evaluated_intrinsic",
    order: 110,
    compatibility: characteristicCompatibility("sweetSpotSize", "SWEET_SPOT_SIZE", "sweet-spot-size")
  },
  {
    key: "power_potential",
    version: EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION,
    displayName: "Power Potential",
    shortLabel: "Power",
    domain: "performance",
    dataType: "ordinal",
    allowedValues: fivePointSupportValues,
    description: "The evaluated support for turning a player's swing into strong batted-ball output.",
    parentExplanation: "Power potential is useful context, but it matters most when it matches the player's control, confidence, and growth needs.",
    recommendationImpact: "medium",
    evidenceRequirement: "combined_evidence",
    requiredForRecommendationReady: false,
    applicableLevel: "equipment",
    status: "active",
    attributeNature: "evaluated_intrinsic",
    order: 120,
    compatibility: characteristicCompatibility("powerPotential", "POWER_POTENTIAL", "power-potential")
  },
  {
    key: "barrel_stability",
    version: EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION,
    displayName: "Barrel Stability",
    shortLabel: "Stability",
    domain: "performance",
    dataType: "ordinal",
    allowedValues: fivePointSupportValues,
    description: "The evaluated steadiness of the barrel through contact and minor mishits.",
    parentExplanation: "Barrel stability gives more detail on whether the bat stays composed through contact, separate from raw power.",
    recommendationImpact: "medium",
    evidenceRequirement: "structured_evaluation",
    requiredForRecommendationReady: false,
    applicableLevel: "equipment",
    status: "active",
    attributeNature: "evaluated_intrinsic",
    order: 130,
    compatibility: {
      seededCharacteristicCode: "mishit-forgiveness",
      notes: "Reserved for richer evaluation beyond the current eight scoring attributes."
    }
  },
  {
    key: "transition_difficulty",
    version: EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION,
    displayName: "Transition Difficulty",
    shortLabel: "Transition",
    domain: "compatibility",
    dataType: "ordinal",
    allowedValues: ["minimal", "low", "moderate", "high", "very_high"],
    description: "A candidate estimate of how demanding the bat may be when a player changes size, drop, or certification.",
    parentExplanation: "Transition difficulty is partly about the player, so Ninery treats it as a candidate signal until player-relative compatibility can fully own it.",
    recommendationImpact: "high",
    evidenceRequirement: "structured_evaluation",
    requiredForRecommendationReady: false,
    applicableLevel: "equipment",
    status: "experimental",
    attributeNature: "relational_candidate",
    order: 140,
    compatibility: {
      existingCharacteristicCode: "TRANSITION_FRIENDLINESS",
      seededCharacteristicCode: "transition-friendliness",
      existingScoreAttribute: "transitionFriendliness",
      sourceCode: "equipment.TRANSITION_FRIENDLINESS",
      notes: "Current scoring stores transitionFriendliness. The registry keeps transition_difficulty experimental because true transition fit is player-relative and belongs in Compatibility Intelligence."
    }
  },
  {
    key: "predictability_support",
    version: EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION,
    displayName: "Predictability Support",
    shortLabel: "Predictable",
    domain: "performance",
    dataType: "ordinal",
    allowedValues: fivePointSupportValues,
    description: "The degree to which a bat's behavior and performance feedback remain stable, understandable, and repeatable across typical swings, contact locations, and mishit outcomes.",
    parentExplanation: "How consistent and understandable the bat's response tends to feel from swing to swing.",
    recommendationImpact: "medium",
    evidenceRequirement: "combined_evidence",
    requiredForRecommendationReady: false,
    applicableLevel: "equipment",
    status: "active",
    attributeNature: "evaluated_intrinsic",
    order: 145,
    compatibility: {
      notes: "Equipment-side replacement for the intrinsic portion of legacy confidenceBuilding. It must not be treated as player confidence or copied directly from CONFIDENCE_BUILDING."
    }
  },
  {
    key: "confidence_building_potential",
    version: EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION,
    displayName: "Confidence Building Potential",
    shortLabel: "Confidence",
    domain: "compatibility",
    dataType: "ordinal",
    allowedValues: fivePointSupportValues,
    description: "A candidate estimate of whether the bat's feel and forgiveness may support player comfort.",
    parentExplanation: "Confidence support can help explain a recommendation, but confidence is personal and should not be promised from equipment alone.",
    recommendationImpact: "medium",
    evidenceRequirement: "structured_evaluation",
    requiredForRecommendationReady: false,
    applicableLevel: "equipment",
    status: "experimental",
    attributeNature: "relational_candidate",
    order: 150,
    compatibility: characteristicCompatibility("confidenceBuilding", "CONFIDENCE_BUILDING", "confidence-building")
  },
  {
    key: "bat_control_support",
    version: EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION,
    displayName: "Bat Control Support",
    shortLabel: "Control",
    domain: "development",
    dataType: "ordinal",
    allowedValues: fivePointSupportValues,
    description: "The evaluated support for keeping the barrel controllable through the swing.",
    parentExplanation: "Bat control support helps families see whether the bat profile supports a controllable swing for development goals.",
    recommendationImpact: "critical",
    evidenceRequirement: "combined_evidence",
    requiredForRecommendationReady: true,
    applicableLevel: "equipment",
    status: "active",
    attributeNature: "evaluated_intrinsic",
    order: 160,
    compatibility: characteristicCompatibility("batControl", "BAT_CONTROL", "bat-control")
  }
] as const satisfies readonly EquipmentDNAAttributeDefinition[];

export const EQUIPMENT_DNA_ATTRIBUTE_DEFINITIONS: readonly EquipmentDNAAttributeDefinition[] =
  equipmentDNAAttributeDefinitions;

const definitionsByKey = new Map<EquipmentDNAAttributeKey, EquipmentDNAAttributeDefinition>(
  EQUIPMENT_DNA_ATTRIBUTE_DEFINITIONS.map((definition) => [definition.key, definition])
);

export function getEquipmentDNAAttributeDefinitions(): readonly EquipmentDNAAttributeDefinition[] {
  return EQUIPMENT_DNA_ATTRIBUTE_DEFINITIONS;
}

export function getEquipmentDNAAttributeDefinition(
  key: EquipmentDNAAttributeKey | string
): EquipmentDNAAttributeDefinition | undefined {
  return definitionsByKey.get(key as EquipmentDNAAttributeKey);
}

export function getEquipmentDNAAttributesByDomain(
  domain: EquipmentDNAAttributeDomain
): readonly EquipmentDNAAttributeDefinition[] {
  return EQUIPMENT_DNA_ATTRIBUTE_DEFINITIONS.filter((definition) => definition.domain === domain);
}

export function getActiveEquipmentDNAAttributeDefinitions(): readonly EquipmentDNAAttributeDefinition[] {
  return EQUIPMENT_DNA_ATTRIBUTE_DEFINITIONS.filter((definition) => definition.status === "active");
}

export function getRequiredEquipmentDNAAttributeDefinitions(): readonly EquipmentDNAAttributeDefinition[] {
  return EQUIPMENT_DNA_ATTRIBUTE_DEFINITIONS.filter(
    (definition) => definition.status === "active" && definition.requiredForRecommendationReady
  );
}

export function isEquipmentDNAAttributeKey(value: unknown): value is EquipmentDNAAttributeKey {
  return typeof value === "string" && definitionsByKey.has(value as EquipmentDNAAttributeKey);
}

export function validateEquipmentDNAAttributeRegistry(
  definitions: readonly EquipmentDNAAttributeDefinition[] = EQUIPMENT_DNA_ATTRIBUTE_DEFINITIONS
): string[] {
  const errors: string[] = [];
  const keys = new Set<string>();
  const orders = new Set<number>();

  for (const definition of definitions) {
    if (definition.version !== EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION) {
      errors.push(`${definition.key} must use registry version ${EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION}.`);
    }
    if (keys.has(definition.key)) {
      errors.push(`${definition.key} is duplicated.`);
    }
    keys.add(definition.key);
    if (orders.has(definition.order)) {
      errors.push(`${definition.key} has a duplicated order value.`);
    }
    orders.add(definition.order);
    if (!definition.displayName.trim()) {
      errors.push(`${definition.key} must have a display name.`);
    }
    if (!definition.parentExplanation.trim()) {
      errors.push(`${definition.key} must have a parent explanation.`);
    }
    if (definition.dataType === "enum" || definition.dataType === "ordinal") {
      const values = new Set(definition.allowedValues);
      if (values.size !== definition.allowedValues.length) {
        errors.push(`${definition.key} has duplicate allowed values.`);
      }
      if (definition.allowedValues.length === 0) {
        errors.push(`${definition.key} must define allowed values.`);
      }
    }
    if (definition.dataType === "number") {
      if (definition.min >= definition.max) {
        errors.push(`${definition.key} must have min lower than max.`);
      }
    }
    if (definition.attributeNature === "relational_candidate" && definition.requiredForRecommendationReady) {
      errors.push(`${definition.key} cannot be required while marked relational_candidate.`);
    }
  }

  return errors;
}

function characteristicCompatibility(
  existingScoreAttribute: EquipmentDNAAttribute,
  existingCharacteristicCode: string,
  seededCharacteristicCode: string
) {
  return {
    existingCharacteristicCode,
    seededCharacteristicCode,
    existingScoreAttribute,
    sourceCode: `equipment.${existingCharacteristicCode}`
  };
}
