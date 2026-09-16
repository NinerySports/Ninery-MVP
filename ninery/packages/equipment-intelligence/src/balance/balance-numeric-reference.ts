import type { EquipmentDNANumericReference } from "../profiles/index.js";
import {
  BALANCE_PROFILE_NUMERIC_DIRECTION,
  BALANCE_PROFILE_NUMERIC_REFERENCE_VERSION,
  LEGACY_BALANCE_TO_CANONICAL_MAPPING_VERSION,
  type BalanceProfileNumericReference,
  type BalanceProfileOrdinal,
  type LegacyBalanceConversionResult,
  type LegacyBalanceConversionStrategy
} from "./balance-semantics.types.js";

export const BALANCE_PROFILE_ORDINAL_RANGES: Readonly<Record<BalanceProfileOrdinal, readonly [number, number]>> = {
  very_balanced: [0, 19],
  balanced: [20, 39],
  slightly_end_loaded: [40, 59],
  end_loaded: [60, 79],
  very_end_loaded: [80, 100]
};

export function convertLegacyBalanceToCanonical(
  sourceValue: number,
  strategy: LegacyBalanceConversionStrategy = "inverse"
): LegacyBalanceConversionResult {
  assertValidBalanceScore(sourceValue);
  if (strategy === "unsupported") {
    return {
      sourceValue,
      strategy,
      mappingVersion: LEGACY_BALANCE_TO_CANONICAL_MAPPING_VERSION,
      explanation: "Legacy balance conversion is blocked because semantics are unsupported."
    };
  }
  const canonicalValue = strategy === "direct" ? sourceValue : 100 - sourceValue;
  return {
    sourceValue,
    canonicalValue,
    strategy,
    mappingVersion: LEGACY_BALANCE_TO_CANONICAL_MAPPING_VERSION,
    explanation: strategy === "inverse"
      ? `Converted legacy balance ${sourceValue} with inverse strategy because legacy high values behave as balanced/light support while canonical high values mean more end-loaded.`
      : `Converted legacy balance ${sourceValue} with direct strategy.`
  };
}

export function mapBalanceNumericValueToOrdinal(value: number): BalanceProfileOrdinal {
  assertValidBalanceScore(value);
  for (const [ordinal, [min, max]] of Object.entries(BALANCE_PROFILE_ORDINAL_RANGES) as Array<[BalanceProfileOrdinal, readonly [number, number]]>) {
    if (value >= min && value <= max) return ordinal;
  }
  throw new Error(`Balance numeric value ${value} did not match a canonical range.`);
}

export function createLegacyDerivedBalanceNumericReference(input: {
  readonly sourceValue: number;
  readonly equipmentId: string;
  readonly equipmentVariantId?: string;
  readonly sourceReference?: string;
  readonly evidenceRecordId?: string;
}): BalanceProfileNumericReference {
  const conversion = convertLegacyBalanceToCanonical(input.sourceValue, "inverse");
  if (conversion.canonicalValue === undefined) {
    throw new Error("Legacy balance conversion did not produce a canonical value.");
  }
  const ordinal = mapBalanceNumericValueToOrdinal(conversion.canonicalValue);
  return {
    attributeKey: "balance_profile",
    sourceValue: input.sourceValue,
    canonicalValue: conversion.canonicalValue,
    ordinal,
    scale: "0_100",
    direction: BALANCE_PROFILE_NUMERIC_DIRECTION,
    conversionStrategy: conversion.strategy,
    mappingVersion: conversion.mappingVersion,
    referenceVersion: BALANCE_PROFILE_NUMERIC_REFERENCE_VERSION,
    sourceField: "balance",
    sourceCharacteristicCode: "SWING_BALANCE",
    sourceReference: input.sourceReference ?? `legacy:SWING_BALANCE:${input.equipmentId}:${input.equipmentVariantId ?? "model"}`,
    method: "legacy_preserved",
    confidence: "moderate",
    evidenceRecordId: input.evidenceRecordId,
    rationale: `${conversion.explanation} This is internal-derived legacy evidence, not an objective balance-point measurement.`
  };
}

export function toEquipmentDNANumericReferenceCandidate(
  reference: BalanceProfileNumericReference
): EquipmentDNANumericReference {
  return {
    numericValue: reference.canonicalValue,
    scale: "0_100",
    referenceMethod: "legacy_preserved",
    confidence: reference.confidence,
    evaluatorType: "derived",
    mappingVersion: reference.mappingVersion,
    generatedAt: new Date("2026-07-30T00:00:00.000Z"),
    sourceEvidenceRecordId: reference.evidenceRecordId,
    sourceReference: reference.sourceReference,
    sourceScore: reference.sourceValue
  };
}

function assertValidBalanceScore(value: number): void {
  if (!Number.isFinite(value)) throw new Error("Balance score must be finite.");
  if (value < 0 || value > 100) throw new Error("Balance score must be between 0 and 100.");
}
