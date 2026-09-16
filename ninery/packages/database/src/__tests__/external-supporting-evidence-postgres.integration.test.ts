import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { ExternalSupportingEvidencePersistenceService, type ExternalSupportingPersistenceCommand } from "../external-supporting-evidence-persistence.js";
import { PrismaExternalSupportingPersistenceRepository } from "../prisma-external-supporting-evidence-repository.js";

const url = process.env.TEST_DATABASE_URL;
const integration = url ? test : test.skip;
const db = url ? new PrismaClient({ datasources: { db: { url } } }) : undefined;

integration("PostgreSQL migration, constraints, current-state reads, and real Prisma repository", async () => {
  assert.ok(db);
  const valid = await graph();
  const service = new ExternalSupportingEvidencePersistenceService(new PrismaExternalSupportingPersistenceRepository(db));
  const positive = await service.persist(valid.command);
  assert.equal(positive.eligible, true);
  assert.deepEqual(await service.persist(valid.command), positive, "idempotent replay returns the immutable row");

  const cases: Array<[string, Parameters<typeof graph>[0]]> = [
    ["wrong source type", { sourceType: "retailer" }], ["wrong claim type", { claimType: "marketing_claim" }],
    ["ambiguous identity", { certainty: "ambiguous" }], ["inapplicable identity scope", { omitDrop: true }],
    ["non-human approval", { contentReviewerType: "system" }], ["rejected approval", { contentReview: "reviewed_rejected" }],
    ["unknown independence", { dependencyType: "unknown_dependency", independenceGroupId: null }],
    ["fabricated independence group", { dependencyType: "original", independenceGroupId: "fabricated" }],
    ["non-human independence provenance", { dependencyReviewerType: "system" }],
    ["ineligible construct", { construct: "response_degradation" }], ["invalid qualification", { qualification: "not_eligible" }],
    ["invalid contract", { contractVersion: "0.9" }], ["invalid mapping", { mappingVersion: "0.9" }],
    ["invalid policy", { constructPolicyVersion: "0.9" }], ["invalid role", { constructRole: "candidate_only" }],
    ["invalid construct review", { constructReview: "review_pending" }], ["conflicting claim", { verification: "conflicting" }]
  ];
  for (const [name, options] of cases) {
    const fixture = await graph(options);
    await assert.rejects(() => directInsert(fixture), name);
  }
  const crossA = await graph(); const crossB = await graph();
  await assert.rejects(() => directInsert({ ...crossA, command: { ...crossA.command, reviewDecisionId: crossB.command.reviewDecisionId } }));
  await assert.rejects(() => directInsert({ ...crossA, command: { ...crossA.command, qualificationDecisionId: crossB.command.qualificationDecisionId } }));
  await assert.rejects(() => db.externalEvidenceDocument.create({ data: { sourceId: randomUUID(), documentType: "review", sourceReference: randomUUID(), title: "bad", retrievedAt: new Date(), revision: "1", availability: "available" } }));
  const wrongEquipment = await db.equipment.create({ data: { manufacturer: "Other", model: randomUUID(), category: "bat" } });
  await assert.rejects(() => db.externalEvidenceIdentityAssertion.create({ data: { certainty: "exact_variant_match", equipmentId: wrongEquipment.id, equipmentVariantId: valid.variantId, limitations: [] } }));
  const escalated = { ...(await supportingData(valid)), canonicalValueCreated: true, idempotencyKey: randomUUID() };
  await assert.rejects(() => db.externalSupportingRoleDecision.create({ data: escalated }));
  await assert.rejects(() => directInsert(valid), "duplicate idempotency key is rejected");

  const staleDependency = await graph();
  await db.externalEvidenceDependencyAssessment.create({ data: { claimId: staleDependency.command.rawClaimId, dependencyType: "unknown_dependency", dependencyRationale: "supersedes", reviewedState: "reviewed_accepted", reviewerType: "human", reviewerReference: "dependency-reviewer", reviewedAt: new Date(), assessmentVersion: "1.0", supersedesAssessmentId: staleDependency.command.dependencyAssessmentId, idempotencyKey: randomUUID() } });
  await assert.rejects(() => directInsert(staleDependency));
  const staleConstruct = await graph();
  await db.externalEvidenceConstructRelationship.create({ data: { normalizedClaimId: staleConstruct.command.normalizedClaimId, proposedConstruct: "startup_demand", mappingMethod: "manual_review", mappingConfidence: "high", mappingVersion: "1.0", policyVersion: "1.0-provisional", role: "supporting_context", reviewState: "reviewed_accepted", rationale: "supersedes", limitations: [], supersedesRelationshipId: staleConstruct.command.constructRelationshipId, idempotencyKey: randomUUID() } });
  await assert.rejects(() => directInsert(staleConstruct));
  const staleClaim = await graph();
  await db.externalEvidenceClaim.create({ data: { documentId: staleClaim.documentId, identityAssertionId: staleClaim.identityAssertionId, extractionRunId: staleClaim.extractionRunId, claimType: "subjective_observation", verificationState: "source_confirmed", reviewState: "reviewed_accepted", authority: "none", authorityRationale: "supersedes", limitations: [], supersedesClaimId: staleClaim.command.rawClaimId } });
  await assert.rejects(() => directInsert(staleClaim));

  const historical = await graph();
  const historicalDecision = await directInsert(historical);
  await db.externalEvidenceDependencyAssessment.create({ data: { claimId: historical.command.rawClaimId, dependencyType: "unknown_dependency", dependencyRationale: "new current state", reviewedState: "reviewed_accepted", reviewerType: "human", reviewerReference: "dependency-reviewer", reviewedAt: new Date(), assessmentVersion: "1.0", supersedesAssessmentId: historical.command.dependencyAssessmentId, idempotencyKey: randomUUID() } });
  const current = await new PrismaExternalSupportingPersistenceRepository(db).loadContext(historical.command);
  assert.equal(current?.dependencyAssessment.supersededByCount, 1);
  assert.ok(await db.externalSupportingRoleDecision.findUnique({ where: { id: historicalDecision.id } }), "history is preserved");

  const conflict = await graph();
  const conflictCase = await db.externalEvidenceConflictCase.create({ data: { claimKey: "feel", identityScopeKey: "equipment", idempotencyKey: randomUUID(), members: { create: { normalizedClaimId: conflict.command.normalizedClaimId } } } });
  await db.externalEvidenceConflictResolution.create({ data: { conflictCaseId: conflictCase.id, outcome: "resolved_no_material_conflict", reviewerType: "human", reviewerReference: "reviewer", rationale: "old", limitations: [], idempotencyKey: randomUUID(), decidedAt: new Date("2026-01-01") } });
  await db.externalEvidenceConflictResolution.create({ data: { conflictCaseId: conflictCase.id, outcome: "unresolved", reviewerType: "human", reviewerReference: "reviewer", rationale: "new", limitations: [], idempotencyKey: randomUUID(), decidedAt: new Date("2026-01-02") } });
  await assert.rejects(() => directInsert(conflict));
  assert.equal((await new PrismaExternalSupportingPersistenceRepository(db).loadContext(conflict.command))?.unresolvedConflictCount, 1);

  await assert.rejects(() => db.externalSupportingRoleDecision.update({ where: { id: positive.id }, data: { direction: "higher" } }));
  await assert.rejects(() => db.externalSupportingRoleDecision.delete({ where: { id: positive.id } }));
  const self = randomUUID();
  await assert.rejects(() => db.externalEvidenceClaim.create({ data: { id: self, documentId: valid.documentId, identityAssertionId: valid.identityAssertionId, extractionRunId: valid.extractionRunId, claimType: "subjective_observation", verificationState: "source_confirmed", reviewState: "reviewed_accepted", authority: "none", authorityRationale: "test", limitations: [], supersedesClaimId: self } }));
  await assert.rejects(() => db.externalEvidenceClaim.update({ where: { id: valid.command.rawClaimId }, data: { supersedesClaimId: valid.command.rawClaimId } }));
  const cycleA = await graph();
  const cycleB = await db.externalEvidenceClaim.create({ data: { documentId: cycleA.documentId, identityAssertionId: cycleA.identityAssertionId, extractionRunId: cycleA.extractionRunId, claimType: "subjective_observation", verificationState: "source_confirmed", reviewState: "reviewed_accepted", authority: "none", authorityRationale: "cycle test", limitations: [], supersedesClaimId: cycleA.command.rawClaimId } });
  await assert.rejects(() => db.externalEvidenceClaim.update({ where: { id: cycleA.command.rawClaimId }, data: { supersedesClaimId: cycleB.id } }), "multi-node supersession cycle is rejected");

  const before = await db.externalSupportingRoleDecision.count();
  await assert.rejects(() => db.$transaction(async (tx) => {
    const transactional = new ExternalSupportingEvidencePersistenceService(new PrismaExternalSupportingPersistenceRepository(tx, true));
    await transactional.persist({ ...valid.command, idempotencyKey: randomUUID(), direction: "higher" });
    throw new Error("forced late failure");
  }));
  assert.equal(await db.externalSupportingRoleDecision.count(), before, "transaction rollback is atomic");
});

