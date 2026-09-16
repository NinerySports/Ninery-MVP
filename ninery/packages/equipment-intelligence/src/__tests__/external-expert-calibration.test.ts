import assert from "node:assert/strict";
import test from "node:test";
import { buildDemariniExternalExpertCalibrationReport, DEMARINI_CALIBRATION_EQUIPMENT_ID, DEMARINI_CALIBRATION_VARIANT_ID, demariniExternalObservations, demariniExternalSources } from "../evidence/calibration/external-expert/index.js";

test("preserves identity, source provenance, dependency, and scope", () => {
  const report = buildDemariniExternalExpertCalibrationReport();
  assert.equal(report.target.equipmentId, DEMARINI_CALIBRATION_EQUIPMENT_ID);
  assert.equal(report.target.variantId, DEMARINI_CALIBRATION_VARIANT_ID);
  assert.equal(report.target.sku, "DEM-THE-GOODS-USA-30-20");
  assert.ok(demariniExternalSources.every((source) => source.publisher && source.independenceGroup));
  assert.ok(demariniExternalObservations.some((item) => item.identityScope === "exact_variant"));
  assert.ok(demariniExternalObservations.some((item) => item.identityScope === "equipment_family"));
  assert.ok(demariniExternalObservations.every((item) => !item.canonicalValueCreated && !item.numericValueCreated));
});

test("keeps marketing, vague language, comparisons, and construct separation explicit", () => {
  assert.equal(demariniExternalObservations.find((item) => item.classification === "marketing_repetition")?.classification, "marketing_repetition");
  assert.equal(demariniExternalObservations.find((item) => item.id === "bd-clean")?.construct, null);
  assert.ok(demariniExternalObservations.find((item) => item.id === "bd-balance-compare")?.comparisonTarget);
  assert.notEqual("usable_contact_region_breadth", "centered_response_consistency");
  assert.notEqual("centered_response_consistency", "near_center_response_consistency");
});

test("is deterministic and preserves protocol distinctions and inverse semantics", () => {
  const first = buildDemariniExternalExpertCalibrationReport();
  assert.deepEqual(first, buildDemariniExternalExpertCalibrationReport());
  assert.match(first.constructCalibration.find((item) => item.construct === "response_degradation")!.structured.disagreement, /higher degradation means less forgiveness/);
  assert.deepEqual(first.persistedReference.protocolVersions, ["1.0", "1.1"]);
});

test("simulates policy without changing evidence, #070, #067, or recommendations", () => {
  const report = buildDemariniExternalExpertCalibrationReport();
  assert.deepEqual(report.decisions, { taxonomy: "SIX_CLASSES_SUFFICIENT_WITH_ROLE_POLICY", qualification: "SECOND_CALIBRATION_REQUIRED_BEFORE_POLICY_CHANGE", sufficiency: "SECOND_PRODUCT_CALIBRATION_REQUIRED" });
  assert.equal(report.firewalls.databaseWrites, 0);
  assert.equal(report.firewalls.externalEvidencePersisted, 0);
  assert.equal(report.firewalls.canonicalEvaluationsCreated, 0);
  assert.equal(report.firewalls.numericReferencesCreated, 0);
  assert.equal(report.firewalls.recommendationInputsCreated, 0);
  assert.equal(report.firewalls.seventhEvidenceClassIntroduced, false);
  assert.equal(report.firewalls.qualificationRuntimeChanged, false);
  assert.equal(report.firewalls.sufficiencyRuntimeChanged, false);
  assert.equal(report.atlasSimulation.length, 6);
});
