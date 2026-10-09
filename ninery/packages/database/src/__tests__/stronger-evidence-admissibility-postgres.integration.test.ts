import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Prisma, PrismaClient } from "@prisma/client";
import { convergenceFixture } from "./reviewed-qualification.fixture.js";
import { protocolCandidate } from "./stronger-evidence.fixture.js";
import { GovernedSupportingContextBridgeService, governedSupportingContextIdempotencyKey } from "../governed-supporting-context-bridge.js";
import { PrismaGovernedSupportingContextBridgeRepository } from "../prisma-governed-supporting-context-bridge-repository.js";
import { GovernedConstructEvidenceProjectionService } from "../governed-construct-evidence-projection.js";
import { PrismaGovernedConstructEvidenceProjectionRepository } from "../prisma-governed-construct-evidence-projection-repository.js";
import type { ReviewedSupportingInterpretation } from "../external-claim-review.js";

const url = process.env.TEST_DATABASE_URL;
const integration = url ? test : test.skip;
const db = url ? new PrismaClient({ datasources: { db: { url } }, transactionOptions: { maxWait: 30000, timeout: 30000 } }) : undefined;
const interpretation: ReviewedSupportingInterpretation = { version: "1.0", policyVersion: "1.0-provisional", construct: "startup_demand", role: "supporting_context", identityScope: "exact_variant", direction: "lower" };

async function setup() {
  assert.ok(db);
  const fixture = await convergenceFixture(db);
  await fixture.dependency(); await fixture.construct();
  const qualification = await fixture.convergence.converge(fixture.locator);
  const review = await fixture.content(interpretation);
  const binding = review.reviewedBinding;
  const lineage = { rawClaimId: binding.rawClaimId, normalizedClaimId: binding.normalizedClaimId, dependencyAssessmentId: binding.dependencyAssessmentId,
    constructRelationshipId: binding.constructRelationshipId, qualificationDecisionId: qualification.id, reviewDecisionId: review.id, interpretation };
  const support = await new GovernedSupportingContextBridgeService(new PrismaGovernedSupportingContextBridgeRepository(db)).persist({ ...fixture.locator,
    expectedQualificationDecisionId: qualification.id, expectedReviewDecisionId: review.id, identityScope: "exact_variant", direction: "lower", idempotencyKey: governedSupportingContextIdempotencyKey(lineage, interpretation) });
  const candidate = protocolCandidate(fixture.equipment.id, fixture.variant.id, randomUUID(), randomUUID());
  const evidence = await db.equipmentDNAEvidenceRecord.create({ data: { id: candidate.id, equipmentId: candidate.equipmentId, equipmentVariantId: candidate.equipmentVariantId,
    targetLevel: "equipment", attributeKey: candidate.attributeKey, attributeDefinitionVersion: candidate.attributeDefinitionVersion,
    sourceType: "structured_expert_evaluation", sourceName: candidate.sourceName, sourceReference: candidate.sourceReference, sourceDate: new Date(candidate.sourceDate!),
    method: "standardized_rubric", rawValue: JSON.parse(JSON.stringify(candidate.rawValue)), evaluatorReference: candidate.evaluatorReference, status: "active" } });
  const request = { equipmentId: fixture.equipment.id, equipmentVariantId: fixture.variant.id, construct: "startup_demand" };
  const repository = new PrismaGovernedConstructEvidenceProjectionRepository(db);
  return { fixture, support, evidence, request, projection: new GovernedConstructEvidenceProjectionService(repository) };
}

integration("#082 real writer scope is restricted, exact-variant isolated, deterministic, and read only", async () => {
  assert.ok(db);
  const f = await setup();
  const before = await db.equipmentDNAEvidenceRecord.findUniqueOrThrow({ where: { id: f.evidence.id } });
  const count = await db.equipmentDNAEvidenceRecord.count();
  const result = await f.projection.load(f.request);
  const record = result.strongerEvidenceAdmissibility[0]!;
  assert.equal(record.disposition, "admissible_with_restrictions");
  assert.equal(record.declaredTarget.targetLevel, "equipment");
  assert.equal(record.observedIdentity.equipmentVariantId, f.fixture.variant.id);
  assert.equal(record.applicability.level, "variant");
  assert.equal(record.applicability.modelGeneralizationEstablished, false);
  assert.equal(record.permittedAssessment, "calibration_only");
  assert.equal(result.directEvidenceRecordCount, 0);
  assert.deepEqual(result.currentSupportingContext.map(item => item.decisionId), [f.support.id]);
  assert.equal("evidenceClass" in result.currentSupportingContext[0]!, false);
  assert.deepEqual(result, await f.projection.load(f.request));
  assert.equal((await f.projection.load({ ...f.request, equipmentVariantId: undefined })).strongerEvidenceAdmissibility[0]?.disposition, "unresolved");
  const other = await db.equipmentVariant.create({ data: { equipmentId: f.fixture.equipment.id, sku: randomUUID() } });
  const isolated = await f.projection.load({ ...f.request, equipmentVariantId: other.id });
  assert.equal(isolated.strongerEvidence.length, 0);
  assert.ok(isolated.strongerEvidenceAdmissibility[0]?.exclusions.includes("observed_variant_mismatch"));
  assert.equal(await db.equipmentDNAEvidenceRecord.count(), count);
  assert.deepEqual(await db.equipmentDNAEvidenceRecord.findUniqueOrThrow({ where: { id: before.id } }), before);
  assert.ok(Object.values(result.authority).every(value => value === false || value === 0));
});

