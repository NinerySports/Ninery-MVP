import type { EquipmentAttributeConfidence } from "../evidence/index.js";
import type {
  EquipmentDNANumericReferenceCandidate,
  EquipmentDNANumericReferenceValidationInput,
  EquipmentDNANumericReferenceValidationResult
} from "./equipment-dna-numeric-reference.types.js";

export const supportedNumericReferenceAttributes = [
  "bat_control_support",
  "swing_effort",
  "forgiveness",
  "sweet_spot_support",
  "power_potential",
  "balance_profile",
  "predictability_support"
] as const;

export const unsupportedNumericReferenceAttributes = [
  "transition_difficulty",
  "confidence_building_potential"
] as const;

const supportOrdinalRanges = {
  very_low: [0, 19],
  low: [20, 39],
  moderate: [40, 59],
  high: [60, 79],
  very_high: [80, 100]
} as const;

const swingEffortRanges = {
  very_easy: [0, 19],
  easy: [20, 39],
  moderate: [40, 59],
  demanding: [60, 79],
  very_demanding: [80, 100]
} as const;

const balanceProfileRanges = {
  very_balanced: [0, 19],
  balanced: [20, 39],
  slightly_end_loaded: [40, 59],
  end_loaded: [60, 79],
  very_end_loaded: [80, 100]
} as const;

const confidenceRank: Record<EquipmentAttributeConfidence, number> = {
  estimated: 0,
  moderate: 1,
  high: 2,
  validated: 3
};

export function validateEquipmentDNANumericReference(
  input: EquipmentDNANumericReferenceValidationInput
): EquipmentDNANumericReferenceValidationResult {
  if (!input.numericReference) {
    return { valid: false, status: "missing", reasons: ["Numeric reference is missing."] };
  }

  const reasons = [
    ...validateReferenceShape(input.numericReference),
    ...validateOrdinalConsistency(input.attributeKey, input.ordinalValue, input.numericReference.numericValue),
    ...validateConfidence(input)
  ];

  return {
    valid: reasons.length === 0,
    status: reasons.length === 0 ? "pass" : "fail",
    reasons
  };
}

export function isEquipmentDNANumericReferenceSupported(attributeKey: string): boolean {
  return supportedNumericReferenceAttributes.includes(attributeKey as (typeof supportedNumericReferenceAttributes)[number]);
}

function validateReferenceShape(reference: EquipmentDNANumericReferenceCandidate): string[] {
  const reasons: string[] = [];
  if (!Number.isFinite(reference.numericValue)) reasons.push("Numeric reference must be finite.");
  if (reference.numericValue < 0 || reference.numericValue > 100) {
    reasons.push("Numeric reference must be between 0 and 100.");
  }
  if (reference.scale !== "0_100") reasons.push(`Unsupported numeric reference scale: ${reference.scale}.`);
  if (
    reference.referenceMethod !== "structured_evaluation" &&
    reference.referenceMethod !== "derived_from_evaluation" &&
    reference.referenceMethod !== "legacy_preserved" &&
    reference.referenceMethod !== "manual_expert_review"
  ) {
    reasons.push(`Unsupported numeric reference method: ${reference.referenceMethod}.`);
  }
  return reasons;
}

function validateOrdinalConsistency(attributeKey: string, ordinalValue: unknown, numericValue: number): string[] {
  const range = ordinalRange(attributeKey, ordinalValue);
  if (!range) {
    return [`${attributeKey} does not have a supported ordinal value for numeric reference validation.`];
  }

  const [min, max] = range;
  return numericValue >= min && numericValue <= max
    ? []
    : [`${attributeKey} ordinal ${ordinalValue} is inconsistent with numeric reference ${numericValue}. Expected ${min}-${max}.`];
}

function ordinalRange(attributeKey: string, ordinalValue: unknown): readonly [number, number] | undefined {
  if (attributeKey === "swing_effort" && typeof ordinalValue === "string" && ordinalValue in swingEffortRanges) {
    return swingEffortRanges[ordinalValue as keyof typeof swingEffortRanges];
  }
  if (attributeKey === "balance_profile" && typeof ordinalValue === "string" && ordinalValue in balanceProfileRanges) {
    return balanceProfileRanges[ordinalValue as keyof typeof balanceProfileRanges];
  }
  if (typeof ordinalValue === "string" && ordinalValue in supportOrdinalRanges) {
    return supportOrdinalRanges[ordinalValue as keyof typeof supportOrdinalRanges];
  }
  return undefined;
}

function validateConfidence(input: EquipmentDNANumericReferenceValidationInput): string[] {
  if (!input.previousConfidence || !input.numericReference) return [];
  if (!isEquipmentAttributeConfidence(input.numericReference.confidence)) {
    return [`Unsupported numeric reference confidence: ${input.numericReference.confidence}.`];
  }
  const downgraded = confidenceRank[input.numericReference.confidence] < confidenceRank[input.previousConfidence];
  if (!downgraded) return [];
  return input.confidenceChangeExplanation?.trim()
    ? []
    : ["Numeric reference confidence downgrade requires an explanation."];
}

function isEquipmentAttributeConfidence(value: string): value is EquipmentAttributeConfidence {
  return value === "estimated" || value === "moderate" || value === "high" || value === "validated";
}
