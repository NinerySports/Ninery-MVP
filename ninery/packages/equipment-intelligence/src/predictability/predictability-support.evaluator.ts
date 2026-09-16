import {
  EQUIPMENT_DNA_NUMERIC_REFERENCE_MAPPING_VERSION,
  type EquipmentDNANumericReference
} from "../profiles/index.js";
import { meetsMinimumConfidence, type EquipmentAttributeConfidence } from "../evidence/index.js";
import { predictabilitySupportCompositePolicy, validatePredictabilitySupportCompositePolicy } from "./predictability-support.policy.js";
import {
  PREDICTABILITY_SUPPORT_EVALUATION_VERSION,
  type PredictabilitySupportComponentInput,
  type PredictabilitySupportComponentResult,
  type PredictabilitySupportEvaluationResult,
  type PredictabilitySupportFindingCode,
  type PredictabilitySupportOrdinal
} from "./predictability-support.types.js";

export const PREDICTABILITY_SUPPORT_ORDINAL_RANGES: Readonly<Record<PredictabilitySupportOrdinal, readonly [number, number]>> = {
  very_low: [0, 19],
  low: [20, 39],
  moderate: [40, 59],
  high: [60, 79],
  very_high: [80, 100]
};

export function evaluatePredictabilitySupport(input: {
  readonly components: readonly PredictabilitySupportComponentInput[];
  readonly generatedAt?: Date;
  readonly sourceReference?: string;
  readonly sourceEvidenceRecordId?: string;
}): PredictabilitySupportEvaluationResult {
  const policyErrors = validatePredictabilitySupportCompositePolicy();
  if (policyErrors.length > 0) {
    return invalidResult(policyErrors);
  }

  const warnings: string[] = [];
  const findings: PredictabilitySupportFindingCode[] = [
    "PREDICTABILITY_DEFINITION_APPROVED",
    "LEGACY_CONFIDENCE_BUILDING_NOT_DIRECTLY_MIGRATABLE",
    "DOUBLE_COUNTING_RISK",
    "CONFIDENCE_COMPATIBILITY_STILL_REQUIRED"
  ];
  const componentResults: PredictabilitySupportComponentResult[] = [];

  for (const configured of predictabilitySupportCompositePolicy.components) {
    const component = input.components.find((candidate) => candidate.attributeKey === configured.attributeKey);
    if (!component) {
      if (configured.required) warnings.push(`Missing required component ${configured.attributeKey}.`);
      findings.push("COMPONENT_EXCLUDED");
      componentResults.push({
        attributeKey: configured.attributeKey,
        sourceValue: "missing",
        weight: configured.weight,
        confidence: "estimated",
        included: false,
        explanation: `Missing ${configured.attributeKey}; composite cannot use fabricated values.`
      });
      continue;
    }
    if (!meetsMinimumConfidence(component.confidence, "moderate")) {
      warnings.push(`${configured.attributeKey} confidence ${component.confidence} is below moderate.`);
    }
    const numericValue = component.numericValue ?? ordinalToNumeric(component.attributeKey, component.sourceValue);
    if (numericValue === undefined) {
      warnings.push(`${configured.attributeKey} does not have a usable numeric component value.`);
      findings.push("COMPONENT_EXCLUDED");
      componentResults.push({
        attributeKey: configured.attributeKey,
        sourceValue: component.sourceValue,
        weight: configured.weight,
        confidence: component.confidence,
        included: false,
        explanation: `No numeric value was available for ${configured.attributeKey}.`
      });
      continue;
    }
    const transformedValue = configured.direction === "inverse" ? 100 - numericValue : numericValue;
    findings.push("COMPONENT_INCLUDED");
    componentResults.push({
      attributeKey: configured.attributeKey,
      sourceValue: component.sourceValue,
      numericValue,
      transformedValue,
      weight: configured.weight,
      weightedContribution: round(transformedValue * configured.weight),
      confidence: component.confidence,
      included: true,
      explanation: configured.rationale
    });
  }

  const includedWeight = componentResults.filter((component) => component.included).reduce((sum, component) => sum + component.weight, 0);
  const missingRequired = componentResults.some((component) => {
    const configured = predictabilitySupportCompositePolicy.components.find((item) => item.attributeKey === component.attributeKey);
    return configured?.required && !component.included;
  });
  const insufficientConfidence = componentResults.some((component) => {
    const configured = predictabilitySupportCompositePolicy.components.find((item) => item.attributeKey === component.attributeKey);
    return configured?.required && !meetsMinimumConfidence(component.confidence, "moderate");
  });
  const componentCoverage = round(includedWeight);
  findings.push(componentCoverage >= predictabilitySupportCompositePolicy.minimumComponentCoverage ? "COMPONENT_COVERAGE_SUFFICIENT" : "COMPONENT_COVERAGE_INSUFFICIENT");
  findings.push(insufficientConfidence ? "CONFIDENCE_INSUFFICIENT" : "CONFIDENCE_SUFFICIENT");

  if (missingRequired || insufficientConfidence || componentCoverage < predictabilitySupportCompositePolicy.minimumComponentCoverage) {
    findings.push("COMPOSITE_INVALID", "NUMERIC_REFERENCE_DEFERRED", "SHADOW_BRIDGE_BLOCKED");
    return {
      version: PREDICTABILITY_SUPPORT_EVALUATION_VERSION,
      ordinalValue: "moderate",
      componentResults,
      componentCoverage,
      confidence: "estimated",
      rationale: "Predictability support could not be evaluated because required components were missing or insufficient.",
      warnings,
      findings
    };
  }

  const numericValue = Math.round(componentResults.reduce((sum, component) => sum + (component.weightedContribution ?? 0), 0));
  const ordinalValue = mapPredictabilityNumericValueToOrdinal(numericValue);
  const confidence = weakestConfidence(componentResults.filter((component) => component.included).map((component) => component.confidence));
  findings.push("COMPOSITE_VALID", "NUMERIC_REFERENCE_SUPPORTED", "SHADOW_BRIDGE_BLOCKED");
  return {
    version: PREDICTABILITY_SUPPORT_EVALUATION_VERSION,
    ordinalValue,
    numericReference: {
      numericValue,
      scale: "0_100",
      referenceMethod: "derived_from_evaluation",
      confidence: confidence === "validated" || confidence === "high" ? "moderate" : confidence,
      evaluatorType: "derived",
      mappingVersion: EQUIPMENT_DNA_NUMERIC_REFERENCE_MAPPING_VERSION,
      generatedAt: input.generatedAt ?? new Date("2026-08-01T00:00:00.000Z"),
      sourceEvidenceRecordId: input.sourceEvidenceRecordId,
      sourceReference: input.sourceReference,
      sourceScore: numericValue
    },
    componentResults,
    componentCoverage,
    confidence: confidence === "validated" || confidence === "high" ? "moderate" : confidence,
    rationale: "Predictability support is a structured composite of forgiveness, sweet-spot support, and swing-effort manageability. It describes equipment response consistency, not player confidence.",
    warnings,
    findings
  };
}