type Options = { sourceType?: any; claimType?: any; certainty?: any; omitDrop?: boolean; contentReviewerType?: any; contentReview?: any; dependencyType?: any; independenceGroupId?: string | null; dependencyReviewerType?: any; construct?: string; qualification?: any; contractVersion?: string; mappingVersion?: string; constructPolicyVersion?: string; constructRole?: any; constructReview?: any; verification?: any };
async function graph(options: Options = {}) {
  assert.ok(db);
  const equipment = await db.equipment.create({ data: { manufacturer: "Test", model: randomUUID(), modelYear: 2026, category: "bat", certification: "USA" } });
  const variant = await db.equipmentVariant.create({ data: { equipmentId: equipment.id, lengthInches: 30, weightOunces: 20, dropWeight: -10 } });
  const source = await db.externalEvidenceSource.create({ data: { stableKey: randomUUID(), displayName: "Expert", sourceType: options.sourceType ?? "independent_expert_review", sourceVersion: "1", state: "active" } });
  const document = await db.externalEvidenceDocument.create({ data: { sourceId: source.id, documentType: "review", sourceReference: randomUUID(), title: "Review", retrievedAt: new Date(), revision: "1", availability: "available" } });
  const extraction = await db.externalEvidenceExtractionRun.create({ data: { method: "manual", extractorType: "human", extractorId: "extractor", extractorVersion: "1", executedAt: new Date(), schemaVersion: "1", reviewState: "reviewed_accepted" } });
  const identity = await db.externalEvidenceIdentityAssertion.create({ data: { certainty: options.certainty ?? "equipment_model_match", manufacturer: "Test", model: equipment.model, modelYear: 2026, certification: "USA", drop: options.omitDrop ? null : -10, lengthInches: 30, weightOunces: 20, equipmentId: equipment.id, equipmentVariantId: variant.id, limitations: [] } });
  const raw = await db.externalEvidenceClaim.create({ data: { documentId: document.id, identityAssertionId: identity.id, extractionRunId: extraction.id, claimType: options.claimType ?? "subjective_observation", verificationState: options.verification ?? "source_confirmed", reviewState: "reviewed_accepted", authority: "none", authorityRationale: "test", limitations: [] } });
  const normalized = await db.externalEvidenceNormalizedClaim.create({ data: { rawClaimId: raw.id, claimKey: randomUUID(), normalizedValue: {}, normalizationMethod: "manual", normalizationVersion: "1", evidenceClass: "external_expert_observation", verificationState: "source_confirmed", reviewState: "reviewed_accepted", limitations: [] } });
  const dependency = await db.externalEvidenceDependencyAssessment.create({ data: { claimId: raw.id, dependencyType: options.dependencyType ?? "independent_observation", independenceGroupId: options.independenceGroupId === undefined ? "independent-group" : options.independenceGroupId, dependencyRationale: "reviewed", reviewedState: "reviewed_accepted", reviewerType: options.dependencyReviewerType ?? "human", reviewerReference: "dependency-reviewer", reviewedAt: new Date(), assessmentVersion: "1.0", idempotencyKey: randomUUID() } });
  const relationship = await db.externalEvidenceConstructRelationship.create({ data: { normalizedClaimId: normalized.id, proposedConstruct: options.construct ?? "startup_demand", mappingMethod: "manual_review", mappingConfidence: "high", mappingVersion: options.mappingVersion ?? "1.0", policyVersion: options.constructPolicyVersion ?? "1.0-provisional", role: options.constructRole ?? "supporting_context", reviewState: options.constructReview ?? "reviewed_accepted", rationale: "reviewed", limitations: [], idempotencyKey: randomUUID() } });
  const qualification = await db.externalEvidenceQualificationDecision.create({ data: { normalizedClaimId: normalized.id, constructRelationshipId: relationship.id, contractVersion: options.contractVersion ?? "1.0", state: options.qualification ?? "context_only", reasons: [], gaps: [], blockers: [], warnings: [], limitations: [], idempotencyKey: randomUUID() } });
  const review = await db.externalEvidenceReviewDecision.create({ data: { normalizedClaimId: normalized.id, constructRelationshipId: relationship.id, decision: options.contentReview ?? "reviewed_accepted", reviewerType: options.contentReviewerType ?? "human", reviewerReference: "content-reviewer", reason: "accepted", limitations: [], idempotencyKey: randomUUID() } });
  return { command: { rawClaimId: raw.id, normalizedClaimId: normalized.id, dependencyAssessmentId: dependency.id, constructRelationshipId: relationship.id, qualificationDecisionId: qualification.id, reviewDecisionId: review.id, identityScope: "drop_family", direction: "lower", idempotencyKey: randomUUID() } satisfies ExternalSupportingPersistenceCommand, identityAssertionId: identity.id, documentId: document.id, extractionRunId: extraction.id, variantId: variant.id };
}

async function directInsert(fixture: Awaited<ReturnType<typeof graph>>) {
  assert.ok(db);
  return db.externalSupportingRoleDecision.create({ data: await supportingData(fixture) });
}

async function supportingData(fixture: Awaited<ReturnType<typeof graph>>) {
  return { ...fixture.command, identityAssertionId: fixture.identityAssertionId, policy: "external_expert_supporting_role", policyVersion: "1.0-provisional", policyStatus: "PROVISIONAL_CONSTRUCT_SPECIFIC_POLICY", eligible: true, role: "supporting_context" as const, reasons: [], blockers: [], decisionFingerprint: randomUUID() };
}

test.after(async () => { await db?.$disconnect(); });
