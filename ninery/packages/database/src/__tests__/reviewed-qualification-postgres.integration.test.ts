import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { qualifyEquipmentClaim } from "@ninery/equipment-intelligence";
import { convergenceFixture } from "./reviewed-qualification.fixture.js";
import { GovernedExternalClaimReviewService } from "../external-claim-review.js";
import { PrismaGovernedReviewRepository } from "../prisma-external-claim-review-repository.js";
import { PrismaReviewedQualificationRepository } from "../prisma-reviewed-dimension-qualification-convergence-repository.js";
import { ReviewedDimensionQualificationConvergenceService, type ReviewedQualificationRepository } from "../reviewed-dimension-qualification-convergence.js";
import { externalClaimUuid } from "../external-claim-ingestion.js";

const url = process.env.TEST_DATABASE_URL;
const integration = url ? test : test.skip;
const db = url ? new PrismaClient({ datasources: { db: { url } }, transactionOptions: { maxWait: 30000, timeout: 30000 } }) : undefined;

integration("#078 durable Q1 D2 C2 Q2 R2 convergence and successor applicability", async () => {
  assert.ok(db);
  const f = await convergenceFixture(db);
  const q1 = await db.externalEvidenceQualificationDecision.findUniqueOrThrow({ where: { id: f.record.qualificationDecisionId } });
  const d1 = await db.externalEvidenceDependencyAssessment.findUniqueOrThrow({ where: { id: f.record.dependencyAssessmentId } });
  const c1 = await db.externalEvidenceConstructRelationship.findUniqueOrThrow({ where: { id: f.record.constructRelationshipId } });
  await assert.rejects(() => f.convergence.converge(f.locator), /dependency_not_governed_reviewed/);
  const r1 = await f.content();
  await f.dependency();
  await assert.rejects(() => f.content(), /QUALIFICATION_NEEDS_CONVERGENCE|requires governed qualification/);
  await assert.rejects(() => f.convergence.converge(f.locator), /construct_not_governed_reviewed/);
  await f.construct();
  assert.equal((await f.convergence.inspect(f.locator)).status, "needs_convergence");
  const [a, b] = await Promise.all([f.convergence.converge(f.locator), f.convergence.converge(f.locator)]);
  assert.equal(a.id, b.id);
  assert.deepEqual([a.status, b.status].sort(), ["created", "existing"]);
  assert.equal(a.assessment.state, "context_only");
  assert.equal(a.assessment.dependency, "independent_observation");
  assert.equal(a.assessment.constructRelationship?.reviewed, true);
  assert.notDeepEqual(a.assessment, f.record.qualification);
  const state = await new PrismaReviewedQualificationRepository(db).load(f.locator);
  assert.equal(state.graph.sources[0]!.version, f.input.source.sourceVersion);
  assert.deepEqual(a.assessment, qualifyEquipmentClaim({ graph: state.graph, normalizedClaimId: state.normalizedClaimId, targetIdentity: state.targetIdentity }));
  const q2 = await db.externalEvidenceQualificationDecision.findUniqueOrThrow({ where: { id: a.id } });
  assert.equal(q2.constructRelationshipId, state.constructRelationshipId);
  assert.equal(q2.sourceGovernanceRevisionId, state.sourceGovernanceRevisionId);
  assert.equal(q2.contractVersion, "1.0");
  const normalized = await db.externalEvidenceNormalizedClaim.findUniqueOrThrow({ where: { id: f.record.normalizedClaimId } });
  assert.equal(normalized.evidenceClass, "unclassified");
  assert.equal(normalized.proposedEvidenceClass, "structured_human_evaluation");
  const status = await f.review.inspect(f.locator);
  assert.equal(status.binding.qualificationDecisionId, a.id);
  assert.equal(status.binding.dependencyAssessmentId, state.dependencyAssessmentId);
  assert.equal(status.binding.constructRelationshipId, state.constructRelationshipId);
  assert.equal(status.qualificationConvergence, "current");
  const projectedCase = await new PrismaGovernedReviewRepository(db).loadCase(f.locator);
  assert.equal(projectedCase?.record.dependencyAssessmentId, state.dependencyAssessmentId);
  assert.equal(projectedCase?.record.constructRelationshipId, state.constructRelationshipId);
  assert.equal(status.applicableDecision, undefined);
  assert.ok(status.historicalDecisions.some(row => row.decision.id === r1.id));
  const before = await dimensionCounts(f.record.rawClaimId, f.record.normalizedClaimId);
  const r2 = await f.content();
  assert.equal(r2.reviewedBinding.qualificationDecisionId, a.id);
  assert.deepEqual(await dimensionCounts(f.record.rawClaimId, f.record.normalizedClaimId), before);
  assert.equal((await f.review.inspect(f.locator)).applicableDecision?.id, r2.id);
  assert.equal((await f.convergence.converge(f.locator)).id, a.id);
  assert.equal((await f.convergence.inspect(f.locator)).status, "current");
  await assert.rejects(() => db.externalEvidenceQualificationDecision.update({ where: { id: a.id }, data: { state: "qualified" } }));
  await f.dependency();
  assert.equal((await f.convergence.inspect(f.locator)).status, "needs_convergence");
  assert.equal((await f.review.inspect(f.locator)).applicableDecision, undefined);
  await assert.rejects(() => f.content(), /requires governed qualification/);
  const q3 = await f.convergence.converge(f.locator);
  assert.notEqual(q3.id, a.id);
  await f.construct();
  assert.equal((await f.convergence.inspect(f.locator)).status, "needs_convergence");
  const q4 = await f.convergence.converge(f.locator);
  assert.notEqual(q4.id, q3.id);
  const g1 = await db.externalEvidenceSourceGovernanceRevision.findUniqueOrThrow({ where: { id: state.sourceGovernanceRevisionId } });
  const g2 = await db.externalEvidenceSourceGovernanceRevision.create({ data: { sourceId: g1.sourceId, revisionNumber: 2, governanceVersion: g1.governanceVersion, sourceType: g1.sourceType, publisherIdentity: g1.publisherIdentity, authorityScope: g1.authorityScope!, dependencyKnowledge: g1.dependencyKnowledge!, state: "active", reviewerType: "human", reviewerReference: "governance-reviewer", rationale: "Reviewed authority remains bounded.", effectiveAt: new Date(), supersedesRevisionId: g1.id, idempotencyKey: randomUUID() } });
  assert.equal((await f.convergence.inspect(f.locator)).status, "needs_convergence");
  const q5 = await f.convergence.converge(f.locator);
  assert.notEqual(q5.id, q4.id);
  assert.equal((await db.externalEvidenceQualificationDecision.findUniqueOrThrow({ where: { id: q5.id } })).sourceGovernanceRevisionId, g2.id);
  assert.equal((await f.review.inspect(f.locator)).binding.sourceGovernanceRevisionId, g2.id);
  assert.deepEqual(await db.externalEvidenceQualificationDecision.findUniqueOrThrow({ where: { id: q1.id } }), q1);
  assert.deepEqual(await db.externalEvidenceDependencyAssessment.findUniqueOrThrow({ where: { id: d1.id } }), d1);
  assert.deepEqual(await db.externalEvidenceConstructRelationship.findUniqueOrThrow({ where: { id: c1.id } }), c1);
  assert.deepEqual(await db.externalEvidenceQualificationDecision.findUniqueOrThrow({ where: { id: a.id } }), q2);
  assert.equal(await db.externalEvidenceReviewDecision.count({ where: { id: { in: [r1.id, r2.id] } } }), 2);
  assert.equal(await db.externalSupportingRoleDecision.count({ where: { normalizedClaimId: normalized.id } }), 0);
  assert.equal(await db.equipmentDNAAttributeEvaluation.count({ where: { equipmentId: f.equipment.id } }), 0);
  assert.equal(await db.recommendationItem.count({ where: { equipmentId: f.equipment.id } }), 0);
});

