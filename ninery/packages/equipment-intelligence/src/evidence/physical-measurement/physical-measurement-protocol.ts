import { createHash } from "node:crypto";
import { normalizePhysicalMeasurement } from "../equipment-multi-source-strategy.js";
import type { DiameterMethodSelection, PhysicalMeasurementBlock, PhysicalMeasurementEvidenceRecord, PhysicalMeasurementSession, PhysicalMeasurementType, PhysicalObservedQuantity } from "./physical-measurement-protocol.types.js";

export const NINERY_PHYSICAL_MEASUREMENT_PROTOCOL = "ninery_physical_measurement";
export const NINERY_PHYSICAL_MEASUREMENT_PROTOCOL_VERSION = "1.0";
export const NINERY_PHYSICAL_MEASUREMENT_PROVENANCE = "real_physical_measurement";
export const PHYSICAL_MEASUREMENT_FIREWALL_VERSION = "1.0";
export const PHYSICAL_MEASUREMENT_REPEATABILITY_THRESHOLD = "calibration_pending";
export const HANDLE_MEASUREMENT_LOCATION_FROM_KNOB_MM = 152.4;

export type PhysicalMeasurementMethodDefinition = { readonly measurementType: PhysicalMeasurementType; readonly method: string; readonly observedQuantity: PhysicalObservedQuantity; readonly referencePoints: string; readonly preferredUnit: string; readonly supportedRawUnits: readonly string[]; readonly minimumTrials: number; readonly repositionRequired: boolean; readonly instrumentType?: string; readonly derivationMethod?: "diameter_equals_circumference_divided_by_pi" };

export const physicalMeasurementMethods: Readonly<Record<PhysicalMeasurementType, PhysicalMeasurementMethodDefinition>> = {
  actual_mass: { measurementType: "actual_mass", method: "stable_tared_digital_scale", observedQuantity: "mass", referencePoints: "Entire unsupported specimen centered on a zeroed scale without operator contact.", preferredUnit: "grams", supportedRawUnits: ["grams", "ounces"], minimumTrials: 3, repositionRequired: true },
  overall_length: { measurementType: "overall_length", method: "flat_surface_longitudinal_endpoint", observedQuantity: "length", referencePoints: "Furthest physical knob endpoint to furthest barrel or end-cap endpoint along the longitudinal axis; use the same tangent endpoints every trial.", preferredUnit: "millimeters", supportedRawUnits: ["millimeters", "inches", "centimeters"], minimumTrials: 3, repositionRequired: true },
  balance_point: { measurementType: "balance_point", method: "narrow_fulcrum_knob_datum", observedQuantity: "balance_point_distance", referencePoints: "Distance from furthest knob endpoint to neutral balance location along the longitudinal axis.", preferredUnit: "millimeters_from_knob", supportedRawUnits: ["millimeters_from_knob", "inches_from_knob"], minimumTrials: 3, repositionRequired: true },
  barrel_diameter: { measurementType: "barrel_diameter", method: "maximum_direct_caliper", observedQuantity: "diameter", referencePoints: "Maximum external barrel diameter, located by longitudinal search and repeated across rotational orientations.", preferredUnit: "millimeters", supportedRawUnits: ["millimeters", "inches"], minimumTrials: 3, repositionRequired: true, instrumentType: "digital_calipers" },
  handle_diameter: { measurementType: "handle_diameter", method: "ninery_152_4mm_from_knob_caliper", observedQuantity: "diameter", referencePoints: "External diameter 152.4 mm (6.0 in) from the furthest knob endpoint; a Ninery operational convention, not an industry standard.", preferredUnit: "millimeters", supportedRawUnits: ["millimeters", "inches"], minimumTrials: 3, repositionRequired: true, instrumentType: "digital_calipers" }
};

