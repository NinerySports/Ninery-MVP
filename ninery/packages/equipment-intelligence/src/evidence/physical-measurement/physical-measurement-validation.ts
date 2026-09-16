import { aggregateTrials, getPhysicalMeasurementMethodDefinition, normalizeAggregate } from "./physical-measurement-protocol.js";
import { physicalMeasurementTypes, type MeasurementQuality, type PhysicalMeasurementBlock, type PhysicalMeasurementBlockReview, type PhysicalMeasurementCatalogIdentity, type PhysicalMeasurementSession, type PhysicalMeasurementSessionReview, type RepeatabilitySummary } from "./physical-measurement-protocol.types.js";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function reviewPhysicalMeasurementSession(session: PhysicalMeasurementSession, catalogIdentity?: PhysicalMeasurementCatalogIdentity): PhysicalMeasurementSessionReview {
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (!uuidPattern.test(session.equipmentId)) blockers.push("valid_equipment_uuid_required");
  if (!uuidPattern.test(session.equipmentVariantId)) blockers.push("valid_variant_uuid_required");
  if (!completeText(session.measurementSessionId)) blockers.push("measurement_session_id_required");
  if (!completeText(session.specimenReference)) blockers.push("specimen_reference_required");
  if (!completeText(session.operatorId)) blockers.push("operator_id_required");
  if (session.protocol !== "ninery_physical_measurement" || session.protocolVersion !== "1.0") blockers.push("protocol_identity_invalid");
  if (session.provenanceClassification !== "real_physical_measurement") blockers.push("provenance_classification_invalid");
  if (session.physicalVerification.equipmentId !== session.equipmentId || session.physicalVerification.equipmentVariantId !== session.equipmentVariantId) blockers.push("physical_verification_identity_mismatch");
  if (catalogIdentity && !physicalVerificationMatchesCatalog(session, catalogIdentity)) blockers.push("physical_verification_catalog_mismatch");
  if (session.physicalVerification.confidence !== "confident") blockers.push("physical_verification_uncertain");
  if (!completeText(session.physicalVerification.verifiedAt) || !completeText(session.physicalVerification.verifiedBy)) blockers.push("physical_verification_provenance_required");
  if (session.equipmentCondition === "unknown" || session.equipmentCondition === "damaged") blockers.push(`equipment_condition_${session.equipmentCondition}`);
  if (session.equipmentCondition === "modified" && session.modifications.length === 0) blockers.push("modifications_required");
  if (session.equipmentCondition === "materially_worn") warnings.push("material_wear_may_limit_representativeness");
  const blocks = session.measurementBlocks.map(reviewPhysicalMeasurementBlock);
  for (const type of physicalMeasurementTypes) if (!session.measurementBlocks.some((block) => block.measurementType === type)) blockers.push(`missing_measurement_block:${type}`);
  for (const block of blocks) blockers.push(...block.blockers.map((item) => `${block.measurementType}:${item}`));
  const duplicates = session.measurementBlocks.filter((block, index, all) => all.findIndex((candidate) => candidate.measurementType === block.measurementType) !== index);
  if (duplicates.length) blockers.push("duplicate_measurement_block");
  return { sessionId: session.measurementSessionId, valid: blockers.length === 0, persistenceEligible: blockers.length === 0, blockers, warnings, blocks, writesPerformed: false, behavioralEvaluationsPlanned: 0, numericReferencesPlanned: 0, recommendationImpact: "none" };
}

function physicalVerificationMatchesCatalog(session: PhysicalMeasurementSession, expected: PhysicalMeasurementCatalogIdentity) { const actual = session.physicalVerification; return session.equipmentId === expected.equipmentId && session.equipmentVariantId === expected.equipmentVariantId && actual.manufacturer === expected.manufacturer && actual.model === expected.model && actual.modelYear === expected.modelYear && actual.certification === expected.certification && actual.nominalLengthInches === expected.nominalLengthInches && actual.nominalWeightOunces === expected.nominalWeightOunces && actual.nominalDrop === expected.nominalDrop; }