integration("#078 exact R2 replay is idempotent only while its governed meaning is current", async () => {
  assert.ok(db);
  for (const dimension of ["dependency", "construct", "governance"] as const) {
    const f = await convergenceFixture(db);
    await f.dependency(); await f.construct(); await f.convergence.converge(f.locator);
    const command = { ...f.locator, credential: f.token, expectedStateFingerprint: (await f.review.inspect(f.locator)).stateFingerprint,
      decision: "reviewed_accepted" as const, reason: "Reviewed current claim.", idempotencyKey: randomUUID() };
    const r2 = await f.review.reviewClaim(command);
    assert.equal((await f.review.reviewClaim(command)).id, r2.id);
    await assert.rejects(() => f.review.reviewClaim({ ...command, reason: "Conflicting review." }), /IDEMPOTENCY_CONFLICT|different decision/);
    assert.equal(await db.externalEvidenceReviewDecision.count({ where: { normalizedClaimId: f.record.normalizedClaimId } }), 1);
    if (dimension === "dependency") await f.dependency();
    else if (dimension === "construct") await f.construct();
    else {
      const g = await db.externalEvidenceSourceGovernanceRevision.findUniqueOrThrow({ where: { id: f.record.reviewReady.currentSourceGovernanceRevisionId } });
      await db.externalEvidenceSourceGovernanceRevision.create({ data: { sourceId: g.sourceId, revisionNumber: 2, governanceVersion: g.governanceVersion,
        sourceType: g.sourceType, publisherIdentity: g.publisherIdentity, authorityScope: g.authorityScope!, dependencyKnowledge: g.dependencyKnowledge!,
        state: "active", reviewerType: "human", reviewerReference: "successor-reviewer", rationale: "Same scope, new revision.",
        effectiveAt: new Date(), supersedesRevisionId: g.id, idempotencyKey: randomUUID() } });
    }
    await assert.rejects(() => f.review.reviewClaim(command), /QUALIFICATION_NEEDS_CONVERGENCE|CASE_NOT_CURRENT|STALE_REVIEW_CASE|requires governed qualification|no longer current/);
    assert.equal((await db.externalEvidenceReviewDecision.findUniqueOrThrow({ where: { id: r2.id } })).reviewedStateFingerprint, r2.reviewedStateFingerprint);
    const status = await f.review.inspect(f.locator);
    assert.equal(status.applicableDecision, undefined);
    assert.ok(status.historicalDecisions.some(row => row.decision.id === r2.id));
    assert.equal(await db.externalEvidenceReviewDecision.count({ where: { normalizedClaimId: f.record.normalizedClaimId } }), 1);
  }
});

