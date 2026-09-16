import {
  OPTIONAL_SIGNAL_ARCHITECTURE_DECISION_VERSION,
  OPTIONAL_SIGNAL_CANONICALIZATION_POLICY_VERSION,
  type OptionalSignalCanonicalizationDecision,
  type OptionalSignalKey,
  type OptionalSignalPolicyValidationResult
} from "./optional-signal-policy.types.js";

const requiredSignals: readonly OptionalSignalKey[] = ["balance", "confidence_building", "transition"];

export function validateOptionalSignalCanonicalizationPolicy(
  decisions: readonly OptionalSignalCanonicalizationDecision[]
): OptionalSignalPolicyValidationResult {
  const errors = [
    ...validateRequiredSignals(decisions),
    ...decisions.flatMap(validateDecision),
    ...validateFutureReplacementKeys(decisions)
  ];
  return { valid: errors.length === 0, errors };
}

export function assertValidOptionalSignalCanonicalizationPolicy(
  decisions: readonly OptionalSignalCanonicalizationDecision[]
): void {
  const result = validateOptionalSignalCanonicalizationPolicy(decisions);
  if (!result.valid) {
    throw new Error(`Invalid optional signal policy:\n${result.errors.join("\n")}`);
  }
}

function validateRequiredSignals(decisions: readonly OptionalSignalCanonicalizationDecision[]): string[] {
  const errors: string[] = [];
  const keys = decisions.map((decision) => decision.signal.key);
  for (const key of requiredSignals) {
    if (!keys.includes(key)) errors.push(`Missing optional signal decision: ${key}.`);
  }
  for (const key of keys) {
    if (keys.filter((candidate) => candidate === key).length > 1) errors.push(`Duplicate optional signal decision: ${key}.`);
  }
  return errors;
}

function validateDecision(decision: OptionalSignalCanonicalizationDecision): string[] {
  const errors: string[] = [];
  if (decision.version !== OPTIONAL_SIGNAL_ARCHITECTURE_DECISION_VERSION) errors.push(`${decision.signal.key} has unsupported decision version.`);
  if (decision.policyVersion !== OPTIONAL_SIGNAL_CANONICALIZATION_POLICY_VERSION) errors.push(`${decision.signal.key} has unsupported policy version.`);
  if (!decision.outcome) errors.push(`${decision.signal.key} is missing an outcome.`);
  if (!decision.definitions.technical.trim()) errors.push(`${decision.signal.key} is missing a technical definition.`);
  if (!decision.definitions.parentFriendly.trim()) errors.push(`${decision.signal.key} is missing a parent-friendly definition.`);
  if (decision.definitions.explicitlyNot.length === 0) errors.push(`${decision.signal.key} must define explicit non-meanings.`);
  if (!decision.evidencePolicy.expectedEvidenceRequirement) errors.push(`${decision.signal.key} is missing evidence policy.`);
  if (!decision.confidencePolicy.confidenceAppliesTo) errors.push(`${decision.signal.key} is missing confidence policy.`);
  if (!decision.recommendationPolicy.futureCanonicalUse) errors.push(`${decision.signal.key} is missing recommendation policy.`);
  if (decision.migrationGuidance.historicalReproducibilityRequired !== true) {
    errors.push(`${decision.signal.key} must preserve historical reproducibility.`);
  }
  if (decision.numericReferencePolicy.supported && (!decision.numericReferencePolicy.scale || !decision.numericReferencePolicy.direction)) {
    errors.push(`${decision.signal.key} supports numeric references but is missing scale or direction.`);
  }
  if (decision.outcome === "compatibility_only" && (decision.futureState.relationalInputs?.length ?? 0) === 0) {
    errors.push(`${decision.signal.key} is compatibility-only but has no relational inputs.`);
  }
  if (decision.outcome === "split_equipment_and_compatibility" && (!decision.futureState.canonicalTechnicalName || !decision.futureState.compatibilityConceptKey)) {
    errors.push(`${decision.signal.key} is split but does not define both equipment and compatibility concepts.`);
  }
  if ((decision.futureState.attributeNature === "relational" || decision.futureState.attributeNature === "mixed") && decision.migrationGuidance.directValueMigrationAllowed) {
    errors.push(`${decision.signal.key} is relational or mixed but allows direct migration.`);
  }
  if (decision.migrationGuidance.legacyFieldDisposition === "deprecate" && !decision.warnings.some((warning) => warning.code === "DIRECT_MIGRATION_BLOCKED" || warning.code === "DIRECTION_INVERSION_REQUIRED")) {
    errors.push(`${decision.signal.key} deprecates a legacy field without a migration warning.`);
  }
  return errors;
}

function validateFutureReplacementKeys(decisions: readonly OptionalSignalCanonicalizationDecision[]): string[] {
  const intentionalDuplicates = new Set<string>();
  const counts = new Map<string, number>();
  for (const decision of decisions) {
    for (const key of decision.migrationGuidance.futureReplacementKeys) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([key, count]) => count > 1 && !intentionalDuplicates.has(key))
    .map(([key]) => `Future replacement key is duplicated without explicit approval: ${key}.`);
}
