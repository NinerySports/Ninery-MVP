import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { convergenceFixture } from "./reviewed-qualification.fixture.js";
import { GovernedSupportingContextBridgeService, governedSupportingContextIdempotencyKey } from "../governed-supporting-context-bridge.js";
import { PrismaGovernedSupportingContextBridgeRepository } from "../prisma-governed-supporting-context-bridge-repository.js";
import { GovernedConstructEvidenceProjectionService } from "../governed-construct-evidence-projection.js";
import { PrismaGovernedConstructEvidenceProjectionRepository } from "../prisma-governed-construct-evidence-projection-repository.js";
import type { ReviewedSupportingInterpretation } from "../external-claim-review.js";

const url = process.env.TEST_DATABASE_URL;
const integration = url ? test : test.skip;
const db = url ? new PrismaClient({ datasources: { db: { url } }, transactionOptions: { maxWait: 30000, timeout: 30000 } }) : undefined;
const interpretation: ReviewedSupportingInterpretation = { version: "1.0", policyVersion: "1.0-provisional",
  construct: "startup_demand", role: "supporting_context", identityScope: "exact_variant", direction: "lower" };

async function setup() {
  assert.ok(db);
  const fixture = await convergenceFixture(db);
  await fixture.dependency(); await fixture.construct();
  const qualification = await fixture.convergence.converge(fixture.locator);
  const review = await fixture.content(interpretation);
  const binding = review.reviewedBinding;
  const lineage = { rawClaimId: binding.rawClaimId, normalizedClaimId: binding.normalizedClaimId,
    dependencyAssessmentId: binding.dependencyAssessmentId, constructRelationshipId: binding.constructRelationshipId,
    qualificationDecisionId: qualification.id, reviewDecisionId: review.id, interpretation };
  const bridge = new GovernedSupportingContextBridgeService(new PrismaGovernedSupportingContextBridgeRepository(db));
  const decision = await bridge.persist({ ...fixture.locator, expectedQualificationDecisionId: qualification.id,
    expectedReviewDecisionId: review.id, identityScope: "exact_variant", direction: "lower",
    idempotencyKey: governedSupportingContextIdempotencyKey(lineage, interpretation) });
  const projection = new GovernedConstructEvidenceProjectionService(new PrismaGovernedConstructEvidenceProjectionRepository(db));
  const request = { equipmentId: fixture.equipment.id, equipmentVariantId: fixture.variant.id, construct: "startup_demand" };
  return { fixture, decision, review, projection, request };
}

async function addEvidence(equipmentId: string, equipmentVariantId: string | undefined, source: "structured_expert_evaluation" | "other" = "structured_expert_evaluation") {
  assert.ok(db);
  return db.equipmentDNAEvidenceRecord.create({ data: { equipmentId, equipmentVariantId, targetLevel: equipmentVariantId ? "variant" : "equipment",
    attributeKey: "startup_demand", attributeDefinitionVersion: "1.0", sourceType: source, sourceName: "Disposable test evaluator",
    sourceReference: `test:${randomUUID()}`, method: source === "other" ? "manual_review" : "standardized_rubric",
    rawValue: { dimensionKey: "startup_demand", sessionId: randomUUID() }, normalizedValue: { value: "easy" },
    evaluatorReference: "test-evaluator", status: "active" } });
}

integration("#081 combines exact stronger evidence and governed context without writes or authority", async () => {
  assert.ok(db);
  const f = await setup();
  const equipmentLevel = await addEvidence(f.fixture.equipment.id, undefined);
  const variantLevel = await addEvidence(f.fixture.equipment.id, f.fixture.variant.id);
  const otherVariant = await db.equipmentVariant.create({ data: { equipmentId: f.fixture.equipment.id, lengthInches: 31, weightOunces: 21, dropWeight: -10, sku: `OTHER-${randomUUID()}` } });
  const otherEvidence = await addEvidence(f.fixture.equipment.id, otherVariant.id);
  const before = await db.externalSupportingRoleDecision.count();
  const result = await f.projection.load(f.request);
  assert.deepEqual(result.strongerEvidence.map(item => item.id).sort(), [equipmentLevel.id, variantLevel.id].sort());
  assert.equal(result.strongerEvidence.some(item => item.id === otherEvidence.id), false);
  assert.ok(result.strongerEvidence.every(item => item.evidenceClass === "structured_human_evaluation"));
  assert.equal(result.directEvidenceRecordCount, 2);
  assert.deepEqual(result.knownIndependentStrongerGroups, ["test-evaluator"]);
  assert.deepEqual(result.currentSupportingContext.map(item => item.decisionId), [f.decision.id]);
  assert.equal(result.currentSupportingContext[0]?.authority.directEvidenceContribution, 0);
  assert.equal(result.authority.synthesisEligibilityGranted, false);
  assert.equal(result.authority.canonicalValueCreated, false);
  assert.equal(result.authority.numericValueCreated, false);
  assert.equal(result.authority.compatibilityAuthorityGranted, false);
  assert.equal(result.authority.recommendationAuthorityGranted, false);
  assert.equal(result.authority.decisionBookAuthorityGranted, false);
  assert.equal(await db.externalSupportingRoleDecision.count(), before);
  assert.deepEqual(result, await f.projection.load(f.request));
  assert.equal((await f.projection.load({ ...f.request, construct: "rotational_demand" })).strongerEvidence.length, 0);
  assert.equal((await f.projection.load({ ...f.request, equipmentVariantId: otherVariant.id })).currentSupportingContext.length, 0);
  const anotherEquipment = await db.equipment.create({ data: { manufacturer: "Other", model: randomUUID(), category: "bat" } });
  assert.equal((await f.projection.load({ ...f.request, equipmentId: anotherEquipment.id, equipmentVariantId: undefined })).strongerEvidence.length, 0);
});

