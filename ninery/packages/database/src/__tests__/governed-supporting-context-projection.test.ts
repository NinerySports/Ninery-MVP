import assert from "node:assert/strict";
import test from "node:test";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaGovernedSupportingContextProjectionRepository as SnapshotRepository } from "../prisma-governed-supporting-context-projection-repository.js";
import { PrismaGovernedSupportingContextBridgeRepository } from "../prisma-governed-supporting-context-bridge-repository.js";
import { GovernedSupportingContextBridgeError } from "../governed-supporting-context-bridge.js";
import { GovernedSupportingContextProjectionService, toGovernedSupportingContextOverlay, type GovernedSupportingContextEntry, type GovernedSupportingContextProjectionRepository } from "../governed-supporting-context-projection.js";

const request = { equipmentId: "equipment", equipmentVariantId: "variant", construct: "startup_demand" as const };
function entry(id: string, status: "current" | "historical", decidedAt: string): GovernedSupportingContextEntry {
  return { decisionId: id, status, exclusions: status === "historical" ? ["review_not_current"] : [], decidedAt,
    construct: "startup_demand", direction: "lower", identityScope: "exact_variant",
    provenance: { sourceId: "source", documentId: "document", extractionRunId: "extraction", rawClaimId: "raw",
      normalizedClaimId: "normalized", identityAssertionId: "identity", dependencyAssessmentId: "dependency",
      dependencyType: "independent_observation", independenceGroupId: "group", independence: "reviewed_independent",
      constructRelationshipId: "construct", qualificationDecisionId: "q2", reviewDecisionId: "r2",
      equipmentId: "equipment", equipmentVariantId: "variant" },
    authority: { role: "supporting_context", directEvidenceContribution: 0, canonicalValueCreated: false,
      numericValueCreated: false, synthesisEligibilityGranted: false, recommendationAuthorityGranted: false } };
}

test("projection deterministically separates current and historical without granting evidence authority", async () => {
  let snapshots = 0;
  const repository: GovernedSupportingContextProjectionRepository = {
    async readSnapshot(operation) { snapshots++; return operation(this); },
    async load() { return [entry("later", "historical", "2026-09-02T00:00:00.000Z"), entry("earlier", "current", "2026-09-01T00:00:00.000Z")]; }
  };
  const service = new GovernedSupportingContextProjectionService(repository);
  const first = await service.loadGovernedSupportingContext(request);
  const second = await service.loadGovernedSupportingContext(request);
  assert.deepEqual(first, second);
  assert.equal(snapshots, 2);
  assert.deepEqual(first.current.map(item => item.decisionId), ["earlier"]);
  assert.deepEqual(first.historical.map(item => item.decisionId), ["later"]);
  assert.deepEqual(first.exclusions, [{ decisionId: "later", reasons: ["review_not_current"] }]);
  const overlay = toGovernedSupportingContextOverlay(first);
  assert.equal(overlay.role, "supporting_context");
  assert.equal(overlay.directEvidenceCountContribution, 0);
  assert.equal(overlay.canonicalValueCreated, false);
  assert.equal(overlay.numericValueCreated, false);
  assert.equal(overlay.synthesisEligibilityGranted, false);
  assert.equal(overlay.recommendationAuthorityGranted, false);
  assert.equal("evidenceClass" in overlay.entries[0]!, false);
});

function clients() {
  const root = new PrismaClient({ datasources: { db: { url: "postgresql://unused:unused@127.0.0.1:1/unit_only" } } });
  const overrides = new Map<PropertyKey, unknown>([["externalSupportingRoleDecision", { async findMany() { return []; } }]]);
  const tx = new Proxy(root, {
    has(target, key) { return key === "$transaction" ? false : Reflect.has(target, key); },
    get(target, key) { return key === "$transaction" ? undefined : overrides.has(key) ? overrides.get(key) : Reflect.get(target, key); },
    getOwnPropertyDescriptor(target, key) {
      return { configurable: true, enumerable: true, writable: true, value: overrides.has(key) ? overrides.get(key) : Reflect.get(target, key) };
    },
    defineProperty(_target, key, descriptor) { overrides.set(key, descriptor.value); return true; }
  });
  return { root, tx };
}

