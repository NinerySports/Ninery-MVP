import {
  CANONICAL_EQUIPMENT_DNA_ADMISSION_POLICY_VERSION,
  CANONICAL_EQUIPMENT_DNA_PROFILE_VERSION,
  validateEquipmentDNANumericReference,
  type CanonicalEquipmentDNAAdmissionDecision,
  type CanonicalEquipmentDNAAttributeValue,
  type CanonicalEquipmentDNAProfile,
  type EquipmentDNAAttributeKey,
  type EquipmentDNANumericReference,
  type EquipmentDNANumericReferenceCandidate
} from "@ninery/equipment-intelligence";
import type { EquipmentDNAAttribute } from "@ninery/equipment-intelligence";
import {
  CANONICAL_ATTRIBUTE_SOURCE_SELECTION_DECISION_VERSION,
  CANONICAL_ATTRIBUTE_SOURCE_SELECTION_POLICY_VERSION,
  type CanonicalAttributeSourceSelectionDecision,
  type CanonicalAttributeSourceSelectionFinding,
  type CanonicalAttributeSourceSelectionPolicy,
  type CanonicalCandidateAttributeSourceSelectionResult
} from "./canonical-attribute-source-selection.types.js";
import {
  canonicalAttributeSourceSelectionPolicy,
  canonicalAttributeSourceSelectionPolicyWithBalance,
  meetsMinimumEquipmentAttributeConfidence
} from "./canonical-attribute-source-selection.policy.js";

export const canonicalSourceSelectionMappings = [
  ["bat_control_support", "batControl"],
  ["swing_effort", "swingWeight"],
  ["forgiveness", "barrelForgiveness"],
  ["sweet_spot_support", "sweetSpotSize"],
  ["power_potential", "powerPotential"]
] as const satisfies readonly (readonly [EquipmentDNAAttributeKey, EquipmentDNAAttribute])[];

export const canonicalSourceSelectionMappingsWithBalance = [
  ...canonicalSourceSelectionMappings,
  ["balance_profile", "balance"]
] as const satisfies readonly (readonly [EquipmentDNAAttributeKey, EquipmentDNAAttribute])[];

const relationalExcluded = ["transition_difficulty", "confidence_building_potential"] as const;

const fiveLevelSupportToScore = { very_low: 10, low: 30, moderate: 50, high: 70, very_high: 90 } as const;
const swingEffortToDemandScore = { very_easy: 10, easy: 30, moderate: 50, demanding: 70, very_demanding: 90 } as const;
const balanceProfileToEndLoadedScore = { very_balanced: 10, balanced: 30, slightly_end_loaded: 50, end_loaded: 70, very_end_loaded: 90 } as const;

