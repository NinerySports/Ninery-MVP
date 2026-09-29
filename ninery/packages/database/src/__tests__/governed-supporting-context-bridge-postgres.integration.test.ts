import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { convergenceFixture } from "./reviewed-qualification.fixture.js";
import { PrismaGovernedReviewRepository } from "../prisma-external-claim-review-repository.js";
import type { ExternalSupportingDecisionInsert } from "../external-supporting-evidence-persistence.js";
import { GovernedSupportingContextBridgeService, governedSupportingContextIdempotencyKey, type GovernedSupportingContextBridgeRepository } from "../governed-supporting-context-bridge.js";
import { PrismaGovernedSupportingContextBridgeRepository } from "../prisma-governed-supporting-context-bridge-repository.js";
import type { ReviewedSupportingInterpretation } from "../external-claim-review.js";

const url = process.env.TEST_DATABASE_URL;
const integration = url ? test : test.skip;
const db = url ? new PrismaClient({ datasources: { db: { url } }, transactionOptions: { maxWait: 30000, timeout: 30000 } }) : undefined;
const interpretation: ReviewedSupportingInterpretation = { version: "1.0", policyVersion: "1.0-provisional", construct: "startup_demand",
  role: "supporting_context", identityScope: "exact_variant", direction: "lower" };

async function ready() {
  assert.ok(db);
  const fixture = await convergenceFixture(db);
  await fixture.dependency(); await fixture.construct();
  const qualification = await fixture.convergence.converge(fixture.locator);
  const review = await fixture.content(interpretation);
  const binding = review.reviewedBinding;
  const lineage = { rawClaimId: binding.rawClaimId, normalizedClaimId: binding.normalizedClaimId,
    dependencyAssessmentId: binding.dependencyAssessmentId, constructRelationshipId: binding.constructRelationshipId,
    qualificationDecisionId: qualification.id, reviewDecisionId: review.id, interpretation };
  const options = { identityScope: "exact_variant" as const, direction: "lower" as const };
  const command = { ...fixture.locator, expectedQualificationDecisionId: qualification.id, expectedReviewDecisionId: review.id,
    ...options, idempotencyKey: governedSupportingContextIdempotencyKey(lineage, options) };
  return { fixture, qualification, review, command, bridge: new GovernedSupportingContextBridgeService(new PrismaGovernedSupportingContextBridgeRepository(db)) };
}

integration("#079 Q2 R2 persists only bounded support; current replay and stale D3 fail closed", async () => {
  assert.ok(db);
  const f = await ready();
  await assert.rejects(() => f.bridge.persist({ ...f.command, expectedQualificationDecisionId: f.fixture.record.qualificationDecisionId }), /STALE_GOVERNED_LINEAGE/);
  await assert.rejects(() => f.bridge.persist({ ...f.command, expectedReviewDecisionId: randomUUID() }), /STALE_GOVERNED_LINEAGE/);
  await assert.rejects(() => f.bridge.persist({ ...f.command, idempotencyKey: randomUUID() }), /IDEMPOTENCY_CONFLICT/);
  assert.equal(await db.externalSupportingRoleDecision.count({ where: { normalizedClaimId: f.fixture.record.normalizedClaimId } }), 0);
  const first = await f.bridge.persist(f.command);
  assert.equal(first.eligible, true);
  assert.equal(first.role, "supporting_context");
  assert.equal((await f.bridge.persist(f.command)).id, first.id);
  const row = await db.externalSupportingRoleDecision.findUniqueOrThrow({ where: { id: first.id } });
  assert.equal(row.qualificationDecisionId, f.qualification.id);
  assert.equal(row.reviewDecisionId, f.review.id);
  assert.equal(row.dependencyAssessmentId, f.review.reviewedBinding.dependencyAssessmentId);
  assert.equal(row.constructRelationshipId, f.review.reviewedBinding.constructRelationshipId);
  assert.equal(row.canonicalValueCreated, false);
  assert.equal(row.numericValueCreated, false);
  assert.equal(row.recommendationAuthorityGranted, false);
  assert.equal(row.decisionBookAuthorityGranted, false);
  await f.fixture.dependency();
  await assert.rejects(() => f.bridge.persist(f.command), /QUALIFICATION_NOT_CURRENT|REVIEW_CASE_NOT_CURRENT/);
  assert.deepEqual(await db.externalSupportingRoleDecision.findUniqueOrThrow({ where: { id: first.id } }), row);
  assert.equal(await db.externalSupportingRoleDecision.count({ where: { normalizedClaimId: f.fixture.record.normalizedClaimId } }), 1);
});

