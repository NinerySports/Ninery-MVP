import { validateEquipmentDNANumericReference, type EquipmentDNANumericReferenceCandidate } from "../profiles/index.js";
import { BALANCE_PROFILE_NUMERIC_REFERENCE_VERSION, type BalanceNumericReferenceValidationResult, type BalanceProfileOrdinal } from "./balance-semantics.types.js";

export function validateBalanceNumericReference(input: {
  readonly ordinal: BalanceProfileOrdinal;
  readonly numericReference?: EquipmentDNANumericReferenceCandidate;
  readonly conversionExplanation?: string;
  readonly sourceValue?: number;
}): BalanceNumericReferenceValidationResult {
  const errors: string[] = [];
  const findings: BalanceNumericReferenceValidationResult["findings"][number][] = ["CANONICAL_DIRECTION_CONFIRMED"];

  if (!input.numericReference) {
    errors.push("Balance numeric reference is missing.");
    findings.push("NUMERIC_REFERENCE_INVALID", "SOURCE_SELECTION_BLOCKED");
    return { valid: false, findings, errors };
  }
  if (input.sourceValue === undefined) errors.push("Legacy source value is required.");
  if (!input.conversionExplanation?.trim()) errors.push("Conversion explanation is required.");
  if (input.numericReference.mappingVersion !== BALANCE_PROFILE_NUMERIC_REFERENCE_VERSION) {
    errors.push(`Unsupported balance mapping version ${input.numericReference.mappingVersion}.`);
  }
  if (input.numericReference.confidence === "estimated") {
    errors.push("Estimated confidence is not sufficient for balance candidate selection.");
    findings.push("CONFIDENCE_INSUFFICIENT");
  } else {
    findings.push("CONFIDENCE_SUFFICIENT");
  }

  const validation = validateEquipmentDNANumericReference({
    attributeKey: "balance_profile",
    ordinalValue: input.ordinal,
    numericReference: input.numericReference,
    previousConfidence: "moderate"
  });
  if (!validation.valid) {
    errors.push(...validation.reasons);
    if (validation.reasons.some((reason) => reason.toLowerCase().includes("inconsistent"))) findings.push("ORDINAL_INCONSISTENT");
  } else {
    findings.push("ORDINAL_CONSISTENT");
  }

  findings.push(errors.length === 0 ? "NUMERIC_REFERENCE_VALID" : "NUMERIC_REFERENCE_INVALID");
  findings.push(errors.length === 0 ? "SOURCE_SELECTION_ALLOWED" : "SOURCE_SELECTION_BLOCKED");
  findings.push("OBJECTIVE_MEASUREMENT_STILL_REQUIRED");
  return { valid: errors.length === 0, findings, errors };
}