export function selectCanonicalCandidateAttributeSource(input: {
  readonly canonicalAttribute: CanonicalEquipmentDNAAttributeValue;
  readonly numericReference?: EquipmentDNANumericReference | EquipmentDNANumericReferenceCandidate;
  readonly admissionDecision: CanonicalEquipmentDNAAdmissionDecision;
  readonly targetRecommendationField: EquipmentDNAAttribute;
  readonly policy?: CanonicalAttributeSourceSelectionPolicy;
  readonly evaluatedAt?: Date;
}): CanonicalAttributeSourceSelectionDecision {
  const policy = input.policy ?? canonicalAttributeSourceSelectionPolicy;
  const evaluatedAt = input.evaluatedAt ?? new Date();
  const reasons: CanonicalAttributeSourceSelectionFinding[] = [];
  const warnings: CanonicalAttributeSourceSelectionFinding[] = [];
  const base = {
    version: CANONICAL_ATTRIBUTE_SOURCE_SELECTION_DECISION_VERSION,
    policyVersion: policy.version,
    equipmentId: input.admissionDecision.equipmentId,
    equipmentVariantId: input.admissionDecision.equipmentVariantId,
    attributeKey: input.canonicalAttribute.key,
    targetRecommendationField: input.targetRecommendationField,
    canonicalOrdinalValue: input.canonicalAttribute.value,
    evaluatedAt
  } as const;

  const admissionFinding = admissionBlocker(input.admissionDecision, input.canonicalAttribute);
  if (admissionFinding) {
    return blocked(base, "blocked_no_safe_source", reasons, warnings, admissionFinding);
  }

  if (!policy.supportedAttributes.includes(input.canonicalAttribute.key)) {
    const code = relationalExcluded.includes(input.canonicalAttribute.key as (typeof relationalExcluded)[number]) ? "ATTRIBUTE_RELATIONAL_EXCLUDED" : "ATTRIBUTE_UNSUPPORTED";
    return blocked(base, "blocked_unsupported_attribute", reasons, warnings, finding(code, "blocking", `${input.canonicalAttribute.key} is not supported by policy ${policy.version}.`));
  }
  reasons.push(finding("ATTRIBUTE_SUPPORTED", "info", `${input.canonicalAttribute.key} is supported.`));

  const ordinalProjectedValue = ordinalProjection(input.canonicalAttribute.key, input.canonicalAttribute.value);
  if (ordinalProjectedValue === undefined) {
    return blocked(base, "blocked_missing_ordinal_value", reasons, warnings, finding("NO_SAFE_INPUT_SOURCE", "blocking", "Canonical ordinal value could not be projected."));
  }
  reasons.push(finding("ORDINAL_PROJECTION_AVAILABLE", "info", "Ordinal projection is available.", { ordinalProjectedValue }));

  const reference = input.numericReference;
  if (!reference) {
    warnings.push(finding("NUMERIC_REFERENCE_MISSING", "warning", "Numeric reference is missing."));
    return fallbackOrBlock({ base, reasons, warnings, ordinalProjectedValue, policy, reason: "missing" });
  }
  reasons.push(finding("NUMERIC_REFERENCE_AVAILABLE", "info", "Numeric reference is available."));

  const numericSummaryBase = summarizeNumericReference(reference);
  const numericSummary: CanonicalAttributeSourceSelectionDecision["numericReference"] = numericSummaryBase
    ? { ...numericSummaryBase, validationStatus: "invalid" }
    : undefined;
  const minimum = policy.numericReference.minimumConfidenceByAttribute[input.canonicalAttribute.key] ?? "moderate";
  if (!meetsMinimumEquipmentAttributeConfidence(reference.confidence, minimum)) {
    return fallbackOrBlock({ base, reasons, warnings: [...warnings, finding("NUMERIC_REFERENCE_CONFIDENCE_INSUFFICIENT", "warning", `Confidence ${reference.confidence} does not meet ${minimum}.`)], ordinalProjectedValue, policy, reason: "confidence", numericReference: numericSummary });
  }
  const validation = validateEquipmentDNANumericReference({
    attributeKey: input.canonicalAttribute.key,
    ordinalValue: input.canonicalAttribute.value,
    numericReference: reference,
    previousConfidence: input.canonicalAttribute.confidence,
    confidenceChangeExplanation: input.canonicalAttribute.key === "balance_profile"
      ? "Balance numeric reference is legacy-derived and intentionally capped below objective-measurement confidence."
      : undefined
  });
  if (!validation.valid) {
    warnings.push(finding("NUMERIC_REFERENCE_INVALID", "warning", validation.reasons.join(" ")));
    if (validation.reasons.some((reason) => reason.toLowerCase().includes("inconsistent"))) {
      warnings.push(finding("NUMERIC_REFERENCE_ORDINAL_INCONSISTENT", "warning", "Numeric reference is not ordinal-consistent."));
      return fallbackOrBlock({ base, reasons, warnings, ordinalProjectedValue, policy, reason: "invalid", numericReference: numericSummary });
    }
    return fallbackOrBlock({ base, reasons, warnings, ordinalProjectedValue, policy, reason: "invalid", numericReference: numericSummary });
  }
  reasons.push(finding("NUMERIC_REFERENCE_VALID", "info", "Numeric reference is valid."));
  reasons.push(finding("NUMERIC_REFERENCE_ORDINAL_CONSISTENT", "info", "Numeric reference is ordinal-consistent."));

  if (!policy.numericReference.supportedMethods.includes(reference.referenceMethod as EquipmentDNANumericReference["referenceMethod"])) {
    return fallbackOrBlock({ base, reasons, warnings: [...warnings, finding("NUMERIC_REFERENCE_METHOD_UNSUPPORTED", "warning", `Unsupported method ${reference.referenceMethod}.`)], ordinalProjectedValue, policy, reason: "method", numericReference: numericSummary });
  }
  reasons.push(finding("NUMERIC_REFERENCE_METHOD_SUPPORTED", "info", "Numeric reference method is supported."));
  if (!policy.numericReference.supportedVersions.includes(reference.mappingVersion)) {
    return fallbackOrBlock({ base, reasons, warnings: [...warnings, finding("NUMERIC_REFERENCE_VERSION_UNSUPPORTED", "warning", `Unsupported numeric reference version ${reference.mappingVersion}.`)], ordinalProjectedValue, policy, reason: "version", numericReference: numericSummary });
  }
  reasons.push(finding("NUMERIC_REFERENCE_VERSION_SUPPORTED", "info", "Numeric reference version is supported."));
  reasons.push(finding("NUMERIC_REFERENCE_CONFIDENCE_SUFFICIENT", "info", "Numeric reference confidence is sufficient."));
  reasons.push(finding("NUMERIC_REFERENCE_SELECTED", "info", "Numeric reference selected."));
  return {
    ...base,
    outcome: "numeric_reference_selected",
    selectedSource: "numeric_reference",
    selectedNumericValue: reference.numericValue,
    ordinalProjectedValue,
    numericReference: numericSummary ? { ...numericSummary, validationStatus: "valid" } : undefined,
    reasons,
    warnings,
    fallbackUsed: false,
    candidateInputAllowed: true
  };
}