integration("#079 C3 and governance successors invalidate original-key replay without deleting history", async () => {
  assert.ok(db);
  for (const change of ["construct", "governance"] as const) {
    const f = await ready();
    const persisted = await f.bridge.persist(f.command);
    if (change === "construct") await f.fixture.construct();
    else {
      const g = await db.externalEvidenceSourceGovernanceRevision.findUniqueOrThrow({ where: { id: f.fixture.record.reviewReady.currentSourceGovernanceRevisionId } });
      await db.externalEvidenceSourceGovernanceRevision.create({ data: { sourceId: g.sourceId, revisionNumber: 2, governanceVersion: g.governanceVersion,
        sourceType: g.sourceType, publisherIdentity: g.publisherIdentity, authorityScope: g.authorityScope!, dependencyKnowledge: g.dependencyKnowledge!,
        state: "active", reviewerType: "human", reviewerReference: "bridge-test", rationale: "Reviewed successor.", effectiveAt: new Date(),
        supersedesRevisionId: g.id, idempotencyKey: randomUUID() } });
    }
    await assert.rejects(() => f.bridge.persist(f.command), /QUALIFICATION_NOT_CURRENT|REVIEW_CASE_NOT_CURRENT/);
    assert.ok(await db.externalSupportingRoleDecision.findUnique({ where: { id: persisted.id } }));
    assert.equal(await db.externalSupportingRoleDecision.count({ where: { normalizedClaimId: f.fixture.record.normalizedClaimId } }), 1);
  }
});

integration("#079 Q1, absent R2, rejected R2, and limited R2 never persist support", async () => {
  assert.ok(db);
  for (const phase of ["q1", "missing_review", "rejected", "limited"] as const) {
    const f = await convergenceFixture(db);
    await f.dependency(); await f.construct();
    const qualification = phase !== "q1" ? await f.convergence.converge(f.locator) : undefined;
    let reviewId: string = randomUUID();
    if (phase === "rejected" || phase === "limited") {
      const status = await f.review.inspect(f.locator, interpretation);
      const review = await f.review.reviewClaim({ ...f.locator, credential: f.token, expectedStateFingerprint: status.stateFingerprint,
        supportingInterpretation: interpretation,
        decision: phase === "rejected" ? "reviewed_rejected" : "reviewed_with_limitations",
        limitations: phase === "limited" ? ["Scope needs further review."] : undefined,
        reason: "Explicit bounded human decision.", idempotencyKey: randomUUID() });
      reviewId = review.id;
    }
    const bridge = new GovernedSupportingContextBridgeService(new PrismaGovernedSupportingContextBridgeRepository(db));
    await assert.rejects(() => bridge.persist({ ...f.locator, expectedQualificationDecisionId: f.record.qualificationDecisionId,
      expectedReviewDecisionId: reviewId, identityScope: "exact_variant", direction: "lower", idempotencyKey: randomUUID() }),
      phase === "q1" ? /QUALIFICATION_NOT_CURRENT/ : phase === "missing_review" ? /REVIEW_LINEAGE_AMBIGUOUS/ : /ACCEPTED_CURRENT_HUMAN_REVIEW_REQUIRED/);
    if (qualification) assert.notEqual(qualification.id, f.record.qualificationDecisionId);
    assert.equal(await db.externalSupportingRoleDecision.count({ where: { normalizedClaimId: f.record.normalizedClaimId } }), 0);
  }
});

