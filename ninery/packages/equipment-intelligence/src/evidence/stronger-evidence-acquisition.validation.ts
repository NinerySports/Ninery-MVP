import { physicalMeasurementEquipmentConditions, physicalMeasurementInstrumentCalibrationStatuses } from "./physical-measurement/physical-measurement-protocol.types.js";
import { HANDLE_MEASUREMENT_LOCATION_FROM_KNOB_MM, type PhysicalMeasurementMethodDefinition } from "./physical-measurement/physical-measurement-protocol.js";
import { physicalBatConditionPolicy, physicalBatEvaluatorCategories } from "../physical-evaluation/structured-physical-bat-evaluation.policy.js";
import { physicalEvaluationProtocolV11Questions } from "../physical-evaluation/protocol-v1-1/physical-evaluation-protocol-v1-1.policy.js";
import { PHYSICAL_EVALUATION_PROTOCOL_V1_1_WRITER_VERSION, PHYSICAL_EVALUATION_PROTOCOL_V1_1_FIREWALL_VERSION } from "../physical-evaluation/protocol-v1-1/physical-evaluation-protocol-v1-1-writer.js";
import { PHYSICAL_EVALUATION_EVALUATOR_INDEPENDENCE_VERSION } from "../physical-evaluation/protocol-v1-1/physical-evaluation-evaluator-independence.js";
import type { StrongerEvidenceCandidate } from "./stronger-construct-evidence-admissibility.js";

// Inspect persisted acquisition metadata only: do not rerun aggregation or synthesize values.
export function physicalMeasurementAcquisitionGaps(record: StrongerEvidenceCandidate, raw: Record<string, unknown>, method: PhysicalMeasurementMethodDefinition): string[] {
  const gaps: string[] = [];
  const need = (field: string, valid: boolean) => { if (!valid) gaps.push(field); };
  const instrument = object(raw.instrument);
  const trials = Array.isArray(raw.trials) ? raw.trials.map(object) : [];
  need("protocol_trials", trials.length >= method.minimumTrials && trials.every(trial => !!trial && positiveInteger(trial.trialNumber) && finite(trial.value) && trial.repositioned === true));
  need("unique_trial_numbers", new Set(trials.map(trial => trial?.trialNumber)).size === trials.length);
  need("instrument_type", text(instrument?.instrumentType) && (!method.instrumentType || instrument?.instrumentType === method.instrumentType));
  need("instrument_reference", text(instrument?.instrumentReference));
  need("instrument_calibration_status", physicalMeasurementInstrumentCalibrationStatuses.some(status => status === instrument?.calibrationStatus));
  need("measurement_type", raw.measurementType === record.attributeKey);
  need("observed_quantity", raw.observedQuantity === method.observedQuantity);
  need("reference_points", raw.referencePoints === method.referencePoints);
  need("aggregation_method", raw.aggregationMethod === "median");
  need("recorded_aggregate", finite(raw.aggregate));
  need("deviations", strings(raw.deviations));
  need("limitations", strings(raw.limitations) && strings(raw.sessionLimitations));
  need("equipment_condition", physicalMeasurementEquipmentConditions.some(condition => condition === raw.equipmentCondition) && raw.equipmentCondition !== "damaged" && raw.equipmentCondition !== "unknown");
  need("modifications", strings(raw.modifications) && (raw.equipmentCondition !== "modified" || (Array.isArray(raw.modifications) && raw.modifications.length > 0)));
  if (record.attributeKey === "handle_diameter") {
    need("handle_location", raw.locationFromKnobMm === HANDLE_MEASUREMENT_LOCATION_FROM_KNOB_MM);
    need("handle_surface", ["bare_handle", "factory_grip_outer_diameter", "aftermarket_grip_outer_diameter"].some(surface => surface === raw.measuredSurface));
  }
  verificationGaps(record, object(raw.physicalVerification), true, need);
  return gaps;
}

