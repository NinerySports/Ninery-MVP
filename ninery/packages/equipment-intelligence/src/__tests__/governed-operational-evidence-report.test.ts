import assert from "node:assert/strict";
import test from "node:test";
import { assessStrongerConstructEvidence, assessStrongerEvidenceDependence, composeGovernedOperationalEvidenceReport, formatGovernedOperationalEvidenceReport, reviewProtocolV11CalibrationSession, buildEquipmentDNAEvidenceReadModel, assessEquipmentDNAConstructSynthesisReadiness, buildPhysicalMeasurementSessionTemplate, buildPhysicalMeasurementEvidence, type StrongerEvidenceCandidate } from "../index.js";
import { calibrationSession, measurementCandidate } from "./stronger-evidence.fixture.js";

const request = { equipmentId: "equipment", equipmentVariantId: "variant", construct: "startup_demand" };
function human(actor = "actor", sessionId = "session"): StrongerEvidenceCandidate {
  const packet = { ...calibrationSession("equipment", "variant", actor), sessionId };
  const review = reviewProtocolV11CalibrationSession(packet);
  assert.equal(review.complete, true);
  const row = review.evidence[0]!;
  return { id: row.id, equipmentId: row.equipmentId, equipmentVariantId: row.equipmentVariantId, targetLevel: "equipment",
    attributeKey: row.attributeKey, attributeDefinitionVersion: "1.0", sourceType: "structured_expert_evaluation", sourceName: "Protocol v1.1 calibration",
    sourceReference: row.sourceReference, sourceDate: row.evaluationDate, method: "standardized_rubric", rawValue: row.rawValue, status: "active", evaluatorReference: row.evaluatorId };
}
function compose(records: readonly StrongerEvidenceCandidate[], scoped = request, directCount = 0) {
  const admissibility = assessStrongerConstructEvidence({ request: scoped, records, variants: [{ id: "variant", equipmentId: "equipment" }, { id: "other", equipmentId: "equipment" }] });
  const dependence = assessStrongerEvidenceDependence({ request: scoped, assessments: admissibility, contextRecords: records });
  const projection = { directEvidenceRecordCount: directCount, descriptiveState: directCount ? "direct_evidence_present" as const : "no_direct_evidence" as const,
    gaps: ["no_current_primary_construct_evidence"], blockers: ["synthesis_policy_not_established", "synthesis_not_permitted"],
    currentSupportingContext: [{ decisionId: "support" }], historicalSupportingContext: [{ decisionId: "historical" }] };
  return composeGovernedOperationalEvidenceReport({ identity: { equipmentId: "equipment", manufacturer: "Test", model: "Test", variant: { id: scoped.equipmentVariantId } },
    catalogFacts: [], inventory: records, constructs: [{ request: scoped, projection, admissibility, dependence }] });
}
function noIndependence(report: ReturnType<typeof compose>) {
  assert.equal(report.constructs[0]!.sourceIndependence, "not_established");
  assert.deepEqual(report.constructs[0]!.knownIndependentStrongerGroups, []);
  assert.deepEqual(report.constructs[0]!.dependence.independentGroups, []);
  assert.ok(Object.values(report.authority).every(value => value === false));
}

test("#085 authentic legacy defect A is reproduced only by the explicitly retained simulation", () => {
  const records = [human("alice", "a"), human("bob", "b")];
  const model = buildEquipmentDNAEvidenceReadModel({ identity: { equipmentId: "equipment", manufacturer: "Test", model: "Test", variant: { id: "variant" } }, catalogFacts: [], records });
  const legacy = assessEquipmentDNAConstructSynthesisReadiness({ readModel: model, crossEquipmentCalibrationState: "single_equipment_only", equipmentCoverageCount: 1 });
  assert.equal(model.interpretation, "legacy_descriptive_inventory");
  assert.equal(legacy.interpretation, "legacy_simulation_only");
  assert.equal(legacy.constructs.find(item => item.construct === "startup_demand")!.independentSourceCount, 2);
  const governed = compose(records);
  noIndependence(governed);
  assert.equal(governed.constructs[0]!.applicableCalibrationObservations.length, 2);
});
for (const [name, records] of [
  ["different evaluators", [human("alice", "a"), human("bob", "b")]],
  ["different sessions", [human("alice", "a"), human("alice", "b")]],
  ["missing dependence information", [human()]],
  ["arbitrary group strings", [{ ...human(), rawValue: { ...human().rawValue as object, independenceGroupId: "asserted-positive-group", independentSourceContribution: 1 } }]],
  ["shared upstream input", [human("alice", "a"), human("bob", "b")].map(row => ({ ...row, rawValue: { ...row.rawValue as object, inputEvidenceReferences: ["external:shared-input"] } }))]
] as const) test("#085 no source independence from " + name, () => noIndependence(compose(records)));

