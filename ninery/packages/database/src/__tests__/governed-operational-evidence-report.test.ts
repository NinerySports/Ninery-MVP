import assert from "node:assert/strict";
import test from "node:test";
import { Prisma, type PrismaClient } from "@prisma/client";
import { GovernedOperationalEvidenceReportService } from "../governed-operational-evidence-report.js";
import { runGovernedOperationalEvidenceReport, parseGovernedEvidenceReportOptions } from "../governed-operational-evidence-report-cli.js";
import { PrismaGovernedConstructEvidenceProjectionRepository } from "../prisma-governed-construct-evidence-projection-repository.js";
import { GovernedConstructEvidenceProjectionService } from "../governed-construct-evidence-projection.js";
import { protocolCandidate } from "./stronger-evidence.fixture.js";

const request = { equipmentId: "equipment", equipmentVariantId: "variant", construct: "startup_demand" };
function clients() {
  const calls: string[] = [];
  let settings: unknown = [{ isolation: "repeatable read", readOnly: "on" }];
  let failure: Error | undefined;
  const tx = {
    async $queryRaw() { calls.push("verify"); if (failure) throw failure; return settings; },
    async $executeRaw(strings: TemplateStringsArray) { calls.push(strings.join("")); },
    equipment: { async findUnique() { calls.push("equipment"); return { id: "equipment", manufacturer: "Test", model: "Test", modelYear: 2026, certification: "USA", specifications: [] }; } },
    equipmentVariant: {
      async findUnique({ where }: { where: { id: string } }) { calls.push("variant"); return { id: where.id, equipmentId: where.id === "foreign" ? "different-equipment" : "equipment", sku: where.id }; },
      async findMany() { calls.push("variants"); return [{ id: "variant", equipmentId: "equipment" }, { id: "other", equipmentId: "equipment" }]; }
    },
    equipmentDNAEvidenceRecord: { async findMany(args: unknown) { calls.push("evidence:" + JSON.stringify(args)); if (failure) throw failure; return [protocolCandidate("equipment", "variant")]; } },
    acquisitionEvidenceBinding: { async findMany() { return []; } },
    externalSupportingRoleDecision: { async findMany() { calls.push("support"); return []; } }
  };
  const root = { async $transaction<T>(operation: (client: typeof tx) => Promise<T>, options: unknown) { calls.push("transaction:" + JSON.stringify(options)); return operation(tx); } } as unknown as PrismaClient;
  return { root, tx: tx as unknown as Prisma.TransactionClient, calls,
    setSettings(value: unknown) { settings = value; }, expire(error: Error) { failure = error; } };
}

test("#085 actual CLI loader uses one existing protected transaction and captures inventory once", async () => {
  const f = clients();
  const writes: string[] = [];
  const result = await runGovernedOperationalEvidenceReport(["--equipment=equipment", "--variant=variant"], "readiness", { client: f.root, write: output => writes.push(output) });
  assert.equal(f.calls.filter(call => call.startsWith("transaction:")).length, 1);
  assert.match(f.calls[0]!, /RepeatableRead/);
  assert.equal(f.calls[1], "SET TRANSACTION READ ONLY");
  assert.ok(f.calls.indexOf("verify") < f.calls.indexOf("equipment"));
  const evidence = f.calls.filter(call => call.startsWith("evidence:"));
  assert.equal(evidence.length, 1);
  assert.match(evidence[0]!, /"where":\{"equipmentId":"equipment"\}/);
  assert.doesNotMatch(evidence[0]!, /targetLevel/);
  assert.ok(result.constructs.length > 1);
  assert.equal(result.inventory.length, 1);
  assert.match(writes[0]!, /Source independence: not_established/);
  assert.doesNotMatch(writes[0]!, /independent_same_method/);
});
test("#085 evidence and readiness CLI modes use the same governed decisions", async () => {
  const f = clients();
  const args = ["--equipment=equipment", "--variant=variant", "--construct=startup_demand"];
  const deps = { client: f.root, write() {} };
  assert.deepEqual(await runGovernedOperationalEvidenceReport(args, "evidence", deps), await runGovernedOperationalEvidenceReport(args, "readiness", deps));
});
test("#085 operational summary agrees with unchanged #081 projection", async () => {
  const f = clients();
  const repo = new PrismaGovernedConstructEvidenceProjectionRepository(f.root);
  const expected = await new GovernedConstructEvidenceProjectionService(repo).load(request);
  const actual = (await new GovernedOperationalEvidenceReportService(repo).load(request)).constructs[0]!;
  assert.equal(actual.directEvidenceRecordCount, expected.directEvidenceRecordCount);
  assert.equal(actual.descriptiveState, expected.descriptiveState);
  assert.deepEqual(actual.blockers, expected.blockers);
  assert.deepEqual(actual.gaps, expected.gaps);
  assert.equal(actual.applicableCalibrationObservations.length, expected.strongerEvidence.length);
});
for (const settings of [null, [], [{}], [{ isolation: "read committed", readOnly: "on" }], [{ isolation: "repeatable read", readOnly: "off" }]]) test("#085 unsafe borrowed report settings " + JSON.stringify(settings) + " fail before inventory", async () => {
  const f = clients(); f.setSettings(settings);
  const repo = new PrismaGovernedConstructEvidenceProjectionRepository(f.tx, true);
  await assert.rejects(repo.readOperationalSnapshot(request), /PROJECTION_SNAPSHOT_SETTINGS_REQUIRED/);
  assert.deepEqual(f.calls, ["verify"]);
});
test("#085 borrowed report does not own a transaction or alter settings", async () => {
  const f = clients();
  await new GovernedOperationalEvidenceReportService(new PrismaGovernedConstructEvidenceProjectionRepository(f.tx, true)).load(request);
  assert.equal(f.calls.some(call => call.startsWith("transaction:") || call.startsWith("SET")), false);
});
test("#085 expired borrowed report propagates unchanged and cannot emit a success", async () => {
  const f = clients();
  const repo = new PrismaGovernedConstructEvidenceProjectionRepository(f.tx, true);
  await repo.readOperationalSnapshot(request);
  const expired = new Prisma.PrismaClientKnownRequestError("Transaction closed", { code: "P2028", clientVersion: "test" });
  f.expire(expired);
  await assert.rejects(new GovernedOperationalEvidenceReportService(repo).load(request), error => error === expired);
});
test("#085 snapshot errors propagate through the CLI before output", async () => {
  const f = clients(); f.expire(new Error("verification unavailable"));
  let emitted = false;
  await assert.rejects(runGovernedOperationalEvidenceReport(["--equipment=equipment", "--variant=variant"], "readiness", { client: f.root, write() { emitted = true; } }), /PROJECTION_SNAPSHOT_VERIFICATION_FAILED/);
  assert.equal(emitted, false);
});
test("#085 variant ownership rejects before evidence reads", async () => {
  const f = clients();
  await assert.rejects(new GovernedOperationalEvidenceReportService(new PrismaGovernedConstructEvidenceProjectionRepository(f.root)).load({ ...request, equipmentVariantId: "foreign" }), /Variant does not belong/);
  assert.equal(f.calls.some(call => call.startsWith("evidence:")), false);
});
test("#085 unsupported constructs fail closed without a transaction or legacy fallback", async () => {
  const f = clients();
  await assert.rejects(new GovernedOperationalEvidenceReportService(new PrismaGovernedConstructEvidenceProjectionRepository(f.root)).load({ ...request, construct: "unapproved" }), /Unsupported operational construct/);
  assert.deepEqual(f.calls, []);
});
test("#085 root clients cannot use borrowed mode", () => {
  assert.throws(() => new PrismaGovernedConstructEvidenceProjectionRepository(clients().root, true), /PROTECTED_SNAPSHOT_ROOT_CLIENT_REJECTED/);
});
test("#085 CLI options reject ambiguous scope and preserve inventory-only specimen filtering", () => {
  assert.throws(() => parseGovernedEvidenceReportOptions(["--equipment=e"], "readiness"), /variant/);
  assert.throws(() => parseGovernedEvidenceReportOptions(["--equipment=e", "--equipment=f"], "evidence"), /duplicate/);
  assert.throws(() => parseGovernedEvidenceReportOptions(["--equipment=e", "--unknown=x"], "evidence"), /Unknown/);
  assert.equal(parseGovernedEvidenceReportOptions(["--equipment=e", "--specimen=s"], "evidence").specimenReference, "s");
});

