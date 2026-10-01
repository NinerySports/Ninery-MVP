import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { convergenceFixture } from "./reviewed-qualification.fixture.js";
import { GovernedSupportingContextBridgeService, governedSupportingContextIdempotencyKey } from "../governed-supporting-context-bridge.js";
import { PrismaGovernedSupportingContextBridgeRepository } from "../prisma-governed-supporting-context-bridge-repository.js";
import { GovernedSupportingContextProjectionService, toGovernedSupportingContextOverlay } from "../governed-supporting-context-projection.js";
import { PrismaGovernedSupportingContextProjectionRepository } from "../prisma-governed-supporting-context-projection-repository.js";
import { ExternalSupportingEvidencePersistenceService } from "../external-supporting-evidence-persistence.js";
import { PrismaExternalSupportingPersistenceRepository } from "../prisma-external-supporting-evidence-repository.js";
import type { ReviewedSupportingInterpretation } from "../external-claim-review.js";

const url = process.env.TEST_DATABASE_URL;
const integration = url ? test : test.skip;
const db = url ? new PrismaClient({ datasources: { db: { url } }, transactionOptions: { maxWait: 30000, timeout: 30000 } }) : undefined;
const interpretation: ReviewedSupportingInterpretation = { version: "1.0", policyVersion: "1.0-provisional",
  construct: "startup_demand", role: "supporting_context", identityScope: "exact_variant", direction: "lower" };

async function ready(ids?: { equipmentId: string; variantId: string; sku: string }) {
  assert.ok(db);
  const fixture = await convergenceFixture(db, ids);
  await fixture.dependency(); await fixture.construct();
  const qualification = await fixture.convergence.converge(fixture.locator);
  const review = await fixture.content(interpretation);
  const binding = review.reviewedBinding;
  const lineage = { rawClaimId: binding.rawClaimId, normalizedClaimId: binding.normalizedClaimId,
    dependencyAssessmentId: binding.dependencyAssessmentId, constructRelationshipId: binding.constructRelationshipId,
    qualificationDecisionId: qualification.id, reviewDecisionId: review.id, interpretation };
  const options = { identityScope: "exact_variant" as const, direction: "lower" as const };
  const bridge = new GovernedSupportingContextBridgeService(new PrismaGovernedSupportingContextBridgeRepository(db));
  const decision = await bridge.persist({ ...fixture.locator, expectedQualificationDecisionId: qualification.id,
    expectedReviewDecisionId: review.id, ...options, idempotencyKey: governedSupportingContextIdempotencyKey(lineage, options) });
  const request = { equipmentId: fixture.equipment.id, equipmentVariantId: fixture.variant.id, construct: "startup_demand" as const };
  const projection = new GovernedSupportingContextProjectionService(new PrismaGovernedSupportingContextProjectionRepository(db));
  return { fixture, qualification, review, decision, request, projection };
}

integration("#080 current Q2/R2 support projects with full lineage and zero authority", async () => {
  const f = await ready({ equipmentId: "748ae67e-0b10-40d6-8ef6-28d6953d1d40",
    variantId: "0844a8e0-8b9a-42ba-9b6f-50f288832e58", sku: "LS-ATLAS-USSSA-30-20" });
  const first = await f.projection.loadGovernedSupportingContext(f.request);
  assert.deepEqual(first, await f.projection.loadGovernedSupportingContext(f.request));
  assert.ok(first.current.length >= 1);
  const item = first.current.find(entry => entry.decisionId === f.decision.id)!;
  assert.equal(item.decisionId, f.decision.id);
  assert.equal(item.provenance.qualificationDecisionId, f.qualification.id);
  assert.equal(item.provenance.reviewDecisionId, f.review.id);
  assert.equal(item.provenance.independence, "reviewed_independent");
  assert.equal(item.authority.directEvidenceContribution, 0);
  assert.equal(toGovernedSupportingContextOverlay(first).synthesisEligibilityGranted, false);
  assert.equal((await f.projection.loadGovernedSupportingContext({ ...f.request, construct: "rotational_demand" })).current.length, 0);
  assert.equal((await f.projection.loadGovernedSupportingContext({ ...f.request, equipmentVariantId: randomUUID() })).current.length, 0);
});