integration("#078 exact-key replay waits for a dimension successor before checking currentness", async () => {
  assert.ok(db);
  const f = await convergenceFixture(db);
  await f.dependency(); await f.construct(); await f.convergence.converge(f.locator);
  const command = { ...f.locator, credential: f.token, expectedStateFingerprint: (await f.review.inspect(f.locator)).stateFingerprint,
    decision: "reviewed_accepted" as const, reason: "Reviewed before race.", idempotencyKey: randomUUID() };
  const r2 = await f.review.reviewClaim(command);
  let acquired!: () => void; let release!: () => void;
  const locked = new Promise<void>(resolve => { acquired = resolve; });
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const writer = db.$transaction(async tx => {
    const repository = new PrismaGovernedReviewRepository(tx, true);
    await repository.lockClaimSlot(f.locator);
    const claim = await repository.loadCase(f.locator);
    assert.ok(claim);
    acquired(); await barrier;
    await repository.writeDependencyReview({ ...f.locator, credential: f.token, expectedStateFingerprint: command.expectedStateFingerprint,
      decision: "reviewed_accepted", reason: "Race successor.", idempotencyKey: randomUUID(), dependencyType: "independent_observation",
      independenceGroupId: `expert:${f.record.sourceId}`, reviewerId: "convergence-human", claim });
  }, { timeout: 30000 });
  await locked;
  const replay = f.review.reviewClaim(command).then(value => ({ value, error: undefined }), error => ({ value: undefined, error }));
  try { await waitForBlockedWriter(db); } finally { release(); }
  await writer;
  const result = await replay;
  assert.equal(result.value, undefined);
  assert.match(String(result.error), /QUALIFICATION_NEEDS_CONVERGENCE|requires governed qualification/);
  assert.equal((await db.externalEvidenceReviewDecision.findUniqueOrThrow({ where: { id: r2.id } })).id, r2.id);
  assert.equal(await db.externalEvidenceReviewDecision.count({ where: { normalizedClaimId: f.record.normalizedClaimId } }), 1);
});

