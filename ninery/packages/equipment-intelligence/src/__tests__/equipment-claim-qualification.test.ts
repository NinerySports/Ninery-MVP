import assert from "node:assert/strict";
import test from "node:test";
import { analyzeEquipmentClaimProvenance, buildSyntheticEquipmentClaimProvenanceFixture, EQUIPMENT_CLAIM_QUALIFICATION_CONTRACT_VERSION, equipmentClaimQualificationStateValues, equipmentClaimProvenanceTaxonomies, multiSourceEvidenceClassValues, qualifyEquipmentClaim, validateEquipmentDNAEvidenceRecord, type EquipmentClaimProvenanceGraph } from "../index.js";

const fixture = () => buildSyntheticEquipmentClaimProvenanceFixture();
const target = (graph: EquipmentClaimProvenanceGraph) => graph.identities.find((item) => item.id === "identity-atlas-usa-2026-30-20")!;
const qualify = (graph: EquipmentClaimProvenanceGraph, normalizedClaimId: string, targetIdentity = target(graph)) => qualifyEquipmentClaim({ graph, normalizedClaimId, targetIdentity });

test("contract is versioned and qualification grants no downstream authority", () => {
  const result = qualify(fixture(), "norm-weight");
  assert.equal(EQUIPMENT_CLAIM_QUALIFICATION_CONTRACT_VERSION, "1.0"); assert.deepEqual(equipmentClaimQualificationStateValues, ["qualified", "context_only", "review_required", "not_eligible"]); assert.equal(result.state, "qualified");
  assert.deepEqual(result.firewalls, { canonicalValueCreated: false, synthesisEligibilityGranted: false, recommendationEligibilityGranted: false, persistencePerformed: false });
});

test("manufacturer specification qualifies claim by claim and preserves provenance", () => {
  const graph = fixture(); const result = qualify(graph, "norm-weight"); const proposed = result.proposedEvidenceInput!;
  assert.equal(result.proposedEvidenceClass, "verified_catalog_fact"); assert.equal(proposed.attributeKey, "weight"); assert.equal(proposed.targetLevel, "variant"); assert.equal(proposed.equipmentVariantId, "atlas-usa-30-20");
  assert.equal(proposed.provenance.documentId, "doc-manufacturer"); assert.equal(proposed.provenance.rawClaimId, "claim-manufacturer-spec"); assert.equal(proposed.provenance.normalizedClaimId, "norm-weight"); assert.equal(proposed.independenceGroupId, "lineage-manufacturer"); assert.equal(proposed.qualificationContractVersion, "1.0"); assert.equal(validateEquipmentDNAEvidenceRecord(proposed).valid, true);
});

test("source confirmation independence and review do not qualify unstructured observation", () => {
  const result = qualify(fixture(), "norm-review"); assert.equal(result.state, "context_only"); assert.equal(result.proposedEvidenceInput, undefined); assert.equal(result.constructRelationship?.role, "candidate_only"); assert.ok(result.reasons.includes("unstructured_observation_context_only"));
});

test("marketing claim is not behavioral authority", () => {
  const result = qualify(fixture(), "norm-marketing"); assert.equal(result.state, "not_eligible"); assert.ok(result.blockers.includes("marketing_behavior_forbidden")); assert.equal(result.proposedEvidenceInput, undefined); assert.equal(result.firewalls.canonicalValueCreated, false);
});

test("syndicated retailer remains context in its upstream group", () => {
  const result = qualify(fixture(), "norm-retailer-a"); assert.equal(result.state, "context_only"); assert.equal(result.dependency, "syndicated_from"); assert.ok(result.reasons.includes("shared_dependency_preserved")); assert.equal(result.proposedEvidenceInput, undefined);
});

test("retailer-only unknown dependency requires review", () => {
  const graph = fixture(); const changed = { ...graph, dependencies: graph.dependencies.map((item) => item.claimId === "claim-retailer-a" ? { ...item, dependencyType: "unknown_dependency" as const, upstreamClaimId: undefined } : item) };
  const result = qualify(changed, "norm-retailer-a"); assert.equal(result.state, "review_required"); assert.ok(result.gaps.includes("authority_requires_review")); assert.ok(result.gaps.includes("dependency_unknown"));
});