integration("#080 D/C successors and review successor leave immutable historical support", async () => {
  assert.ok(db);
  for (const change of ["dependency", "construct", "review"] as const) {
    const f = await ready();
    if (change === "dependency") await f.fixture.dependency();
    if (change === "construct") await f.fixture.construct();
    if (change === "review") {
      const status = await f.fixture.review.inspect(f.fixture.locator, interpretation);
      await f.fixture.review.reviewClaim({ ...f.fixture.locator, credential: f.fixture.token,
        expectedStateFingerprint: status.stateFingerprint, expectedPriorDecisionId: f.review.id,
        decision: "reviewed_rejected", reason: "Human successor withdraws support.", idempotencyKey: randomUUID(),
        supportingInterpretation: interpretation });
    }
    const result = await f.projection.loadGovernedSupportingContext(f.request);
    assert.equal(result.current.length, 0);
    assert.equal(result.historical.length, 1);
    assert.equal(result.historical[0]!.decisionId, f.decision.id);
    assert.ok(result.historical[0]!.exclusions.length > 0);
  }
});

integration("#080 source governance and document successors become historical", async () => {
  assert.ok(db);
  const governance = await ready();
  const current = await db.externalEvidenceSourceGovernanceRevision.findFirstOrThrow({ where: { sourceId: governance.fixture.record.sourceId, supersededBy: { none: {} } } });
  await db.externalEvidenceSourceGovernanceRevision.create({ data: { sourceId: current.sourceId, revisionNumber: current.revisionNumber + 1,
    governanceVersion: current.governanceVersion, sourceType: current.sourceType, publisherIdentity: current.publisherIdentity,
    authorityScope: current.authorityScope!, dependencyKnowledge: current.dependencyKnowledge!, state: "active",
    reviewerType: "human", reviewerReference: "test", rationale: "Governed revision.", effectiveAt: new Date(),
    supersedesRevisionId: current.id, idempotencyKey: randomUUID() } });
  assert.equal((await governance.projection.loadGovernedSupportingContext(governance.request)).historical.length, 1);

  const document = await ready();
  const next = await document.fixture.ingestion.ingest({ ...document.fixture.input,
    document: { ...document.fixture.input.document, boundedContent: "Successor text.", capturedAt: new Date("2026-09-28") },
    extraction: { ...document.fixture.input.extraction, logicalRunKey: randomUUID(), executedAt: new Date("2026-09-28") } });
  assert.deepEqual(next.failed, []);
  const result = await document.projection.loadGovernedSupportingContext(document.request);
  assert.equal(result.current.length, 0);
  assert.equal(result.historical[0]?.decisionId, document.decision.id);
});

integration("#080 unresolved conflict excludes support; resolved conflict restores current applicability", async () => {
  assert.ok(db);
  const f = await ready();
  const conflict = await db.externalEvidenceConflictCase.create({ data: { claimKey: "startup_demand", identityScopeKey: randomUUID(),
    idempotencyKey: randomUUID(), members: { create: { normalizedClaimId: f.fixture.record.normalizedClaimId } } } });
  const blocked = await f.projection.loadGovernedSupportingContext(f.request);
  assert.deepEqual(blocked.historical[0]?.exclusions, ["conflict_unresolved"]);
  await db.externalEvidenceConflictResolution.create({ data: { conflictCaseId: conflict.id, outcome: "resolved_no_material_conflict",
    reviewerType: "human", reviewerReference: "test", rationale: "Reviewed no material conflict.", limitations: [], idempotencyKey: randomUUID() } });
  const restored = await f.projection.loadGovernedSupportingContext(f.request);
  assert.equal(restored.current[0]?.decisionId, f.decision.id);
});

integration("#080 newer extraction and catalog identity drift cannot remain current", async () => {
  assert.ok(db);
  const extraction = await ready();
  const next = await extraction.fixture.ingestion.ingest({ ...extraction.fixture.input,
    extraction: { ...extraction.fixture.input.extraction, logicalRunKey: randomUUID(), executedAt: new Date("2026-09-27") } });
  assert.deepEqual(next.failed, []);
  const afterExtraction = await extraction.projection.loadGovernedSupportingContext(extraction.request);
  assert.equal(afterExtraction.current.length, 0);
  assert.equal(afterExtraction.historical[0]?.decisionId, extraction.decision.id);

  const identity = await ready();
  await db.equipment.update({ where: { id: identity.fixture.equipment.id }, data: { model: `changed-${randomUUID()}` } });
  const afterIdentity = await identity.projection.loadGovernedSupportingContext(identity.request);
  assert.deepEqual(afterIdentity.historical[0]?.exclusions, ["identity_not_current"]);
});

