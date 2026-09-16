import assert from "node:assert/strict";
import test from "node:test";
import {
  ATLAS_USSSA_PILOT_EQUIPMENT_ID,
  ATLAS_USSSA_PILOT_EXCLUDED_EQUIPMENT_ID,
  ATLAS_USSSA_PILOT_EXCLUDED_VARIANT_ID,
  ATLAS_USSSA_PILOT_VARIANT_ID,
  buildAtlasUsssaAcquisitionPilotGraph,
  buildAtlasUsssaAcquisitionPilotReport,
  qualifyEquipmentClaim
} from "../index.js";

test("pilot uses the repaired Atlas USSSA identity and excludes historical UUIDs", () => {
  const report = buildAtlasUsssaAcquisitionPilotReport();
  assert.equal(report.target.equipmentId, ATLAS_USSSA_PILOT_EQUIPMENT_ID);
  assert.equal(report.target.equipmentVariantId, ATLAS_USSSA_PILOT_VARIANT_ID);
  assert.equal(report.target.certification, "USSSA");
  assert.equal(report.target.modelYear, 2026);
  assert.equal(report.target.lengthInches, 30);
  assert.equal(report.target.weightOunces, 20);
  assert.equal(report.target.drop, -10);
  assert.equal(JSON.stringify(report).includes(ATLAS_USSSA_PILOT_EXCLUDED_EQUIPMENT_ID), false);
  assert.equal(JSON.stringify(report).includes(ATLAS_USSSA_PILOT_EXCLUDED_VARIANT_ID), false);
});

test("real-source graph preserves source documents, scope, extraction, and lineage", () => {
  const graph = buildAtlasUsssaAcquisitionPilotGraph();
  assert.equal(graph.sources.length, 5);
  assert.equal(graph.documents.length, 5);
  assert.equal(graph.rawClaims.length, 27);
  assert.equal(graph.normalizedClaims.length, 27);
  assert.ok(graph.extractionRuns.some((item) => item.method === "ai_assisted" && item.reviewState === "review_pending"));
  assert.ok(graph.extractionRuns.some((item) => item.method === "ai_assisted" && item.reviewState === "review_not_required"));
  assert.ok(graph.identities.some((item) => item.certainty === "equipment_model_match"));
  assert.ok(graph.identities.some((item) => item.certainty === "exact_variant_match"));
  assert.equal(new Set(graph.rawClaims.filter((item) => item.sourceId.includes("direct") || item.sourceId.includes("academy")).map((item) => item.independenceGroupId)).size, 1);
});

test("all normalized claims run through #070 with the expected conservative distribution", () => {
  const report = buildAtlasUsssaAcquisitionPilotReport();
  assert.deepEqual(report.qualification, { qualified: 11, context_only: 12, review_required: 0, not_eligible: 4 });
  assert.equal(report.proposedEvidenceCount, 11);
  assert.deepEqual(report.proposedEvidenceClasses, ["verified_catalog_fact"]);
  assert.equal(report.firewalls.databasePersistence, false);
  assert.equal(report.firewalls.canonicalEvaluationsCreated, 0);
  assert.equal(report.firewalls.recommendationChanges, 0);
});

test("manufacturer facts qualify while marketing never becomes behavioral evidence", () => {
  const graph = buildAtlasUsssaAcquisitionPilotGraph();
  const target = graph.identities.find((item) => item.id === "atlas-usssa-2026-30-20")!;
  const fact = qualifyEquipmentClaim({ graph, normalizedClaimId: "normalized-barrel", targetIdentity: target });
  const marketing = qualifyEquipmentClaim({ graph, normalizedClaimId: "normalized-sweet-marketing", targetIdentity: target });
  assert.equal(fact.state, "qualified");
  assert.equal(fact.proposedEvidenceInput?.equipmentId, ATLAS_USSSA_PILOT_EQUIPMENT_ID);
  assert.equal(marketing.state, "not_eligible");
  assert.ok(marketing.blockers.includes("marketing_behavior_forbidden"));
  assert.equal(marketing.proposedEvidenceInput, undefined);
});

test("retailer syndication and unknown editorial dependency remain conservative", () => {
  const graph = buildAtlasUsssaAcquisitionPilotGraph();
  const target = graph.identities.find((item) => item.id === "atlas-usssa-2026-30-20")!;
  const retailer = qualifyEquipmentClaim({ graph, normalizedClaimId: "normalized-direct-barrel", targetIdentity: target });
  const editorial = qualifyEquipmentClaim({ graph, normalizedClaimId: "normalized-reviews-light", targetIdentity: target });
  assert.equal(retailer.state, "context_only");
  assert.equal(retailer.dependency, "shared_upstream");
  assert.equal(editorial.state, "context_only");
  assert.equal(editorial.dependency, "unknown_dependency");
  assert.ok(editorial.gaps.includes("extraction_review_incomplete"));
});

test("unstructured observations stay candidate-only and never become numbers or measurements", () => {
  const graph = buildAtlasUsssaAcquisitionPilotGraph();
  const observationIds = new Set(graph.rawClaims.filter((item) => item.claimType === "subjective_observation").map((item) => item.id));
  const observations = graph.normalizedClaims.filter((item) => observationIds.has(item.rawClaimId));
  assert.equal(observations.length, 6);
  assert.ok(observations.every((item) => typeof item.normalizedValue === "string"));
  assert.ok(graph.constructRelationships.filter((item) => observations.some((claim) => claim.id === item.normalizedClaimId)).every((item) => item.role === "candidate_only" && item.constructValueCreated === false));
  assert.equal(graph.rawClaims.some((item) => item.claimType === "measurement_observation"), false);
  assert.equal(graph.modeledLineages.length, 0);
});

test("identity firewall rejects USA, BBCOR, other-year, and other-drop targets", () => {
  const graph = buildAtlasUsssaAcquisitionPilotGraph();
  const target = graph.identities.find((item) => item.id === "atlas-usssa-2026-30-20")!;
  for (const mismatch of [{ certification: "USA" }, { certification: "BBCOR" }, { modelYear: 2025 }, { drop: -5 }]) {
    const result = qualifyEquipmentClaim({ graph, normalizedClaimId: "normalized-weight", targetIdentity: { ...target, ...mismatch } });
    assert.notEqual(result.state, "qualified");
    assert.ok(result.blockers.includes("identity_scope_mismatch"));
  }
});

test("pilot report is deterministic and maintains every zero-write firewall", () => {
  assert.deepEqual(buildAtlasUsssaAcquisitionPilotReport(), buildAtlasUsssaAcquisitionPilotReport());
  const report = buildAtlasUsssaAcquisitionPilotReport();
  assert.equal(report.constructCoverage.length, 13);
  assert.equal(report.conflicts.length, 0);
  assert.equal(report.firewalls.writesPerformed, false);
  assert.equal(report.firewalls.physicalEvidenceCreated, 0);
  assert.equal(report.firewalls.modeledEvidenceCreated, 0);
});