integration("#079 legacy R2 remains readable but requires a fresh interpreted human review", async () => {
  assert.ok(db);
  const f = await convergenceFixture(db);
  await f.dependency(); await f.construct();
  const qualification = await f.convergence.converge(f.locator);
  const legacy = await f.content();
  const bridge = new GovernedSupportingContextBridgeService(new PrismaGovernedSupportingContextBridgeRepository(db));
  const command = { ...f.locator, expectedQualificationDecisionId: qualification.id, expectedReviewDecisionId: legacy.id,
    identityScope: "exact_variant" as const, direction: "lower" as const, idempotencyKey: randomUUID() };
  await assert.rejects(() => bridge.persist(command), /INTERPRETATION_REVIEW_REQUIRED/);
  assert.ok(await db.externalEvidenceReviewDecision.findUnique({ where: { id: legacy.id } }));
  const status = await f.review.inspect(f.locator, interpretation);
  const fresh = await f.review.reviewClaim({ ...f.locator, credential: f.token, expectedStateFingerprint: status.stateFingerprint,
    expectedPriorDecisionId: legacy.id, decision: "reviewed_accepted", reason: "Reviewed directional support explicitly.",
    idempotencyKey: randomUUID(), supportingInterpretation: interpretation });
  const key = governedSupportingContextIdempotencyKey({ rawClaimId: fresh.reviewedBinding.rawClaimId,
    normalizedClaimId: fresh.reviewedBinding.normalizedClaimId, dependencyAssessmentId: fresh.reviewedBinding.dependencyAssessmentId,
    constructRelationshipId: fresh.reviewedBinding.constructRelationshipId, qualificationDecisionId: qualification.id,
    reviewDecisionId: fresh.id, interpretation }, interpretation);
  assert.equal((await bridge.persist({ ...command, expectedReviewDecisionId: fresh.id, idempotencyKey: key })).eligible, true);
  assert.ok(await db.externalEvidenceReviewDecision.findUnique({ where: { id: legacy.id } }));
});

integration("#079 alternate keys cannot turn one R2 into opposite or incompatible support", async () => {
  assert.ok(db);
  const f = await ready();
  const original = await f.bridge.persist(f.command);
  for (const change of [{ direction: "higher" as const }, { comparisonTarget: "another bat" }]) {
    const requested = { ...f.command, ...change };
    await assert.rejects(() => f.bridge.persist(requested), /INTERPRETATION_MISMATCH/);
    const alternate = governedSupportingContextIdempotencyKey({ rawClaimId: f.review.reviewedBinding.rawClaimId,
      normalizedClaimId: f.review.reviewedBinding.normalizedClaimId, dependencyAssessmentId: f.review.reviewedBinding.dependencyAssessmentId,
      constructRelationshipId: f.review.reviewedBinding.constructRelationshipId, qualificationDecisionId: f.qualification.id,
      reviewDecisionId: f.review.id, interpretation }, requested);
    await assert.rejects(() => f.bridge.persist({ ...requested, idempotencyKey: alternate }), /INTERPRETATION_MISMATCH/);
  }
  assert.equal((await f.bridge.persist(f.command)).id, original.id);
  assert.equal(await db.externalSupportingRoleDecision.count({ where: { normalizedClaimId: f.fixture.record.normalizedClaimId } }), 1);
});

integration("#079 document and catalog-identity drift fail closed before supporting persistence", async () => {
  assert.ok(db);
  const document = await ready();
  const next = await document.fixture.ingestion.ingest({ ...document.fixture.input,
    document: { ...document.fixture.input.document, boundedContent: "Later bounded observation.", capturedAt: new Date("2026-09-27") },
    extraction: { ...document.fixture.input.extraction, logicalRunKey: randomUUID(), executedAt: new Date("2026-09-27") } });
  assert.deepEqual(next.failed, []);
  await assert.rejects(() => document.bridge.persist(document.command), /claim_not_current|QUALIFICATION_NOT_CURRENT|REVIEW_CASE_NOT_CURRENT/);
  assert.equal(await db.externalSupportingRoleDecision.count({ where: { normalizedClaimId: document.fixture.record.normalizedClaimId } }), 0);

  const identity = await ready();
  await db.equipment.update({ where: { id: identity.fixture.equipment.id }, data: { model: `changed-${randomUUID()}` } });
  await assert.rejects(() => identity.bridge.persist(identity.command), /CATALOG_IDENTITY_MISMATCH/);
  assert.equal(await db.externalSupportingRoleDecision.count({ where: { normalizedClaimId: identity.fixture.record.normalizedClaimId } }), 0);
});

