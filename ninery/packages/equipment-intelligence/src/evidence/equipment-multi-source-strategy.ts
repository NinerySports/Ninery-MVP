import { physicalEvaluationProtocolV11Questions } from "../physical-evaluation/index.js";
import type { ConstructEvidenceStrategy, CorroborationState, DirectMeasurementRecord, EvidenceSourcePolicy, MeasurementIndependence, MultiSourceConflictType, MultiSourceEvidenceClass, PhysicalMeasurementDefinition } from "./equipment-multi-source-strategy.types.js";

export const EQUIPMENT_DNA_MULTI_SOURCE_STRATEGY_VERSION = "1.0";
export const EQUIPMENT_PHYSICAL_MEASUREMENT_STRATEGY_VERSION = "1.0";

export const equipmentEvidenceSourceTaxonomy: readonly EvidenceSourcePolicy[] = [
  policy("verified_catalog_fact", "fact", "Nominal product identity and manufacturer specifications.", ["equipment identity", "source name", "source reference", "retrieval or verification date"], "Recheck against the same source and product identity.", "Source-document identity; duplicate mirrors are not independent.", "Source accuracy and product-revision uncertainty.", false, "Verified specification"),
  policy("direct_physical_measurement", "measurement", "Observed physical quantity for one identified variant/specimen.", ["equipment and variant identity", "raw value and unit", "method and protocol version", "operator", "instrument metadata", "date", "trials", "condition", "limitations"], "Repeat under the same method with operator/instrument relationships preserved.", "Operator and instrument independence are classified separately.", "Resolution, calibration, repeatability, environment, and specimen variation.", false, "Measured by Ninery"),
  policy("controlled_mechanical_test", "controlled_test_result", "Response under a documented mechanical or impact condition.", ["equipment and variant identity", "raw trial output", "test fixture and instrument", "contact/location controls", "protocol version", "date", "limitations"], "Repeat controlled trials and fixtures; preserve every raw result.", "Rig, instrument, operator, and session dependence must be represented.", "Fixture repeatability, sensor uncertainty, contact placement, and specimen condition.", true, "Controlled test"),
  policy("structured_human_evaluation", "human_observation", "Perceived or experienced equipment behavior under a structured protocol.", ["equipment and variant identity", "protocol and questions", "raw responses", "evaluator identity/category", "session", "condition", "limitations"], "Repeat sessions can assess repeatability but do not create population consensus.", "Use equipment-scoped evaluator independence plus protocol participation provenance.", "Evaluator interpretation, execution, fatigue, learning, and session variation.", true, "Controlled evaluation"),
  policy("structured_field_observation", "field_observation", "Player-specific experience in a documented real-world use context.", ["player and equipment context", "variant", "usage session", "source", "experience context", "raw report", "date", "limitations"], "Comparable contexts are desirable but field conditions vary.", "Player, reporter, team/session, and repeated-use dependence remain explicit.", "Recall, context, player differences, and uncontrolled conditions.", true, "Player-reported observation"),
  policy("modeled_estimate", "inference", "A versioned prediction derived from referenced evidence.", ["model identifier and version", "input evidence references", "prediction", "uncertainty", "training scope", "out-of-distribution warning", "generated date"], "Same model and immutable inputs must reproduce the estimate.", "Model outputs sharing training data or inputs are correlated.", "Model, data coverage, calibration, and distribution shift.", true, "Modeled estimate")
] as const;

const defaultRoles = (): Record<MultiSourceEvidenceClass, "unknown"> => ({ verified_catalog_fact: "unknown", direct_physical_measurement: "unknown", controlled_mechanical_test: "unknown", structured_human_evaluation: "unknown", structured_field_observation: "unknown", modeled_estimate: "unknown" });
const humanDimensions = new Set(["startup_demand", "rotational_demand", "barrel_redirect_demand", "directional_adjustment_control", "barrel_path_repeatability", "start_stop_redirect_control"]);
const responseDimensions = new Set(["center_response_baseline", "handle_side_miss_tolerance", "end_side_miss_tolerance", "response_degradation", "usable_contact_region_breadth", "centered_response_consistency", "near_center_response_consistency"]);