export function selectCanonicalCandidateAttributeSources(input: {
  readonly canonicalProfile: CanonicalEquipmentDNAProfile;
  readonly admissionDecision: CanonicalEquipmentDNAAdmissionDecision;
  readonly numericReferences: readonly EquipmentDNANumericReference[];
  readonly policy?: CanonicalAttributeSourceSelectionPolicy;
  readonly evaluatedAt?: Date;
}): CanonicalCandidateAttributeSourceSelectionResult {
  const policy = input.policy ?? canonicalAttributeSourceSelectionPolicy;
  return selectCanonicalCandidateAttributeSourcesForMappings({
    ...input,
    policy,
    mappings: canonicalSourceSelectionMappings
  });
}

export function selectCanonicalCandidateAttributeSourcesWithBalance(input: {
  readonly canonicalProfile: CanonicalEquipmentDNAProfile;
  readonly admissionDecision: CanonicalEquipmentDNAAdmissionDecision;
  readonly numericReferences: readonly EquipmentDNANumericReference[];
  readonly evaluatedAt?: Date;
}): CanonicalCandidateAttributeSourceSelectionResult {
  return selectCanonicalCandidateAttributeSourcesForMappings({
    ...input,
    policy: canonicalAttributeSourceSelectionPolicyWithBalance,
    mappings: canonicalSourceSelectionMappingsWithBalance
  });
}