integration("#078 PostgreSQL locks serialize dependency, construct, governance and R2 races", async () => {
  assert.ok(db);
  for (const dimension of ["dependency", "construct", "governance"] as const) {
    const f = await convergenceFixture(db);
    await f.dependency(); await f.construct();
    const initial = await f.convergence.converge(f.locator);
    const oldReview = await f.review.inspect(f.locator);
    let locked!: () => void; let release!: () => void;
    const acquired = new Promise<void>(resolve => { locked = resolve; });
    const barrier = new Promise<void>(resolve => { release = resolve; });
    const writer = db.$transaction(async tx => {
      const repository = new PrismaGovernedReviewRepository(tx, true);
      await repository.lockClaimSlot(f.locator);
      const claim = await repository.loadCase(f.locator);
      assert.ok(claim);
      locked(); await barrier;
      if (dimension === "dependency") await repository.writeDependencyReview({ ...f.locator, credential: f.token, expectedStateFingerprint: oldReview.stateFingerprint, decision: "reviewed_accepted", reason: "Race successor dependency.", idempotencyKey: randomUUID(), dependencyType: "independent_observation", independenceGroupId: `expert:${f.record.sourceId}`, reviewerId: "convergence-human", claim });
      else if (dimension === "construct") await repository.writeConstructReview({ ...f.locator, credential: f.token, expectedStateFingerprint: oldReview.stateFingerprint, decision: "reviewed_accepted", reason: "Race successor construct.", idempotencyKey: randomUUID(), role: "supporting_context", mappingConfidence: "high", reviewerId: "convergence-human", claim });
      else {
        const g = await tx.externalEvidenceSourceGovernanceRevision.findUniqueOrThrow({ where: { id: claim.record.reviewReady.currentSourceGovernanceRevisionId } });
        await tx.externalEvidenceSourceGovernanceRevision.create({ data: { sourceId: g.sourceId, revisionNumber: g.revisionNumber + 1, governanceVersion: g.governanceVersion, sourceType: g.sourceType, publisherIdentity: g.publisherIdentity, authorityScope: g.authorityScope!, dependencyKnowledge: g.dependencyKnowledge!, state: "active", reviewerType: "human", reviewerReference: "race-governance", rationale: "Race governance successor.", effectiveAt: new Date(), supersedesRevisionId: g.id, idempotencyKey: randomUUID() } });
      }
    }, { timeout: 30000 });
    await acquired;
    const converging = f.convergence.converge(f.locator);
    const reviewing = f.review.reviewClaim({ ...f.locator, credential: f.token, expectedStateFingerprint: oldReview.stateFingerprint, decision: "reviewed_accepted", reason: "Stale pre-race approval.", idempotencyKey: randomUUID() }).then(value => ({ value, error: undefined }), error => ({ value: undefined, error }));
    await waitForBlockedWriter(db);
    release(); await writer;
    const successor = await converging;
    assert.notEqual(successor.id, initial.id);
    assert.equal((await f.convergence.inspect(f.locator)).id, successor.id);
    assert.ok((await reviewing).error);
    assert.equal(await db.externalEvidenceReviewDecision.count({ where: { normalizedClaimId: f.record.normalizedClaimId } }), 0);
  }
});