integration("#082 unsupported records retain explicit dispositions without modeled fallback", async () => {
  assert.ok(db);
  const f = await setup();
  const unknown = await db.equipmentDNAEvidenceRecord.create({ data: { equipmentId: f.fixture.equipment.id, equipmentVariantId: f.fixture.variant.id,
    targetLevel: "variant", attributeKey: "startup_demand", attributeDefinitionVersion: "1.0", sourceType: "other", sourceName: "Unknown fixture", method: "instrument_measurement", status: "active" } });
  const result = await f.projection.load(f.request);
  const record = result.strongerEvidenceAdmissibility.find(item => item.evidenceRecordId === unknown.id)!;
  assert.equal(record.evidenceClass, undefined);
  assert.equal(record.disposition, "excluded");
  assert.ok(record.exclusions.includes("unsupported_source_type"));
  assert.equal(result.strongerEvidence.some(item => item.id === unknown.id), false);
});

integration("#082 supporting successors remain historical without changing stronger records", async () => {
  assert.ok(db);
  const f = await setup();
  const before = await db.equipmentDNAEvidenceRecord.findUniqueOrThrow({ where: { id: f.evidence.id } });
  await f.fixture.dependency();
  const result = await f.projection.load(f.request);
  assert.equal(result.currentSupportingContext.length, 0);
  assert.equal(result.historicalSupportingContext[0]?.decisionId, f.support.id);
  assert.equal(result.strongerEvidenceAdmissibility[0]?.disposition, "admissible_with_restrictions");
  assert.deepEqual(await db.equipmentDNAEvidenceRecord.findUniqueOrThrow({ where: { id: before.id } }), before);
});

integration("#082 stronger status changes exclude records without granting authority or changing support", async () => {
  assert.ok(db);
  const f = await setup();
  await db.equipmentDNAEvidenceRecord.update({ where: { id: f.evidence.id }, data: { status: "disputed" } });
  const result = await f.projection.load(f.request);
  assert.equal(result.strongerEvidence.length, 0);
  assert.deepEqual(result.excludedStrongerEvidence.map(item => item.id), [f.evidence.id]);
  assert.ok(result.strongerEvidenceAdmissibility[0]?.exclusions.includes("disputed_evidence"));
  assert.equal(result.descriptiveState, "review_required");
  assert.equal(result.currentSupportingContext[0]?.decisionId, f.support.id);
  assert.ok(Object.values(result.authority).every(value => value === false || value === 0));
});

integration("#082 repeatable-read snapshot spans concurrent evidence status and governed successors", async () => {
  assert.ok(db);
  const f = await setup();
  await db.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const isolation = await tx.$queryRaw<{ transaction_isolation: string }[]>`SHOW transaction_isolation`;
    const readonly = await tx.$queryRaw<{ transaction_read_only: string }[]>`SHOW transaction_read_only`;
    assert.equal(isolation[0]?.transaction_isolation, "repeatable read");
    assert.equal(readonly[0]?.transaction_read_only, "on");
    const snapshot = new GovernedConstructEvidenceProjectionService(new PrismaGovernedConstructEvidenceProjectionRepository(tx, true));
    const before = await snapshot.load(f.request);
    assert.equal(before.strongerEvidence.length, 1);
    assert.equal(before.currentSupportingContext.length, 1);
    // These writes commit on a distinct connection while the read transaction remains open.
    await db!.equipmentDNAEvidenceRecord.update({ where: { id: f.evidence.id }, data: { status: "withdrawn" } });
    await f.fixture.dependency();
    const committed = await db!.equipmentDNAEvidenceRecord.findUniqueOrThrow({ where: { id: f.evidence.id } });
    assert.equal(committed.status, "withdrawn");
    assert.deepEqual(await snapshot.load(f.request), before);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000 });
  const after = await f.projection.load(f.request);
  assert.equal(after.strongerEvidence.length, 0);
  assert.equal(after.currentSupportingContext.length, 0);
  assert.equal(after.historicalSupportingContext[0]?.decisionId, f.support.id);
  assert.ok(after.strongerEvidenceAdmissibility[0]?.exclusions.includes("withdrawn_evidence"));
});

test.after(async () => { await db?.$disconnect(); });