function selectCanonicalCandidateAttributeSourcesForMappings(input: {
  readonly canonicalProfile: CanonicalEquipmentDNAProfile;
  readonly admissionDecision: CanonicalEquipmentDNAAdmissionDecision;
  readonly numericReferences: readonly EquipmentDNANumericReference[];
  readonly policy: CanonicalAttributeSourceSelectionPolicy;
  readonly mappings: readonly (readonly [EquipmentDNAAttributeKey, EquipmentDNAAttribute])[];
  readonly evaluatedAt?: Date;
}): CanonicalCandidateAttributeSourceSelectionResult {
  const policy = input.policy;
  if (input.admissionDecision.equipmentId !== input.canonicalProfile.equipmentId || input.admissionDecision.equipmentVariantId !== input.canonicalProfile.equipmentVariantId) {
    const decisions: CanonicalAttributeSourceSelectionDecision[] = input.mappings.map(([key, field]) => ({
      version: CANONICAL_ATTRIBUTE_SOURCE_SELECTION_DECISION_VERSION,
      policyVersion: policy.version,
      equipmentId: input.canonicalProfile.equipmentId,
      equipmentVariantId: input.canonicalProfile.equipmentVariantId,
      attributeKey: key,
      targetRecommendationField: field,
      outcome: "blocked_no_safe_source" as const,
      selectedSource: "unavailable" as const,
      reasons: [finding("ADMISSION_INVALID", "blocking", "Admission decision target does not match canonical profile.")],
      warnings: [],
      fallbackUsed: false,
      candidateInputAllowed: false,
      evaluatedAt: input.evaluatedAt ?? new Date()
    }));
    return selectionResult(input.canonicalProfile, decisions, policy);
  }
  const decisions = input.mappings.map(([key, field]) => {
    const attribute = input.canonicalProfile.attributes.find((candidate) => candidate.key === key);
    if (!attribute) return missingDecision(input, key, field, policy);
    return selectCanonicalCandidateAttributeSource({
      canonicalAttribute: attribute,
      numericReference: input.numericReferences.find((reference) => reference.sourceReference?.includes(keyToSourceHint(key)) || reference.sourceEvidenceRecordId?.includes(key)),
      admissionDecision: input.admissionDecision,
      targetRecommendationField: field,
      policy,
      evaluatedAt: input.evaluatedAt
    });
  });
  return selectionResult(input.canonicalProfile, decisions, policy);
}

function selectionResult(
  profile: CanonicalEquipmentDNAProfile,
  decisions: readonly CanonicalAttributeSourceSelectionDecision[],
  policy: CanonicalAttributeSourceSelectionPolicy
): CanonicalCandidateAttributeSourceSelectionResult {
  const blockedRequiredAttributes = decisions.filter((decision) => !decision.candidateInputAllowed).map((decision) => decision.attributeKey);
  const missingRequiredAttributes = policy.requiredCandidateAttributes.filter((key) => !decisions.some((decision) => decision.attributeKey === key));
  return {
    version: CANONICAL_ATTRIBUTE_SOURCE_SELECTION_DECISION_VERSION,
    policyVersion: policy.version,
    equipmentId: profile.equipmentId,
    equipmentVariantId: profile.equipmentVariantId,
    decisions,
    requiredAttributesComplete: missingRequiredAttributes.length === 0 && blockedRequiredAttributes.length === 0,
    selectedNumericReferenceCount: decisions.filter((decision) => decision.selectedSource === "numeric_reference").length,
    selectedOrdinalProjectionCount: decisions.filter((decision) => decision.selectedSource === "ordinal_projection").length,
    blockedAttributeCount: decisions.filter((decision) => !decision.candidateInputAllowed).length,
    missingRequiredAttributes,
    blockedRequiredAttributes,
    candidateInputAllowed: missingRequiredAttributes.length === 0 && blockedRequiredAttributes.length === 0,
    warnings: decisions.flatMap((decision) => decision.warnings.map((warning) => warning.message))
  };
}

export function ordinalProjection(key: EquipmentDNAAttributeKey, value: unknown): number | undefined {
  if (key === "swing_effort" && typeof value === "string" && value in swingEffortToDemandScore) return swingEffortToDemandScore[value as keyof typeof swingEffortToDemandScore];
  if (key === "balance_profile" && typeof value === "string" && value in balanceProfileToEndLoadedScore) return balanceProfileToEndLoadedScore[value as keyof typeof balanceProfileToEndLoadedScore];
  if (typeof value === "string" && value in fiveLevelSupportToScore) return fiveLevelSupportToScore[value as keyof typeof fiveLevelSupportToScore];
  return undefined;
}