for (const mode of ["evidence", "readiness"] as const) {
  test("#085 documented pnpm " + mode + " arguments accept exactly one leading separator", () => {
    const id = "00000000-0000-0000-0000-000000000000";
    const options = ["--equipment=" + id, ...(mode === "readiness" ? ["--variant=" + id] : [])];
    const forwarded = Object.freeze(["--", ...options]);
    assert.deepEqual(parseGovernedEvidenceReportOptions(forwarded, mode), parseGovernedEvidenceReportOptions(options, mode));
    assert.equal(parseGovernedEvidenceReportOptions(forwarded, mode).equipmentId, id);
    assert.equal(parseGovernedEvidenceReportOptions(forwarded, mode).equipmentVariantId, mode === "readiness" ? id : undefined);
    assert.deepEqual(forwarded, ["--", ...options]);
  });
  test("#085 forwarded pnpm separator reaches the governed " + mode + " loader", async () => {
    const f = clients();
    const report = await runGovernedOperationalEvidenceReport(["--", "--equipment=equipment", "--variant=variant", "--construct=startup_demand"], mode, { client: f.root, write() {} });
    assert.equal(report.interpretation, "governed_operational_evidence");
    assert.equal(f.calls.filter(call => call.startsWith("transaction:")).length, 1);
  });
  for (const invalid of [
    ["--"], ["--", "--equipment=equipment"], ["--equipment=equipment", "--"],
    ["--unknown=x"], ["--equipment="], ["--equipment"], ["equipment=equipment"], ["--=value"],
    ["--equipment=equipment", "--equipment=another"], ["--variant=variant", "--variant=another"]
  ]) test("#085 " + mode + " retains strict validation after separator: " + JSON.stringify(invalid), () => {
    assert.throws(() => parseGovernedEvidenceReportOptions(["--", ...invalid], mode), /Unknown, empty or duplicate report option/);
  });
  test("#085 " + mode + " leading separator does not bypass required scope", () => {
    assert.throws(() => parseGovernedEvidenceReportOptions(["--"], mode), /equipment.*required/);
    assert.throws(() => parseGovernedEvidenceReportOptions(["--", "--equipment="], mode), /Unknown, empty or duplicate/);
    if (mode === "readiness") assert.throws(() => parseGovernedEvidenceReportOptions(["--", "--equipment=equipment"], mode), /variant.*required/);
  });
}
test("#085 leading separator preserves valid optional values and mode-specific validation", () => {
  assert.deepEqual(parseGovernedEvidenceReportOptions(["--", "--equipment=equipment", "--variant=variant", "--construct=startup_demand", "--specimen=specimen=one"], "evidence"), {
    equipmentId: "equipment", equipmentVariantId: "variant", construct: "startup_demand", specimenReference: "specimen=one"
  });
  assert.throws(() => parseGovernedEvidenceReportOptions(["--", "--equipment=equipment", "--variant=variant", "--specimen=one"], "readiness"), /Unknown/);
});