integration("#079 unresolved conflicts and incompatible construct policy cannot create support", async () => {
  assert.ok(db);
  const conflict = await ready();
  await db.externalEvidenceConflictCase.create({ data: { claimKey: "startup_demand", identityScopeKey: randomUUID(),
    idempotencyKey: randomUUID(), members: { create: { normalizedClaimId: conflict.fixture.record.normalizedClaimId } } } });
  await assert.rejects(() => conflict.bridge.persist(conflict.command), /claim_not_current|REVIEW_CASE_NOT_CURRENT/);
  assert.equal(await db.externalSupportingRoleDecision.count({ where: { normalizedClaimId: conflict.fixture.record.normalizedClaimId } }), 0);

  const policy = await ready();
  await db.externalEvidenceConstructRelationship.create({ data: { normalizedClaimId: policy.fixture.record.normalizedClaimId,
    proposedConstruct: "startup_demand", mappingMethod: "manual_review", mappingConfidence: "high", mappingVersion: "1.0",
    policyVersion: "0.9", role: "supporting_context", reviewState: "reviewed_accepted", reviewerReference: "legacy-policy",
    rationale: "Historical policy successor.", limitations: [], supersedesRelationshipId: policy.review.reviewedBinding.constructRelationshipId,
    idempotencyKey: randomUUID() } });
  await assert.rejects(() => policy.bridge.persist(policy.command), /construct_not_governed_reviewed|dimension_policy_not_current/);
  assert.equal(await db.externalSupportingRoleDecision.count({ where: { normalizedClaimId: policy.fixture.record.normalizedClaimId } }), 0);
});

integration("#079 cross-source conflict commits first and bridge rejects after waiting on its FK lock", async () => {
  assert.ok(db);
  const f = await ready();
  const peer = await convergenceFixture(db);
  let acquired!: () => void; let release!: () => void;
  const inserted = new Promise<void>(resolve => { acquired = resolve; });
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const writer = db.$transaction(async tx => {
    await tx.externalEvidenceConflictCase.create({ data: { claimKey: "startup_demand", identityScopeKey: `cross-source:${randomUUID()}`,
      idempotencyKey: randomUUID(), members: { create: [
        { normalizedClaimId: f.fixture.record.normalizedClaimId }, { normalizedClaimId: peer.record.normalizedClaimId }
      ] } } });
    acquired(); await barrier;
  }, { timeout: 30000 });
  await inserted;
  const attempt = f.bridge.persist(f.command).then(value => ({ value, error: undefined }), error => ({ value: undefined, error }));
  try { await waitForBlockedWriter(db); } finally { release(); }
  await writer;
  const result = await attempt;
  assert.equal(result.value, undefined);
  assert.match(String(result.error), /claim_not_current|REVIEW_CASE_NOT_CURRENT/);
  assert.equal(await db.externalSupportingRoleDecision.count({ where: { normalizedClaimId: f.fixture.record.normalizedClaimId } }), 0);
});

integration("#079 bridge locks first and cross-source conflict member waits until persistence commits", async () => {
  assert.ok(db);
  const f = await ready();
  const peer = await convergenceFixture(db);
  const real = new PrismaGovernedSupportingContextBridgeRepository(db);
  let acquired!: () => void; let release!: () => void;
  const loaded = new Promise<void>(resolve => { acquired = resolve; });
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const paused: GovernedSupportingContextBridgeRepository = {
    transaction: operation => real.transaction(repo => operation({
      transaction: repo.transaction.bind(repo), lock: repo.lock.bind(repo), supportingRepository: repo.supportingRepository.bind(repo),
      async loadCurrent(locator) { const state = await repo.loadCurrent(locator); acquired(); await barrier; return state; }
    })), lock: real.lock.bind(real), loadCurrent: real.loadCurrent.bind(real), supportingRepository: real.supportingRepository.bind(real)
  };
  const persisting = new GovernedSupportingContextBridgeService(paused).persist(f.command);
  await loaded;
  const writer = db.$transaction(async tx => {
    await tx.externalEvidenceConflictCase.create({ data: { claimKey: "startup_demand", identityScopeKey: `cross-source:${randomUUID()}`,
      idempotencyKey: randomUUID(), members: { create: [
        { normalizedClaimId: f.fixture.record.normalizedClaimId }, { normalizedClaimId: peer.record.normalizedClaimId }
      ] } } });
  }, { timeout: 30000 });
  try { await waitForBlockedWriter(db); } finally { release(); }
  const decision = await persisting;
  await writer;
  assert.equal(decision.eligible, true);
  await assert.rejects(() => f.bridge.persist(f.command), /claim_not_current|REVIEW_CASE_NOT_CURRENT/);
  assert.equal(await db.externalSupportingRoleDecision.count({ where: { normalizedClaimId: f.fixture.record.normalizedClaimId } }), 1);
});

