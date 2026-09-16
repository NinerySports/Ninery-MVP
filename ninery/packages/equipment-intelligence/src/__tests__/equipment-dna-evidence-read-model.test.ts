import assert from "node:assert/strict";
import test from "node:test";
import { buildEquipmentDNAEvidenceReadModel, multiSourceEvidenceClassValues, type EquipmentDNAEvidenceRecordInput } from "../index.js";

const equipmentId = "6cf0f7fa-c8c2-4ce7-a36e-6ad1c52cc56c";
const variantId = "af5ff27c-aedd-4f56-88c3-c1ec4b70affa";

test("read model preserves physical observation, derivation, specimen, and session semantics", () => {
  const model = build([physical("barrel_diameter", "circumference_derived_diameter", {
    measurementSessionId: "measurement-01", specimenReference: "specimen-01", protocol: "Ninery Physical Measurement Protocol", protocolVersion: "1.0",
    method: "circumference_derived_diameter", observedQuantity: "circumference", observedAggregate: 8, observedUnit: "inches", trials: [8, 8, 8], limitations: ["Flexible tape measurement."]
  }, { value: 64.68056887254626, unit: "millimeters", derived: true, derivedQuantity: "diameter", derivationMethod: "diameter_equals_circumference_divided_by_pi", independentMeasurement: false })]);
  const item = model.evidenceByClass.direct_physical_measurement[0]!;
  assert.equal(item.knowledgeLevel, "specimen");
  assert.equal(item.specimenReference, "specimen-01");
  assert.equal(item.sessionReference, "measurement-01");
  assert.equal(item.aggregate, 8);
  assert.equal(item.derivation?.quantity, "diameter");
  assert.equal(item.derivation?.independentMeasurement, false);
  assert.notDeepEqual(item.rawObservation, item.normalizedRepresentation);
});

test("direct-caliper and circumference-derived methods remain distinct", () => {
  const model = build([
    physical("barrel_diameter", "circumference_derived_diameter", { specimenReference: "one", measurementSessionId: "one", method: "circumference_derived_diameter" }, { value: 64, derived: true, independentMeasurement: false }),
    physical("barrel_diameter", "maximum_direct_caliper", { specimenReference: "two", measurementSessionId: "two", method: "maximum_direct_caliper" }, { value: 64, derived: false })
  ]);
  assert.deepEqual(model.evidenceByClass.direct_physical_measurement.map((item) => item.method), ["circumference_derived_diameter", "maximum_direct_caliper"]);
  assert.equal(model.evidenceByClass.direct_physical_measurement[1]?.derivation, undefined);
});

test("same-unit normalized measurement is not mislabeled as a separate derivation", () => {
  const model = build([physical("actual_mass", "stable_tared_digital_scale", { specimenReference: "one", measurementSessionId: "one", observedQuantity: "mass", aggregate: 604, rawUnit: "grams" }, { value: 604, unit: "grams", observedUnit: "grams", derived: true, independentMeasurement: false })]);
  assert.equal(model.evidenceByClass.direct_physical_measurement[0]?.derivation, undefined);
});

test("catalog facts and specimen measurements remain separate and differences stay descriptive", () => {
  const model = build([physical("actual_mass", "stable_tared_digital_scale", { specimenReference: "specimen-01", measurementSessionId: "session-01", observedAggregate: 604, observedUnit: "grams" }, { value: 604, unit: "grams" })]);
  assert.equal(model.evidenceByClass.verified_catalog_fact.find((item) => item.claimKey === "weight")?.knowledgeLevel, "variant");
  assert.equal(model.evidenceByClass.direct_physical_measurement[0]?.knowledgeLevel, "specimen");
  assert.equal(model.differences.find((item) => item.key === "weight:actual_mass")?.state, "descriptive_difference");
  assert.equal(model.differences.some((item) => item.state === "potential_conflict_requires_review"), false);
});