test("structured human and field observations qualify but unstructured reviews do not", () => {
  const base = fixture(); assert.equal(qualify(base, "norm-review").state, "context_only");
  const human = structured(base, "ninery_internal_evaluation", "structured_human_evaluation", "subjective_observation"); const humanResult = qualify(human, "norm-review"); assert.equal(humanResult.state, "qualified"); assert.equal(humanResult.proposedEvidenceClass, "structured_human_evaluation"); assert.equal(humanResult.proposedEvidenceInput?.evidenceRole, "supporting_context");
  const field = structured(base, "ninery_structured_field_observation", "structured_field_observation", "field_observation"); const fieldResult = qualify(field, "norm-review"); assert.equal(fieldResult.state, "qualified"); assert.equal(fieldResult.proposedEvidenceClass, "structured_field_observation"); assert.equal(fieldResult.firewalls.canonicalValueCreated, false);
});

test("physical measurement and mechanical test use only matching classes", () => {
  const physical = noConflict(fixture()); const measured = qualify(physical, "norm-barrel-measured"); assert.equal(measured.state, "qualified"); assert.equal(measured.proposedEvidenceClass, "direct_physical_measurement");
  const mechanical = structured(physical, "ninery_controlled_test", "controlled_mechanical_test", "test_observation", "norm-barrel-measured"); const tested = qualify(mechanical, "norm-barrel-measured"); assert.equal(tested.state, "qualified"); assert.equal(tested.proposedEvidenceClass, "controlled_mechanical_test");
});

test("modeled estimate retains lineage and can qualify only as modeled estimate", () => {
  const result = qualify(fixture(), "norm-model"); assert.equal(result.state, "qualified"); assert.equal(result.proposedEvidenceClass, "modeled_estimate"); assert.equal(result.proposedEvidenceInput?.sourceType, "internal_derived"); assert.equal(result.proposedEvidenceInput?.independenceGroupId, "lineage-manufacturer"); assert.equal(result.firewalls.synthesisEligibilityGranted, false);
});

test("AI requires review unless the underlying source path is reviewed", () => {
  const pending = ai(fixture(), "review_pending"); const pendingResult = qualify(pending, "norm-weight"); assert.equal(pendingResult.state, "review_required"); assert.ok(pendingResult.gaps.includes("extraction_review_incomplete"));
  const reviewed = ai(fixture(), "reviewed_accepted"); const result = qualify(reviewed, "norm-weight"); assert.equal(result.state, "qualified"); assert.ok(result.reasons.includes("underlying_source_not_extractor")); assert.equal(result.proposedEvidenceInput?.provenance.sourceId, "manufacturer");
});

test("identity firewall blocks ambiguity year certification and variant leakage", () => {
  const graph = fixture(); const identities = [graph.identities.find((item) => item.id === "identity-atlas-ambiguous")!, graph.identities.find((item) => item.id === "identity-atlas-bbcor-2026")!, graph.identities.find((item) => item.id === "identity-atlas-usa-2025")!, { ...target(graph), id: "other-variant", equipmentVariantId: "other", lengthInches: 31, weightOunces: 21 }];
  for (const identity of identities) { const result = qualify(graph, "norm-weight", identity); assert.notEqual(result.state, "qualified"); assert.ok(result.blockers.includes("identity_scope_mismatch")); }
  const conflicting = { ...graph, identities: graph.identities.map((item) => item.id === target(graph).id ? { ...item, certainty: "conflicting" as const } : item) }; assert.equal(qualify(conflicting, "norm-weight").state, "not_eligible");
});

test("equipment scope remains distinct and no target is invented", () => {
  const graph = fixture(); const scoped = { ...graph, identities: graph.identities.map((item) => item.id === target(graph).id ? { ...item, certainty: "equipment_model_match" as const, equipmentVariantId: undefined, sku: undefined, lengthInches: undefined, weightOunces: undefined, drop: undefined } : item) };
  const result = qualify(scoped, "norm-weight"); assert.equal(result.proposedTarget?.level, "equipment"); assert.equal(result.proposedEvidenceInput?.equipmentId, "atlas-usa"); assert.equal(result.proposedEvidenceInput?.equipmentVariantId, undefined);
});

