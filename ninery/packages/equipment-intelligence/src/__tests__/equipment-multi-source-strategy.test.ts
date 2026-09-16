import assert from "node:assert/strict";
import test from "node:test";
import {
  assessCorroboration,
  buildEquipmentDNAMultiSourceStrategyReport,
  buildPhysicalMeasurementFeasibilityReport,
  buildPhysicalMeasurementPilotPlan,
  classifyMeasurementIndependence,
  classifyMultiSourceConflict,
  equipmentDNAConstructEvidenceMap,
  equipmentEvidenceSourceTaxonomy,
  normalizePhysicalMeasurement,
  physicalMeasurementInventory,
  validateDirectMeasurement,
  type DirectMeasurementRecord
} from "../evidence/index.js";

test("all evidence classes remain semantically distinct", () => {
  const kinds = new Map(equipmentEvidenceSourceTaxonomy.map((item) => [item.sourceClass, item.claimKind]));
  assert.equal(kinds.get("verified_catalog_fact"), "fact");
  assert.equal(kinds.get("direct_physical_measurement"), "measurement");
  assert.equal(kinds.get("structured_human_evaluation"), "human_observation");
  assert.equal(kinds.get("structured_field_observation"), "field_observation");
  assert.equal(kinds.get("modeled_estimate"), "inference");
  assert.equal(new Set(kinds.values()).size, 6);
});

test("measurement preserves raw value, unit, method, operator, instrument, and identities", () => {
  const record = measurement();
  const result = validateDirectMeasurement(record);
  assert.equal(result.valid, true);
  assert.equal(result.rawValue, 20.4);
  assert.equal(result.rawUnit, "ounces");
  assert.equal(record.method, "scale_mass_protocol_v1");
  assert.equal(record.operatorId, "operator-01");
  assert.equal(record.instrument.identifier, "scale-01");
  assert.equal(result.nominalSpecificationChanged, false);
});

test("measurement validation requires equipment and variant identities", () => {
  assert.deepEqual(validateDirectMeasurement({ ...measurement(), equipmentId: "" }).errors, ["equipment_identity_required"]);
  assert.deepEqual(validateDirectMeasurement({ ...measurement(), equipmentVariantId: "" }).errors, ["variant_identity_required"]);
});

test("nominal catalog weight and measured mass remain separate", () => {
  const nominal = { sourceClass: "verified_catalog_fact", nominalWeightOunces: 20 } as const;
  const measured = measurement();
  assert.equal(nominal.nominalWeightOunces, 20);
  assert.equal(measured.rawValue, 20.4);
  assert.equal(validateDirectMeasurement(measured).nominalSpecificationChanged, false);
});

test("supported unit conversion is deterministic and preserves original", () => {
  const first = normalizePhysicalMeasurement(20.4, "ounces", "grams");
  assert.deepEqual(first, normalizePhysicalMeasurement(20.4, "ounces", "grams"));
  assert.equal(first.rawValue, 20.4);
  assert.equal(first.rawUnit, "ounces");
  assert.equal(first.normalizedUnit, "grams");
  assert.throws(() => normalizePhysicalMeasurement(1, "mystery", "grams"));
});

test("measurement independence uses operator and instrument terminology", () => {
  const first = measurement();
  assert.equal(classifyMeasurementIndependence(first, first), "same_operator_same_instrument");
  assert.equal(classifyMeasurementIndependence(first, { ...first, instrument: { ...first.instrument, identifier: "scale-02" } }), "same_operator_different_instrument");
  assert.equal(classifyMeasurementIndependence(first, { ...first, operatorId: "operator-02" }), "different_operator_same_instrument");
  assert.equal(classifyMeasurementIndependence(first, { ...first, operatorId: "operator-02", instrument: { ...first.instrument, identifier: "scale-02" } }), "different_operator_different_instrument");
});

test("candidate measurement relationships never create causal or behavioral assignments", () => {
  const swing = equipmentDNAConstructEvidenceMap.find((item) => item.construct === "startup_demand")!;
  assert.equal(swing.sourceRoles.direct_physical_measurement, "supporting_candidate");
  assert.match(swing.causalityWarning!, /no measurement is established as a cause/);
  assert.equal(validateDirectMeasurement(measurement()).behavioralInferenceCreated, false);
  assert.equal("swingDemandOrdinal" in measurement(), false);
});

test("mass, balance, construction, and mechanical response do not assign behavioral DNA", () => {
  for (const key of ["actual_mass", "balance_point", "impact_response"]) assert.equal(physicalMeasurementInventory.find((item) => item.key === key)?.behavioralInferenceAllowed, false);
  const construction = equipmentDNAConstructEvidenceMap.find((item) => item.construct === "construction")!;
  assert.equal("forgiveness" in construction, false);
  assert.equal("sweetSpot" in physicalMeasurementInventory.find((item) => item.key === "impact_response")!, false);
});

