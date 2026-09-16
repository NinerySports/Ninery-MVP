import {
  getEquipmentDNAAttributeDefinition,
  getRequiredEquipmentDNAAttributeDefinitions,
  validateEquipmentDNAAttributeValue,
  type EquipmentDNAAttributeKey
} from "../attributes/index.js";
import type {
  RealWorldEquipmentAttributeCoverage,
  RealWorldEquipmentEvidencePacket,
  RealWorldEquipmentOnboardingPacket,
  RealWorldEquipmentOnboardingReview,
  RealWorldEquipmentOnboardingStatus,
  RealWorldEquipmentPhysicalVerificationInput,
  RealWorldEquipmentPhysicalVerificationResult
} from "./real-world-equipment-onboarding.types.js";
import {
  RealWorldEquipmentOnboardingValidationError,
  UnsupportedNumericPrecisionError
} from "./real-world-equipment-onboarding.types.js";

export const REAL_WORLD_EQUIPMENT_ONBOARDING_VERSION = "1.0";

const behaviorKeys = [
  "bat_control_support",
  "swing_effort",
  "forgiveness",
  "sweet_spot_support",
  "power_potential",
  "balance_profile",
  "predictability_support"
] as const satisfies readonly EquipmentDNAAttributeKey[];

export function validateRealWorldEquipmentOnboardingPacket(packet: RealWorldEquipmentOnboardingPacket): string[] {
  const errors: string[] = [];
  if (packet.version !== REAL_WORLD_EQUIPMENT_ONBOARDING_VERSION) errors.push("Unsupported onboarding packet version.");
  if (!packet.productKey.trim()) errors.push("productKey is required.");
  if (!packet.manufacturer.trim()) errors.push("manufacturer is required.");
  if (!packet.model.trim()) errors.push("model is required.");
  if (!Number.isInteger(packet.modelYear)) errors.push("modelYear must be an integer.");
  if (packet.category !== "bat") errors.push("Only bat onboarding is supported in v1.0.");
  if (!packet.variants.length) errors.push("At least one variant is required.");

  const variantSkus = new Set<string>();
  for (const variant of packet.variants) {
    if (!variant.sku.trim()) errors.push("Every variant requires a SKU.");
    if (variantSkus.has(variant.sku)) errors.push(`Duplicate variant SKU ${variant.sku}.`);
    variantSkus.add(variant.sku);
    if (variant.lengthInches <= 0 || variant.weightOunces <= 0) errors.push(`Variant ${variant.sku} has invalid dimensions.`);
    if (variant.dropWeight !== variant.weightOunces - variant.lengthInches) {
      errors.push(`Variant ${variant.sku} drop must preserve Ninery's signed weight-minus-length convention.`);
    }
  }

  const evidenceKeys = new Set<string>();
  for (const evidence of packet.evidence) {
    if (evidenceKeys.has(evidence.evidenceKey)) errors.push(`Duplicate evidence key ${evidence.evidenceKey}.`);
    evidenceKeys.add(evidence.evidenceKey);
    if (evidence.variantSku && !variantSkus.has(evidence.variantSku)) errors.push(`Evidence ${evidence.evidenceKey} targets unknown variant ${evidence.variantSku}.`);
    if (evidence.attributeKey && !getEquipmentDNAAttributeDefinition(evidence.attributeKey)) errors.push(`Evidence ${evidence.evidenceKey} uses unknown attribute ${evidence.attributeKey}.`);
    if (evidence.normalizedValue !== undefined && evidence.attributeKey) {
      const validation = validateEquipmentDNAAttributeValue(evidence.attributeKey, evidence.normalizedValue);
      if (!validation.valid) errors.push(...validation.errors.map((error) => `${evidence.evidenceKey}: ${error}`));
    }
  }
  return errors;
}

export function reviewRealWorldEquipmentOnboardingPacket(
  packet: RealWorldEquipmentOnboardingPacket
): RealWorldEquipmentOnboardingReview {
  const validationErrors = validateRealWorldEquipmentOnboardingPacket(packet);
  if (validationErrors.length) throw new RealWorldEquipmentOnboardingValidationError(validationErrors.join(" "));

  const requiredCoverage = getRequiredEquipmentDNAAttributeDefinitions().map((definition) =>
    coverageFor(definition.key, packet.evidence)
  );
  const optionalCoverage = behaviorKeys
    .filter((key) => !requiredCoverage.some((coverage) => coverage.key === key))
    .map((key) => coverageFor(key, packet.evidence));
  const unresolvedAttributes = requiredCoverage
    .filter((coverage) => coverage.state === "unresolved")
    .map((coverage) => coverage.key);
  const specificationReady = ["length", "weight", "drop", "certification", "barrel_diameter"].every((key) =>
    requiredCoverage.some((coverage) => coverage.key === key && coverage.state === "evaluation_supported")
  );
  const canonicalProfileReady = unresolvedAttributes.length === 0;
  const statuses: RealWorldEquipmentOnboardingStatus[] = [
    "identity_ready",
    ...(specificationReady ? ["specification_ready" as const] : []),
    ...(canonicalProfileReady ? ["canonical_profile_ready" as const] : ["evidence_incomplete" as const, "canonical_profile_partial" as const]),
    "recommendation_activation_blocked"
  ];

  return {
    version: REAL_WORLD_EQUIPMENT_ONBOARDING_VERSION,
    productKey: packet.productKey,
    productLabel: `${packet.manufacturer} ${packet.model} ${packet.modelYear}`,
    variantSkus: packet.variants.map((variant) => variant.sku),
    statuses,
    identityReady: true,
    specificationReady,
    canonicalProfileReady,
    genuineStudyReady: false,
    liveRecommendationActivationAllowed: false,
    requiredCoverage,
    optionalCoverage,
    unresolvedAttributes,
    conflictingEvidence: conflictingEvidence(packet.evidence),
    numericReferencesCreated: packet.evidence
      .filter((evidence) => evidence.attributeKey && evidence.nature === "objective" && typeof evidence.normalizedValue === "number")
      .map((evidence) => evidence.attributeKey)
      .filter((key): key is EquipmentDNAAttributeKey => Boolean(key)),
    evidenceInventory: packet.evidence,
    blockers: canonicalProfileReady ? [] : [`Unresolved required attributes: ${unresolvedAttributes.join(", ")}.`],
    warnings: [
      "Catalog presence is not recommendation readiness.",
      "Newly onboarded equipment remains blocked from live recommendation activation."
    ]
  };
}