integration("#080 current Q successor and opposite reviewed interpretation exclude old support", async () => {
  const qualification = await ready();
  await qualification.fixture.dependency();
  const q3 = await qualification.fixture.convergence.converge(qualification.fixture.locator);
  assert.notEqual(q3.id, qualification.qualification.id);
  const afterQ = await qualification.projection.loadGovernedSupportingContext(qualification.request);
  assert.equal(afterQ.current.length, 0);
  assert.equal(afterQ.historical[0]?.decisionId, qualification.decision.id);

  const interpretationChange = await ready();
  const opposite: ReviewedSupportingInterpretation = { ...interpretation, direction: "higher" };
  const status = await interpretationChange.fixture.review.inspect(interpretationChange.fixture.locator, opposite);
  const r3 = await interpretationChange.fixture.review.reviewClaim({ ...interpretationChange.fixture.locator,
    credential: interpretationChange.fixture.token, expectedStateFingerprint: status.stateFingerprint,
    expectedPriorDecisionId: interpretationChange.review.id, decision: "reviewed_accepted",
    reason: "Explicit opposite directional interpretation.", idempotencyKey: randomUUID(),
    supportingInterpretation: opposite });
  assert.equal(r3.reviewedBinding.supportingInterpretation?.direction, "higher");
  const afterR = await interpretationChange.projection.loadGovernedSupportingContext(interpretationChange.request);
  assert.equal(afterR.current.length, 0);
  assert.equal(afterR.historical[0]?.decisionId, interpretationChange.decision.id);
});

integration("#080 policy successor and alternate #075 persistence cannot gain current support", async () => {
  assert.ok(db);
  const policy = await ready();
  await db.externalEvidenceConstructRelationship.create({ data: {
    normalizedClaimId: policy.fixture.record.normalizedClaimId, proposedConstruct: "startup_demand",
    mappingMethod: "manual_review", mappingConfidence: "high", mappingVersion: "1.0",
    policyVersion: "1.0-provisional", role: "candidate_only", reviewState: "reviewed_accepted",
    reviewerReference: "fixture", rationale: "Supporting role withdrawn.", limitations: [],
    supersedesRelationshipId: policy.review.reviewedBinding.constructRelationshipId, idempotencyKey: randomUUID()
  } });
  const afterPolicy = await policy.projection.loadGovernedSupportingContext(policy.request);
  assert.equal(afterPolicy.current.length, 0);
  assert.equal(afterPolicy.historical[0]?.decisionId, policy.decision.id);

  const duplicate = await ready();
  const b = duplicate.review.reviewedBinding;
  const direct = new ExternalSupportingEvidencePersistenceService(new PrismaExternalSupportingPersistenceRepository(db));
  const second = await direct.persist({ rawClaimId: b.rawClaimId, normalizedClaimId: b.normalizedClaimId,
    dependencyAssessmentId: b.dependencyAssessmentId, constructRelationshipId: b.constructRelationshipId,
    qualificationDecisionId: duplicate.qualification.id, reviewDecisionId: duplicate.review.id,
    identityScope: "exact_variant", direction: "lower", idempotencyKey: `direct-replay:${randomUUID()}` });
  const opposite = await direct.persist({ rawClaimId: b.rawClaimId, normalizedClaimId: b.normalizedClaimId,
    dependencyAssessmentId: b.dependencyAssessmentId, constructRelationshipId: b.constructRelationshipId,
    qualificationDecisionId: duplicate.qualification.id, reviewDecisionId: duplicate.review.id,
    identityScope: "exact_variant", direction: "higher", idempotencyKey: `direct-opposite:${randomUUID()}` });
  const result = await duplicate.projection.loadGovernedSupportingContext(duplicate.request);
  assert.deepEqual(result.current.map(item => item.decisionId), [duplicate.decision.id]);
  assert.deepEqual(result.historical.map(item => item.decisionId).sort(), [second.id, opposite.id].sort());
  assert.deepEqual(result.historical.find(item => item.decisionId === second.id)?.exclusions, ["durable_lineage_invalid"]);
  assert.deepEqual(result.historical.find(item => item.decisionId === opposite.id)?.exclusions, ["interpretation_not_current"]);
  assert.ok(result.historical.every(item => item.provenance.independenceGroupId === result.current[0]?.provenance.independenceGroupId));
});

integration("#080 one repeatable-read snapshot does not combine pre- and post-successor state", async () => {
  assert.ok(db);
  const f = await ready();
  const repository = new PrismaGovernedSupportingContextProjectionRepository(db);
  await repository.readSnapshot(async snapshot => {
    const before = await snapshot.load(f.request);
    assert.equal(before[0]?.status, "current");
    await f.fixture.dependency();
    const sameSnapshot = await snapshot.load(f.request);
    assert.deepEqual(sameSnapshot, before);
  });
  assert.equal((await f.projection.loadGovernedSupportingContext(f.request)).historical.length, 1);
});

test.after(async () => { await db?.$disconnect(); });
