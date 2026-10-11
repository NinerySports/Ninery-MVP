import assert from "node:assert/strict";
import test from "node:test";
import { assessStrongerConstructEvidence } from "@ninery/equipment-intelligence";
import { protocolCandidate } from "./stronger-evidence.fixture.js";
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
  const record = { ...protocolCandidate("equipment", "variant"), id, status };
  const admissibility = assessStrongerConstructEvidence({ request, records: [record], variants: [{ id: "variant", equipmentId: "equipment" }] })[0]!;
  return { ...admissibility.evidence!, sourceType: record.sourceType, attributeDefinitionVersion: "1.0", constructRole, admissibility };
}

function service(stronger: GovernedStrongerEvidence[], current: GovernedSupportingContextEntry[], historical: GovernedSupportingContextEntry[]) {
  let reads = 0;
  const repository: GovernedConstructEvidenceRepository = { async readSnapshot() {
    reads++;
    return { stronger, admissibility: stronger.map(item => item.admissibility), supporting: { current, historical, semantics: "snapshot_at_read_time_not_historical_as_of" } };
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
  assert.equal(result.directEvidenceRecordCount, 0);
  assert.deepEqual(result.knownIndependentStrongerGroups, []);
  assert.ok(result.strongerEvidence.every(item => item.admissibility.permittedAssessment === "calibration_only"));
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

for (const kind of ["session", "specimen", "instrument", "upstream"] as const) {
  test(`distinct evaluators sharing ${kind} do not establish independent stronger sources`, async () => {
    const records = ["evaluator-a", "evaluator-b"].map((evaluator, index) => {
      const record = protocolCandidate("equipment", "variant", `session-${index}`, evaluator);
      assert.ok(record.rawValue && typeof record.rawValue === "object" && !Array.isArray(record.rawValue));
      return { ...record, id: `record-${index}`, rawValue: { ...record.rawValue,
        ...(kind === "session" ? { sessionId: "shared-session" } : {}),
        ...(kind === "specimen" ? { specimenReference: "shared-specimen" } : {}),
        ...(kind === "instrument" ? { instrument: { instrumentReference: "shared-instrument" } } : {}),
        ...(kind === "upstream" ? { inputEvidenceReferences: ["shared-input"] } : {}) } };
    });
    const assessments = assessStrongerConstructEvidence({ request, records, variants: [{ id: "variant", equipmentId: "equipment" }] });
    assert.ok(assessments.every(item => item.dependence.state === "independent_evaluator"));
    assert.ok(assessments.every(item => item.dependence.relationships.some(relation => relation.kind === kind)));
    // Exercise the direct-evidence branch independently of today's calibration-only gate.
    const stronger: GovernedStrongerEvidence[] = assessments.map(item => ({ ...item.evidence!, sourceType: item.sourceType,
      attributeDefinitionVersion: item.attributeDefinitionVersion, constructRole: "primary_candidate",
      admissibility: { ...item, permittedAssessment: "construct_evidence" } }));
    const result = await service(stronger, [], []).projection.load(request);
    assert.equal(result.directEvidenceRecordCount, 2);
    assert.deepEqual(result.knownIndependentStrongerGroups, []);
    assert.deepEqual(result.strongerEvidenceAdmissibility.map(item => item.dependence), assessments.map(item => item.dependence));
    assert.ok(Object.values(result.authority).every(value => value === false || value === 0));
  });
}

for (const state of ["independent_evaluator", "repeat_evaluator", "unresolved"] as const) {
  test(`${state} alone cannot populate stronger-source independence`, async () => {
    const record = evidence("record");
    const stronger = { ...record, admissibility: { ...record.admissibility, permittedAssessment: "construct_evidence" as const,
      dependence: { ...record.admissibility.dependence, state, evaluatorGroup: "evaluator-only" } } };
    const result = await service([stronger], [], []).projection.load(request);
    assert.equal(result.directEvidenceRecordCount, 1);
    assert.deepEqual(result.knownIndependentStrongerGroups, []);
    assert.deepEqual(result.strongerEvidence[0]?.admissibility.dependence, stronger.admissibility.dependence);
  });
}
