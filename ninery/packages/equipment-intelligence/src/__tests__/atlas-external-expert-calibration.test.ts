import assert from "node:assert/strict";
import test from "node:test";
import { ATLAS_USSSA_PILOT_EQUIPMENT_ID, ATLAS_USSSA_PILOT_EXCLUDED_EQUIPMENT_ID, ATLAS_USSSA_PILOT_EXCLUDED_VARIANT_ID, ATLAS_USSSA_PILOT_VARIANT_ID } from "../evidence/acquisition/pilots/index.js";
import { atlasExternalObservations, atlasExternalSources, buildAtlasExternalExpertCalibrationReport, buildCrossProductSupportingRoleValidationReport, buildDemariniExternalExpertCalibrationReport } from "../evidence/calibration/external-expert/index.js";

test("uses only the clean 2026 Atlas USSSA 30/20/-10 identity", () => {
  const report = buildAtlasExternalExpertCalibrationReport();
  assert.equal(report.target.equipmentId, ATLAS_USSSA_PILOT_EQUIPMENT_ID);
  assert.equal(report.target.variantId, ATLAS_USSSA_PILOT_VARIANT_ID);
  assert.equal(report.target.certification, "USSSA");
  assert.equal(report.target.modelYear, 2026);
  assert.deepEqual([report.target.length, report.target.nominalWeight, report.target.drop], [30, 20, -10]);
  assert.equal(report.excludedHistoricalIdentity.equipmentId, ATLAS_USSSA_PILOT_EXCLUDED_EQUIPMENT_ID);
  assert.equal(report.excludedHistoricalIdentity.variantId, ATLAS_USSSA_PILOT_EXCLUDED_VARIANT_ID);
  assert.equal(report.excludedHistoricalIdentity.used, false);
  assert.ok(atlasExternalObservations.every((item) => item.certification === "USSSA" && item.modelYear === 2026));
});

test("reuses all six #071 observations without changing their provenance", () => {
  const reused = atlasExternalObservations.filter((item) => item.provenance === "reused_071");
  assert.equal(reused.length, 6);
  assert.ok(reused.every((item) => item.originalClaimId?.startsWith("claim-")));
  assert.equal(buildAtlasExternalExpertCalibrationReport().ticket071.originalQualification, "context_only");
  assert.equal(atlasExternalObservations.filter((item) => item.provenance === "new_073").length, 12);
});

test("preserves scope, dependency, direction, comparisons, and conservative mappings", () => {
  assert.ok(atlasExternalObservations.some((item) => item.scope === "drop_family"));
  assert.ok(atlasExternalObservations.some((item) => item.scope === "equipment_family"));
  assert.ok(atlasExternalSources.some((item) => item.independence === "unknown_dependency"));
  assert.ok(atlasExternalObservations.some((item) => item.direction === "comparative_only" && item.comparisonTarget));
  assert.ok(atlasExternalObservations.some((item) => item.classification === "useful_unmapped" && item.construct === null));
  assert.ok(atlasExternalObservations.some((item) => item.classification === "ambiguous" && item.construct === null));
  assert.ok(atlasExternalObservations.every((item) => !item.canonicalValueCreated && !item.numericValueCreated));
});

test("keeps all Protocol v1.1 constructs separate and response degradation inverse", () => {
  const report = buildCrossProductSupportingRoleValidationReport();
  assert.equal(report.comparison.length, 13);
  assert.equal(new Set(report.comparison.map((item) => item.construct)).size, 13);
  assert.notEqual("startup_demand", "rotational_demand");
  assert.notEqual("barrel_redirect_demand", "directional_adjustment_control");
  assert.notEqual("barrel_path_repeatability", "start_stop_redirect_control");
  assert.notEqual("usable_contact_region_breadth", "centered_response_consistency");
  assert.notEqual("centered_response_consistency", "near_center_response_consistency");
  assert.notEqual("handle_side_miss_tolerance", "end_side_miss_tolerance");
  assert.match(buildDemariniExternalExpertCalibrationReport().constructCalibration.find((item) => item.construct === "response_degradation")!.structured.disagreement, /higher degradation means less forgiveness/);
});

test("reports cross-product evidence behavior, never product performance or Atlas calibration", () => {
  const report = buildAtlasExternalExpertCalibrationReport();
  assert.match(report.calibrationKind, /not external-to-Ninery behavioral calibration/);
  const cross = buildCrossProductSupportingRoleValidationReport();
  assert.match(cross.classification, /NOT A PRODUCT PERFORMANCE COMPARISON/);
  assert.deepEqual(cross.decisions, { taxonomy: "SIX_CLASSES_SUFFICIENT_WITH_ROLE_POLICY", qualification: "PROVISIONAL_SUPPORTING_ROLE_READY_FOR_IMPLEMENTATION", sufficiency: "ENOUGH_FOR_PROVISIONAL_SUPPORTING_POLICY", globalPolicy: "CONSTRUCT_SPECIFIC_POLICY_SUPPORTED" });
});

test("policy remains non-implemented and all persistence and authority firewalls stay closed", () => {
  const atlas = buildAtlasExternalExpertCalibrationReport();
  assert.equal(atlas.current070Baseline.runtimeChanged, false);
  assert.ok(Object.entries(atlas.firewalls).every(([, value]) => value === 0 || value === false));
  const policy = buildCrossProductSupportingRoleValidationReport().proposedPolicy;
  assert.equal(policy.implemented, false);
  assert.equal(policy.directEvidence, false);
  assert.equal(policy.canonicalAuthority, false);
  assert.equal(policy.numericAuthority, false);
  assert.equal(policy.recommendationAuthority, false);
});

test("Atlas and cross-product reports are deterministic", () => {
  assert.deepEqual(buildAtlasExternalExpertCalibrationReport(), buildAtlasExternalExpertCalibrationReport());
  assert.deepEqual(buildCrossProductSupportingRoleValidationReport(), buildCrossProductSupportingRoleValidationReport());
});