export const equipmentDNAConstructEvidenceMap: readonly ConstructEvidenceStrategy[] = [
  ...physicalEvaluationProtocolV11Questions.map((question): ConstructEvidenceStrategy => ({
    construct: question.dimensionKey,
    lifecycle: question.aggregationRole === "candidate_subconstruct_only" ? "candidate" : "experimental",
    canonicalAttribute: false,
    sourceRoles: {
      ...defaultRoles(),
      verified_catalog_fact: "not_applicable",
      direct_physical_measurement: humanDimensions.has(question.dimensionKey) ? "supporting_candidate" : "unknown",
      controlled_mechanical_test: responseDimensions.has(question.dimensionKey) ? "primary_candidate" : "supporting_candidate",
      structured_human_evaluation: humanDimensions.has(question.dimensionKey) ? "primary_candidate" : "supporting_candidate",
      structured_field_observation: "supporting_candidate",
      modeled_estimate: "future_validation_candidate"
    },
    currentEvidence: "Protocol v1.1 human calibration evidence on one equipment model",
    canonicalReadiness: "not_evaluated",
    causalityWarning: "Candidate measurements and observations may coexist, but no measurement is established as a cause or determinant of this construct."
  })),
  ...["actual_mass", "overall_length", "barrel_diameter", "construction", "material"].map((construct): ConstructEvidenceStrategy => ({
    construct, lifecycle: "supported", canonicalAttribute: ["barrel_diameter", "construction", "material"].includes(construct),
    sourceRoles: {
      ...defaultRoles(),
      verified_catalog_fact: construct === "actual_mass" || construct === "overall_length" ? "supporting_candidate" : "primary_candidate",
      direct_physical_measurement: construct === "actual_mass" || construct === "overall_length" ? "primary_candidate" : "validation_candidate",
      controlled_mechanical_test: "not_applicable",
      structured_human_evaluation: "not_applicable",
      structured_field_observation: "not_applicable",
      modeled_estimate: "not_applicable"
    },
    currentEvidence: "Catalog support varies by equipment record", canonicalReadiness: "not_evaluated"
  }))
] as const;

export const physicalMeasurementInventory: readonly PhysicalMeasurementDefinition[] = [
  measurement("actual_mass", "easy_low_cost", ["accurate digital scale"], ["ounces", "grams"], "grams", "recommended", "Standardized placement, tare, resolution, and repeated-trial protocol required.", "Actual specimen mass at measurement time."),
  measurement("overall_length", "easy_low_cost", ["rigid measuring rule", "flat measurement surface"], ["inches", "centimeters", "millimeters"], "millimeters", "recommended", "Knob-to-end reference points and alignment must be standardized.", "Actual specimen overall length."),
  measurement("balance_point", "moderate_setup", ["repeatable balance fixture", "rigid rule", "level"], ["inches_from_knob", "millimeters_from_knob"], "millimeters_from_knob", "required", "Requires a standardized Ninery datum, fixture, and stability rule.", "Observed balance location; not a swing-demand ordinal."),
  measurement("center_of_mass_position", "moderate_setup", ["support jig", "rigid rule", "level"], ["inches_from_knob", "millimeters_from_knob"], "millimeters_from_knob", "required", "Method equivalence with balance point must be defined before treating these as separate measurements.", "Observed center-of-mass position under the selected method."),
  measurement("barrel_diameter", "easy_low_cost", ["digital calipers"], ["inches", "millimeters"], "millimeters", "recommended", "Contact pressure and measurement location must be standardized.", "Observed diameter at a documented location."),
  measurement("handle_diameter", "easy_low_cost", ["digital calipers"], ["inches", "millimeters"], "millimeters", "recommended", "Grip state and measurement location must be documented.", "Observed handle diameter at a documented location."),
  measurement("barrel_length", "method_not_yet_defined", ["rigid measuring rule"], ["inches", "millimeters"], "millimeters", "recommended", "A reproducible barrel start/end definition is not yet approved.", "No claim until the barrel boundary method is defined."),
  measurement("circumference", "easy_low_cost", ["flexible measuring tape"], ["inches", "millimeters"], "millimeters", "recommended", "Use only where a documented location makes circumference useful.", "Observed circumference at a documented location."),
  measurement("moment_of_inertia", "specialized_equipment", ["pendulum fixture", "timing or motion sensor", "support jig"], [], undefined, "required", "Requires a defensible protocol, physical unit, fixture validation, and uncertainty model.", "Rotational inertia under a future approved method; no behavioral inference."),
  measurement("swing_weight_equivalent", "method_not_yet_defined", ["pendulum fixture", "motion sensor"], [], undefined, "required", "Terminology, datum, calculation, and unit are not approved.", "No claim until an equivalent physical definition is approved."),
  measurement("center_of_percussion", "laboratory_grade", ["instrumented pendulum or impact system"], [], undefined, "required", "Future laboratory protocol required.", "Physical response location under a defined test."),
  measurement("vibration_characteristics", "specialized_equipment", ["accelerometer", "data acquisition system", "controlled impact fixture"], [], undefined, "required", "Sensor mounting, impact input, sampling, and analysis protocol required.", "Instrument response only; perceived vibration remains a separate claim."),
  measurement("impact_response", "laboratory_grade", ["instrumented impact system", "high-speed camera", "calibrated ball delivery"], [], undefined, "required", "Controlled location, input energy, ball, fixture, and sensor protocol required.", "Mechanical response under tested conditions, not universal forgiveness or sweet spot.")
] as const;