export function reviewPhysicalMeasurementBlock(block: PhysicalMeasurementBlock): PhysicalMeasurementBlockReview {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const expected = getPhysicalMeasurementMethodDefinition(block);
  const observedQuantity = block.observedQuantity ?? (block.measurementType === "actual_mass" ? "mass" : block.measurementType === "overall_length" ? "length" : block.measurementType === "balance_point" ? "balance_point_distance" : "diameter");
  if (!expected) return { measurementType: block.measurementType, method: block.method, observedQuantity, complete: false, blockers: ["unsupported_measurement_method"], warnings, aggregateUnit: block.rawUnit, repeatability: emptyRepeatability(), quality: "blocked" };
  if (block.referencePoints !== expected.referencePoints || !block.methodCompliant) blockers.push("method_deviation");
  if (observedQuantity !== expected.observedQuantity) blockers.push("observed_quantity_method_mismatch");
  if (!expected.supportedRawUnits.includes(block.rawUnit)) blockers.push("invalid_or_unsupported_unit");
  if (expected.instrumentType && block.instrument.instrumentType !== expected.instrumentType) blockers.push("instrument_type_method_mismatch");
  if ("derivedDiameter" in block || "derivedValue" in block) blockers.push("operator_supplied_derived_value_not_allowed");
  if (!completeText(block.instrument.instrumentReference) || !completeText(block.instrument.instrumentType)) blockers.push("instrument_provenance_incomplete");
  if (block.instrument.calibrationStatus === "unknown") warnings.push("instrument_calibration_unknown");
  const validTrials = block.trials.filter((trial) => typeof trial.value === "number" && Number.isFinite(trial.value));
  if (validTrials.length < expected.minimumTrials) blockers.push(`minimum_${expected.minimumTrials}_trials_required`);
  if (new Set(block.trials.map((trial) => trial.trialNumber)).size !== block.trials.length) blockers.push("duplicate_trial_number");
  if (expected.repositionRequired && validTrials.some((trial) => !trial.repositioned)) blockers.push("independent_repositioning_required");
  if (block.measurementType === "handle_diameter") {
    if (block.locationFromKnobMm !== 152.4) blockers.push("handle_location_must_be_152_4mm_from_knob");
    if (!block.measuredSurface) blockers.push("handle_measured_surface_required");
    if (block.measuredSurface === "factory_grip_outer_diameter" && block.method.includes("bare_handle")) blockers.push("factory_grip_cannot_masquerade_as_bare_handle");
  }
  const aggregate = aggregateTrials(block);
  let normalized: ReturnType<typeof normalizeAggregate> | undefined;
  if (aggregate !== undefined) { try { normalized = normalizeAggregate(block, aggregate); } catch { blockers.push("invalid_or_unsupported_unit"); } }
  const repeatability = summarizeRepeatability(validTrials.map((trial) => trial.value!));
  const quality = classifyMeasurementQuality(block, blockers, warnings, repeatability);
  return { measurementType: block.measurementType, method: block.method, observedQuantity, complete: blockers.length === 0, blockers: [...new Set(blockers)], warnings, aggregate, aggregateUnit: block.rawUnit, normalizedAggregate: normalized?.normalizedValue, normalizedUnit: normalized?.normalizedUnit, derivationMethod: normalized?.derivationMethod, repeatability, quality };
}

export function summarizeRepeatability(values: readonly number[]): RepeatabilitySummary { if (!values.length) return emptyRepeatability(); const sorted = [...values].sort((a, b) => a - b); const mean = values.reduce((sum, value) => sum + value, 0) / values.length; const median = values.length % 2 ? sorted[Math.floor(values.length / 2)] : (sorted[values.length / 2 - 1]! + sorted[values.length / 2]!) / 2; return { trialCount: values.length, minimum: sorted[0], maximum: sorted.at(-1), range: sorted.at(-1)! - sorted[0]!, mean, median, standardDeviation: Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length), threshold: "calibration_pending" }; }
export function classifyMeasurementQuality(block: PhysicalMeasurementBlock, blockers: readonly string[], warnings: readonly string[], repeatability: RepeatabilitySummary): MeasurementQuality { if (blockers.includes("method_deviation")) return "method_deviation"; if (blockers.length) return "incomplete"; if (warnings.includes("instrument_calibration_unknown")) return "instrument_uncertain"; return repeatability.range === 0 ? "complete_repeatable" : "complete_variation_observed"; }
function emptyRepeatability(): RepeatabilitySummary { return { trialCount: 0, threshold: "calibration_pending" }; }
function completeText(value: string) { return Boolean(value.trim()) && !value.includes("<"); }
