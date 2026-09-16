import assert from "node:assert/strict";
import test from "node:test";
import { analyzeEquipmentClaimProvenance, buildSyntheticEquipmentClaimProvenanceFixture, claimAppliesToIdentity, equipmentClaimProvenanceTaxonomies, EquipmentClaimProvenanceValidationError, multiSourceEvidenceClassValues, validateEquipmentClaimProvenance } from "../index.js";

test("source, document, raw claim, normalized claim, and evidence class remain distinct", () => {
  const graph = buildSyntheticEquipmentClaimProvenanceFixture(); const analysis = analyzeEquipmentClaimProvenance(graph);
  assert.equal(graph.sources[0]?.sourceType, "manufacturer_primary"); assert.equal(graph.normalizedClaims[0]?.evidenceClass, "verified_catalog_fact");
  assert.notEqual(graph.sources[0]?.id, graph.documents[0]?.id); assert.notEqual(graph.rawClaims[0]?.id, graph.normalizedClaims[0]?.id);
  assert.equal(graph.normalizedClaims.filter((item) => item.rawClaimId === "claim-manufacturer-spec").length, 3);
  assert.equal(analysis.firewalls.normalizationIncreasedIndependence, false);
  assert.deepEqual(equipmentClaimProvenanceTaxonomies.evidenceClasses, multiSourceEvidenceClassValues);
});

test("manufacturer and three syndicated retailers remain one lineage group", () => {
  const graph = buildSyntheticEquipmentClaimProvenanceFixture(); const analysis = analyzeEquipmentClaimProvenance(graph);
  const group = analysis.lineageGroups.find((item) => item.id === "lineage-manufacturer")!;
  assert.equal(group.rawClaimIds.filter((id) => id === "claim-manufacturer-spec" || id.startsWith("claim-retailer")).length, 4);
  assert.ok(analysis.documentCount > analysis.independentClaimGroupCount); assert.ok(analysis.rawClaimCount > analysis.independentClaimGroupCount);
  assert.equal(group.normalizedClaimIds.length >= 6, true);
});

test("matching dependent values do not create corroboration and unknown dependency is conservative", () => {
  const graph = buildSyntheticEquipmentClaimProvenanceFixture(); const unknown = { ...graph.dependencies[1]!, id: "dep-unknown", dependencyType: "unknown_dependency" as const };
  validateEquipmentClaimProvenance({ ...graph, dependencies: [...graph.dependencies, unknown] });
  assert.equal(analyzeEquipmentClaimProvenance(graph).firewalls.normalizationIncreasedIndependence, false);
  assert.equal(unknown.dependencyType, "unknown_dependency");
});

test("independent expert observation remains observational and creates no construct value", () => {
  const graph = buildSyntheticEquipmentClaimProvenanceFixture(); const raw = graph.rawClaims.find((item) => item.id === "claim-reviewer")!; const relationship = graph.constructRelationships.find((item) => item.id === "relationship-review")!;
  assert.equal(raw.claimType, "subjective_observation"); assert.equal(raw.independenceGroupId, "lineage-reviewer"); assert.equal(relationship.role, "candidate_only"); assert.equal(relationship.constructValueCreated, false);
});

test("marketing language remains non-authoritative and cannot create behavioral DNA", () => {
  const graph = buildSyntheticEquipmentClaimProvenanceFixture(); const raw = graph.rawClaims.find((item) => item.id === "claim-marketing")!; const relationship = graph.constructRelationships.find((item) => item.id === "relationship-marketing")!;
  assert.equal(raw.claimType, "marketing_claim"); assert.equal(raw.authority, "not_authoritative_for_claim"); assert.equal(relationship.role, "not_applicable"); assert.equal(analyzeEquipmentClaimProvenance(graph).firewalls.marketingCreatedBehavioralDNA, false);
});

test("AI extraction is processing provenance and changes neither verification nor independence", () => {
  const graph = buildSyntheticEquipmentClaimProvenanceFixture(); const raw = graph.rawClaims.find((item) => item.id === "claim-reviewer")!; const run = graph.extractionRuns.find((item) => item.id === raw.extractionRunId)!;
  assert.equal(run.extractorType, "ai_model"); assert.equal(raw.verificationState, "unverified_extracted"); assert.equal(graph.sources.some((item) => item.id === run.id), false); assert.equal(analyzeEquipmentClaimProvenance(graph).firewalls.aiCreatedEvidenceSource, false);
});

test("identity firewall rejects certification, year, variant, and ambiguous leakage", () => {
  const identities = buildSyntheticEquipmentClaimProvenanceFixture().identities; const usa = identities.find((item) => item.id.includes("usa-2026-30"))!;
  assert.equal(claimAppliesToIdentity(usa, usa), true); assert.equal(claimAppliesToIdentity(usa, identities.find((item) => item.id.includes("bbcor"))!), false); assert.equal(claimAppliesToIdentity(usa, identities.find((item) => item.id.includes("2025"))!), false); assert.equal(claimAppliesToIdentity(usa, identities.find((item) => item.id.includes("ambiguous"))!), false);
});