export function mapPredictabilityNumericValueToOrdinal(value: number): PredictabilitySupportOrdinal {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error("Predictability numeric value must be between 0 and 100.");
  }
  for (const [ordinal, [min, max]] of Object.entries(PREDICTABILITY_SUPPORT_ORDINAL_RANGES) as Array<[PredictabilitySupportOrdinal, readonly [number, number]]>) {
    if (value >= min && value <= max) return ordinal;
  }
  throw new Error(`Predictability numeric value ${value} did not match a canonical range.`);
}

function ordinalToNumeric(attributeKey: string, value: unknown): number | undefined {
  if (attributeKey === "swing_effort") {
    const mapping = { very_easy: 10, easy: 30, moderate: 50, demanding: 70, very_demanding: 90 } as const;
    return typeof value === "string" && value in mapping ? mapping[value as keyof typeof mapping] : undefined;
  }
  const mapping = { very_low: 10, low: 30, moderate: 50, high: 70, very_high: 90 } as const;
  return typeof value === "string" && value in mapping ? mapping[value as keyof typeof mapping] : undefined;
}

function weakestConfidence(values: readonly EquipmentAttributeConfidence[]): EquipmentAttributeConfidence {
  const order: readonly EquipmentAttributeConfidence[] = ["estimated", "moderate", "high", "validated"];
  return values.reduce((weakest, value) => order.indexOf(value) < order.indexOf(weakest) ? value : weakest, "validated");
}

function invalidResult(warnings: readonly string[]): PredictabilitySupportEvaluationResult {
  return {
    version: PREDICTABILITY_SUPPORT_EVALUATION_VERSION,
    ordinalValue: "moderate",
    componentResults: [],
    componentCoverage: 0,
    confidence: "estimated",
    rationale: "Predictability support composite policy is invalid.",
    warnings,
    findings: ["COMPOSITE_INVALID", "NUMERIC_REFERENCE_DEFERRED", "SHADOW_BRIDGE_BLOCKED"]
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
