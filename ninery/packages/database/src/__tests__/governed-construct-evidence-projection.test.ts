import assert from "node:assert/strict";
import test from "node:test";
import type { EquipmentDNAEvidenceItem } from "@ninery/equipment-intelligence";
import { GovernedConstructEvidenceProjectionService, type GovernedConstructEvidenceRepository, type GovernedStrongerEvidence } from "../governed-construct-evidence-projection.js";
import type { GovernedSupportingContextEntry } from "../governed-supporting-context-projection.js";

const request = { equipmentId: "equipment", equipmentVariantId: "variant", construct: "startup_demand" };
const authority = { role: "supporting_context" as const, directEvidenceContribution: 0 as const,
  canonicalValueCreated: false as const, numericValueCreated: false as const,
  synthesisEligibilityGranted: false as const, recommendationAuthorityGranted: false as const };

function context(id: string, status: "current" | "historical", direction = "lower", group = "group-1"): GovernedSupportingContextEntry {
  return { decisionId: id, status, exclusions: status === "historical" ? ["review_not_current"] : [],
    decidedAt: "2026-10-01T00:00:00.000Z", construct: "startup_demand", direction, identityScope: "exact_variant",
    provenance: { sourceId: "source", documentId: "document", extractionRunId: "run", rawClaimId: "raw", normalizedClaimId: "normalized",
      identityAssertionId: "identity", dependencyAssessmentId: "dependency", dependencyType: "independent_observation",
      independenceGroupId: group, independence: "reviewed_independent", constructRelationshipId: "construct",
      qualificationDecisionId: "q2", reviewDecisionId: "r2", equipmentId: "equipment", equipmentVariantId: "variant" }, authority };
}

function evidence(id: string, status = "active", constructRole: GovernedStrongerEvidence["constructRole"] = "primary_candidate"): GovernedStrongerEvidence {
  const item: EquipmentDNAEvidenceItem = { id, evidenceClass: "structured_human_evaluation", claimKey: "startup_demand",
    recordAttributeKey: "startup_demand", knowledgeLevel: "variant", targetLevel: "variant", equipmentId: "equipment",
    equipmentVariantId: "variant", method: "standardized_rubric", sourceName: "human", rawObservation: {},
    limitations: [], independenceGroup: "evaluator-1", status };
  return { ...item, sourceType: "structured_expert_evaluation", attributeDefinitionVersion: "1.0", constructRole };
}

function service(stronger: GovernedStrongerEvidence[], current: GovernedSupportingContextEntry[], historical: GovernedSupportingContextEntry[]) {
  let reads = 0;
  const repository: GovernedConstructEvidenceRepository = { async readSnapshot() {
    reads++;
    return { stronger, supporting: { current, historical, semantics: "snapshot_at_read_time_not_historical_as_of" } };
  } };
  return { projection: new GovernedConstructEvidenceProjectionService(repository), reads: () => reads };
}

test("support alone cannot meet the primary-evidence gap or gain authority", async () => {
  const subject = service([], [context("r2", "current")], [context("r1", "historical")]);
  const result = await subject.projection.load(request);
  assert.equal(subject.reads(), 1);
  assert.equal(result.directEvidenceRecordCount, 0);
  assert.deepEqual(result.gaps, ["no_current_primary_construct_evidence", "supporting_context_cannot_replace_primary_evidence"]);
  assert.equal(result.currentSupportingContext.length, 1);
  assert.deepEqual(result.historicalSupportingContext[0]?.exclusions, ["review_not_current"]);
  assert.deepEqual(result.authority, { directEvidenceContributionFromSupport: 0, canonicalValueCreated: false,
    numericValueCreated: false, synthesisEligibilityGranted: false, compatibilityAuthorityGranted: false,
    recommendationAuthorityGranted: false, decisionBookAuthorityGranted: false });
  assert.equal(result.semantics, "snapshot_at_read_time_not_historical_as_of");
});

test("stronger evidence preserves class, status, provenance and construct role", async () => {
  const subject = service([evidence("b"), evidence("a"), evidence("withdrawn", "withdrawn"), evidence("contextual", "active", "supporting_candidate")], [], []);
  const result = await subject.projection.load(request);
  assert.deepEqual(result.strongerEvidence.map(item => item.id), ["a", "b", "contextual"]);
  assert.equal(result.directEvidenceRecordCount, 2);
  assert.deepEqual(result.knownIndependentStrongerGroups, ["evaluator-1"]);
  assert.equal(result.strongerEvidence[0]?.evidenceClass, "structured_human_evaluation");
  assert.equal(result.strongerEvidence[0]?.attributeDefinitionVersion, "1.0");
  assert.deepEqual(result.excludedStrongerEvidence.map(item => item.id), ["withdrawn"]);
  assert.equal(result.descriptiveState, "review_required");
  assert.equal(result.authority.synthesisEligibilityGranted, false);
});

test("duplicate and contradictory support remains separate context, never direct evidence", async () => {
  const subject = service([], [context("b", "current", "higher"), context("a", "current", "lower"), context("c", "current", "lower")], []);
  const result = await subject.projection.load(request);
  assert.deepEqual(result.currentSupportingContext.map(item => item.decisionId), ["a", "b", "c"]);
  assert.deepEqual(result.contextualDirections, ["higher", "lower"]);
  assert.deepEqual(result.currentSupportingGroups, ["group-1"]);
  assert.equal(result.directEvidenceRecordCount, 0);
  assert.equal("evidenceClass" in result.currentSupportingContext[0]!, false);
});

test("dependent or unestablished context cannot become an independent source group", async () => {
  const dependent = context("dependent", "current");
  const subject = service([], [{ ...dependent, provenance: { ...dependent.provenance, dependencyType: "syndicated_from",
    independence: "dependent", upstreamClaimId: "upstream" } }], []);
  const result = await subject.projection.load(request);
  assert.deepEqual(result.currentSupportingGroups, []);
  assert.equal(result.directEvidenceRecordCount, 0);
  assert.equal(result.authority.synthesisEligibilityGranted, false);
});

test("unsupported constructs fail before any repository read", async () => {
  const subject = service([], [], []);
  await assert.rejects(() => subject.projection.load({ ...request, construct: "unknown_construct" }));
  assert.equal(subject.reads(), 0);
});