test("independent disagreement remains an explicit conflict without winner or tolerance", () => {
  const conflict = analyzeEquipmentClaimProvenance(buildSyntheticEquipmentClaimProvenanceFixture()).conflicts.find((item) => item.claimKey === "barrel_diameter")!;
  assert.equal(conflict.state, "independent_disagreement"); assert.equal(conflict.automaticWinnerSelected, false); assert.equal(conflict.toleranceApplied, false); assert.deepEqual(conflict.independenceGroupIds, ["lineage-manufacturer", "lineage-measurement"]);
});

test("modeled derivative inherits input lineage and cannot corroborate its input", () => {
  const graph = buildSyntheticEquipmentClaimProvenanceFixture(); const lineage = graph.modeledLineages[0]!; const outputRaw = graph.rawClaims.find((item) => item.id === "claim-model")!;
  assert.ok(lineage.inputIndependenceGroupIds.includes(outputRaw.independenceGroupId)); assert.equal(analyzeEquipmentClaimProvenance(graph).firewalls.modeledDerivativeCorroboratedInput, false);
});

test("supersession preserves historical claims and publication differs from retrieval", () => {
  const graph = buildSyntheticEquipmentClaimProvenanceFixture(); assert.ok(graph.rawClaims.some((item) => item.id === "claim-historical" && item.verificationState === "superseded")); assert.equal(graph.rawClaims.find((item) => item.id === "claim-current")?.supersedesClaimId, "claim-historical");
  const document = graph.documents.find((item) => item.id === "doc-manufacturer")!; assert.notEqual(document.publishedAt, document.retrievedAt);
});

test("validation rejects missing parents, self dependencies, dependent independence, and cycles", () => {
  const graph = buildSyntheticEquipmentClaimProvenanceFixture();
  assert.throws(() => validateEquipmentClaimProvenance({ ...graph, normalizedClaims: [{ ...graph.normalizedClaims[0]!, rawClaimId: "missing" }, ...graph.normalizedClaims.slice(1)] }), EquipmentClaimProvenanceValidationError);
  assert.throws(() => validateEquipmentClaimProvenance({ ...graph, dependencies: [...graph.dependencies, { id: "self", claimId: "claim-reviewer", upstreamClaimId: "claim-reviewer", dependencyType: "derived_from", dependencyRationale: "invalid", reviewedState: "review_pending" }] }), /self_dependency/);
  assert.throws(() => validateEquipmentClaimProvenance({ ...graph, dependencies: [...graph.dependencies, { id: "bad-independent", claimId: "claim-reviewer", upstreamClaimId: "claim-manufacturer-spec", dependencyType: "copied_from", dependencyRationale: "invalid", reviewedState: "review_pending" }] }), /dependent_claim_marked_independent/);
  assert.throws(() => validateEquipmentClaimProvenance({ ...graph, dependencies: [...graph.dependencies, { id: "cycle-a", claimId: "claim-reviewer", upstreamClaimId: "claim-manufacturer-spec", dependencyType: "unknown_dependency", dependencyRationale: "invalid", reviewedState: "review_pending" }, { id: "cycle-b", claimId: "claim-manufacturer-spec", upstreamClaimId: "claim-reviewer", dependencyType: "unknown_dependency", dependencyRationale: "invalid", reviewedState: "review_pending" }] }), /claim_dependency_cycle/);
});

test("modeled lineage and construct relationships require referenced parents", () => {
  const graph = buildSyntheticEquipmentClaimProvenanceFixture();
  assert.throws(() => validateEquipmentClaimProvenance({ ...graph, modeledLineages: [{ ...graph.modeledLineages[0]!, inputNormalizedClaimIds: [] }] }), /input_lineage_required/);
  assert.throws(() => validateEquipmentClaimProvenance({ ...graph, constructRelationships: [{ ...graph.constructRelationships[0]!, normalizedClaimId: "missing" }] }), /missing_reference/);
});

test("verification and review are independent, and review does not create independence", () => {
  const graph = buildSyntheticEquipmentClaimProvenanceFixture(); const claim = graph.rawClaims.find((item) => item.id === "claim-reviewer")!; const before = analyzeEquipmentClaimProvenance(graph).independentClaimGroupCount;
  const reviewed = { ...graph, rawClaims: graph.rawClaims.map((item) => item.id === claim.id ? { ...item, reviewState: "reviewed_accepted" as const } : item) };
  assert.equal(claim.verificationState, "unverified_extracted"); assert.notEqual(claim.reviewState, claim.verificationState); assert.equal(analyzeEquipmentClaimProvenance(reviewed).independentClaimGroupCount, before);
});

test("analysis ordering and output are deterministic and preserve all firewalls", () => {
  const graph = buildSyntheticEquipmentClaimProvenanceFixture(); const shuffled = { ...graph, rawClaims: [...graph.rawClaims].reverse(), normalizedClaims: [...graph.normalizedClaims].reverse() };
  assert.deepEqual(analyzeEquipmentClaimProvenance(graph), analyzeEquipmentClaimProvenance(shuffled));
  assert.deepEqual(analyzeEquipmentClaimProvenance(graph).firewalls, { aiCreatedEvidenceSource: false, normalizationIncreasedIndependence: false, marketingCreatedBehavioralDNA: false, constructValuesCreated: false, modeledDerivativeCorroboratedInput: false, writesPerformed: false, recommendationImpact: "none" });
});