export const circumferenceDerivedDiameterMethods = {
  barrel_diameter: { measurementType: "barrel_diameter", method: "circumference_derived_diameter", observedQuantity: "circumference", referencePoints: "Circumference at the widest observed barrel location, with the tape perpendicular to the longitudinal axis and repositioned between trials.", preferredUnit: "millimeters", supportedRawUnits: ["inches", "millimeters"], minimumTrials: 3, repositionRequired: true, instrumentType: "flexible_measuring_tape", derivationMethod: "diameter_equals_circumference_divided_by_pi" },
  handle_diameter: { measurementType: "handle_diameter", method: "circumference_derived_outer_diameter", observedQuantity: "circumference", referencePoints: "Circumference 152.4 mm (6.0 in) from the furthest knob endpoint, with the tape perpendicular to the handle axis and repositioned between trials; a Ninery convention.", preferredUnit: "millimeters", supportedRawUnits: ["inches", "millimeters"], minimumTrials: 3, repositionRequired: true, instrumentType: "flexible_measuring_tape", derivationMethod: "diameter_equals_circumference_divided_by_pi" }
} as const satisfies Readonly<Record<"barrel_diameter" | "handle_diameter", PhysicalMeasurementMethodDefinition>>;

export function buildPhysicalMeasurementSessionTemplate(input: { equipmentId: string; equipmentVariantId: string; manufacturer: string; model: string; modelYear: number; certification: string; nominalLengthInches: number; nominalWeightOunces: number; nominalDrop: number; barrelMethod?: DiameterMethodSelection; handleMethod?: DiameterMethodSelection }): PhysicalMeasurementSession {
  return {
    measurementSessionId: "<new-unique-session-id>", protocol: NINERY_PHYSICAL_MEASUREMENT_PROTOCOL, protocolVersion: "1.0", provenanceClassification: NINERY_PHYSICAL_MEASUREMENT_PROVENANCE,
    equipmentId: input.equipmentId, equipmentVariantId: input.equipmentVariantId, specimenReference: "<operator-assigned-physical-specimen-reference>", measurementDate: "<ISO-8601-date>", operatorId: "<operator-id>",
    physicalVerification: { equipmentId: input.equipmentId, equipmentVariantId: input.equipmentVariantId, manufacturer: input.manufacturer, model: input.model, modelYear: input.modelYear, certification: input.certification, nominalLengthInches: input.nominalLengthInches, nominalWeightOunces: input.nominalWeightOunces, nominalDrop: input.nominalDrop, verifiedAt: "<ISO-8601-date>", verifiedBy: "<operator-id>", confidence: "uncertain" },
    equipmentCondition: "unknown", modifications: [], environmentNotes: "", measurementBlocks: (Object.keys(physicalMeasurementMethods) as PhysicalMeasurementType[]).map((type) => blankBlock(type, type === "barrel_diameter" ? input.barrelMethod : type === "handle_diameter" ? input.handleMethod : undefined)), sessionLimitations: []
  };
}

export function aggregateTrials(block: PhysicalMeasurementBlock) {
  const values = block.trials.map((trial) => trial.value).filter((value): value is number => typeof value === "number" && Number.isFinite(value)).sort((a, b) => a - b);
  if (!values.length) return undefined;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : (values[middle - 1]! + values[middle]!) / 2;
}

export function normalizeAggregate(block: PhysicalMeasurementBlock, aggregate: number) {
  const definition = getPhysicalMeasurementMethodDefinition(block);
  if (!definition) throw new Error(`Unsupported physical measurement method: ${block.measurementType}/${block.method}.`);
  if (definition.derivationMethod === "diameter_equals_circumference_divided_by_pi") {
    const derivedDiameter = aggregate / Math.PI;
    const normalized = normalizePhysicalMeasurement(derivedDiameter, block.rawUnit, definition.preferredUnit);
    return { ...normalized, observedQuantity: "circumference" as const, observedAggregate: aggregate, observedUnit: block.rawUnit, derivedQuantity: "diameter" as const, derivedValueInObservedUnit: derivedDiameter, derivationMethod: definition.derivationMethod, derivationVersion: "1.0", independentMeasurement: false as const };
  }
  const normalized = normalizePhysicalMeasurement(aggregate, block.rawUnit, definition.preferredUnit);
  return { ...normalized, observedQuantity: definition.observedQuantity, observedAggregate: aggregate, observedUnit: block.rawUnit, derivedQuantity: definition.observedQuantity, derivedValueInObservedUnit: aggregate, derivationMethod: undefined, derivationVersion: undefined, independentMeasurement: false as const };
}

