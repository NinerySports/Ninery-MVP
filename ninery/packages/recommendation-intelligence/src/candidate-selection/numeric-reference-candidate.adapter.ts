import type { CanonicalEquipmentDNAProfile, EquipmentDNAProfile } from "@ninery/equipment-intelligence";
import {
  NUMERIC_REFERENCE_CANDIDATE_INPUT_MAPPING_VERSION,
  type CanonicalCandidateAttributeSourceSelectionResult,
  type CanonicalSelectedSourceTrace,
  type NumericReferenceCandidateAdaptedEquipmentInput
} from "./canonical-attribute-source-selection.types.js";
import { bridgeCanonicalBalanceToRecommendationInput } from "./canonical-balance-recommendation-bridge.js";

export class NumericReferenceCandidateAdapterError extends Error {}

export function adaptCanonicalEquipmentDNAUsingSelectedSources(input: {
  readonly canonicalProfile: CanonicalEquipmentDNAProfile;
  readonly sourceSelection: CanonicalCandidateAttributeSourceSelectionResult;
  readonly legacyBaseline: EquipmentDNAProfile;
}): NumericReferenceCandidateAdaptedEquipmentInput {
  const blocked = input.sourceSelection.decisions.filter((decision) => !decision.candidateInputAllowed);
  if (!input.sourceSelection.candidateInputAllowed || blocked.length > 0) {
    throw new NumericReferenceCandidateAdapterError(`Canonical source selection blocked candidate input: ${blocked.map((item) => item.attributeKey).join(", ")}`);
  }

  const scores: EquipmentDNAProfile["scores"] = {};

  const selectedSources: CanonicalSelectedSourceTrace[] = [];
  for (const decision of input.sourceSelection.decisions) {
    if (decision.selectedSource === "unavailable" || decision.selectedNumericValue === undefined || decision.ordinalProjectedValue === undefined || decision.canonicalOrdinalValue === undefined) {
      throw new NumericReferenceCandidateAdapterError(`Missing selected source value for ${decision.attributeKey}.`);
    }
    const bridge = decision.attributeKey === "balance_profile" && decision.targetRecommendationField === "balance"
      ? bridgeCanonicalBalanceToRecommendationInput(decision.selectedNumericValue)
      : undefined;
    const selectedValue = bridge?.recommendationInputValue ?? decision.selectedNumericValue;
    scores[decision.targetRecommendationField] = selectedValue;
    selectedSources.push({
      canonicalKey: decision.attributeKey,
      recommendationField: decision.targetRecommendationField,
      selectedSource: decision.selectedSource,
      selectedValue,
      ordinalValue: decision.canonicalOrdinalValue,
      ordinalProjectedValue: decision.ordinalProjectedValue,
      numericReferenceValue: decision.numericReference?.value,
      canonicalValueBeforeRecommendationBridge: bridge?.canonicalValue,
      recommendationBridgeValue: bridge?.recommendationInputValue,
      recommendationBridgeStrategy: bridge?.strategy,
      recommendationBridgeVersion: bridge?.version,
      recommendationBridgeExplanation: bridge?.explanation,
      selectionOutcome: decision.outcome,
      selectionPolicyVersion: decision.policyVersion,
      numericReferenceVersion: decision.numericReference?.mappingVersion
    });
  }

  return {
    equipment: {
      ...input.legacyBaseline,
      variantId: input.canonicalProfile.equipmentVariantId ?? input.legacyBaseline.variantId,
      sourceLevel: "model",
      selectedVariant: variantFromCanonical(input.canonicalProfile, input.legacyBaseline),
      sourceProfileId: `canonical-candidate-numeric-reference:${input.canonicalProfile.equipmentId}:${input.canonicalProfile.equipmentVariantId ?? "model"}:${input.canonicalProfile.version}:${NUMERIC_REFERENCE_CANDIDATE_INPUT_MAPPING_VERSION}`,
      profileVersion: Number(input.canonicalProfile.version.replace(/\D/g, "")) || 1,
      profileCompleteness: 100,
      evidenceConfidence: input.legacyBaseline.evidenceConfidence,
      scores,
      missingCharacteristics: missingCharacteristics(input.legacyBaseline, selectedSources),
      eligibility: { eligible: true, reasons: [] },
      explanations: []
    },
    selectedSources,
    warnings: input.sourceSelection.warnings
  };
}

function missingCharacteristics(
  baseline: EquipmentDNAProfile,
  selectedSources: readonly CanonicalSelectedSourceTrace[]
): EquipmentDNAProfile["missingCharacteristics"] {
  const missing = new Set<EquipmentDNAProfile["missingCharacteristics"][number]>(
    baseline.missingCharacteristics.filter((item) => !selectedSources.some((source) => source.recommendationField === item))
  );
  for (const optional of ["balance", "confidenceBuilding", "transitionFriendliness"] as const) {
    if (!selectedSources.some((source) => source.recommendationField === optional)) missing.add(optional);
    else missing.delete(optional);
  }
  return [...missing].sort();
}

function variantFromCanonical(profile: CanonicalEquipmentDNAProfile, baseline: EquipmentDNAProfile) {
  const length = numberAttribute(profile, "length") ?? baseline.selectedVariant?.lengthInches;
  const weight = numberAttribute(profile, "weight") ?? baseline.selectedVariant?.weightOunces;
  const drop = numberAttribute(profile, "drop") ?? baseline.selectedVariant?.dropWeight;
  return {
    ...(baseline.selectedVariant ?? baseline.availableVariants.find((variant) => variant.id === profile.equipmentVariantId) ?? { id: profile.equipmentVariantId ?? "canonical-variant" }),
    id: profile.equipmentVariantId ?? baseline.selectedVariant?.id ?? "canonical-variant",
    lengthInches: length,
    weightOunces: weight,
    dropWeight: drop
  };
}

function numberAttribute(profile: CanonicalEquipmentDNAProfile, key: string): number | undefined {
  const value = profile.attributes.find((attribute) => attribute.key === key)?.value;
  return typeof value === "number" ? value : undefined;
}
