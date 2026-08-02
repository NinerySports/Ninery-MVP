import { getEquipmentDNAAttributeDefinition } from "./equipment-attribute.registry.js";
import type {
  EquipmentDNAAttributeKey,
  EquipmentDNAAttributeNormalizedValue,
  EquipmentDNAAttributeValidationResult
} from "./equipment-attribute.types.js";

export function validateEquipmentDNAAttributeValue(
  key: EquipmentDNAAttributeKey | string,
  value: unknown
): EquipmentDNAAttributeValidationResult {
  const definition = getEquipmentDNAAttributeDefinition(key);
  if (!definition) {
    return invalid(`Unknown Equipment DNA attribute key: ${key}.`);
  }

  if (value === null || value === undefined) {
    return invalid(`${definition.key} cannot be null or undefined.`);
  }

  switch (definition.dataType) {
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return invalid(`${definition.key} must be a finite number.`);
      }
      if (value < definition.min || value > definition.max) {
        return invalid(`${definition.key} must be between ${definition.min} and ${definition.max}.`);
      }
      if (definition.integer && !Number.isInteger(value)) {
        return invalid(`${definition.key} must be an integer.`);
      }
      return valid(value);
    case "boolean":
      if (typeof value !== "boolean") {
        return invalid(`${definition.key} must be a boolean.`);
      }
      return valid(value);
    case "enum":
    case "ordinal":
      if (typeof value !== "string") {
        return invalid(`${definition.key} must be one of: ${definition.allowedValues.join(", ")}.`);
      }
      return validateAllowedStringValue(definition.key, value, definition.allowedValues);
  }
}

function validateAllowedStringValue(
  key: string,
  rawValue: string,
  allowedValues: readonly string[]
): EquipmentDNAAttributeValidationResult {
  const trimmedValue = rawValue.trim();
  if (!trimmedValue) {
    return invalid(`${key} cannot be empty.`);
  }

  const exactMatch = allowedValues.find((allowedValue) => allowedValue === trimmedValue);
  if (exactMatch) {
    return valid(exactMatch);
  }

  const normalizedMatches = allowedValues.filter(
    (allowedValue) => allowedValue.toLowerCase() === trimmedValue.toLowerCase()
  );
  if (normalizedMatches.length === 1) {
    return valid(normalizedMatches[0]);
  }

  return invalid(`${key} must be one of: ${allowedValues.join(", ")}.`);
}

function valid(normalizedValue: EquipmentDNAAttributeNormalizedValue): EquipmentDNAAttributeValidationResult {
  return {
    valid: true,
    normalizedValue
  };
}

function invalid(message: string): EquipmentDNAAttributeValidationResult {
  return {
    valid: false,
    errors: [message]
  };
}