export const lowCostNineryMeasurementKit = [
  { item: "accurate digital scale", supports: ["actual_mass"], resolution: "must be selected and validated before protocol approval", calibration: "known check-weight status required", complexity: "low" },
  { item: "digital calipers", supports: ["barrel_diameter", "handle_diameter"], resolution: "record instrument resolution; required tolerance not yet established", calibration: "zero check and calibration status recorded", complexity: "low" },
  { item: "rigid measuring rule", supports: ["overall_length", "balance_point"], resolution: "record marked resolution", calibration: "inspect against known reference", complexity: "low" },
  { item: "repeatable balance fixture", supports: ["balance_point", "center_of_mass_position"], resolution: "method-dependent", calibration: "fixture level and datum check", complexity: "moderate" },
  { item: "level and support blocks", supports: ["fixture setup"], resolution: "not applicable", calibration: "visual/fixture check", complexity: "low" },
  { item: "stable measurement surface", supports: ["all first-wave measurements"], resolution: "not applicable", calibration: "setup check", complexity: "low" },
  { item: "optional camera or phone", supports: ["setup documentation"], resolution: "not a measurement authority", calibration: "not applicable", complexity: "low" }
] as const;

export function validateDirectMeasurement(record: DirectMeasurementRecord) {
  const errors = [
    !record.equipmentId ? "equipment_identity_required" : undefined,
    !record.equipmentVariantId ? "variant_identity_required" : undefined,
    !record.measurementType ? "measurement_type_required" : undefined,
    !Number.isFinite(record.rawValue) ? "raw_value_required" : undefined,
    !record.rawUnit ? "raw_unit_required" : undefined,
    !record.method ? "method_required" : undefined,
    !record.operatorId ? "operator_required" : undefined,
    !record.instrument.type ? "instrument_type_required" : undefined,
    !record.protocolVersion ? "protocol_version_required" : undefined
  ].filter((value): value is string => Boolean(value));
  return { valid: errors.length === 0, errors, rawValue: record.rawValue, rawUnit: record.rawUnit, nominalSpecificationChanged: false, behavioralInferenceCreated: false };
}

export function normalizePhysicalMeasurement(value: number, rawUnit: string, normalizedUnit: string) {
  if (!Number.isFinite(value)) throw new Error("Measurement value must be finite.");
  const conversions: Record<string, number> = { "ounces:grams": 28.349523125, "grams:ounces": 1 / 28.349523125, "inches:millimeters": 25.4, "centimeters:millimeters": 10, "millimeters:inches": 1 / 25.4, "inches_from_knob:millimeters_from_knob": 25.4 };
  if (rawUnit === normalizedUnit) return { rawValue: value, rawUnit, normalizedValue: value, normalizedUnit, conversionVersion: "1.0" };
  const factor = conversions[`${rawUnit}:${normalizedUnit}`];
  if (!factor) throw new Error(`Unsupported physical unit conversion: ${rawUnit} to ${normalizedUnit}.`);
  return { rawValue: value, rawUnit, normalizedValue: value * factor, normalizedUnit, conversionVersion: "1.0" };
}

export function classifyMeasurementIndependence(left: Pick<DirectMeasurementRecord, "operatorId" | "instrument">, right: Pick<DirectMeasurementRecord, "operatorId" | "instrument">): MeasurementIndependence {
  const sameOperator = left.operatorId === right.operatorId;
  const sameInstrument = Boolean(left.instrument.identifier && right.instrument.identifier && left.instrument.identifier === right.instrument.identifier);
  return sameOperator ? sameInstrument ? "same_operator_same_instrument" : "same_operator_different_instrument" : sameInstrument ? "different_operator_same_instrument" : "different_operator_different_instrument";
}

export function assessCorroboration(classes: readonly MultiSourceEvidenceClass[], directions: readonly string[]): { state: CorroborationState; causalClaimAllowed: false } {
  if (!classes.length) return { state: "insufficient_evidence", causalClaimAllowed: false };
  if (new Set(directions).size > 1) return { state: "conflicting_evidence", causalClaimAllowed: false };
  if (new Set(classes).size === 1) return { state: classes.length === 1 ? "single_source" : "multi_source_uncorroborated", causalClaimAllowed: false };
  return { state: "directionally_correlated", causalClaimAllowed: false };
}

