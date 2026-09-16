import type { EquipmentDNAProfile } from "../equipment-dna.types.js";
import type { EquipmentDNAAttributeKey, EquipmentDNAAttributeNormalizedValue } from "../attributes/index.js";
import type { EquipmentDNAMaturityLevel } from "../evidence/index.js";
import type { CanonicalEquipmentDNAProfile } from "./canonical-equipment-dna-profile.types.js";

export const EQUIPMENT_ORDINAL_TO_NUMERIC_COMPARISON_VERSION = "1.0";
export const EQUIPMENT_DNA_SHADOW_COMPARISON_VERSION = "1.0";

export const EQUIPMENT_DNA_SHADOW_DIFFERENCE_THRESHOLDS = {
  alignedMaximum: 10,
  minorMaximum: 20
} as const;

export type LegacyEquipmentDNAComparisonProfile = {
  readonly equipmentId: string;
  readonly equipmentVariantId?: string;
  readonly scores: {
    readonly batControl?: number;
    readonly swingWeight?: number;
    readonly barrelForgiveness?: number;
    readonly sweetSpotSize?: number;
    readonly powerPotential?: number;
    readonly balance?: number;
    readonly confidenceBuilding?: number;
    readonly transitionFriendliness?: number;
  };
  readonly completeness: number;
  readonly confidence?: number;
  readonly sourceProfileId?: string;
};

export type EquipmentDNAAttributeComparisonStatus =
  | "aligned"
  | "minor_difference"
  | "material_difference"
  | "missing_canonical"
  | "missing_legacy"
  | "incomparable";

export type EquipmentDNAAttributeComparison = {
  readonly canonicalKey: EquipmentDNAAttributeKey;
  readonly legacyField: string;
  readonly canonicalValue?: EquipmentDNAAttributeNormalizedValue;
  readonly canonicalNumericEquivalent?: number;
  readonly legacyValue?: number;
  readonly normalizedDifference?: number;
  readonly status: EquipmentDNAAttributeComparisonStatus;
  readonly comparisonStrategy: string;
  readonly explanation: string;
};

export type EquipmentDNASpecificationCheck = {
  readonly key: "length" | "weight" | "drop" | "certification" | "barrel_diameter";
  readonly canonicalValue: unknown;
  readonly catalogValue: unknown;
  readonly status: "match" | "mismatch" | "missing";
  readonly explanation: string;
};

export type EquipmentDNAShadowComparisonResult = {
  readonly version: typeof EQUIPMENT_DNA_SHADOW_COMPARISON_VERSION;
  readonly equipmentId: string;
  readonly equipmentVariantId?: string;
  readonly equipmentName: string;
  readonly canonicalProfileReady: boolean;
  readonly canonicalMaturity: EquipmentDNAMaturityLevel;
  readonly comparedAttributes: readonly EquipmentDNAAttributeComparison[];
  readonly specificationChecks: readonly EquipmentDNASpecificationCheck[];
  readonly alignedCount: number;
  readonly minorDifferenceCount: number;
  readonly materialDifferenceCount: number;
  readonly incomparableCount: number;
  readonly overallStatus: "aligned" | "review_recommended" | "material_disagreement" | "insufficient_data";
  readonly reasons: readonly string[];
};

export type EquipmentDNASpecificationCatalog = {
  readonly length?: number;
  readonly weight?: number;
  readonly drop?: number;
  readonly certification?: string;
  readonly barrelDiameter?: number;
};

const supportOrdinalToNumeric = {
  very_low: 10,
  low: 30,
  moderate: 50,
  high: 70,
  very_high: 90
} as const;

const swingEffortOrdinalToNumeric = {
  very_easy: 10,
  easy: 30,
  moderate: 50,
  demanding: 70,
  very_demanding: 90
} as const;

const behaviorComparisonRules = [
  ["bat_control_support", "batControl", "direct support ordinal midpoint comparison"],
  ["swing_effort", "swingWeight", "direct demand comparison; legacy swingWeight is treated as demand because live recommendation code inversely scores it for manageability"],
  ["forgiveness", "barrelForgiveness", "direct support ordinal midpoint comparison"],
  ["sweet_spot_support", "sweetSpotSize", "direct support ordinal midpoint comparison"],
  ["power_potential", "powerPotential", "direct support ordinal midpoint comparison"],
  ["balance_profile", "balance", "incomparable; canonical balance profile is directional feel while legacy balance score is support-oriented"],
  ["confidence_building_potential", "confidenceBuilding", "incomparable; experimental relational candidate is not trusted as intrinsic profile fact"],
  ["transition_difficulty", "transitionFriendliness", "incomparable; experimental relational transition difficulty is not equivalent to legacy transition friendliness"]
] as const satisfies readonly (readonly [EquipmentDNAAttributeKey, keyof LegacyEquipmentDNAComparisonProfile["scores"], string])[];