integration("#078 semantic current selector ignores timestamps and rejects ambiguous qualification", async () => {
  assert.ok(db);
  const f = await convergenceFixture(db); await f.dependency(); await f.construct();
  const q = await f.convergence.converge(f.locator);
  const row = await db.externalEvidenceQualificationDecision.findUniqueOrThrow({ where: { id: q.id } });
  const { id: _id, decidedAt: _time, ...data } = row;
  await db.externalEvidenceQualificationDecision.create({ data: { ...data, proposedEvidenceInput: undefined, reasons: row.reasons!, gaps: row.gaps!, blockers: row.blockers!, warnings: row.warnings!, limitations: row.limitations!, id: randomUUID(), idempotencyKey: randomUUID(), semanticFingerprint: "unrelated-history", decidedAt: new Date("2099-01-01") } });
  assert.equal((await f.convergence.inspect(f.locator)).id, q.id);
  assert.equal((await f.review.inspect(f.locator)).binding.qualificationDecisionId, q.id);
  await db.externalEvidenceQualificationDecision.create({ data: { ...data, proposedEvidenceInput: undefined, reasons: row.reasons!, gaps: row.gaps!, blockers: row.blockers!, warnings: row.warnings!, limitations: row.limitations!, id: randomUUID(), idempotencyKey: randomUUID() } });
  await assert.rejects(() => f.convergence.inspect(f.locator), /qualification_ambiguous/);
  await assert.rejects(() => f.content(), /requires governed qualification/);
});

integration("#078 unknown, rejected, legacy and inactive governed state fails closed", async () => {
  assert.ok(db);
  const unknown = await convergenceFixture(db); await unknown.dependency(); await unknown.construct();
  await unknown.review.reviewDependency({ ...await unknown.dimensionCommand(), dependencyType: "unknown_dependency" });
  await assert.rejects(() => unknown.convergence.converge(unknown.locator), /dependency_unknown/);
  const rejected = await convergenceFixture(db); await rejected.dependency(); await rejected.construct();
  await rejected.review.reviewConstruct({ ...await rejected.dimensionCommand(), decision: "reviewed_rejected", role: "candidate_only", mappingConfidence: "low" });
  await assert.rejects(() => rejected.convergence.converge(rejected.locator), /construct_not_governed_reviewed/);
  const inactive = await convergenceFixture(db); await inactive.dependency(); await inactive.construct();
  const g = await db.externalEvidenceSourceGovernanceRevision.findUniqueOrThrow({ where: { id: inactive.record.reviewReady.currentSourceGovernanceRevisionId } });
  await db.externalEvidenceSourceGovernanceRevision.create({ data: { sourceId: g.sourceId, revisionNumber: 2, governanceVersion: g.governanceVersion, sourceType: g.sourceType, publisherIdentity: g.publisherIdentity, authorityScope: g.authorityScope!, dependencyKnowledge: g.dependencyKnowledge!, state: "historical", reviewerType: "human", reviewerReference: "governance", rationale: "Withdrawn authority.", effectiveAt: new Date(), supersedesRevisionId: g.id, idempotencyKey: randomUUID() } });
  await assert.rejects(() => inactive.convergence.converge(inactive.locator), /source_governance_state_inactive/);
  for (const f of [unknown, rejected, inactive]) {
    assert.equal(await db.externalEvidenceQualificationDecision.count({ where: { normalizedClaimId: f.record.normalizedClaimId } }), 1);
    assert.equal(await db.externalSupportingRoleDecision.count({ where: { normalizedClaimId: f.record.normalizedClaimId } }), 0);
  }
});