test("conflict triggers review without winner or tolerance", () => {
  const graph = fixture(); const result = qualify(graph, "norm-barrel-manufacturer"); assert.equal(result.state, "review_required"); assert.ok(result.blockers.includes("claim_conflicting")); assert.equal(result.proposedEvidenceInput, undefined);
  const conflict = analyzeEquipmentClaimProvenance(graph).conflicts.find((item) => item.claimKey === "barrel_diameter")!; assert.equal(conflict.automaticWinnerSelected, false); assert.equal(conflict.toleranceApplied, false);
});

test("superseded claim remains historical and cannot qualify as current", () => {
  const graph = fixture(); const old = graph.identities.find((item) => item.id === "identity-atlas-usa-2025")!; const result = qualify(graph, "norm-historical", old); assert.equal(result.state, "not_eligible"); assert.ok(result.blockers.includes("claim_superseded")); assert.ok(graph.normalizedClaims.some((item) => item.id === "norm-historical"));
});

test("reason gap blocker limitation and output ordering are deterministic", () => {
  const graph = fixture(); const first = qualify(graph, "norm-weight"); const second = qualify({ ...graph, rawClaims: [...graph.rawClaims].reverse(), normalizedClaims: [...graph.normalizedClaims].reverse() }, "norm-weight", target(graph)); assert.deepEqual(first, second); assert.deepEqual(first.reasons, [...first.reasons].sort()); assert.deepEqual(first.gaps, [...first.gaps].sort()); assert.deepEqual(first.blockers, [...first.blockers].sort()); assert.ok(first.limitations.length);
});

test("existing six classes and zero-write boundaries remain intact", () => {
  assert.deepEqual(equipmentClaimProvenanceTaxonomies.evidenceClasses, multiSourceEvidenceClassValues); const result = qualify(fixture(), "norm-weight"); assert.equal(result.firewalls.persistencePerformed, false); assert.equal(result.firewalls.recommendationEligibilityGranted, false); assert.equal(result.proposedEvidenceInput?.rawValue && typeof result.proposedEvidenceInput.rawValue === "object", true);
});

function structured(graph: EquipmentClaimProvenanceGraph, sourceType: "ninery_internal_evaluation" | "ninery_structured_field_observation" | "ninery_controlled_test", evidenceClass: "structured_human_evaluation" | "structured_field_observation" | "controlled_mechanical_test", claimType: "subjective_observation" | "field_observation" | "test_observation", normalizedId = "norm-review"): EquipmentClaimProvenanceGraph { const normalized = graph.normalizedClaims.find((item) => item.id === normalizedId)!; const raw = graph.rawClaims.find((item) => item.id === normalized.rawClaimId)!; return { ...graph, sources: graph.sources.map((item) => item.id === raw.sourceId ? { ...item, sourceType } : item), documents: graph.documents.map((item) => item.id === raw.documentId ? { ...item, documentType: "survey_response" as const } : item), extractionRuns: graph.extractionRuns.map((item) => item.id === raw.extractionRunId ? { ...item, reviewState: "reviewed_accepted" as const } : item), rawClaims: graph.rawClaims.map((item) => item.id === raw.id ? { ...item, claimType, verificationState: "source_confirmed" as const, reviewState: "reviewed_accepted" as const } : item), normalizedClaims: graph.normalizedClaims.map((item) => item.id === normalizedId ? { ...item, evidenceClass, verificationState: "source_confirmed" as const, reviewState: "reviewed_accepted" as const } : item) }; }
function ai(graph: EquipmentClaimProvenanceGraph, reviewState: "review_pending" | "reviewed_accepted"): EquipmentClaimProvenanceGraph { return { ...graph, rawClaims: graph.rawClaims.map((item) => item.id === "claim-manufacturer-spec" ? { ...item, extractionRunId: "extract-ai", reviewState } : item), normalizedClaims: graph.normalizedClaims.map((item) => item.rawClaimId === "claim-manufacturer-spec" ? { ...item, reviewState } : item), extractionRuns: graph.extractionRuns.map((item) => item.id === "extract-ai" ? { ...item, reviewState } : item) }; }
function noConflict(graph: EquipmentClaimProvenanceGraph): EquipmentClaimProvenanceGraph { return { ...graph, normalizedClaims: graph.normalizedClaims.map((item) => item.id === "norm-barrel-measured" ? { ...item, normalizedValue: 2.625 } : item) }; }