function fallbackOrBlock(input: {
  readonly base: Omit<CanonicalAttributeSourceSelectionDecision, "outcome" | "selectedSource" | "reasons" | "warnings" | "fallbackUsed" | "candidateInputAllowed">;
  readonly reasons: CanonicalAttributeSourceSelectionFinding[];
  readonly warnings: CanonicalAttributeSourceSelectionFinding[];
  readonly ordinalProjectedValue: number;
  readonly policy: CanonicalAttributeSourceSelectionPolicy;
  readonly reason: "missing" | "invalid" | "confidence" | "version" | "method";
  readonly numericReference?: CanonicalAttributeSourceSelectionDecision["numericReference"];
}): CanonicalAttributeSourceSelectionDecision {
  const allowed =
    input.policy.ordinalFallback.allowedAttributes.includes(input.base.attributeKey) &&
    ((input.reason === "missing" && input.policy.ordinalFallback.allowedWhenReferenceMissing) ||
      (input.reason === "invalid" && input.policy.ordinalFallback.allowedWhenReferenceInvalid) ||
      (input.reason === "confidence" && input.policy.ordinalFallback.allowedWhenConfidenceInsufficient) ||
      (input.reason === "version" && input.policy.ordinalFallback.allowedWhenVersionUnsupported) ||
      (input.reason === "method" && input.policy.ordinalFallback.allowedWhenReferenceInvalid));
  if (!allowed) {
    return blocked(input.base, outcomeForReason(input.reason), input.reasons, input.warnings, finding("ORDINAL_FALLBACK_NOT_ALLOWED", "blocking", "Ordinal fallback is not allowed by policy."), input.numericReference);
  }
  const reasons = [...input.reasons, finding("ORDINAL_FALLBACK_ALLOWED", "info", "Ordinal fallback is allowed."), finding("ORDINAL_PROJECTION_SELECTED", "info", "Ordinal projection selected.")];
  return {
    ...input.base,
    outcome: "ordinal_projection_selected",
    selectedSource: "ordinal_projection",
    selectedNumericValue: input.ordinalProjectedValue,
    ordinalProjectedValue: input.ordinalProjectedValue,
    numericReference: input.numericReference,
    reasons,
    warnings: input.warnings,
    fallbackUsed: true,
    candidateInputAllowed: true
  };
}

function blocked(
  base: Omit<CanonicalAttributeSourceSelectionDecision, "outcome" | "selectedSource" | "reasons" | "warnings" | "fallbackUsed" | "candidateInputAllowed">,
  outcome: CanonicalAttributeSourceSelectionDecision["outcome"],
  reasons: CanonicalAttributeSourceSelectionFinding[],
  warnings: CanonicalAttributeSourceSelectionFinding[],
  blocker: CanonicalAttributeSourceSelectionFinding,
  numericReference?: CanonicalAttributeSourceSelectionDecision["numericReference"]
): CanonicalAttributeSourceSelectionDecision {
  return { ...base, outcome, selectedSource: "unavailable", numericReference, reasons: [...reasons, blocker, finding("NO_SAFE_INPUT_SOURCE", "blocking", "No safe input source is available.")], warnings, fallbackUsed: false, candidateInputAllowed: false };
}