integration("#078 content review race cannot approve a superseded dimension snapshot", async () => {
  assert.ok(db);
  const f = await convergenceFixture(db); await f.dependency(); await f.construct(); await f.convergence.converge(f.locator);
  const observed = await f.review.inspect(f.locator);
  await f.dependency();
  await assert.rejects(() => f.review.reviewClaim({ ...f.locator, credential: f.token, expectedStateFingerprint: observed.stateFingerprint, decision: "reviewed_accepted", reason: "Previously loaded state.", idempotencyKey: randomUUID() }), /requires governed qualification/);
  assert.equal(await db.externalEvidenceReviewDecision.count({ where: { normalizedClaimId: f.record.normalizedClaimId } }), 0);
});

integration("#078 transaction failure rolls back Q2 and wrong scope cannot converge", async () => {
  assert.ok(db);
  const f = await convergenceFixture(db); await f.dependency(); await f.construct();
  const real = new PrismaReviewedQualificationRepository(db);
  const failing: ReviewedQualificationRepository = {
    transaction: operation => real.transaction(repository => operation({
      transaction: repository.transaction.bind(repository), lock: repository.lock.bind(repository), load: repository.load.bind(repository), findCurrent: repository.findCurrent.bind(repository),
      async append(state, expected) { await repository.append(state, expected); throw new Error("Injected after Q2 write"); }
    })), lock: real.lock.bind(real), load: real.load.bind(real), findCurrent: real.findCurrent.bind(real), append: real.append.bind(real)
  };
  await assert.rejects(() => new ReviewedDimensionQualificationConvergenceService(failing).converge(f.locator), /Injected after Q2 write/);
  assert.equal(await db.externalEvidenceQualificationDecision.count({ where: { normalizedClaimId: f.record.normalizedClaimId } }), 1);
  await assert.rejects(() => f.convergence.converge({ ...f.locator, claimSlotKey: "wrong-slot" }), /claim_scope_mismatch/);
  assert.equal((await f.convergence.converge(f.locator)).status, "created");
});

integration("#078 dependent claim preserves upstream lineage without independent-source promotion", async () => {
  assert.ok(db);
  const parent = await convergenceFixture(db); await parent.dependency(); await parent.construct();
  const child = await convergenceFixture(db);
  await child.review.reviewDependency({ ...await child.dimensionCommand(), dependencyType: "derived_from", upstreamClaimId: parent.record.rawClaimId });
  await child.construct();
  const q = await child.convergence.converge(child.locator);
  assert.equal(q.assessment.dependency, "derived_from");
  assert.ok(q.assessment.reasons.includes("shared_dependency_preserved"));
  const state = await new PrismaReviewedQualificationRepository(db).load(child.locator);
  assert.equal(state.graph.rawClaims.length, 2);
  assert.equal(state.graph.rawClaims[0]!.independenceGroupId, state.graph.rawClaims[1]!.independenceGroupId);
  assert.equal(await db.externalSupportingRoleDecision.count({ where: { normalizedClaimId: child.record.normalizedClaimId } }), 0);
});