export function buildPhysicalMeasurementEvidence(session: PhysicalMeasurementSession, block: PhysicalMeasurementBlock, quality: string): PhysicalMeasurementEvidenceRecord {
  const aggregate = aggregateTrials(block)!;
  const normalized = normalizeAggregate(block, aggregate);
  const sourceReference = `physical-measurement:1.0:${session.measurementSessionId}:${block.measurementType}`;
  return { id: deterministicUuid(sourceReference), sourceReference, equipmentId: session.equipmentId, equipmentVariantId: session.equipmentVariantId, attributeKey: block.measurementType, sourceDate: session.measurementDate, operatorId: session.operatorId, unit: normalized.normalizedUnit,
    rawValue: { protocol: session.protocol, protocolVersion: session.protocolVersion, provenanceClassification: session.provenanceClassification, measurementSessionId: session.measurementSessionId, specimenReference: session.specimenReference, operatorId: session.operatorId, physicalVerification: session.physicalVerification, equipmentCondition: session.equipmentCondition, modifications: session.modifications, environmentNotes: session.environmentNotes ?? "", sessionLimitations: session.sessionLimitations, measurementType: block.measurementType, observedQuantity: normalized.observedQuantity, method: block.method, methodVersion: block.methodVersion, referencePoints: block.referencePoints, measuredSurface: block.measuredSurface, locationFromKnobMm: block.locationFromKnobMm, instrument: block.instrument, trials: block.trials, rawUnit: block.rawUnit, aggregate, aggregationMethod: block.aggregationMethod, repeatabilityThreshold: PHYSICAL_MEASUREMENT_REPEATABILITY_THRESHOLD, quality, deviations: block.deviations, limitations: block.limitations, canonicalEligible: false, numericReferenceEligible: false, recommendationEligible: false },
    normalizedValue: { value: normalized.normalizedValue, unit: normalized.normalizedUnit, derived: true, derivedQuantity: normalized.derivedQuantity, derivedValueInObservedUnit: normalized.derivedValueInObservedUnit, observedAggregate: normalized.observedAggregate, observedUnit: normalized.observedUnit, derivationMethod: normalized.derivationMethod, derivationVersion: normalized.derivationVersion, conversionVersion: normalized.conversionVersion, independentMeasurement: false }
  };
}

export function getPhysicalMeasurementMethodDefinition(block: Pick<PhysicalMeasurementBlock, "measurementType" | "method">): PhysicalMeasurementMethodDefinition | undefined { const direct = physicalMeasurementMethods[block.measurementType]; if (direct.method === block.method) return direct; if (block.measurementType === "barrel_diameter" || block.measurementType === "handle_diameter") { const alternate = circumferenceDerivedDiameterMethods[block.measurementType]; if (alternate.method === block.method) return alternate; } return undefined; }
function blankBlock(measurementType: PhysicalMeasurementType, selection?: DiameterMethodSelection): PhysicalMeasurementBlock { const definition = selection === "circumference_derived" && (measurementType === "barrel_diameter" || measurementType === "handle_diameter") ? circumferenceDerivedDiameterMethods[measurementType] : physicalMeasurementMethods[measurementType]; return { measurementType, method: definition.method, methodVersion: "1.0", observedQuantity: definition.observedQuantity, referencePoints: definition.referencePoints, rawUnit: definition.preferredUnit, measuredSurface: measurementType === "handle_diameter" ? "factory_grip_outer_diameter" : undefined, locationFromKnobMm: measurementType === "handle_diameter" ? HANDLE_MEASUREMENT_LOCATION_FROM_KNOB_MM : undefined, instrument: { instrumentType: definition.instrumentType ?? (measurementType === "actual_mass" ? "digital_scale" : measurementType === "overall_length" || measurementType === "balance_point" ? "rigid_measuring_rule" : "digital_calipers"), instrumentReference: "<instrument-reference>", calibrationStatus: "unknown" }, trials: Array.from({ length: definition.minimumTrials }, (_, index) => ({ trialNumber: index + 1, repositioned: false })), aggregationMethod: "median", methodCompliant: false, deviations: [], limitations: [] }; }
function deterministicUuid(value: string) { const hex = createHash("sha256").update(value).digest("hex").slice(0, 32).split(""); hex[12] = "5"; hex[16] = ((Number.parseInt(hex[16]!, 16) & 3) | 8).toString(16); return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20).join("")}`; }