function admissionBlocker(admission: CanonicalEquipmentDNAAdmissionDecision, attribute: CanonicalEquipmentDNAAttributeValue): CanonicalAttributeSourceSelectionFinding | undefined {
  if (admission.outcome !== "approved_for_internal_candidate" || !admission.eligibleForInternalCandidate || admission.liveRecommendationUseAllowed !== false) return finding("ADMISSION_INVALID", "blocking", "Admission is not approved for internal candidate use.");
  if (admission.policyVersion !== CANONICAL_EQUIPMENT_DNA_ADMISSION_POLICY_VERSION) return finding("ADMISSION_INVALID", "blocking", "Admission policy version is unsupported.");
  if (admission.versionAssessment.actual.canonicalProfileVersion !== CANONICAL_EQUIPMENT_DNA_PROFILE_VERSION) return finding("PROFILE_VERSION_MISMATCH", "blocking", "Admission was created for an unsupported canonical profile version.");
  return undefined;
}

function summarizeNumericReference(
  reference: EquipmentDNANumericReference | EquipmentDNANumericReferenceCandidate
): Omit<NonNullable<CanonicalAttributeSourceSelectionDecision["numericReference"]>, "validationStatus"> | undefined {
  if (reference.scale !== "0_100") return undefined;
  if (!isSupportedConfidence(reference.confidence)) return undefined;
  if (!isSupportedReferenceMethod(reference.referenceMethod)) return undefined;
  return {
    value: reference.numericValue,
    scale: reference.scale,
    confidence: reference.confidence,
    referenceMethod: reference.referenceMethod,
    mappingVersion: reference.mappingVersion
  };
}

function isSupportedConfidence(value: string): value is EquipmentDNANumericReference["confidence"] {
  return value === "estimated" || value === "moderate" || value === "high" || value === "validated";
}

function isSupportedReferenceMethod(value: string): value is EquipmentDNANumericReference["referenceMethod"] {
  return value === "legacy_preserved" || value === "derived_from_evaluation" || value === "structured_evaluation" || value === "manual_expert_review";
}

function missingDecision(input: { readonly canonicalProfile: CanonicalEquipmentDNAProfile; readonly evaluatedAt?: Date }, key: EquipmentDNAAttributeKey, field: EquipmentDNAAttribute, policy: CanonicalAttributeSourceSelectionPolicy): CanonicalAttributeSourceSelectionDecision {
  return {
    version: CANONICAL_ATTRIBUTE_SOURCE_SELECTION_DECISION_VERSION,
    policyVersion: policy.version,
    equipmentId: input.canonicalProfile.equipmentId,
    equipmentVariantId: input.canonicalProfile.equipmentVariantId,
    attributeKey: key,
    targetRecommendationField: field,
    outcome: "blocked_missing_ordinal_value",
    selectedSource: "unavailable",
    reasons: [finding("NO_SAFE_INPUT_SOURCE", "blocking", `Missing canonical attribute ${key}.`)],
    warnings: [],
    fallbackUsed: false,
    candidateInputAllowed: false,
    evaluatedAt: input.evaluatedAt ?? new Date()
  };
}

function outcomeForReason(reason: "missing" | "invalid" | "confidence" | "version" | "method"): CanonicalAttributeSourceSelectionDecision["outcome"] {
  if (reason === "missing") return "blocked_missing_numeric_reference";
  if (reason === "confidence") return "blocked_insufficient_confidence";
  if (reason === "version") return "blocked_unsupported_version";
  if (reason === "method") return "blocked_unsupported_method";
  return "blocked_invalid_reference";
}

function finding(code: CanonicalAttributeSourceSelectionFinding["code"], severity: CanonicalAttributeSourceSelectionFinding["severity"], message: string, details?: Record<string, unknown>): CanonicalAttributeSourceSelectionFinding {
  return { code, severity, message, details };
}

function keyToSourceHint(key: EquipmentDNAAttributeKey): string {
  return key === "bat_control_support" ? "BAT_CONTROL" : key === "swing_effort" ? "SWING_WEIGHT" : key === "forgiveness" ? "BARREL_FORGIVENESS" : key === "sweet_spot_support" ? "SWEET_SPOT_SIZE" : key === "power_potential" ? "POWER_POTENTIAL" : key === "balance_profile" ? "SWING_BALANCE" : key;
}