integration("#081 historical support remains excluded and cannot replace primary evidence", async () => {
  const f = await setup();
  await f.fixture.dependency();
  const result = await f.projection.load(f.request);
  assert.equal(result.currentSupportingContext.length, 0);
  assert.equal(result.historicalSupportingContext[0]?.decisionId, f.decision.id);
  assert.ok(result.historicalSupportingContext[0]?.exclusions.length);
  assert.equal(result.directEvidenceRecordCount, 0);
  assert.deepEqual(result.gaps, ["no_current_primary_construct_evidence"]);
  assert.equal(result.authority.synthesisEligibilityGranted, false);
});

integration("#081 conflict resolution restores only presently governed support", async () => {
  assert.ok(db);
  const f = await setup();
  const conflict = await db.externalEvidenceConflictCase.create({ data: { claimKey: "startup_demand", identityScopeKey: randomUUID(),
    idempotencyKey: randomUUID(), members: { create: { normalizedClaimId: f.fixture.record.normalizedClaimId } } } });
  const blocked = await f.projection.load(f.request);
  assert.equal(blocked.currentSupportingContext.length, 0);
  assert.deepEqual(blocked.historicalSupportingContext[0]?.exclusions, ["conflict_unresolved"]);
  await db.externalEvidenceConflictResolution.create({ data: { conflictCaseId: conflict.id, outcome: "resolved_no_material_conflict",
    reviewerType: "human", reviewerReference: "test", rationale: "No material conflict.", limitations: [], idempotencyKey: randomUUID() } });
  assert.deepEqual((await f.projection.load(f.request)).currentSupportingContext.map(item => item.decisionId), [f.decision.id]);
});

integration("#081 source, document, identity, qualification and review successors fail closed", async () => {
  assert.ok(db);
  const source = await setup();
  const current = await db.externalEvidenceSourceGovernanceRevision.findFirstOrThrow({ where: { sourceId: source.fixture.record.sourceId, supersededBy: { none: {} } } });
  await db.externalEvidenceSourceGovernanceRevision.create({ data: { sourceId: current.sourceId, revisionNumber: current.revisionNumber + 1,
    governanceVersion: current.governanceVersion, sourceType: current.sourceType, publisherIdentity: current.publisherIdentity,
    authorityScope: current.authorityScope!, dependencyKnowledge: current.dependencyKnowledge!, state: "active",
    reviewerType: "human", reviewerReference: "test", rationale: "Governance successor.", effectiveAt: new Date(),
    supersedesRevisionId: current.id, idempotencyKey: randomUUID() } });
  assert.equal((await source.projection.load(source.request)).currentSupportingContext.length, 0);

  const document = await setup();
  const next = await document.fixture.ingestion.ingest({ ...document.fixture.input,
    document: { ...document.fixture.input.document, boundedContent: "Later revision.", capturedAt: new Date("2026-10-02") },
    extraction: { ...document.fixture.input.extraction, logicalRunKey: randomUUID(), executedAt: new Date("2026-10-02") } });
  assert.deepEqual(next.failed, []);
  assert.equal((await document.projection.load(document.request)).currentSupportingContext.length, 0);

  const identity = await setup();
  await db.equipment.update({ where: { id: identity.fixture.equipment.id }, data: { model: randomUUID() } });
  assert.equal((await identity.projection.load(identity.request)).currentSupportingContext.length, 0);

  const qualification = await setup();
  await qualification.fixture.dependency();
  await qualification.fixture.convergence.converge(qualification.fixture.locator);
  assert.equal((await qualification.projection.load(qualification.request)).currentSupportingContext.length, 0);

  const review = await setup();
  const status = await review.fixture.review.inspect(review.fixture.locator, interpretation);
  await review.fixture.review.reviewClaim({ ...review.fixture.locator, credential: review.fixture.token,
    expectedStateFingerprint: status.stateFingerprint, expectedPriorDecisionId: review.review.id,
    decision: "reviewed_rejected", reason: "Withdrawn by human.", idempotencyKey: randomUUID(),
    supportingInterpretation: interpretation });
  assert.equal((await review.projection.load(review.request)).currentSupportingContext.length, 0);
});

integration("#081 unknown evidence source/method fails closed instead of becoming modeled evidence", async () => {
  assert.ok(db);
  const f = await setup();
  await addEvidence(f.fixture.equipment.id, f.fixture.variant.id, "other");
  await assert.rejects(() => f.projection.load(f.request), /Unclassifiable Equipment DNA evidence/);
  const instrument = await setup();
  await db.equipmentDNAEvidenceRecord.create({ data: { equipmentId: instrument.fixture.equipment.id,
    equipmentVariantId: instrument.fixture.variant.id, targetLevel: "variant", attributeKey: "startup_demand",
    attributeDefinitionVersion: "1.0", sourceType: "other", sourceName: "Ambiguous source",
    method: "instrument_measurement", status: "active" } });
  await assert.rejects(() => instrument.projection.load(instrument.request), /Unclassifiable Equipment DNA evidence/);

  const unrelated = await setup();
  await db.equipmentDNAEvidenceRecord.create({ data: { equipmentId: unrelated.fixture.equipment.id,
    equipmentVariantId: unrelated.fixture.variant.id, targetLevel: "variant", attributeKey: "rotational_demand",
    attributeDefinitionVersion: "1.0", sourceType: "other", sourceName: "Unrelated ambiguous source",
    method: "manual_review", status: "active" } });
  assert.deepEqual((await unrelated.projection.load(unrelated.request)).currentSupportingContext.map(item => item.decisionId), [unrelated.decision.id]);
});

test.after(async () => { await db?.$disconnect(); });