test("actual mass keeps nominal catalog weight separate from specimen measurement", () => {
  const strategy = equipmentDNAConstructEvidenceMap.find((item) => item.construct === "actual_mass");
  assert.equal(strategy?.sourceRoles.verified_catalog_fact, "supporting_candidate");
  assert.equal(strategy?.sourceRoles.direct_physical_measurement, "primary_candidate");
});

test("field observations remain player-context evidence rather than equipment truth", () => {
  const field = equipmentEvidenceSourceTaxonomy.find((item) => item.sourceClass === "structured_field_observation")!;
  assert.equal(field.claimKind, "field_observation");
  assert.match(field.requiredProvenance.join(" "), /player and equipment context/);
  assert.equal(field.canonicalEligibility, "deferred");
});

test("modeled estimates cannot masquerade as measurements", () => {
  const modeled = equipmentEvidenceSourceTaxonomy.find((item) => item.sourceClass === "modeled_estimate")!;
  assert.equal(modeled.claimKind, "inference");
  assert.match(modeled.requiredProvenance.join(" "), /model identifier and version/);
  assert.notEqual(modeled.trustLabel, "Measured by Ninery");
});

test("corroboration is noncausal and conflicts are not averaged", () => {
  assert.deepEqual(assessCorroboration(["direct_physical_measurement", "structured_human_evaluation"], ["higher", "higher"]), { state: "directionally_correlated", causalClaimAllowed: false });
  assert.equal(assessCorroboration(["direct_physical_measurement", "structured_human_evaluation"], ["higher", "lower"]).state, "conflicting_evidence");
  assert.equal(classifyMultiSourceConflict(["direct_physical_measurement", "structured_human_evaluation"]), "measurement_observation_conflict");
  assert.match(buildEquipmentDNAMultiSourceStrategyReport().conflictPolicy, /never blindly average/);
});

test("construct lifecycle permits evolution but retires nothing", () => {
  const report = buildEquipmentDNAMultiSourceStrategyReport();
  assert.ok(report.constructLifecycle.includes("redefinition_candidate"));
  assert.ok(report.constructLifecycle.includes("retirement_candidate"));
  assert.equal(report.constructsRetired, 0);
});

test("Protocol v1.1 dimensions remain represented and sweet spot remains noncanonical", () => {
  assert.equal(equipmentDNAConstructEvidenceMap.filter((item) => item.currentEvidence.includes("Protocol v1.1")).length, 13);
  for (const key of ["usable_contact_region_breadth", "centered_response_consistency", "near_center_response_consistency"]) {
    const item = equipmentDNAConstructEvidenceMap.find((candidate) => candidate.construct === key)!;
    assert.equal(item.lifecycle, "candidate");
    assert.equal(item.canonicalAttribute, false);
  }
  assert.ok(equipmentDNAConstructEvidenceMap.some((item) => item.construct === "response_degradation"));
});

test("strategy and feasibility reports are deterministic read-only firewalls", () => {
  const strategy = buildEquipmentDNAMultiSourceStrategyReport();
  assert.deepEqual(strategy, buildEquipmentDNAMultiSourceStrategyReport());
  assert.equal(strategy.writesPerformed, false);
  assert.equal(strategy.canonicalEvaluationsCreated, 0);
  assert.equal(strategy.canonicalEvaluationsModified, 0);
  assert.equal(strategy.numericReferencesCreated, 0);
  assert.equal(strategy.recommendationChanged, false);
  assert.equal(buildPhysicalMeasurementFeasibilityReport().writesPerformed, false);
});

test("pilot plan fabricates no values or Atlas evidence", () => {
  const plan = buildPhysicalMeasurementPilotPlan({ baselineEquipmentId: "demarini", comparisonEquipmentId: "atlas" });
  assert.deepEqual(plan.firstWave, ["actual_mass", "overall_length", "balance_point", "barrel_diameter", "handle_diameter"]);
  assert.equal(plan.atlasNextStep, "combined_measurement_and_human");
  assert.equal(plan.fabricatedMeasurements, 0);
  assert.equal(plan.atlasHumanSessionCreated, false);
  assert.equal(plan.atlasEvidenceCreated, 0);
  assert.equal(plan.writesPerformed, false);
});

function measurement(): DirectMeasurementRecord {
  return { sourceClass: "direct_physical_measurement", equipmentId: "equipment", equipmentVariantId: "variant", measurementType: "actual_mass", rawValue: 20.4, rawUnit: "ounces", measuredAt: "2026-09-02", operatorId: "operator-01", method: "scale_mass_protocol_v1", instrument: { type: "digital_scale", identifier: "scale-01", resolution: 0.1, calibrationStatus: "unknown" }, trialValues: [20.4, 20.4, 20.4], aggregateValue: 20.4, equipmentCondition: "normal_used_condition", quality: "provisional", limitations: ["Calibration status unknown."], protocolVersion: "1.0" };
}