integration("#079 unresolved resolution successor waits on locked conflict case", async () => {
  assert.ok(db);
  const f = await ready();
  const conflict = await db.externalEvidenceConflictCase.create({ data: { claimKey: "startup_demand", identityScopeKey: randomUUID(),
    idempotencyKey: randomUUID(), members: { create: { normalizedClaimId: f.fixture.record.normalizedClaimId } } } });
  await db.externalEvidenceConflictResolution.create({ data: { conflictCaseId: conflict.id, outcome: "resolved_no_material_conflict",
    reviewerType: "human", reviewerReference: "fixture", rationale: "Reviewed resolution.", limitations: [], idempotencyKey: randomUUID() } });
  const real = new PrismaGovernedSupportingContextBridgeRepository(db);
  let acquired!: () => void; let release!: () => void;
  const loaded = new Promise<void>(resolve => { acquired = resolve; });
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const paused: GovernedSupportingContextBridgeRepository = {
    transaction: operation => real.transaction(repo => operation({
      transaction: repo.transaction.bind(repo), lock: repo.lock.bind(repo), supportingRepository: repo.supportingRepository.bind(repo),
      async loadCurrent(locator) { const state = await repo.loadCurrent(locator); acquired(); await barrier; return state; }
    })), lock: real.lock.bind(real), loadCurrent: real.loadCurrent.bind(real), supportingRepository: real.supportingRepository.bind(real)
  };
  const persisting = new GovernedSupportingContextBridgeService(paused).persist(f.command);
  await loaded;
  const writer = db.externalEvidenceConflictResolution.create({ data: { conflictCaseId: conflict.id, outcome: "unresolved",
    reviewerType: "human", reviewerReference: "fixture", rationale: "Reopened conflict.", limitations: [], idempotencyKey: randomUUID() } }).then(value => value);
  try { await waitForBlockedWriter(db); } finally { release(); }
  const decision = await persisting;
  await writer;
  assert.equal(decision.eligible, true);
  await assert.rejects(() => f.bridge.persist(f.command), /REVIEW_CASE_NOT_CURRENT|claim_not_current/);
});

integration("#079 bridge waits for D3 then reconstructs current state before any #075 replay", async () => {
  assert.ok(db);
  const f = await ready();
  const original = await f.bridge.persist(f.command);
  const expectedStateFingerprint = (await f.fixture.review.inspect(f.fixture.locator)).stateFingerprint;
  let acquired!: () => void; let release!: () => void;
  const locked = new Promise<void>(resolve => { acquired = resolve; });
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const writer = db.$transaction(async tx => {
    const repository = new PrismaGovernedReviewRepository(tx, true);
    await repository.lockClaimSlot(f.fixture.locator);
    const claim = await repository.loadCase(f.fixture.locator);
    assert.ok(claim);
    acquired(); await barrier;
    await repository.writeDependencyReview({ ...f.fixture.locator, credential: f.fixture.token,
      expectedStateFingerprint,
      decision: "reviewed_accepted", reason: "New D3 after held lock.", idempotencyKey: randomUUID(),
      dependencyType: "independent_observation", independenceGroupId: `expert:${f.fixture.record.sourceId}`,
      reviewerId: "convergence-human", claim });
  }, { timeout: 30000 });
  await locked;
  const attempt = f.bridge.persist(f.command).then(value => ({ value, error: undefined }), error => ({ value: undefined, error }));
  try { await waitForBlockedWriter(db); } finally { release(); }
  await writer;
  const result = await attempt;
  assert.equal(result.value, undefined);
  assert.match(String(result.error), /QUALIFICATION_NOT_CURRENT|REVIEW_CASE_NOT_CURRENT/);
  assert.equal((await db.externalSupportingRoleDecision.findUniqueOrThrow({ where: { id: original.id } })).id, original.id);
});

