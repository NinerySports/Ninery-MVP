import { getEquipmentDNAAttributeDefinition } from "../attributes/index.js";
import type {
  EquipmentDNAAttributeEvaluation,
  EquipmentDNAEvidenceRecord,
  EquipmentEvidenceConflict,
  EquipmentJsonValue
} from "./equipment-evidence.types.js";

export function detectEquipmentEvidenceConflict(input: {
  attributeKey: string;
  evidenceRecords: readonly EquipmentDNAEvidenceRecord[];
  proposedValue?: EquipmentJsonValue;
  currentEvaluation?: EquipmentDNAAttributeEvaluation;
}): EquipmentEvidenceConflict {
  const definition = getEquipmentDNAAttributeDefinition(input.attributeKey);
  const reasons: string[] = [];

  if (!definition) {
    return {
      conflict: true,
      severity: "material",
      reasons: [`Unknown Equipment DNA attribute key: ${input.attributeKey}.`]
    };
  }

  if (input.evidenceRecords.some((evidence) => evidence.status === "disputed")) {
    reasons.push("At least one evidence record is disputed.");
  }

  const values = input.evidenceRecords.flatMap((evidence) =>
    evidence.status === "active" && evidence.normalizedValue !== undefined ? [evidence.normalizedValue] : []
  );

  if (input.proposedValue !== undefined) {
    values.push(input.proposedValue);
  }
  if (input.currentEvaluation) {
    values.push(input.currentEvaluation.value);
  }

  const valueConflict = compareValues(
    definition.dataType,
    values,
    definition.dataType === "ordinal" ? definition.allowedValues : undefined
  );
  reasons.push(...valueConflict.reasons);

  const severity = strongestSeverity([
    reasons.some((reason) => /disputed/i.test(reason)) ? "material" : "none",
    valueConflict.severity
  ]);

  return {
    conflict: severity !== "none",
    severity,
    reasons: severity === "none" ? ["No meaningful evidence conflict detected."] : reasons
  };
}

function compareValues(
  dataType: "number" | "boolean" | "enum" | "ordinal",
  values: readonly EquipmentJsonValue[],
  allowedValues?: readonly string[]
): { severity: "none" | "minor" | "material"; reasons: string[] } {
  const comparableValues = values.filter((value) => value !== null && value !== undefined);
  if (comparableValues.length < 2) {
    return { severity: "none", reasons: [] };
  }

  if (dataType === "number") {
    const numericValues = comparableValues.filter((value): value is number => typeof value === "number");
    if (numericValues.length < 2) {
      return { severity: "none", reasons: [] };
    }
    const spread = Math.max(...numericValues) - Math.min(...numericValues);
    if (spread > 0.5) {
      return { severity: "material", reasons: [`Numeric evidence differs by ${spread}.`] };
    }
    if (spread > 0.25) {
      return { severity: "minor", reasons: [`Numeric evidence differs slightly by ${spread}.`] };
    }
    return { severity: "none", reasons: [] };
  }

  const stringValues = comparableValues.map((value) => String(value));
  const uniqueValues = new Set(stringValues);
  if (uniqueValues.size <= 1) {
    return { severity: "none", reasons: [] };
  }

  if (dataType === "ordinal" && allowedValues) {
    const indexes = [...uniqueValues].map((value) => allowedValues.indexOf(value));
    if (indexes.every((index) => index >= 0)) {
      const spread = Math.max(...indexes) - Math.min(...indexes);
      if (spread >= 2) {
        return { severity: "material", reasons: [`Ordinal evidence differs materially: ${[...uniqueValues].join(" vs ")}.`] };
      }
      return { severity: "minor", reasons: [`Ordinal evidence differs: ${[...uniqueValues].join(" vs ")}.`] };
    }
  }

  return { severity: "material", reasons: [`Evidence values conflict: ${[...uniqueValues].join(" vs ")}.`] };
}

function strongestSeverity(severities: ReadonlyArray<"none" | "minor" | "material">): "none" | "minor" | "material" {
  if (severities.includes("material")) return "material";
  if (severities.includes("minor")) return "minor";
  return "none";
}