export function humanCalibrationAcquisitionGaps(record: StrongerEvidenceCandidate, raw: Record<string, unknown>): string[] {
  const gaps: string[] = [];
  const need = (field: string, valid: boolean) => { if (!valid) gaps.push(field); };
  need("writer_version", raw.writerVersion === PHYSICAL_EVALUATION_PROTOCOL_V1_1_WRITER_VERSION);
  need("firewall_version", raw.firewallVersion === PHYSICAL_EVALUATION_PROTOCOL_V1_1_FIREWALL_VERSION);
  need("evaluator_independence_version", raw.evaluatorIndependenceVersion === PHYSICAL_EVALUATION_EVALUATOR_INDEPENDENCE_VERSION);
  need("session_identity", text(raw.sessionId) && raw.equipmentId === record.equipmentId && raw.equipmentVariantId === record.equipmentVariantId);
  need("testing_limitations", strings(raw.testingLimitations));
  const evaluator = object(raw.evaluator);
  need("evaluator_category", physicalBatEvaluatorCategories.some(category => category === evaluator?.category));
  need("evaluator_confidence", ["low", "medium", "high"].some(confidence => confidence === evaluator?.confidence));
  need("evaluator_relationship", ["independent_evaluator", "repeat_evaluator"].some(relationship => relationship === raw.evaluatorRelationship) && evaluator?.relationship === raw.evaluatorRelationship);
  const condition = Object.entries(physicalBatConditionPolicy).find(([key]) => key === raw.equipmentCondition);
  need("equipment_condition", !!condition && !condition[1].blocksEvaluation);
  const question = physicalEvaluationProtocolV11Questions.find(item => item.id === raw.questionId);
  need("question_acquisition_metadata", !!question && raw.construct === question.construct && raw.trialBlock === question.trialBlock && raw.minimumTrials === question.minimumTrials);
  const minimum = (dimension: string) => physicalEvaluationProtocolV11Questions.find(item => item.dimensionKey === dimension)?.minimumTrials;
  const sufficient = (value: unknown, dimension: string) => positiveInteger(value) && value >= (minimum(dimension) ?? Infinity);
  const swing = object(raw.drySwingBlocks);
  const contact = object(raw.controlledContactBlocks);
  need("dry_swing_blocks", sufficient(swing?.startupDemandTrials, "startup_demand") && sufficient(swing?.rotationalDemandTrials, "rotational_demand") && sufficient(swing?.barrelRedirectDemandTrials, "barrel_redirect_demand"));
  need("controlled_contact_blocks", sufficient(contact?.centeredContactTrials, "center_response_baseline") && sufficient(contact?.nearCenterHandleSideTrials, "handle_side_miss_tolerance") && sufficient(contact?.nearCenterEndSideTrials, "end_side_miss_tolerance"));
  // This is trial-count consistency, not aggregation of evidence values.
  need("total_contact_trials", finite(contact?.centeredContactTrials) && finite(contact?.nearCenterHandleSideTrials) && finite(contact?.nearCenterEndSideTrials) && raw.totalControlledContactTrials === contact.centeredContactTrials + contact.nearCenterHandleSideTrials + contact.nearCenterEndSideTrials && sufficient(raw.totalControlledContactTrials, "response_degradation"));
  const controls = object(raw.contactLocationControls);
  need("contact_controls", controls?.centeredContactVerified === true && controls.handleSideMissesModestAndNearCenter === true && controls.endSideMissesModestAndNearCenter === true && text(controls.methodNotes));
  verificationGaps(record, object(raw.physicalVerification), false, need);
  return gaps;
}

function verificationGaps(record: StrongerEvidenceCandidate, verification: Record<string, unknown> | undefined, measurement: boolean, need: (field: string, valid: boolean) => void) {
  need("verification_identity", !!verification && verification.equipmentId === record.equipmentId && verification.equipmentVariantId === record.equipmentVariantId && !!record.equipmentVariantId);
  need("verification_catalog_fields", text(verification?.manufacturer) && text(verification?.model) && finite(verification?.modelYear) && text(verification?.certification) && finite(verification?.[measurement ? "nominalLengthInches" : "lengthInches"]) && finite(verification?.[measurement ? "nominalWeightOunces" : "weightOunces"]) && finite(verification?.[measurement ? "nominalDrop" : "dropWeight"]));
}
function object(value: unknown): Record<string, unknown> | undefined { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined; }
function text(value: unknown): boolean { return typeof value === "string" && !!value.trim() && !value.includes("<"); }
function strings(value: unknown): boolean { return Array.isArray(value) && value.every(item => typeof item === "string"); }
function finite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
function positiveInteger(value: unknown): value is number { return finite(value) && Number.isInteger(value) && value > 0; }