integration("#079 bridge commits before D3 successor and preserved support becomes historical", async () => {
  assert.ok(db);
  const f = await ready();
  const real = new PrismaGovernedSupportingContextBridgeRepository(db);
  let acquired!: () => void; let release!: () => void;
  const loaded = new Promise<void>(resolve => { acquired = resolve; });
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const paused: GovernedSupportingContextBridgeRepository = {
    transaction: operation => real.transaction(repo => operation({
      transaction: repo.transaction.bind(repo), lock: repo.lock.bind(repo), supportingRepository: repo.supportingRepository.bind(repo),
      async loadCurrent(locator) { const state = await repo.loadCurrent(locator); acquired(); await barrier; return state; }
    })),
    lock: real.lock.bind(real), loadCurrent: real.loadCurrent.bind(real), supportingRepository: real.supportingRepository.bind(real)
  };
  const bridge = new GovernedSupportingContextBridgeService(paused);
  const persisting = bridge.persist(f.command);
  await loaded;
  const successor = f.fixture.dependency();
  try { await waitForBlockedWriter(db); } finally { release(); }
  const decision = await persisting; await successor;
  assert.equal(decision.eligible, true);
  await assert.rejects(() => f.bridge.persist(f.command), /QUALIFICATION_NOT_CURRENT|REVIEW_CASE_NOT_CURRENT/);
  assert.ok(await db.externalSupportingRoleDecision.findUnique({ where: { id: decision.id } }));
});

integration("#079 catalog identity update waits for bridge verification and stales later replay", async () => {
  assert.ok(db);
  const f = await ready();
  const real = new PrismaGovernedSupportingContextBridgeRepository(db);
  let acquired!: () => void; let release!: () => void;
  const loaded = new Promise<void>(resolve => { acquired = resolve; });
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const paused: GovernedSupportingContextBridgeRepository = {
    transaction: operation => real.transaction(repo => operation({
      transaction: repo.transaction.bind(repo), lock: repo.lock.bind(repo), supportingRepository: repo.supportingRepository.bind(repo),
      async loadCurrent(locator) { const state = await repo.loadCurrent(locator); acquired(); await barrier; return state; }
    })),
    lock: real.lock.bind(real), loadCurrent: real.loadCurrent.bind(real), supportingRepository: real.supportingRepository.bind(real)
  };
  const persisting = new GovernedSupportingContextBridgeService(paused).persist(f.command);
  await loaded;
  const update = db.equipment.update({ where: { id: f.fixture.equipment.id }, data: { model: `changed-${randomUUID()}` } }).then(value => value);
  try { await waitForBlockedWriter(db); } finally { release(); }
  const decision = await persisting;
  await update;
  assert.equal(decision.eligible, true);
  await assert.rejects(() => f.bridge.persist(f.command), /CATALOG_IDENTITY_MISMATCH/);
  assert.equal(await db.externalSupportingRoleDecision.count({ where: { normalizedClaimId: f.fixture.record.normalizedClaimId } }), 1);
});

integration("#079 a failure after #075 insert rolls the entire governed bridge transaction back", async () => {
  assert.ok(db);
  const f = await ready();
  const real = new PrismaGovernedSupportingContextBridgeRepository(db);
  const failing: GovernedSupportingContextBridgeRepository = {
    transaction: operation => real.transaction(repo => operation({
      transaction: repo.transaction.bind(repo), lock: repo.lock.bind(repo), loadCurrent: repo.loadCurrent.bind(repo),
      supportingRepository() {
        const supporting = repo.supportingRepository();
        const injected = {
          transaction: async <T>(operation: (repository: typeof supporting) => Promise<T>): Promise<T> => operation(injected),
          loadContext: supporting.loadContext.bind(supporting),
          findDecisionByIdempotencyKey: supporting.findDecisionByIdempotencyKey.bind(supporting),
          async createDecision(data: ExternalSupportingDecisionInsert) { await supporting.createDecision(data); throw new Error("Injected after #075 insert"); }
        };
        return injected;
      }
    })), lock: real.lock.bind(real), loadCurrent: real.loadCurrent.bind(real), supportingRepository: real.supportingRepository.bind(real)
  };
  await assert.rejects(() => new GovernedSupportingContextBridgeService(failing).persist(f.command), /Injected after #075 insert/);
  assert.equal(await db.externalSupportingRoleDecision.count({ where: { normalizedClaimId: f.fixture.record.normalizedClaimId } }), 0);
  assert.equal((await f.bridge.persist(f.command)).eligible, true);
  assert.equal(await db.externalSupportingRoleDecision.count({ where: { normalizedClaimId: f.fixture.record.normalizedClaimId } }), 1);
});

async function waitForBlockedWriter(client: PrismaClient) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const rows = await client.$queryRaw<Array<{ count: bigint }>>`SELECT count(*)::bigint AS count FROM pg_locks WHERE NOT granted AND locktype IN ('advisory', 'transactionid')`;
    if (rows[0]!.count > 0n) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error("PostgreSQL did not observe a blocked concurrent operation");
}

test.after(async () => { await db?.$disconnect(); });