test("30 catalog inches and 762 normalized specimen millimeters agree exactly", () => {
  const model = build([physical("overall_length", "flat_surface_longitudinal_endpoint", { specimenReference: "specimen-01", measurementSessionId: "session-01", aggregate: 30, rawUnit: "inches" }, { value: 762, unit: "millimeters", observedUnit: "inches", derived: true })]);
  assert.equal(model.differences.find((item) => item.key === "length:overall_length")?.state, "consistent_or_no_material_difference");
});

test("30 catalog inches and 30 specimen inches agree exactly", () => {
  const model = build([physical("overall_length", "flat_surface_longitudinal_endpoint", { specimenReference: "specimen-01", aggregate: 30, rawUnit: "inches" }, { value: 30, unit: "inches" })]);
  assert.equal(model.differences.find((item) => item.key === "length:overall_length")?.state, "consistent_or_no_material_difference");
});

test("20 catalog ounces and 604 specimen grams remain a descriptive difference", () => {
  const model = build([physical("actual_mass", "stable_tared_digital_scale", { specimenReference: "specimen-01", aggregate: 604, rawUnit: "grams" }, { value: 604, unit: "grams" })]);
  assert.equal(model.differences.find((item) => item.key === "weight:actual_mass")?.state, "descriptive_difference");
});

test("catalog 2.625 inches and circumference-derived 2.54648 inches remain descriptive", () => {
  const model = buildEquipmentDNAEvidenceReadModel({ identity: { equipmentId, manufacturer: "DeMarini", model: "The Goods", variant: { id: variantId } }, catalogFacts: [{ key: "barrel_diameter", value: 2.625, unit: "inches", level: "equipment", sourceName: "catalog" }], records: [physical("barrel_diameter", "circumference_derived_diameter", { specimenReference: "specimen-01", aggregate: 8, rawUnit: "inches", observedQuantity: "circumference" }, { value: 64.68056887254626, unit: "millimeters", derived: true, derivationMethod: "diameter_equals_circumference_divided_by_pi" })] });
  assert.equal(model.differences.find((item) => item.key === "barrel_diameter:barrel_diameter")?.state, "descriptive_difference");
  assert.equal(model.differences.some((item) => item.state === "potential_conflict_requires_review"), false);
});

test("exact agreement uses no epsilon or tolerance", () => {
  const model = build([physical("overall_length", "flat_surface_longitudinal_endpoint", { specimenReference: "specimen-01", aggregate: 30, rawUnit: "inches" }, { value: 762.0000000000001, unit: "millimeters" })]);
  assert.equal(model.differences.find((item) => item.key === "length:overall_length")?.state, "descriptive_difference");
});

test("human evidence preserves v1.0 and v1.1 protocol, evaluator, session, and categorical values", () => {
  const model = build([human("human-v10", "startup_demand", "1.0", "session-v10", "evaluator-a", "moderate"), human("human-v11", "startup_demand", "1.1", "session-v11", "evaluator-a", "high")]);
  const items = model.evidenceByClass.structured_human_evaluation;
  assert.deepEqual(items.map((item) => item.protocolVersion), ["1.0", "1.1"]);
  assert.deepEqual(items.map((item) => item.sessionReference), ["session-v10", "session-v11"]);
  assert.ok(items.every((item) => item.operatorOrEvaluatorReference === "evaluator-a"));
  assert.deepEqual(items.map((item) => (item.rawObservation as Record<string, unknown>).value), ["moderate", "high"]);
  assert.equal(model.constructSupport.find((item) => item.construct === "startup_demand")?.supportState, "single_source_support");
});

test("v1.1 persisted dimension keys feed construct inventory without changing their record attribute", () => {
  const record = human("dimension", "swing_effort", "1.1", "session-v11", "evaluator-a", "moderate");
  const model = build([{ ...record, rawValue: { ...(record.rawValue as Record<string, unknown>), dimensionKey: "startup_demand", observation: "moderate" }, normalizedValue: undefined }]);
  const item = model.evidenceByClass.structured_human_evaluation[0]!;
  assert.equal(item.claimKey, "startup_demand");
  assert.equal(item.recordAttributeKey, "swing_effort");
  assert.equal(item.normalizedRepresentation, "moderate");
  assert.equal(model.constructSupport.find((support) => support.construct === "startup_demand")?.supportState, "single_source_support");
});