integration("#078 successors cannot pass the locks after convergence has read D2 C2 G1", async () => {
  assert.ok(db);
  for (const dimension of ["dependency", "construct", "governance"] as const) {
    const f = await convergenceFixture(db); await f.dependency(); await f.construct();
    const real = new PrismaReviewedQualificationRepository(db);
    let observed!: () => void; let release!: () => void;
    const loaded = new Promise<void>(resolve => { observed = resolve; });
    const barrier = new Promise<void>(resolve => { release = resolve; });
    const paused: ReviewedQualificationRepository = {
      transaction: operation => real.transaction(repository => operation({
        transaction: repository.transaction.bind(repository), lock: repository.lock.bind(repository), findCurrent: repository.findCurrent.bind(repository), append: repository.append.bind(repository),
        async load(locator) { const state = await repository.load(locator); observed(); await barrier; return state; }
      })), lock: real.lock.bind(real), load: real.load.bind(real), findCurrent: real.findCurrent.bind(real), append: real.append.bind(real)
    };
    const converging = new ReviewedDimensionQualificationConvergenceService(paused).converge(f.locator);
    await loaded;
    const changing = dimension === "dependency" ? f.dependency() : dimension === "construct" ? f.construct() : (async () => {
      const g = await db!.externalEvidenceSourceGovernanceRevision.findUniqueOrThrow({ where: { id: f.record.reviewReady.currentSourceGovernanceRevisionId } });
      // This writer does not cooperate with the application advisory lock. Its FK
      // lock must still wait for the source FOR UPDATE held by convergence.
      await db!.externalEvidenceSourceGovernanceRevision.create({ data: { sourceId: g.sourceId, revisionNumber: 2, governanceVersion: g.governanceVersion, sourceType: g.sourceType, publisherIdentity: g.publisherIdentity, authorityScope: g.authorityScope!, dependencyKnowledge: g.dependencyKnowledge!, state: "active", reviewerType: "human", reviewerReference: "late-governance", rationale: "Direct late governance writer.", effectiveAt: new Date(), supersedesRevisionId: g.id, idempotencyKey: randomUUID() } });
    })();
    try { await waitForBlockedWriter(db); } finally { release(); }
    const q2 = await converging; await changing;
    assert.equal(q2.status, "created");
    const current = await f.convergence.inspect(f.locator);
    assert.equal(current.status, "needs_convergence");
    assert.notEqual(current.id, q2.id);
    assert.equal((await f.review.inspect(f.locator)).applicableDecision, undefined);
  }
});

integration("#078 unresolved conflicts prevent convergence and content approval", async () => {
  assert.ok(db);
  const f = await convergenceFixture(db); await f.dependency(); await f.construct(); await f.convergence.converge(f.locator);
  const source = { ...f.input.source, stableKey: randomUUID() };
  await db.externalEvidenceSource.create({ data: { id: externalClaimUuid(`source:${source.stableKey}`), ...source, metadata: { sourceAuthorityResolved: true } } });
  const other = await f.ingestion.ingest({ ...f.input, source,
    document: { ...f.input.document, sourceReference: `https://example.invalid/${randomUUID()}`, boundedContent: "Demanding to start moving." },
    extraction: { ...f.input.extraction, logicalRunKey: randomUUID() },
    claims: [{ ...f.input.claims[0]!, rawText: "Demanding to start moving.", normalization: { ...f.input.claims[0]!.normalization, value: "demanding" } }] });
  assert.deepEqual(other.failed, []);
  await assert.rejects(() => f.convergence.converge(f.locator), /claim_not_current/);
  await assert.rejects(() => f.content(), /requires governed qualification|no longer/);
  assert.equal(await db.externalEvidenceQualificationDecision.count({ where: { normalizedClaimId: f.record.normalizedClaimId } }), 2);
});

async function dimensionCounts(rawClaimId: string, normalizedClaimId: string) {
  assert.ok(db);
  return { d: await db.externalEvidenceDependencyAssessment.count({ where: { claimId: rawClaimId } }), c: await db.externalEvidenceConstructRelationship.count({ where: { normalizedClaimId } }), q: await db.externalEvidenceQualificationDecision.count({ where: { normalizedClaimId } }) };
}
async function waitForBlockedWriter(client: PrismaClient) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const rows = await client.$queryRaw<Array<{ count: bigint }>>`SELECT count(*)::bigint AS count FROM pg_locks WHERE NOT granted AND locktype IN ('advisory', 'transactionid')`;
    if (rows[0]!.count > 0n) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error("PostgreSQL did not observe a blocked concurrent writer");
}
test.after(async () => { await db?.$disconnect(); });
