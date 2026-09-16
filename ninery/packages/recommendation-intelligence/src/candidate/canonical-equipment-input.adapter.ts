import {
  CANONICAL_EQUIPMENT_DNA_ADMISSION_POLICY_VERSION,
  type CanonicalEquipmentDNAAdmissionDecision,
  type CanonicalEquipmentDNAProfile,
  type EquipmentDNAAttributeKey
} from "@ninery/equipment-intelligence";
import type { EquipmentDNAAttribute, EquipmentDNAProfile, EquipmentDNAScores } from "@ninery/equipment-intelligence";
import {
  CANONICAL_CANDIDATE_INPUT_MAPPING_VERSION,
  type CanonicalCandidateAdaptedEquipmentInput,
  type CanonicalCandidateAdmissionFailure,
  type CanonicalCandidateMappedAttribute,
  type CanonicalCandidateMappingFailure
} from "./canonical-candidate.types.js";

export class CanonicalCandidateAdmissionError extends Error {
  constructor(readonly failures: readonly CanonicalCandidateAdmissionFailure[]) {
    super(failures.map((failure) => failure.reason).join(" "));
  }
}

export class CanonicalCandidateMappingError extends Error {
  constructor(readonly failures: readonly CanonicalCandidateMappingFailure[]) {
    super(failures.map((failure) => failure.reason).join(" "));
  }
}

const requiredMappings = [
  ["bat_control_support", "batControl", "five-level support ordinal mapped to Recommendation Intelligence 0-100 support score"],
  ["swing_effort", "swingWeight", "direct demand mapping; live scoring treats swingWeight as demand and inverts it for manageability"],
  ["forgiveness", "barrelForgiveness", "five-level support ordinal mapped to Recommendation Intelligence 0-100 support score"],
  ["sweet_spot_support", "sweetSpotSize", "five-level support ordinal mapped to Recommendation Intelligence 0-100 support score"],
  ["power_potential", "powerPotential", "five-level support ordinal mapped to Recommendation Intelligence 0-100 support score"]
] as const satisfies readonly (readonly [EquipmentDNAAttributeKey, EquipmentDNAAttribute, string])[];

const unsupportedMappings = [
  "balance_profile",
  "confidence_building_potential",
  "transition_difficulty"
] as const satisfies readonly EquipmentDNAAttributeKey[];

const fiveLevelSupportToScore = {
  very_low: 10,
  low: 30,
  moderate: 50,
  high: 70,
  very_high: 90
} as const;

const swingEffortToDemandScore = {
  very_easy: 10,
  easy: 30,
  moderate: 50,
  demanding: 70,
  very_demanding: 90
} as const;

export function enforceCanonicalCandidateAdmission(input: {
  readonly canonicalProfile: CanonicalEquipmentDNAProfile;
  readonly admissionDecision?: CanonicalEquipmentDNAAdmissionDecision;
}): CanonicalCandidateAdmissionFailure[] {
  const profile = input.canonicalProfile;
  const decision = input.admissionDecision;
  if (!decision) {
    return [{
      equipmentId: profile.equipmentId,
      equipmentVariantId: profile.equipmentVariantId,
      code: "missing_admission",
      reason: `Missing admission decision for ${profile.equipmentId}.`
    }];
  }
  const failures: CanonicalCandidateAdmissionFailure[] = [];
  if (decision.equipmentId !== profile.equipmentId || decision.equipmentVariantId !== profile.equipmentVariantId) {
    failures.push({
      equipmentId: profile.equipmentId,
      equipmentVariantId: profile.equipmentVariantId,
      code: "mismatched_admission",
      reason: `Admission decision target does not match canonical profile ${profile.equipmentId}.`
    });
  }
  if (decision.outcome !== "approved_for_internal_candidate" || !decision.eligibleForInternalCandidate) {
    failures.push({
      equipmentId: profile.equipmentId,
      equipmentVariantId: profile.equipmentVariantId,
      code: decision.eligibleForShadow ? "shadow_only_admission" : "blocked_admission",
      reason: `Admission outcome ${decision.outcome} is not approved for internal candidate use.`
    });
  }
  if (decision.liveRecommendationUseAllowed !== false) {
    failures.push({
      equipmentId: profile.equipmentId,
      equipmentVariantId: profile.equipmentVariantId,
      code: "stale_admission",
      reason: "Admission decision must explicitly keep live recommendation use disabled."
    });
  }
  if (decision.policyVersion !== CANONICAL_EQUIPMENT_DNA_ADMISSION_POLICY_VERSION) {
    failures.push({
      equipmentId: profile.equipmentId,
      equipmentVariantId: profile.equipmentVariantId,
      code: "unsupported_admission_version",
      reason: `Unsupported admission policy version ${decision.policyVersion}.`
    });
  }
  if (decision.versionAssessment.actual.canonicalProfileVersion !== profile.version) {
    failures.push({
      equipmentId: profile.equipmentId,
      equipmentVariantId: profile.equipmentVariantId,
      code: "stale_admission",
      reason: "Admission decision was created for a different canonical profile version."
    });
  }
  return failures;
}