export function adaptLegacyEquipmentDNAProfile(profile: EquipmentDNAProfile): LegacyEquipmentDNAComparisonProfile {
  return {
    equipmentId: profile.equipmentId,
    equipmentVariantId: profile.variantId,
    scores: {
      batControl: profile.scores.batControl,
      swingWeight: profile.scores.swingWeight,
      barrelForgiveness: profile.scores.barrelForgiveness,
      sweetSpotSize: profile.scores.sweetSpotSize,
      powerPotential: profile.scores.powerPotential,
      balance: profile.scores.balance,
      confidenceBuilding: profile.scores.confidenceBuilding,
      transitionFriendliness: profile.scores.transitionFriendliness
    },
    completeness: profile.profileCompleteness,
    confidence: profile.evidenceConfidence.score,
    sourceProfileId: profile.sourceProfileId
  };
}

export function ordinalToNumericComparisonValue(
  key: EquipmentDNAAttributeKey,
  value: EquipmentDNAAttributeNormalizedValue
): number {
  if (key === "swing_effort") {
    if (typeof value === "string" && value in swingEffortOrdinalToNumeric) {
      return swingEffortOrdinalToNumeric[value as keyof typeof swingEffortOrdinalToNumeric];
    }
    throw new Error(`Unsupported swing-effort ordinal value: ${String(value)}.`);
  }
  if (typeof value === "string" && value in supportOrdinalToNumeric) {
    return supportOrdinalToNumeric[value as keyof typeof supportOrdinalToNumeric];
  }
  throw new Error(`Unsupported ordinal comparison value for ${key}: ${String(value)}.`);
}

export function compareCanonicalAndLegacyEquipmentDNA(input: {
  readonly canonicalProfile: CanonicalEquipmentDNAProfile;
  readonly legacyProfile?: LegacyEquipmentDNAComparisonProfile;
  readonly catalog: EquipmentDNASpecificationCatalog;
}): EquipmentDNAShadowComparisonResult {
  const reasons: string[] = [
    `shadow comparison ${EQUIPMENT_DNA_SHADOW_COMPARISON_VERSION}`,
    `ordinal comparison ${EQUIPMENT_ORDINAL_TO_NUMERIC_COMPARISON_VERSION}`
  ];
  const specificationChecks = compareSpecifications(input.canonicalProfile, input.catalog);

  if (!input.legacyProfile) {
    return baseResult(input.canonicalProfile, specificationChecks, [], "insufficient_data", [
      ...reasons,
      "Legacy Equipment DNA profile is missing."
    ]);
  }

  const comparedAttributes = behaviorComparisonRules.map(([canonicalKey, legacyField, strategy]) =>
    compareBehaviorAttribute(input.canonicalProfile, input.legacyProfile as LegacyEquipmentDNAComparisonProfile, canonicalKey, legacyField, strategy)
  );
  const alignedCount = comparedAttributes.filter((item) => item.status === "aligned").length;
  const minorDifferenceCount = comparedAttributes.filter((item) => item.status === "minor_difference").length;
  const materialDifferenceCount = comparedAttributes.filter((item) => item.status === "material_difference").length;
  const incomparableCount = comparedAttributes.filter((item) => item.status === "incomparable").length;
  const hasSpecificationProblem = specificationChecks.some((check) => check.status !== "match");
  const comparableCount = comparedAttributes.length - incomparableCount;

  let overallStatus: EquipmentDNAShadowComparisonResult["overallStatus"] = "aligned";
  if (comparableCount === 0) overallStatus = "insufficient_data";
  else if (materialDifferenceCount > 0) overallStatus = "material_disagreement";
  else if (minorDifferenceCount > 0 || hasSpecificationProblem) overallStatus = "review_recommended";

  if (!input.canonicalProfile.readiness.ready) reasons.push("Canonical profile is not recommendation-ready.");
  if (hasSpecificationProblem) reasons.push("One or more canonical specification values do not match catalog values.");
  if (materialDifferenceCount > 0) reasons.push("At least one behavioral attribute has a material disagreement.");
  if (minorDifferenceCount > 0) reasons.push("At least one behavioral attribute has a minor difference.");
  if (incomparableCount > 0) reasons.push("Experimental or semantically ambiguous attributes were reported as incomparable.");
  if (overallStatus === "aligned") reasons.push("Comparable canonical and legacy values are aligned within thresholds.");

  return {
    ...baseResult(input.canonicalProfile, specificationChecks, comparedAttributes, overallStatus, reasons),
    alignedCount,
    minorDifferenceCount,
    materialDifferenceCount,
    incomparableCount
  };
}