test("independent evaluators produce multiple-source support without asserting synthesis", () => {
  const model = build([human("a", "startup_demand", "1.1", "one", "evaluator-a", "moderate"), human("b", "startup_demand", "1.1", "two", "evaluator-b", "moderate")]);
  const support = model.constructSupport.find((item) => item.construct === "startup_demand")!;
  assert.equal(support.supportState, "multiple_source_support");
  assert.equal(support.sourceCount, 2);
  assert.equal(support.synthesisSufficient, false);
});

test("all evidence classes and missing knowledge remain explicit without placeholder values", () => {
  const model = build([]);
  assert.deepEqual(Object.keys(model.evidenceByClass), [...multiSourceEvidenceClassValues]);
  assert.ok(model.missingEvidenceClasses.includes("controlled_mechanical_test"));
  assert.ok(model.missingEvidenceClasses.includes("structured_field_observation"));
  assert.ok(model.missingEvidenceClasses.includes("modeled_estimate"));
  assert.equal(JSON.stringify(model).includes(":50"), false);
  assert.equal(model.evidence.some((item) => item.evidenceClass === "modeled_estimate"), false);
  assert.deepEqual(model.firewalls, { canonicalChanges: false, numericReferenceChanges: false, modeledEstimatesCreated: false, recommendationImpact: "none", writesPerformed: false });
});

test("equipment and variant filtering is honored by repository-shaped input", () => {
  const records = [physical("actual_mass", "scale", { specimenReference: "kept" }, { value: 604 }), { ...physical("actual_mass", "scale", { specimenReference: "other" }, { value: 500 }), equipmentId: "other" }];
  const filtered = records.filter((record) => record.equipmentId === equipmentId && record.equipmentVariantId === variantId);
  const model = build(filtered);
  assert.equal(model.evidenceByClass.direct_physical_measurement.length, 1);
  assert.equal(model.evidenceByClass.direct_physical_measurement[0]?.specimenReference, "kept");
});

function build(records: readonly EquipmentDNAEvidenceRecordInput[]) {
  return buildEquipmentDNAEvidenceReadModel({
    identity: { equipmentId, manufacturer: "DeMarini", model: "The Goods USA", modelYear: 2023, certification: "USA", variant: { id: variantId, sku: "DEM-THE-GOODS-USA-30-20", lengthInches: 30, weightOunces: 20, dropWeight: -10 } },
    catalogFacts: [{ key: "weight", value: 20, unit: "ounces", level: "variant", sourceName: "Equipment catalog" }, { key: "length", value: 30, unit: "inches", level: "variant", sourceName: "Equipment catalog" }], records
  });
}

function physical(attributeKey: string, method: string, rawValue: Record<string, unknown>, normalizedValue: Record<string, unknown>): EquipmentDNAEvidenceRecordInput {
  return { id: `${attributeKey}:${String(rawValue.specimenReference ?? "specimen")}:${method}`, equipmentId, equipmentVariantId: variantId, targetLevel: "variant", attributeKey, sourceType: "objective_measurement", sourceName: "Ninery Physical Measurement Protocol v1.0", sourceReference: `physical-measurement:session:${attributeKey}`, sourceDate: "2026-09-02", method: "instrument_measurement", rawValue, normalizedValue, unit: String(normalizedValue.unit ?? "unknown"), status: "active", evaluatorReference: "operator-01" };
}

function human(id: string, attributeKey: string, protocolVersion: string, sessionId: string, evaluator: string, value: string): EquipmentDNAEvidenceRecordInput {
  return { id, equipmentId, equipmentVariantId: variantId, targetLevel: "variant", attributeKey, sourceType: "structured_expert_evaluation", sourceName: `Physical evaluation protocol ${protocolVersion}`, sourceReference: `physical-bat-evaluation:${protocolVersion}:${sessionId}:${attributeKey}`, sourceDate: "2026-09-01", method: "standardized_rubric", rawValue: { protocolVersion, sessionId, evaluatorId: evaluator, value }, normalizedValue: { value }, status: "active", evaluatorReference: evaluator };
}