export function verifyPhysicalEquipment(
  packet: RealWorldEquipmentOnboardingPacket,
  actual: RealWorldEquipmentPhysicalVerificationInput
): RealWorldEquipmentPhysicalVerificationResult {
  const matched: string[] = [];
  const mismatched: string[] = [];
  const unresolved: string[] = [];
  compare("manufacturer", packet.manufacturer, actual.manufacturer, matched, mismatched);
  compare("model", packet.model, actual.model, matched, mismatched);
  compare("modelYear", packet.modelYear, actual.modelYear, matched, mismatched);
  compare("certification", packet.certification, actual.certification, matched, mismatched);
  const variant = packet.variants.find(
    (candidate) =>
      candidate.lengthInches === actual.lengthInches &&
      candidate.weightOunces === actual.weightOunces &&
      candidate.dropWeight === actual.dropWeight
  );
  if (variant) matched.push("variant_identity");
  else mismatched.push("variant_identity");
  if (!actual.productIdentifier) unresolved.push("productIdentifier");
  else compare("productIdentifier", packet.productIdentifier, actual.productIdentifier, matched, mismatched);
  return {
    verified: mismatched.length === 0 && unresolved.length === 0,
    matched,
    mismatched,
    unresolved,
    reasons: [
      mismatched.length ? `Mismatched: ${mismatched.join(", ")}.` : "All supplied values match.",
      unresolved.length ? `Unresolved: ${unresolved.join(", ")}.` : "No supplied verification fields are unresolved.",
      "Physical verification confirms product identity only; it does not prove subjective Equipment DNA behavior."
    ]
  };
}

export function assertQualitativeClaimDoesNotCreateNumericReference(evidence: RealWorldEquipmentEvidencePacket): void {
  if (evidence.nature === "claimed" && typeof evidence.normalizedValue === "number") {
    throw new UnsupportedNumericPrecisionError("Qualitative published claims may not create exact numeric references.");
  }
}

function coverageFor(
  key: EquipmentDNAAttributeKey,
  evidence: readonly RealWorldEquipmentEvidencePacket[]
): RealWorldEquipmentAttributeCoverage {
  const supporting = evidence.filter((record) => record.attributeKey === key);
  const objective = supporting.filter((record) => record.nature === "objective" && record.normalizedValue !== undefined);
  const claims = supporting.filter((record) => record.nature === "claimed");
  if (objective.length) {
    return {
      key,
      state: "evaluation_supported",
      ordinalEvaluationAllowed: true,
      numericReferenceAllowed: objective.some((record) => typeof record.normalizedValue === "number"),
      evidenceKeys: objective.map((record) => record.evidenceKey),
      reason: "Objective specification evidence supports a canonical evaluation."
    };
  }
  if (claims.length) {
    return {
      key,
      state: "claim_only",
      ordinalEvaluationAllowed: true,
      numericReferenceAllowed: false,
      evidenceKeys: claims.map((record) => record.evidenceKey),
      reason: "Qualitative claim evidence may inform review but does not create numeric precision."
    };
  }
  return {
    key,
    state: "unresolved",
    ordinalEvaluationAllowed: false,
    numericReferenceAllowed: false,
    evidenceKeys: [],
    reason: "No sufficient evidence is available."
  };
}

function conflictingEvidence(evidence: readonly RealWorldEquipmentEvidencePacket[]): string[] {
  const grouped = new Map<string, Set<string>>();
  for (const record of evidence) {
    if (!record.attributeKey || record.normalizedValue === undefined) continue;
    const key = `${record.targetLevel ?? "equipment"}:${record.variantSku ?? "equipment"}:${record.attributeKey}`;
    const values = grouped.get(key) ?? new Set<string>();
    values.add(JSON.stringify(record.normalizedValue));
    grouped.set(key, values);
  }
  return [...grouped.entries()].filter(([, values]) => values.size > 1).map(([key]) => key);
}

function compare(label: string, expected: unknown, actual: unknown, matched: string[], mismatched: string[]) {
  if (String(expected).toLowerCase() === String(actual).toLowerCase()) matched.push(label);
  else mismatched.push(label);
}