export function classifyMultiSourceConflict(classes: readonly MultiSourceEvidenceClass[]): MultiSourceConflictType {
  const values = new Set(classes);
  if (values.has("modeled_estimate")) return "model_observation_conflict";
  if (values.has("direct_physical_measurement") && values.has("structured_human_evaluation")) return "measurement_observation_conflict";
  if (values.has("structured_field_observation") && values.has("controlled_mechanical_test")) return "field_controlled_conflict";
  if (values.size === 1 && values.has("structured_human_evaluation")) return "human_observation_conflict";
  return "methodological_review_required";
}

export function buildPhysicalMeasurementPilotPlan(input: { baselineEquipmentId: string; comparisonEquipmentId: string }) {
  return {
    version: "1.0", baselineEquipmentId: input.baselineEquipmentId, comparisonEquipmentId: input.comparisonEquipmentId,
    firstWave: ["actual_mass", "overall_length", "balance_point", "barrel_diameter", "handle_diameter"],
    secondWave: ["moment_of_inertia", "vibration_characteristics", "impact_response"],
    firstWaveTrials: { actual_mass: 3, overall_length: 3, balance_point: 5, barrel_diameter: 3, handle_diameter: 3 },
    qualityControls: ["Verify both equipment and variant identities.", "Record raw values and units for every trial.", "Record operator, method, instrument resolution and calibration status.", "Preserve nominal catalog specifications separately.", "Document condition, setup, environment, and limitations."],
    expectedEvidenceClass: "direct_physical_measurement" as const,
    atlasNextStep: "combined_measurement_and_human" as const,
    atlasNextStepReason: "The strategy maps physical quantities and perceptual constructs to distinct evidence classes; measurement and structured human observation answer complementary questions.",
    fabricatedMeasurements: 0, atlasHumanSessionCreated: false, atlasEvidenceCreated: 0, writesPerformed: false
  };
}

export function buildEquipmentDNAMultiSourceStrategyReport() {
  return { version: EQUIPMENT_DNA_MULTI_SOURCE_STRATEGY_VERSION, taxonomy: equipmentEvidenceSourceTaxonomy, constructs: equipmentDNAConstructEvidenceMap, corroborationStates: ["single_source", "multi_source_uncorroborated", "directionally_correlated", "cross_method_support", "conflicting_evidence", "insufficient_evidence"], conflictPolicy: "Preserve source-specific evidence; never blindly average, discard, or force consensus.", constructLifecycle: ["experimental", "candidate", "supported", "redefinition_candidate", "redundant_candidate", "retirement_candidate", "retired"], constructsRetired: 0, trustLabels: equipmentEvidenceSourceTaxonomy.map((item) => item.trustLabel), writesPerformed: false, canonicalEvaluationsCreated: 0, canonicalEvaluationsModified: 0, numericReferencesCreated: 0, recommendationChanged: false } as const;
}
export function buildPhysicalMeasurementFeasibilityReport() { return { version: EQUIPMENT_PHYSICAL_MEASUREMENT_STRATEGY_VERSION, measurements: physicalMeasurementInventory, lowCostKit: lowCostNineryMeasurementKit, writesPerformed: false, canonicalPromotion: "not_part_of_ticket_063" as const }; }

function policy(sourceClass: MultiSourceEvidenceClass, claimKind: EvidenceSourcePolicy["claimKind"], supports: string, requiredProvenance: readonly string[], reproducibility: string, independenceSemantics: string, uncertainty: string, corroborationRequired: boolean, trustLabel: string): EvidenceSourcePolicy { return { sourceClass, claimKind, supports, requiredProvenance, reproducibility, independenceSemantics, uncertainty, canonicalEligibility: "deferred", corroborationRequired, recommendationParticipation: "future_policy_required", trustLabel }; }
function measurement(key: string, feasibility: PhysicalMeasurementDefinition["feasibility"], equipment: readonly string[], supportedRawUnits: readonly string[], normalizedUnit: string | undefined, repeatedTrials: PhysicalMeasurementDefinition["repeatedTrials"], methodStatus: string, potentialClaim: string): PhysicalMeasurementDefinition { return { key, evidenceClass: "direct_physical_measurement", feasibility, equipment, supportedRawUnits, normalizedUnit, repeatedTrials, methodStatus, potentialClaim, behavioralInferenceAllowed: false }; }