function baseResult(
  canonicalProfile: CanonicalEquipmentDNAProfile,
  specificationChecks: readonly EquipmentDNASpecificationCheck[],
  comparedAttributes: readonly EquipmentDNAAttributeComparison[],
  overallStatus: EquipmentDNAShadowComparisonResult["overallStatus"],
  reasons: readonly string[]
): EquipmentDNAShadowComparisonResult {
  return {
    version: EQUIPMENT_DNA_SHADOW_COMPARISON_VERSION,
    equipmentId: canonicalProfile.equipmentId,
    equipmentVariantId: canonicalProfile.equipmentVariantId,
    equipmentName: canonicalProfile.equipmentName,
    canonicalProfileReady: canonicalProfile.readiness.ready,
    canonicalMaturity: canonicalProfile.maturity,
    comparedAttributes,
    specificationChecks,
    alignedCount: comparedAttributes.filter((item) => item.status === "aligned").length,
    minorDifferenceCount: comparedAttributes.filter((item) => item.status === "minor_difference").length,
    materialDifferenceCount: comparedAttributes.filter((item) => item.status === "material_difference").length,
    incomparableCount: comparedAttributes.filter((item) => item.status === "incomparable").length,
    overallStatus,
    reasons
  };
}

function compareBehaviorAttribute(
  canonicalProfile: CanonicalEquipmentDNAProfile,
  legacyProfile: LegacyEquipmentDNAComparisonProfile,
  canonicalKey: EquipmentDNAAttributeKey,
  legacyField: keyof LegacyEquipmentDNAComparisonProfile["scores"],
  strategy: string
): EquipmentDNAAttributeComparison {
  const canonical = canonicalProfile.attributes.find((attribute) => attribute.key === canonicalKey);
  const legacyValue = legacyProfile.scores[legacyField];

  if (canonicalKey === "transition_difficulty" || canonicalKey === "confidence_building_potential" || canonicalKey === "balance_profile") {
    return {
      canonicalKey,
      legacyField,
      canonicalValue: canonical?.value,
      legacyValue,
      status: "incomparable",
      comparisonStrategy: strategy,
      explanation: "This mapping is observed but excluded from alignment status because the canonical attribute is experimental or semantically different."
    };
  }
  if (!canonical) {
    return { canonicalKey, legacyField, legacyValue, status: "missing_canonical", comparisonStrategy: strategy, explanation: `Canonical ${canonicalKey} evaluation is missing.` };
  }
  if (legacyValue === undefined) {
    return { canonicalKey, legacyField, canonicalValue: canonical.value, status: "missing_legacy", comparisonStrategy: strategy, explanation: `Legacy ${legacyField} score is missing and was not converted to zero.` };
  }

  const canonicalNumericEquivalent = ordinalToNumericComparisonValue(canonicalKey, canonical.value);
  const normalizedDifference = Math.abs(canonicalNumericEquivalent - legacyValue);
  return {
    canonicalKey,
    legacyField,
    canonicalValue: canonical.value,
    canonicalNumericEquivalent,
    legacyValue,
    normalizedDifference,
    status: classifyDifference(normalizedDifference),
    comparisonStrategy: strategy,
    explanation: `${canonicalKey} canonical value ${canonical.value} maps to ${canonicalNumericEquivalent}; legacy ${legacyField} is ${legacyValue}. Difference ${normalizedDifference}.`
  };
}

function classifyDifference(difference: number): EquipmentDNAAttributeComparisonStatus {
  if (difference <= EQUIPMENT_DNA_SHADOW_DIFFERENCE_THRESHOLDS.alignedMaximum) return "aligned";
  if (difference <= EQUIPMENT_DNA_SHADOW_DIFFERENCE_THRESHOLDS.minorMaximum) return "minor_difference";
  return "material_difference";
}

function compareSpecifications(
  canonicalProfile: CanonicalEquipmentDNAProfile,
  catalog: EquipmentDNASpecificationCatalog
): EquipmentDNASpecificationCheck[] {
  return [
    specificationCheck(canonicalProfile, "length", catalog.length, 0.01),
    specificationCheck(canonicalProfile, "weight", catalog.weight, 0.01),
    specificationCheck(canonicalProfile, "drop", catalog.drop, 0),
    specificationCheck(canonicalProfile, "certification", catalog.certification, 0),
    specificationCheck(canonicalProfile, "barrel_diameter", catalog.barrelDiameter, 0.01)
  ];
}

function specificationCheck(
  canonicalProfile: CanonicalEquipmentDNAProfile,
  key: EquipmentDNASpecificationCheck["key"],
  catalogValue: unknown,
  tolerance: number
): EquipmentDNASpecificationCheck {
  const canonicalValue = canonicalProfile.attributes.find((attribute) => attribute.key === key)?.value;
  if (canonicalValue === undefined || catalogValue === undefined || catalogValue === null) {
    return { key, canonicalValue, catalogValue, status: "missing", explanation: `${key} is missing from ${canonicalValue === undefined ? "canonical profile" : "catalog"}.` };
  }
  const match = typeof canonicalValue === "number" && typeof catalogValue === "number"
    ? Math.abs(canonicalValue - catalogValue) <= tolerance
    : String(canonicalValue) === String(catalogValue);
  return {
    key,
    canonicalValue,
    catalogValue,
    status: match ? "match" : "mismatch",
    explanation: match ? `${key} canonical value matches catalog value.` : `${key} canonical value does not match catalog value.`
  };
}