export function adaptCanonicalEquipmentDNAForRecommendation(input: {
  readonly canonicalProfile: CanonicalEquipmentDNAProfile;
  readonly admissionDecision: CanonicalEquipmentDNAAdmissionDecision;
  readonly legacyBaseline: EquipmentDNAProfile;
}): CanonicalCandidateAdaptedEquipmentInput {
  const admissionFailures = enforceCanonicalCandidateAdmission({
    canonicalProfile: input.canonicalProfile,
    admissionDecision: input.admissionDecision
  });
  if (admissionFailures.length > 0) throw new CanonicalCandidateAdmissionError(admissionFailures);

  const scores: EquipmentDNAScores = {};
  const mappedAttributes: CanonicalCandidateMappedAttribute[] = [];
  const failures: CanonicalCandidateMappingFailure[] = [];

  for (const [canonicalKey, targetRecommendationField, strategy] of requiredMappings) {
    const attribute = input.canonicalProfile.attributes.find((candidate) => candidate.key === canonicalKey);
    if (!attribute) {
      failures.push({
        equipmentId: input.canonicalProfile.equipmentId,
        equipmentVariantId: input.canonicalProfile.equipmentVariantId,
        canonicalKey,
        targetRecommendationField,
        reason: `Missing required canonical attribute ${canonicalKey}.`
      });
      continue;
    }
    const candidateNumericValue = canonicalValueToRecommendationScore(canonicalKey, attribute.value);
    scores[targetRecommendationField] = candidateNumericValue;
    mappedAttributes.push({
      equipmentId: input.canonicalProfile.equipmentId,
      equipmentVariantId: input.canonicalProfile.equipmentVariantId,
      canonicalKey,
      canonicalValue: attribute.value,
      candidateNumericValue,
      targetRecommendationField,
      mappingVersion: CANONICAL_CANDIDATE_INPUT_MAPPING_VERSION,
      strategy,
      confidence: attribute.confidence
    });
  }

  if (failures.length > 0) throw new CanonicalCandidateMappingError(failures);

  const selectedVariant = variantFromCanonical(input.canonicalProfile, input.legacyBaseline);
  const warnings = unsupportedMappings.map(
    (key) => `${key} is not mapped into Recommendation Intelligence candidate input because its semantic contract is ambiguous or experimental.`
  );

  return {
    equipment: {
      ...input.legacyBaseline,
      variantId: input.canonicalProfile.equipmentVariantId ?? input.legacyBaseline.variantId,
      sourceLevel: "model",
      selectedVariant,
      sourceProfileId: `canonical-candidate:${input.canonicalProfile.equipmentId}:${input.canonicalProfile.equipmentVariantId ?? "model"}:${input.canonicalProfile.version}:${CANONICAL_CANDIDATE_INPUT_MAPPING_VERSION}`,
      profileVersion: Number(input.canonicalProfile.version.replace(/\D/g, "")) || 1,
      profileCompleteness: 100,
      evidenceConfidence: canonicalEvidenceConfidence(input.canonicalProfile),
      scores,
      missingCharacteristics: [],
      eligibility: { eligible: true, reasons: [] },
      explanations: []
    },
    mappedAttributes,
    warnings
  };
}

function canonicalValueToRecommendationScore(key: EquipmentDNAAttributeKey, value: unknown): number {
  if (key === "swing_effort") {
    if (typeof value === "string" && value in swingEffortToDemandScore) {
      return swingEffortToDemandScore[value as keyof typeof swingEffortToDemandScore];
    }
    throw new CanonicalCandidateMappingError([{ equipmentId: "unknown", canonicalKey: key, targetRecommendationField: "swingWeight", reason: `Invalid swing_effort value ${String(value)}.` }]);
  }
  if (typeof value === "string" && value in fiveLevelSupportToScore) {
    return fiveLevelSupportToScore[value as keyof typeof fiveLevelSupportToScore];
  }
  throw new CanonicalCandidateMappingError([{ equipmentId: "unknown", canonicalKey: key, targetRecommendationField: "unknown", reason: `Invalid ordinal value for ${key}: ${String(value)}.` }]);
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

function numberAttribute(profile: CanonicalEquipmentDNAProfile, key: EquipmentDNAAttributeKey): number | undefined {
  const value = profile.attributes.find((attribute) => attribute.key === key)?.value;
  return typeof value === "number" ? value : undefined;
}

function canonicalEvidenceConfidence(profile: CanonicalEquipmentDNAProfile) {
  const confidenceScore = profile.attributes.length === 0
    ? 0
    : Math.round(profile.attributes.reduce((sum, attribute) => sum + confidenceToScore(attribute.confidence), 0) / profile.attributes.length);
  return {
    score: confidenceScore,
    band: confidenceScore >= 90 ? "validated" as const : confidenceScore >= 75 ? "high" as const : confidenceScore >= 55 ? "medium" as const : "low" as const
  };
}

function confidenceToScore(confidence: CanonicalEquipmentDNAProfile["attributes"][number]["confidence"]): number {
  switch (confidence) {
    case "validated":
      return 95;
    case "high":
      return 85;
    case "moderate":
      return 70;
    case "estimated":
      return 40;
  }
}
