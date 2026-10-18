import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Prisma, PrismaClient } from "@prisma/client";
import { formatGovernedOperationalEvidenceReport } from "@ninery/equipment-intelligence";
import { GovernedOperationalEvidenceReportService } from "../governed-operational-evidence-report.js";
import { runGovernedOperationalEvidenceReport } from "../governed-operational-evidence-report-cli.js";
import { PrismaGovernedConstructEvidenceProjectionRepository } from "../prisma-governed-construct-evidence-projection-repository.js";
import { protocolCandidate } from "./stronger-evidence.fixture.js";
import { convergenceFixture } from "./reviewed-qualification.fixture.js";
import { GovernedSupportingContextBridgeService, governedSupportingContextIdempotencyKey } from "../governed-supporting-context-bridge.js";
import { PrismaGovernedSupportingContextBridgeRepository } from "../prisma-governed-supporting-context-bridge-repository.js";

const url = process.env.TEST_DATABASE_URL;
if (url) {
  const parsed = new URL(url);
  if (!["127.0.0.1", "localhost"].includes(parsed.hostname) || parsed.pathname !== "/ticket_079_disposable_085" || parsed.port !== "55440") throw new Error("#085 requires the isolated disposable PostgreSQL 16 database on localhost:55440.");
}
const integration = url ? test : test.skip;
const db = url ? new PrismaClient({ datasources: { db: { url } }, transactionOptions: { maxWait: 30000, timeout: 30000 } }) : undefined;
const repository = () => new PrismaGovernedConstructEvidenceProjectionRepository(db!);
const service = () => new GovernedOperationalEvidenceReportService(repository());

async function setup() {
  assert.ok(db);
  const equipment = await db.equipment.create({ data: { manufacturer: "Test", model: randomUUID(), modelYear: 2026, category: "bat", certification: "USA" } });
  const variant = await db.equipmentVariant.create({ data: { equipmentId: equipment.id, lengthInches: 30, weightOunces: 20, dropWeight: -10, sku: randomUUID() } });
  const record = protocolCandidate(equipment.id, variant.id, randomUUID(), randomUUID());
  const evidence = await db.equipmentDNAEvidenceRecord.create({ data: { id: record.id, equipmentId: equipment.id, equipmentVariantId: variant.id,
    targetLevel: "equipment", attributeKey: record.attributeKey, attributeDefinitionVersion: record.attributeDefinitionVersion,
    sourceType: "structured_expert_evaluation", sourceName: record.sourceName, sourceReference: record.sourceReference, sourceDate: new Date(record.sourceDate!),
    method: "standardized_rubric", rawValue: JSON.parse(JSON.stringify(record.rawValue)), evaluatorReference: record.evaluatorReference, status: "active" } });
  return { equipment, variant, evidence, request: { equipmentId: equipment.id, equipmentVariantId: variant.id, construct: "startup_demand" } };
}