for (const marker of [true, false]) test(`#084 legacy marker ${marker} is rejected`, () => {
  assert.throws(() => Reflect.construct(SnapshotRepository, [clients().root, marker]), /PROJECTION_LEGACY_MARKER_REJECTED/);
});
test("#084 wrong ownership and root borrowing fail closed", async () => {
  const { root, tx } = clients();
  assert.throws(() => Reflect.construct(SnapshotRepository, [tx]), /PROJECTION_ROOT_CLIENT_REQUIRED/);
  await assert.rejects(SnapshotRepository.fromProtectedTransaction(root), /PROJECTION_ROOT_CLIENT_BORROW_REJECTED/);
  await assert.rejects(new SnapshotRepository(root).load(request), /PROJECTION_SNAPSHOT_REQUIRED/);
});
for (const settings of [undefined, null, [], [{}], [{ isolation: "read committed", readOnly: "on" }], [{ isolation: "repeatable read", readOnly: "off" }], [{ isolation: "repeatable read", readOnly: "on" }, {}]]) {
  test(`#084 invalid settings ${JSON.stringify(settings)} reject before evidence reads`, async t => {
    const { tx } = clients();
    t.mock.method(tx, "$queryRaw", async () => settings);
    const query = t.mock.method(tx.externalSupportingRoleDecision, "findMany", async () => []);
    await assert.rejects(SnapshotRepository.fromProtectedTransaction(tx), /PROJECTION_SNAPSHOT_SETTINGS_REQUIRED/);
    assert.equal(query.mock.callCount(), 0);
  });
}
test("#084 verification failures propagate before evidence reads", async t => {
  const { tx } = clients();
  t.mock.method(tx, "$queryRaw", async () => { throw new Error("Unavailable settings"); });
  await assert.rejects(SnapshotRepository.fromProtectedTransaction(tx), /PROJECTION_SNAPSHOT_VERIFICATION_FAILED/);
});
test("#084 borrowed reads reverify protection without owning or modifying a transaction", async t => {
  const { tx } = clients();
  let valid = true;
  const settings = t.mock.method(tx, "$queryRaw", async () => [{ isolation: "repeatable read", readOnly: valid ? "on" : "off" }]);
  const writes = t.mock.method(tx, "$executeRaw", async () => { throw new Error("Must not change caller settings"); });
  const reads = t.mock.method(tx.externalSupportingRoleDecision, "findMany", async () => []);
  const borrowed = await SnapshotRepository.fromProtectedTransaction(tx);
  assert.deepEqual(await borrowed.readSnapshot(repo => repo.load(request)), []);
  assert.equal(settings.mock.callCount(), 3);
  assert.equal(writes.mock.callCount(), 0);
  valid = false;
  await assert.rejects(borrowed.load(request), /PROJECTION_SNAPSHOT_SETTINGS_REQUIRED/);
  let invoked = false;
  await assert.rejects(borrowed.readSnapshot(async () => { invoked = true; return []; }), /PROJECTION_SNAPSHOT_SETTINGS_REQUIRED/);
  assert.equal(invoked, false);
  assert.equal(reads.mock.callCount(), 1);
});
test("#084 expired borrowed transaction errors are not historical evidence", async t => {
  const { tx } = clients();
  const settings = t.mock.method(tx, "$queryRaw", async () => [{ isolation: "repeatable read", readOnly: "on" }]);
  const borrowed = await SnapshotRepository.fromProtectedTransaction(tx);
  const expired = new Prisma.PrismaClientKnownRequestError("Transaction closed", { code: "P2028", clientVersion: "test" });
  settings.mock.mockImplementation(async () => { throw expired; });
  await assert.rejects(borrowed.load(request), error => error === expired);
  await assert.rejects(borrowed.readSnapshot(async () => []), error => error === expired);
});

for (const fallback of [false, true]) test(`#084 expiration inside record classification propagates (fallback=${fallback})`, async t => {
  const { tx } = clients();
  const expired = new Prisma.PrismaClientKnownRequestError("Transaction closed", { code: "P2028", clientVersion: "test" });
  let queries = 0;
  t.mock.method(tx, "$queryRaw", async () => {
    if (++queries > 2) throw expired;
    return [{ isolation: "repeatable read", readOnly: "on" }];
  });
  t.mock.method(tx.externalSupportingRoleDecision, "findMany", async () => [{
    normalizedClaimId: "normalized", rawClaim: { identityAssertion: {}, claimSlotKey: "slot", document: { sourceId: "source" } },
    reviewDecision: { reviewedBinding: { ingestionSemanticFingerprint: "fingerprint", claimSlotKey: "slot", sourceId: "source" } },
    normalizedClaim: { qualificationDecisions: [{ id: "q", idempotencyKey: "ingestion:q" }] }
  }]);
  t.mock.method(PrismaGovernedSupportingContextBridgeRepository.prototype, "loadCurrent", async () => {
    if (fallback) throw new GovernedSupportingContextBridgeError("CASE_NOT_CURRENT");
    throw expired;
  });
  const borrowed = await SnapshotRepository.fromProtectedTransaction(tx);
  await assert.rejects(borrowed.load(request), error => error === expired);
});