test("#085 authentic equipment-target variant A calibration never contributes to variant B", () => {
  const row = human();
  assert.equal(row.targetLevel, "equipment");
  const result = compose([row], { ...request, equipmentVariantId: "other" });
  const item = result.constructs[0]!;
  assert.equal(result.inventory.length, 1);
  assert.equal(item.applicableCalibrationObservations.length, 0);
  assert.equal(item.admissibleConstructEvidence.length, 0);
  assert.equal(item.directEvidenceRecordCount, 0);
  assert.ok(item.excludedObservations[0]!.exclusions.includes("observed_variant_mismatch"));
});
test("#085 calibration and supporting context remain separate from direct construct evidence", () => {
  const item = compose([human()]).constructs[0]!;
  assert.equal(item.applicableCalibrationObservations.length, 1);
  assert.equal(item.admissibleConstructEvidence.length, 0);
  assert.equal(item.directEvidenceRecordCount, 0);
  assert.equal(item.supportingContext.directEvidenceContribution, 0);
  assert.deepEqual(item.supportingContext.currentDecisionIds, ["support"]);
  assert.deepEqual(item.supportingContext.historicalDecisionIds, ["historical"]);
  assert.equal(item.readiness, "synthesis_not_permitted");
});
for (const status of ["disputed", "withdrawn", "superseded", "inactive"]) test("#085 status " + status + " remains excluded", () => {
  const item = compose([{ ...human(), status }]).constructs[0]!;
  assert.equal(item.excludedObservations.length, 1);
  assert.equal(item.applicableCalibrationObservations.length, 0);
  assert.equal(item.admissibleConstructEvidence.length, 0);
});
for (const [name, row] of [
  ["missing acquisition metadata", { ...human(), rawValue: { ...human().rawValue as object, drySwingBlocks: undefined } }],
  ["unsupported protocol", { ...human(), rawValue: { ...human().rawValue as object, protocolVersion: "9.0" } }],
  ["unsupported source", { ...human(), sourceType: "other" }],
  ["unresolved field acquisition", { ...human(), sourceType: "field_observation", attributeKey: "startup_demand", method: "structured_feedback" }]
] as const) test("#085 fails closed for " + name, () => {
  const item = compose([row]).constructs[0]!;
  assert.equal(item.applicableCalibrationObservations.length, 0);
  assert.equal(item.admissibleConstructEvidence.length, 0);
  assert.equal(item.excludedObservations.length + item.unresolvedObservations.length, 1);
});
test("#085 report wording retains provenance without positive independence or legacy readiness", () => {
  const output = formatGovernedOperationalEvidenceReport(compose([human("alice", "a"), human("bob", "b")]));
  assert.match(output, /Source independence: not_established/);
  assert.ok(output.includes("evaluator/operator alice"));
  assert.match(output, /session a/);
  assert.match(output, /calibration_only/);
  assert.doesNotMatch(output, /independent_same_method|provenance-aware independent|synthesis_eligible|independence group/);
});
test("#085 unknown construct inventory remains diagnostic and does not get a fallback class", () => {
  const row = { ...human(), attributeKey: "unapproved", rawValue: {}, sourceType: "other" };
  const result = compose([row]);
  assert.deepEqual(result.unassessedInventoryIds, [row.id]);
  assert.equal(result.constructs[0]!.admissibleConstructEvidence.length, 0);
});
test("#085 preserves physical provenance and limits specimen display filtering to inventory", () => {
  const row = measurementCandidate();
  const result = compose([row]);
  const output = formatGovernedOperationalEvidenceReport(result, { specimenReference: "specimen" });
  assert.match(output, /specimen specimen; instrument scale/);
  assert.match(output, /inventory display only/);
  assert.equal(result.inventory[0]!.rawValue, row.rawValue);
});
test("#085 composition is deterministic, immutable, and forwards #081 readiness blockers", () => {
  const rows = [human("bob", "b"), human("alice", "a")];
  const before = JSON.stringify(rows);
  assert.deepEqual(compose(rows), compose([...rows].reverse()));
  assert.equal(JSON.stringify(rows), before);
  assert.deepEqual(compose(rows).constructs[0]!.blockers, ["synthesis_policy_not_established", "synthesis_not_permitted"]);
});

function physical(sessionId: string, specimen: string, instrument: string): StrongerEvidenceCandidate {
  const template = buildPhysicalMeasurementSessionTemplate({ equipmentId: "equipment", equipmentVariantId: "variant", manufacturer: "Test", model: "Test", modelYear: 2026, certification: "USA", nominalLengthInches: 30, nominalWeightOunces: 20, nominalDrop: -10 });
  const session = { ...template, measurementSessionId: sessionId, specimenReference: specimen, operatorId: "operator", measurementDate: "2026-10-01T12:00:00.000Z",
    equipmentCondition: "normal_used_condition" as const, physicalVerification: { ...template.physicalVerification, confidence: "confident" as const, verifiedAt: "2026-10-01T11:00:00.000Z", verifiedBy: "operator" } };
  const block = { ...template.measurementBlocks[0]!, methodCompliant: true,
    instrument: { instrumentType: "digital_scale", instrumentReference: instrument, calibrationStatus: "operator_checked" as const },
    trials: [1, 2, 3].map(trialNumber => ({ trialNumber, value: 570, repositioned: true })) };
  const row = buildPhysicalMeasurementEvidence(session, block, "complete_repeatable");
  return { id: row.id, equipmentId: row.equipmentId, equipmentVariantId: row.equipmentVariantId, targetLevel: "variant", attributeKey: row.attributeKey,
    attributeDefinitionVersion: "physical-measurement-1.0", sourceType: "objective_measurement", sourceName: "Physical measurement", sourceReference: row.sourceReference,
    sourceDate: row.sourceDate, method: "instrument_measurement", rawValue: row.rawValue, normalizedValue: row.normalizedValue, unit: row.unit, status: "active", evaluatorReference: row.operatorId };
}
test("#085 different specimens and instruments do not establish independence even for direct measurements", () => {
  const rows = [physical("a", "specimen-a", "scale-a"), physical("b", "specimen-b", "scale-b")];
  const result = compose(rows, { ...request, construct: "actual_mass" }, 2);
  noIndependence(result);
  assert.equal(result.constructs[0]!.admissibleConstructEvidence.length, 2);
  assert.equal(result.constructs[0]!.directEvidenceRecordCount, 2);
  assert.equal(result.constructs[0]!.descriptiveState, "direct_evidence_present");
  assert.equal(result.constructs[0]!.admissibleConstructEvidence[0]!.value.kind, "numeric");
  assert.equal(result.constructs[0]!.readiness, "synthesis_not_permitted");
});