integration("#085 disposable server identity is PostgreSQL 16 on the dedicated test port/database", async () => {
  assert.ok(db);
  const rows = await db.$queryRaw<Array<{ database: string; port: number; version: string; directory: string }>>`SELECT current_database() AS database, inet_server_port() AS port, current_setting('server_version') AS version, current_setting('data_directory') AS directory`;
  assert.equal(rows[0]!.database, "ticket_079_disposable_085");
  assert.equal(rows[0]!.port, 55440);
  assert.match(rows[0]!.version, /^16[.]/);
  assert.match(rows[0]!.directory.replaceAll("\\", "/"), /ninery-ticket085-pg$/);
});
integration("#085 actual report CLI predicates isolate variants, preserve raw inventory and never write rows", async () => {
  assert.ok(db);
  const f = await setup();
  const otherVariant = await db.equipmentVariant.create({ data: { equipmentId: f.equipment.id, sku: randomUUID() } });
  const foreignEquipment = await db.equipment.create({ data: { manufacturer: "Other", model: randomUUID(), category: "bat" } });
  const foreignVariant = await db.equipmentVariant.create({ data: { equipmentId: foreignEquipment.id, sku: randomUUID() } });
  const before = await db.equipmentDNAEvidenceRecord.findMany({ where: { equipmentId: f.equipment.id }, orderBy: { id: "asc" } });
  const args = ["--equipment=" + f.equipment.id, "--variant=" + otherVariant.id, "--construct=startup_demand"];
  const outputs: string[] = [];
  const deps = { client: db, write: (text: string) => outputs.push(text) };
  const evidence = await runGovernedOperationalEvidenceReport(args, "evidence", deps);
  const readiness = await runGovernedOperationalEvidenceReport(args, "readiness", deps);
  assert.deepEqual(evidence, readiness);
  assert.deepEqual(readiness.inventory.map(row => row.id), [f.evidence.id]);
  assert.equal(readiness.constructs[0]!.applicableCalibrationObservations.length, 0);
  assert.ok(readiness.constructs[0]!.excludedObservations[0]!.exclusions.includes("observed_variant_mismatch"));
  assert.match(outputs[0]!, /observed_variant_mismatch/);
  assert.doesNotMatch(outputs[0]!, /independent_same_method|provenance-aware independent/);
  await assert.rejects(service().load({ ...f.request, equipmentVariantId: foreignVariant.id }), /Variant does not belong/);
  const selected = await service().load(f.request);
  assert.equal(selected.constructs[0]!.applicableCalibrationObservations.length, 1);
  assert.equal(selected.constructs[0]!.directEvidenceRecordCount, 0);
  const model = await service().load({ equipmentId: f.equipment.id, construct: "startup_demand" });
  assert.equal(model.constructs[0]!.applicableCalibrationObservations.length, 0);
  assert.ok(model.constructs[0]!.unresolvedObservations[0]!.exclusions.includes("selected_variant_required"));
  assert.deepEqual(await db.equipmentDNAEvidenceRecord.findMany({ where: { equipmentId: f.equipment.id }, orderBy: { id: "asc" } }), before);
});
for (const [isolationLevel, readOnly] of [[Prisma.TransactionIsolationLevel.ReadCommitted, false], [Prisma.TransactionIsolationLevel.ReadCommitted, true], [Prisma.TransactionIsolationLevel.RepeatableRead, false]] as const) integration("#085 report rejects unsafe borrowed transaction " + isolationLevel + "/" + readOnly, async () => {
  assert.ok(db);
  await db.$transaction(async tx => {
    if (readOnly) await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const borrowed = new GovernedOperationalEvidenceReportService(new PrismaGovernedConstructEvidenceProjectionRepository(tx, true));
    await assert.rejects(borrowed.load({ equipmentId: randomUUID(), construct: "actual_mass" }), /PROJECTION_SNAPSHOT_SETTINGS_REQUIRED/);
  }, { isolationLevel });
});
integration("#085 one protected report snapshot survives committed status and catalog successors and then expires", async () => {
  assert.ok(db);
  const f = await setup();
  let borrowed: GovernedOperationalEvidenceReportService | undefined;
  await db.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const settings = await tx.$queryRaw<Array<{ isolation: string; readOnly: string }>>`SELECT current_setting('transaction_isolation') AS isolation, current_setting('transaction_read_only') AS "readOnly"`;
    assert.deepEqual(settings, [{ isolation: "repeatable read", readOnly: "on" }]);
    borrowed = new GovernedOperationalEvidenceReportService(new PrismaGovernedConstructEvidenceProjectionRepository(tx, true));
    const before = await borrowed.load({ ...f.request, construct: undefined });
    await db!.equipmentDNAEvidenceRecord.update({ where: { id: f.evidence.id }, data: { status: "withdrawn" } });
    await db!.equipment.update({ where: { id: f.equipment.id }, data: { model: "Committed successor" } });
    assert.deepEqual(await borrowed.load({ ...f.request, construct: undefined }), before);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000 });
  const after = await service().load(f.request);
  assert.equal(after.identity.model, "Committed successor");
  assert.equal(after.constructs[0]!.applicableCalibrationObservations.length, 0);
  assert.ok(after.constructs[0]!.excludedObservations[0]!.exclusions.includes("withdrawn_evidence"));
  await assert.rejects(borrowed!.load(f.request), error => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2028");
});
integration("#085 current/historical supporting context uses the same report snapshot with zero direct authority", async () => {
  assert.ok(db);
  const f = await convergenceFixture(db);
  await f.dependency(); await f.construct();
  const q = await f.convergence.converge(f.locator);
  const interpretation = { version: "1.0", policyVersion: "1.0-provisional", construct: "startup_demand", role: "supporting_context", identityScope: "exact_variant", direction: "lower" } as const;
  const r = await f.content(interpretation);
  const b = r.reviewedBinding;
  const lineage = { rawClaimId: b.rawClaimId, normalizedClaimId: b.normalizedClaimId, dependencyAssessmentId: b.dependencyAssessmentId, constructRelationshipId: b.constructRelationshipId,
    qualificationDecisionId: q.id, reviewDecisionId: r.id, interpretation };
  const support = await new GovernedSupportingContextBridgeService(new PrismaGovernedSupportingContextBridgeRepository(db)).persist({ ...f.locator, expectedQualificationDecisionId: q.id,
    expectedReviewDecisionId: r.id, identityScope: "exact_variant", direction: "lower", idempotencyKey: governedSupportingContextIdempotencyKey(lineage, interpretation) });
  const request = { equipmentId: f.equipment.id, equipmentVariantId: f.variant.id, construct: "startup_demand" };
  const beforeRow = await db.externalSupportingRoleDecision.findUniqueOrThrow({ where: { id: support.id } });
  await db.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const borrowed = new GovernedOperationalEvidenceReportService(new PrismaGovernedConstructEvidenceProjectionRepository(tx, true));
    const before = await borrowed.load(request);
    assert.deepEqual(before.constructs[0]!.supportingContext.currentDecisionIds, [support.id]);
    assert.equal(before.constructs[0]!.supportingContext.directEvidenceContribution, 0);
    await f.dependency();
    assert.deepEqual(await borrowed.load(request), before);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000 });
  const after = await service().load(request);
  assert.deepEqual(after.constructs[0]!.supportingContext.historicalDecisionIds, [support.id]);
  assert.equal(after.constructs[0]!.directEvidenceRecordCount, 0);
  assert.match(formatGovernedOperationalEvidenceReport(after), /direct evidence contribution 0/);
  assert.deepEqual(await db.externalSupportingRoleDecision.findUniqueOrThrow({ where: { id: support.id } }), beforeRow);
});
integration("#085 actual writer evaluators and sessions remain descriptive inventory, never independent corroboration", async () => {
  assert.ok(db);
  const f = await setup();
  const next = protocolCandidate(f.equipment.id, f.variant.id, randomUUID(), randomUUID());
  await db.equipmentDNAEvidenceRecord.create({ data: { id: next.id, equipmentId: f.equipment.id, equipmentVariantId: f.variant.id,
    targetLevel: "equipment", attributeKey: next.attributeKey, attributeDefinitionVersion: next.attributeDefinitionVersion,
    sourceType: "structured_expert_evaluation", sourceName: next.sourceName, sourceReference: next.sourceReference, sourceDate: new Date(next.sourceDate!),
    method: "standardized_rubric", rawValue: JSON.parse(JSON.stringify(next.rawValue)), evaluatorReference: next.evaluatorReference, status: "active" } });
  const result = await service().load(f.request);
  assert.equal(result.constructs[0]!.applicableCalibrationObservations.length, 2);
  assert.equal(result.constructs[0]!.directEvidenceRecordCount, 0);
  assert.deepEqual(result.constructs[0]!.knownIndependentStrongerGroups, []);
  assert.equal(result.constructs[0]!.sourceIndependence, "not_established");
  assert.deepEqual(result.constructs[0]!.dependence.independentGroups, []);
  assert.doesNotMatch(formatGovernedOperationalEvidenceReport(result), /independent_same_method|provenance-aware independent/);
});
test.after(async () => { await db?.$disconnect(); });
