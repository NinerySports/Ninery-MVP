import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaClient, Prisma } from "@prisma/client";
import { captureCommand, testCaptureAuthorizer } from "./acquisition-provenance.fixture.js";
import { StrongerEvidenceAcquisitionCaptureService } from "../stronger-evidence-acquisition-capture.js";
import { readAcquisitionProvenanceInSnapshot } from "../acquisition-provenance-projection.js";
import { GovernedOperationalEvidenceReportService } from "../governed-operational-evidence-report.js";
import { PrismaGovernedConstructEvidenceProjectionRepository } from "../prisma-governed-construct-evidence-projection-repository.js";
import { acquisitionFingerprint, evidenceSemantics, exactEvidenceReplay, type CaptureCommand, type AcquisitionLifecycleCommand } from "../acquisition-provenance.js";
const url = process.env.TEST_DATABASE_URL;
if (url) {
    const p = new URL(url);
    if (p.hostname !== "127.0.0.1" || p.port !== "55486" || !["/ticket086_empty_disposable", "/ticket086_upgrade_disposable"].includes(p.pathname))
        throw Error("#086 requires dedicated disposable PostgreSQL on 127.0.0.1:55486");
}
const integration = url ? test : test.skip;
const db = url ? new PrismaClient({ datasources: { db: { url } }, transactionOptions: { maxWait: 30000, timeout: 30000 } }) : undefined;
if (url)
    test.before(async () => { const r = await db!.$queryRaw<any[]> `SELECT current_database() AS database,inet_server_port() AS port,current_setting('data_directory') AS directory,current_setting('server_version') AS version`; assert.equal(r[0].port, 55486); assert.match(r[0].directory.replaceAll("\\", "/"), new RegExp("files-pasted-by-the-user-ninery[/]work[/]ticket086-[0-9]+[/]pg$")); assert.match(r[0].version, /^16[.]/); });
async function setup(protocol: "physical_measurement" | "human_calibration" = "physical_measurement") {
    const equipment = await db!.equipment.create({ data: { manufacturer: "Test", model: "Test", modelYear: 2026, category: "bat", certification: "USA" } });
    const variant = await db!.equipmentVariant.create({ data: { equipmentId: equipment.id, lengthInches: 30, weightOunces: 20, dropWeight: -10, sku: randomUUID() } });
    const command = captureCommand(equipment.id, variant.id, protocol);
    const service = new StrongerEvidenceAcquisitionCaptureService(db!, testCaptureAuthorizer, { [command.namespace]: "test-only-issuer" });
    return { equipment, variant, command, service };
}
function successor(f: Awaited<ReturnType<typeof setup>>, r: {
    acquisitionId: string;
    revisionId: string;
}, action: "correct" | "withdraw" = "correct") { return { namespace: f.command.namespace, credential: f.command.credential, idempotencyKey: randomUUID(), acquisitionId: r.acquisitionId, expectedRevisionId: r.revisionId, action, declaration: { ...f.command.declaration, reason: action + " declaration" } }; }
for (const protocol of ["physical_measurement", "human_calibration"] as const)
    integration("#086 authentic " + protocol + " capture seals complete manifest and exact JSON replay", async () => {
        const f = await setup(protocol), r = await f.service.capture(f.command);
        assert.equal(r.current, true);
        assert.ok(Object.values(r.authority).every(x => x === false));
        const stored = await db!.evidenceAcquisitionRevision.findUniqueOrThrow({ where: { id: r.revisionId }, include: { members: true } });
        assert.equal(stored.sealed, true);
        assert.equal(stored.members.length, protocol === "physical_measurement" ? 5 : 13);
        const replay = await f.service.capture(JSON.parse(JSON.stringify(f.command)));
        assert.equal(replay.revisionId, r.revisionId);
        assert.equal(replay.replayed, true);
        const rows = await db!.equipmentDNAEvidenceRecord.findMany({ where: { equipmentId: f.equipment.id } });
        for (const row of rows) {
            const reordered = { ...row, rawValue: Object.fromEntries(Object.entries(row.rawValue as object).reverse()) };
            assert.equal(exactEvidenceReplay(row as any, reordered as any), true);
        }
        await assert.rejects(f.service.capture({ ...f.command, declaration: { ...f.command.declaration, reason: "Different meaning" } }), /IDEMPOTENCY_CONFLICT/);
    });
integration("#086 unauthorized capture leaves no evidence or acquisition", async () => { const f = await setup(); await assert.rejects(f.service.capture({ ...f.command, credential: "caller-name" }), /NOT_AUTHORIZED/); assert.equal(await db!.equipmentDNAEvidenceRecord.count({ where: { equipmentId: f.equipment.id } }), 0); });
integration("#086 namespace owner and grant scope are enforced", async () => { const f = await setup(); const s = new StrongerEvidenceAcquisitionCaptureService(db!, { async authorize() { return { actorId: "x", namespace: f.command.namespace, issuer: "wrong", actions: ["capture"] }; } }, { [f.command.namespace]: "test-only-issuer" }); await assert.rejects(s.capture(f.command), /NOT_AUTHORIZED/); });
integration("#086 incomplete authentic packet rejects without partial writes", async () => { const f = await setup(); if (f.command.packet.protocol !== "physical_measurement")
    throw Error(); const command = { ...f.command, packet: { ...f.command.packet, session: { ...f.command.packet.session, measurementBlocks: f.command.packet.session.measurementBlocks.slice(1) } } }; await assert.rejects(f.service.capture(command), /PACKET_INCOMPLETE/); assert.equal(await db!.equipmentDNAEvidenceRecord.count({ where: { equipmentId: f.equipment.id } }), 0); });
integration("#086 late upstream failure rolls back evidence namespace and provenance", async () => { const f = await setup(); const command = { ...f.command, declaration: { ...f.command.declaration, upstream: { state: "declared_inputs" as const, inputs: [{ type: "evidence" as const, id: randomUUID(), basis: "Declared input" }] } } }; await assert.rejects(f.service.capture(command), /UPSTREAM_ENDPOINT_UNRESOLVED/); assert.equal(await db!.equipmentDNAEvidenceRecord.count({ where: { equipmentId: f.equipment.id } }), 0); assert.equal(await db!.captureNamespace.count({ where: { id: f.command.namespace } }), 0); });
integration("#086 concurrent identical capture converges to one immutable revision", async () => { const f = await setup(); const [a, b] = await Promise.all([f.service.capture(f.command), f.service.capture(f.command)]); assert.equal(a.revisionId, b.revisionId); assert.equal(await db!.evidenceAcquisitionRevision.count({ where: { acquisitionId: a.acquisitionId } }), 1); });
integration("#086 concurrent conflicting capture rejects changed meaning", async () => { const f = await setup(); const out = await Promise.allSettled([f.service.capture(f.command), f.service.capture({ ...f.command, declaration: { ...f.command.declaration, reason: "Conflict" } })]); assert.equal(out.filter(x => x.status === "fulfilled").length, 1); assert.equal(out.filter(x => x.status === "rejected").length, 1); });
integration("#086 competing successors allow exactly one expected predecessor", async () => { const f = await setup(), r = await f.service.capture(f.command); const c = successor(f, r); const out = await Promise.allSettled([f.service.revise(c), f.service.revise({ ...c, idempotencyKey: randomUUID(), declaration: { ...c.declaration, reason: "Competing correction" } })]); assert.equal(out.filter(x => x.status === "fulfilled").length, 1); assert.equal(out.filter(x => x.status === "rejected").length, 1); });
integration("#086 corrections and terminal withdrawal retain historical receipts", async () => { const f = await setup(), r = await f.service.capture(f.command); const corrected = await f.service.revise(successor(f, r)); const w = successor(f, corrected, "withdraw"); w.declaration = { ...w.declaration, reason: "withdraw", supplier: f.command.declaration.supplier }; const withdrawn = await f.service.revise(w); assert.equal(withdrawn.current, false); assert.equal(withdrawn.withdrawn, true); await assert.rejects(f.service.revise(successor(f, withdrawn)), /WITHDRAWN/); const replay = await f.service.capture(f.command); assert.equal(replay.current, false); assert.equal(replay.withdrawn, true); assert.equal(await db!.evidenceAcquisitionRevision.count({ where: { acquisitionId: r.acquisitionId } }), 3); });
integration("#086 registered evidence mutation and deletion reject but status remains available", async () => { const f = await setup(); await f.service.capture(f.command); const e = await db!.equipmentDNAEvidenceRecord.findFirstOrThrow({ where: { equipmentId: f.equipment.id } }); await assert.rejects(db!.equipmentDNAEvidenceRecord.update({ where: { id: e.id }, data: { rawValue: { altered: true } } }), /REGISTERED_EVIDENCE_IMMUTABLE/); await assert.rejects(db!.equipmentDNAEvidenceRecord.delete({ where: { id: e.id } }), /REGISTERED_EVIDENCE_IMMUTABLE/); await db!.equipmentDNAEvidenceRecord.update({ where: { id: e.id }, data: { status: "withdrawn" } }); assert.equal((await db!.equipmentDNAEvidenceRecord.findUniqueOrThrow({ where: { id: e.id } })).status, "withdrawn"); });
integration("#086 immutable sealed revisions manifests and catalog deletion reject", async () => { const f = await setup(), r = await f.service.capture(f.command); await assert.rejects(db!.evidenceAcquisitionRevision.update({ where: { id: r.revisionId }, data: { fingerprint: "x" } }), /IMMUTABLE/); const m = await db!.acquisitionEvidenceMember.findFirstOrThrow({ where: { revisionId: r.revisionId } }); await assert.rejects(db!.acquisitionEvidenceMember.delete({ where: { revisionId_evidenceId: { revisionId: m.revisionId, evidenceId: m.evidenceId } } }), /IMMUTABLE/); await assert.rejects(db!.equipment.delete({ where: { id: f.equipment.id } })); });
integration("#086 direct unsealed or empty construction cannot commit", async () => { const f = await setup(); await f.service.capture(f.command); const root = await db!.evidenceAcquisition.findFirstOrThrow({ where: { equipmentId: f.equipment.id } }); await assert.rejects(db!.$transaction(async (tx) => { await tx.evidenceAcquisition.create({ data: { ...root, id: randomUUID(), sessionKey: randomUUID() } }); }), /EMPTY_ROOT/); });
integration("#086 cross-variant specimen declarations conflict and rollback", async () => { const f = await setup(); await f.service.capture(f.command); const second = await db!.equipmentVariant.create({ data: { equipmentId: f.equipment.id, lengthInches: 30, weightOunces: 20, dropWeight: -10, sku: randomUUID() } }); const command = captureCommand(f.equipment.id, second.id, "physical_measurement", f.command.namespace); if (command.packet.protocol !== "physical_measurement")
    throw Error(); const key = f.command.declaration.specimen.key!; const c = { ...command, declaration: { ...command.declaration, specimen: { ...command.declaration.specimen, key } }, packet: { ...command.packet, session: { ...command.packet.session, specimenReference: key } } }; await assert.rejects(f.service.capture(c), /PARTICIPANT_IDENTITY_CONFLICT/); assert.equal(await db!.equipmentDNAEvidenceRecord.count({ where: { equipmentVariantId: second.id } }), 0); });
integration("#086 unresolved provenance remains descriptive with no readiness count change", async () => { const f = await setup(), r = await f.service.capture(f.command); const loader = new GovernedOperationalEvidenceReportService(new PrismaGovernedConstructEvidenceProjectionRepository(db!)); const request = { equipmentId: f.equipment.id, equipmentVariantId: f.variant.id, construct: "actual_mass" }; const before = await loader.load(request); assert.equal(before.constructs[0]!.directEvidenceRecordCount, 1); assert.ok(before.provenance!.every(p => p.registration === "registered_declaration")); const correction = successor(f, r); correction.declaration = { ...correction.declaration, specimen: { kind: "specimen", state: "unresolved" } }; await f.service.revise(correction); const after = await loader.load(request); assert.deepEqual(after.constructs, before.constructs); assert.ok(after.provenance!.some(p => p.reasons.includes("specimen_unresolved"))); assert.ok(Object.values(after.authority).every(x => x === false)); });
integration("#086 report snapshot survives concurrent provenance correction", async () => { const f = await setup(), r = await f.service.capture(f.command); await db!.$transaction(async (tx) => { await tx.$executeRaw `SET TRANSACTION READ ONLY`; const service = new GovernedOperationalEvidenceReportService(new PrismaGovernedConstructEvidenceProjectionRepository(tx, true)); const request = { equipmentId: f.equipment.id, equipmentVariantId: f.variant.id, construct: "actual_mass" }; const before = await service.load(request); await f.service.revise(successor(f, r)); assert.deepEqual(await service.load(request), before); }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }); });
integration("#086 legacy unbound evidence stays unbound and unsafe provenance reads reject", async () => { const f = await setup(); const e = await db!.equipmentDNAEvidenceRecord.create({ data: { equipmentId: f.equipment.id, equipmentVariantId: f.variant.id, targetLevel: "variant", attributeKey: "legacy", attributeDefinitionVersion: "1.0", sourceType: "manufacturer_specification", sourceName: "Legacy", method: "direct_specification", rawValue: { original: true } } }); await db!.$transaction(async (tx) => { await tx.$executeRaw `SET TRANSACTION READ ONLY`; const view = await readAcquisitionProvenanceInSnapshot(tx, [e]); assert.equal(view[0]!.registration, "unbound"); }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }); await db!.$transaction(async (tx) => { await assert.rejects(readAcquisitionProvenanceInSnapshot(tx, [e]), /SNAPSHOT_SETTINGS_REQUIRED/); }); });
integration("#086 resolved evidence and revision inputs are pinned and bounded", async () => {
    const f = await setup(), first = await f.service.capture(f.command);
    const source = await db!.equipmentDNAEvidenceRecord.findFirstOrThrow({ where: { equipmentId: f.equipment.id } });
    const c = captureCommand(f.equipment.id, f.variant.id, "physical_measurement", f.command.namespace);
    const command = { ...c, declaration: { ...c.declaration, upstream: { state: "declared_inputs" as const, inputs: [{ type: "evidence" as const, id: source.id, basis: "Declared source observation" }, { type: "revision" as const, id: first.revisionId, basis: "Declared acquisition input" }] } } };
    const second = await f.service.capture(command);
    const loader = new GovernedOperationalEvidenceReportService(new PrismaGovernedConstructEvidenceProjectionRepository(db!));
    const req = { equipmentId: f.equipment.id, equipmentVariantId: f.variant.id, construct: "actual_mass" };
    const before = await loader.load(req);
    assert.ok(before.provenance!.filter(p => p.currentRevisionId === second.revisionId).every(p => !p.reasons.includes("registered_evidence_or_provenance_drift")));
    await f.service.revise(successor(f, first));
    await db!.equipmentDNAEvidenceRecord.update({ where: { id: source.id }, data: { status: "disputed" } });
    const after = await loader.load(req);
    assert.ok(after.provenance!.filter(p => p.currentRevisionId === second.revisionId).every(p => p.reasons.includes("upstream_revision_not_current") && p.reasons.includes("upstream_evidence_inactive")));
});
integration("#086 unknown external input stays unresolved rather than falsely absent", async () => { const f = await setup(); const c = { ...f.command, declaration: { ...f.command.declaration, upstream: { state: "declared_inputs" as const, inputs: [{ type: "unresolved" as const, reference: "external-document:unknown", basis: "Supplier declaration" }] } } }; await f.service.capture(c); const report = await new GovernedOperationalEvidenceReportService(new PrismaGovernedConstructEvidenceProjectionRepository(db!)).load({ equipmentId: f.equipment.id, equipmentVariantId: f.variant.id, construct: "actual_mass" }); assert.ok(report.provenance!.every(p => p.reasons.includes("upstream_unresolved"))); });
integration("#086 cross-scope input fails closed atomically", async () => { const f = await setup(), g = await setup(); await g.service.capture(g.command); const e = await db!.equipmentDNAEvidenceRecord.findFirstOrThrow({ where: { equipmentId: g.equipment.id } }); await assert.rejects(f.service.capture({ ...f.command, declaration: { ...f.command.declaration, upstream: { state: "declared_inputs", inputs: [{ type: "evidence", id: e.id, basis: "Wrong scope" }] } } }), /UPSTREAM_ENDPOINT_UNRESOLVED/); assert.equal(await db!.equipmentDNAEvidenceRecord.count({ where: { equipmentId: f.equipment.id } }), 0); });
integration("#086 late child insertion and raw unsealed successor cannot commit", async () => { const f = await setup(), r = await f.service.capture(f.command); const prior = await db!.evidenceAcquisitionRevision.findUniqueOrThrow({ where: { id: r.revisionId } }); await assert.rejects(db!.acquisitionInputDeclaration.create({ data: { id: randomUUID(), revisionId: r.revisionId, kind: "unresolved", declaration: { reference: "late" } } }), /MANIFEST_SEALED/); await assert.rejects(db!.$transaction(async (tx) => { const { capturedAt, ...data } = prior; await tx.evidenceAcquisitionRevision.create({ data: { ...data, payload: prior.payload as Prisma.InputJsonValue, id: randomUUID(), predecessorId: prior.id, ordinal: 2, operation: "correct", sealed: false, idempotencyKey: randomUUID() } }); }), /INCOMPLETE/); });
integration("#086 database rejects cross-acquisition predecessors and evidence binding reuse", async () => { const f = await setup(), g = await setup(), a = await f.service.capture(f.command), b = await g.service.capture(g.command); const prior = await db!.evidenceAcquisitionRevision.findUniqueOrThrow({ where: { id: a.revisionId } }); await assert.rejects(db!.evidenceAcquisitionRevision.create({ data: { ...prior, payload: prior.payload as Prisma.InputJsonValue, id: randomUUID(), acquisitionId: b.acquisitionId, ordinal: 2, predecessorId: a.revisionId, operation: "correct", sealed: false, idempotencyKey: randomUUID() } }), /INVALID_SUCCESSOR/); const e = await db!.acquisitionEvidenceBinding.findFirstOrThrow({ where: { acquisitionId: a.acquisitionId } }); await assert.rejects(db!.acquisitionEvidenceBinding.update({ where: { evidenceId: e.evidenceId }, data: { acquisitionId: b.acquisitionId } }), /IMMUTABLE/); });
integration("#086 variant reparenting is blocked once provenance is registered", async () => { const f = await setup(), g = await setup(); await f.service.capture(f.command); await assert.rejects(db!.equipmentVariant.update({ where: { id: f.variant.id }, data: { equipmentId: g.equipment.id } }), /VARIANT_IMMUTABLE/); });
integration("#086 corrupt manifest correction cannot silently become complete", async () => { const f = await setup(), r = await f.service.capture(f.command); const members = await db!.acquisitionEvidenceMember.findMany({ where: { revisionId: r.revisionId } }); await assert.rejects(f.service.revise({ ...successor(f, r), evidenceIds: members.slice(1).map(x => x.evidenceId) }), /MANIFEST_INCOMPLETE/); assert.equal(await db!.evidenceAcquisitionRevision.count({ where: { acquisitionId: r.acquisitionId } }), 1); });
integration("#086 actual shared report loader formats provenance without changing authority", async () => { const { runGovernedOperationalEvidenceReport } = await import("../governed-operational-evidence-report-cli.js"); const f = await setup("human_calibration"); await f.service.capture(f.command); const outputs: string[] = []; const report = await runGovernedOperationalEvidenceReport(["--", "--equipment=" + f.equipment.id, "--variant=" + f.variant.id, "--construct=startup_demand"], "readiness", { client: db!, write: t => outputs.push(t) }); assert.match(outputs[0]!, /ACQUISITION PROVENANCE/); assert.match(outputs[0]!, /specimen_unresolved/); assert.equal(report.constructs[0]!.applicableCalibrationObservations.length, 1); assert.equal(report.constructs[0]!.directEvidenceRecordCount, 0); assert.equal(report.constructs[0]!.sourceIndependence, "not_established"); });
if (url && new URL(url).pathname === "/ticket086_upgrade_disposable")
    integration("#086 populated baseline row remains byte-semantically unchanged and unbound", async () => { if (new URL(url!).pathname !== "/ticket086_upgrade_disposable")
        return; const e = await db!.equipmentDNAEvidenceRecord.findUniqueOrThrow({ where: { id: "22222222-2222-4222-a222-222222222222" } }); assert.deepEqual(e.rawValue, { preserve: true }); assert.equal(e.sourceName, "Legacy"); assert.equal(e.status, "active"); assert.equal(await db!.acquisitionEvidenceBinding.count({ where: { evidenceId: e.id } }), 0); });
integration("#086 genuine historical human packet registers through exact PostgreSQL JSON replay", async () => {
    const { reviewProtocolV11CalibrationSession } = await import("@ninery/equipment-intelligence");
    const f = await setup("human_calibration");
    if (f.command.packet.protocol !== "human_calibration")
        throw Error();
    const review = reviewProtocolV11CalibrationSession(f.command.packet.session);
    assert.equal(review.persistenceEligible, true);
    for (const r of review.evidence)
        await db!.equipmentDNAEvidenceRecord.create({ data: { id: r.id, equipmentId: r.equipmentId, equipmentVariantId: r.equipmentVariantId, targetLevel: "equipment", attributeKey: r.attributeKey, attributeDefinitionVersion: "1.0", sourceType: "structured_expert_evaluation", sourceName: "Ninery Physical Bat Evaluation Protocol v1.1 Calibration", sourceReference: r.sourceReference, sourceDate: new Date(r.evaluationDate), method: "standardized_rubric", rawValue: JSON.parse(JSON.stringify(r.rawValue)), notes: "Protocol v1.1 calibration evidence only. Excluded from canonical evaluation, numeric references, recommendations, and genuine transition activation.", status: "active", evaluatorType: "staff", evaluatorReference: r.evaluatorId } });
    const before = await db!.equipmentDNAEvidenceRecord.findMany({ where: { equipmentId: f.equipment.id }, orderBy: { id: "asc" } });
    const r = await f.service.capture({ ...f.command, registerExisting: true });
    const registeredReplay = await f.service.capture({ ...f.command, registerExisting: true });
    assert.equal(registeredReplay.replayed, true); assert.equal(registeredReplay.current, true); assert.equal(registeredReplay.revisionId, r.revisionId);
    assert.equal(r.current, true);
    assert.deepEqual(await db!.equipmentDNAEvidenceRecord.findMany({ where: { equipmentId: f.equipment.id }, orderBy: { id: "asc" } }), before);
});
integration("#086 genuine historical content conflict rejects rather than accepting only raw JSON", async () => {
    const { reviewProtocolV11CalibrationSession } = await import("@ninery/equipment-intelligence");
    const f = await setup("human_calibration");
    if (f.command.packet.protocol !== "human_calibration")
        throw Error();
    const evidence = reviewProtocolV11CalibrationSession(f.command.packet.session).evidence;
    for(const r of evidence) await db!.equipmentDNAEvidenceRecord.create({ data: { id: r.id, equipmentId: r.equipmentId, equipmentVariantId: r.equipmentVariantId, targetLevel: "equipment", attributeKey: r.attributeKey, attributeDefinitionVersion: "1.0", sourceType: "structured_expert_evaluation", sourceName: "Wrong persisted meaning", sourceReference: r.sourceReference, sourceDate: new Date(r.evaluationDate), method: "standardized_rubric", rawValue: JSON.parse(JSON.stringify(r.rawValue)), status: "active", evaluatorType: "staff", evaluatorReference: r.evaluatorId } });
    await assert.rejects(f.service.capture({ ...f.command, registerExisting: true }), /EVIDENCE_REPLAY_CONFLICT/);
    assert.equal(await db!.evidenceAcquisition.count({ where: { equipmentId: f.equipment.id } }), 0);
});
integration("#086 repeated sessions reuse one declared specimen without independent-source authority", async () => {
 const f=await setup();const first=await f.service.capture(f.command);const c=captureCommand(f.equipment.id,f.variant.id,"physical_measurement",f.command.namespace);if(c.packet.protocol!=="physical_measurement")throw Error();const specimen=f.command.declaration.specimen.key!;
 const second=await f.service.capture({...c,declaration:{...c.declaration,specimen:{kind:"specimen",key:specimen,state:"registered_declaration"}},packet:{...c.packet,session:{...c.packet.session,specimenReference:specimen,equipmentCondition:"materially_worn"}}});
 assert.notEqual(first.acquisitionId,second.acquisitionId);const revisions=await db!.evidenceAcquisitionRevision.findMany({where:{id:{in:[first.revisionId,second.revisionId]}}});assert.equal(revisions[0]!.specimenId,revisions[1]!.specimenId);assert.ok(revisions.every(r=>r.actorId==="authenticated-test-capturer"));assert.equal(second.authority.independenceEstablished,false);
});
test.after(async () => { await db?.$disconnect(); });


// Deliberately bypass the service: ordinary raw SQL must preserve the same structural boundary.
async function directSuccessor(f: Awaited<ReturnType<typeof setup>>, mutate: (r: any, members: any[]) => void) {
    const receipt = await f.service.capture(f.command);
    const prior = await db!.evidenceAcquisitionRevision.findUniqueOrThrow({ where: { id: receipt.revisionId }, include: { members: true } });
    const { members: oldMembers, ...priorData } = prior;
    const data: any = { ...priorData, id: randomUUID(), predecessorId: prior.id, ordinal: 2, operation: "correct", idempotencyKey: randomUUID(), sealed: false, payload: structuredClone(prior.payload) };
    const members: any[] = oldMembers.map(m => ({ ...m, revisionId: data.id }));
    data.payload.operation = "correct"; data.payload.ordinal = 2; data.payload.predecessorId = prior.id;
    mutate(data, members);
    data.payload.manifest = members.map(m => ({ evidenceId: m.evidenceId, memberKey: m.memberKey, fingerprint: m.fingerprint })).sort((a, b) => a.evidenceId.localeCompare(b.evidenceId));
    data.fingerprint = acquisitionFingerprint(data.payload);
    await db!.$transaction(async tx => {
        await tx.$executeRaw`INSERT INTO evidence_acquisition_revisions SELECT * FROM jsonb_populate_record(NULL::evidence_acquisition_revisions, ${JSON.stringify(data)}::jsonb)`;
        for (const member of members) await tx.$executeRaw`INSERT INTO acquisition_evidence_members SELECT * FROM jsonb_populate_record(NULL::acquisition_evidence_members, ${JSON.stringify(member)}::jsonb)`;
        await tx.$executeRaw`UPDATE evidence_acquisition_revisions SET sealed=true WHERE id=${data.id}::uuid`;
    });
    return data;
}
for (const protocol of ["physical_measurement", "human_calibration"] as const) {
    integration("#086 direct SQL rejects self-consistent incomplete " + protocol + " manifest", async () => {
        const f = await setup(protocol);
        await assert.rejects(directSuccessor(f, (r, members) => { members.splice(1); r.expectedCount = 1; }), /PROTOCOL_MANIFEST_INCOMPLETE/);
        assert.equal(await db!.evidenceAcquisitionRevision.count({ where: { acquisition: { equipmentId: f.equipment.id } } }), 1);
    });
    integration("#086 direct SQL rejects unsupported " + protocol + " packet version", async () => {
        const f = await setup(protocol);
        await assert.rejects(directSuccessor(f, r => { r.payload.packet.session.protocolVersion = "future"; }), /PROTOCOL_MANIFEST_INCOMPLETE/);
    });
}
for (const role of ["specimen", "operator", "evaluator", "instrument"] as const) {
    integration("#086 direct SQL rejects registered " + role + " without matching identity", async () => {
        const f = await setup(role === "evaluator" ? "human_calibration" : "physical_measurement");
        await assert.rejects(directSuccessor(f, (r, members) => {
            if (role === "instrument") { const key = members[0].memberKey; r.payload.declaration.instruments[key].key = "never-registered"; members[0].instrumentId = null; }
            else { r.payload.declaration[role].key = "never-registered"; r[role + "Id"] = null; }
        }), /PARTICIPANT_DECLARATION_MISMATCH/);
    });
}
for (const invalid of ["wrong-key", "unresolved-with-identity", "missing-specimen", "missing-operator", "missing-instrument", "unknown-instrument"] as const) {
    integration("#086 direct SQL rejects participant declaration mismatch " + invalid, async () => {
        const f = await setup();
        await assert.rejects(directSuccessor(f, (r, members) => {
            const d = r.payload.declaration;
            if (invalid === "wrong-key") d.specimen.key = "other-specimen";
            if (invalid === "unresolved-with-identity") d.specimen = { kind: "specimen", state: "unresolved" };
            if (invalid === "missing-specimen") delete d.specimen;
            if (invalid === "missing-operator") delete d.operator;
            if (invalid === "missing-instrument") delete d.instruments[members[0].memberKey];
            if (invalid === "unknown-instrument") d.instruments.extra = { kind: "instrument", state: "unresolved" };
        }), /PARTICIPANT_DECLARATION_MISMATCH/);
    });
}
integration("#086 concurrent distinct first captures converge on one immutable namespace and shared participants", async () => {
    const f = await setup();
    // Warm the pool and delay inserts to reproduce the old read-then-insert race reliably.
    await Promise.all(Array.from({ length: 4 }, () => db!.$queryRaw`SELECT pg_sleep(0.1)::text`));
    await db!.$executeRawUnsafe(`CREATE FUNCTION acquisition_test_namespace_delay() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(0.25); RETURN NEW; END $$`);
    await db!.$executeRawUnsafe("CREATE TRIGGER acquisition_test_namespace_delay BEFORE INSERT ON capture_namespaces FOR EACH ROW EXECUTE FUNCTION acquisition_test_namespace_delay()");
    try {
        const commands = Array.from({ length: 4 }, () => captureCommand(f.equipment.id, f.variant.id, "physical_measurement", f.command.namespace));
        for (const c of commands) {
            if (c.packet.protocol !== "physical_measurement" || f.command.packet.protocol !== "physical_measurement") throw Error();
            Object.assign(c.packet, { session: { ...c.packet.session, operatorId: f.command.packet.session.operatorId } });
            Object.assign(c, { declaration: { ...c.declaration, operator: f.command.declaration.operator } });
        }
        const receipts = await Promise.all(commands.map(c => f.service.capture(c)));
        assert.equal(new Set(receipts.map(r => r.acquisitionId)).size, 4);
        assert.equal(await db!.captureNamespace.count({ where: { id: f.command.namespace } }), 1);
        assert.equal(await db!.acquisitionParticipant.count({ where: { namespaceId: f.command.namespace, kind: "person" } }), 1);
        for (const [i, c] of commands.entries()) assert.equal((await f.service.capture(c)).revisionId, receipts[i]!.revisionId);
    } finally {
        await db!.$executeRawUnsafe("DROP TRIGGER acquisition_test_namespace_delay ON capture_namespaces");
        await db!.$executeRawUnsafe("DROP FUNCTION acquisition_test_namespace_delay()");
    }
});
integration("#086 concurrent conflicting namespace issuers fail closed with no partial loser", async () => {
    const f = await setup();
    const alternate = new StrongerEvidenceAcquisitionCaptureService(db!, { async authorize() { return { actorId: "other-actor", namespace: f.command.namespace, issuer: "other-issuer", actions: ["capture"] }; } }, { [f.command.namespace]: "other-issuer" });
    await Promise.all(Array.from({ length: 2 }, () => db!.$queryRaw`SELECT pg_sleep(0.1)::text`));
    const other = captureCommand(f.equipment.id, f.variant.id, "physical_measurement", f.command.namespace);
    const result = await Promise.allSettled([f.service.capture(f.command), alternate.capture(other)]);
    assert.equal(result.filter(r => r.status === "fulfilled").length, 1);
    const rejected = result.find(r => r.status === "rejected") as PromiseRejectedResult;
    assert.match(rejected.reason.message, /NAMESPACE_OWNER_CONFLICT/);
    assert.equal(await db!.evidenceAcquisition.count({ where: { namespaceId: f.command.namespace } }), 1);
    assert.equal(await db!.equipmentDNAEvidenceRecord.count({ where: { equipmentId: f.equipment.id } }), 5);
});

for (const protocol of ["physical_measurement", "human_calibration"] as const) {
    integration("#086 integrity drift clears verified currentness in projection and both governed reports: " + protocol, async () => {
        const { runGovernedOperationalEvidenceReport } = await import("../governed-operational-evidence-report-cli.js");
        const f = await setup(protocol);
        const initial = await f.service.capture(f.command);
        const latest = await f.service.revise(successor(f, initial));
        const request = { equipmentId: f.equipment.id, equipmentVariantId: f.variant.id, construct: protocol === "physical_measurement" ? "actual_mass" : "startup_demand" };
        const loader = new GovernedOperationalEvidenceReportService(new PrismaGovernedConstructEvidenceProjectionRepository(db!));
        const before = await loader.load(request);
        assert.ok(before.provenance!.every(p => p.currentRevisionId === latest.revisionId));
        // Fault injection only in the cluster verified by this suite's disposable-server guard.
        // SET LOCAL restores triggers at transaction end; ordinary capture cannot mutate sealed history.
        await db!.$transaction(async tx => {
            await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica");
            await tx.evidenceAcquisitionRevision.update({ where: { id: latest.revisionId }, data: { fingerprint: "0".repeat(64) } });
        });
        const view = await db!.$transaction(async tx => {
            await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
            const rows = await tx.equipmentDNAEvidenceRecord.findMany({ where: { equipmentId: f.equipment.id } });
            return readAcquisitionProvenanceInSnapshot(tx, rows);
        }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
        for (const p of view) {
            assert.ok(p.history.every(r => !r.current), JSON.stringify(p));
            assert.equal(p.currentRevisionId, null);
            assert.equal(p.latestRevisionId, latest.revisionId);
            assert.deepEqual(p.history.map(r => r.revisionId), [initial.revisionId, latest.revisionId]);
            assert.equal(p.history.at(-1)!.complete, false);
            assert.equal(p.history.at(-1)!.consistent, false);
            assert.ok(p.reasons.includes("registered_evidence_or_provenance_drift"));
        }
        for (const mode of ["evidence", "readiness"] as const) {
            const output: string[] = [];
            const report = await runGovernedOperationalEvidenceReport(["--equipment=" + f.equipment.id, "--variant=" + f.variant.id, "--construct=" + request.construct], mode, { client: db!, write: text => output.push(text) });
            assert.ok(report.provenance!.every(p => p.currentRevisionId === null && p.latestRevisionId === latest.revisionId && p.history.every(r => !r.current)));
            assert.deepEqual(report.constructs, before.constructs);
            assert.deepEqual(report.authority, before.authority);
            assert.ok(Object.values(report.authority).every(value => value === false));
            assert.match(output[0]!, /verified current revision none/);
            assert.ok(output[0]!.includes("latest recorded revision " + latest.revisionId));
            assert.doesNotMatch(output[0]!, /; current true;/);
        }
    });
}

for (const field of ["combined", "operation", "ordinal", "predecessorId", "actorId", "missing-predecessor", "string-ordinal"] as const) {
    integration("#086 direct SQL rejects contradictory lifecycle metadata: " + field, async () => {
        const f = await setup();
        await assert.rejects(directSuccessor(f, r => {
            if (field === "combined" || field === "operation") r.payload.operation = "withdraw";
            if (field === "combined" || field === "ordinal") r.payload.ordinal = 99;
            if (field === "combined" || field === "actorId") r.payload.actorId = "other-actor";
            if (field === "predecessorId") r.payload.predecessorId = null;
            if (field === "missing-predecessor") delete r.payload.predecessorId;
            if (field === "string-ordinal") r.payload.ordinal = "2";
        }), /ACQUISITION_LIFECYCLE_MISMATCH/);
        assert.equal(await db!.evidenceAcquisitionRevision.count({ where: { acquisition: { equipmentId: f.equipment.id } } }), 1);
    });
}
for (const protocol of ["physical_measurement", "human_calibration"] as const) {
    integration("#086 direct SQL legitimate correction and terminal withdrawal retain history: " + protocol, async () => {
        const f = await setup(protocol);
        const corrected = await directSuccessor(f, () => {});
        const report = await new GovernedOperationalEvidenceReportService(new PrismaGovernedConstructEvidenceProjectionRepository(db!)).load({ equipmentId: f.equipment.id, equipmentVariantId: f.variant.id, construct: protocol === "physical_measurement" ? "actual_mass" : "startup_demand" });
        assert.ok(report.provenance!.every(p => p.currentRevisionId === corrected.id && p.history.length === 2 && !p.history[0]!.current && p.history[1]!.consistent));
        const g = await setup(protocol);
        const withdrawn = await directSuccessor(g, r => { r.operation = r.payload.operation = "withdraw"; });
        const view = await new GovernedOperationalEvidenceReportService(new PrismaGovernedConstructEvidenceProjectionRepository(db!)).load({ equipmentId: g.equipment.id, equipmentVariantId: g.variant.id, construct: protocol === "physical_measurement" ? "actual_mass" : "startup_demand" });
        assert.ok(view.provenance!.every(p => p.currentRevisionId === null && p.latestRevisionId === withdrawn.id && p.history.length === 2 && p.history.every(r => !r.current && r.consistent)));
        const next = { ...withdrawn, id: randomUUID(), ordinal: 3, predecessorId: withdrawn.id, operation: "correct", idempotencyKey: randomUUID() };
        next.payload = { ...withdrawn.payload, operation: "correct", ordinal: 3, predecessorId: withdrawn.id };
        next.fingerprint = acquisitionFingerprint(next.payload);
        await assert.rejects(db!.$executeRaw`INSERT INTO evidence_acquisition_revisions SELECT * FROM jsonb_populate_record(NULL::evidence_acquisition_revisions, ${JSON.stringify(next)}::jsonb)`, /ACQUISITION_INVALID_SUCCESSOR/);
    });
    integration("#086 contradictory hashed lifecycle cannot remain current in either report: " + protocol, async () => {
        const f = await setup(protocol), first = await f.service.capture(f.command), last = await f.service.revise(successor(f, first));
        const stored = await db!.evidenceAcquisitionRevision.findUniqueOrThrow({ where: { id: last.revisionId } });
        const payload = { ...(stored.payload as object), operation: "withdraw", ordinal: 99, actorId: "other-actor" };
        await db!.$transaction(async tx => {
            // Fault injection remains transaction-local and limited to this suite's verified disposable cluster.
            await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica");
            await tx.$executeRaw`UPDATE evidence_acquisition_revisions SET payload=${JSON.stringify(payload)}::jsonb, fingerprint=${acquisitionFingerprint(payload)} WHERE id=${last.revisionId}::uuid`;
        });
        const { runGovernedOperationalEvidenceReport } = await import("../governed-operational-evidence-report-cli.js");
        for (const mode of ["evidence", "readiness"] as const) {
            const report = await runGovernedOperationalEvidenceReport(["--equipment=" + f.equipment.id, "--variant=" + f.variant.id, "--construct=" + (protocol === "physical_measurement" ? "actual_mass" : "startup_demand")], mode, { client: db!, write: () => {} });
            assert.ok(report.provenance!.every(p => p.currentRevisionId === null && p.latestRevisionId === last.revisionId && p.history.length === 2 && p.history.every(r => !r.current) && !p.history.at(-1)!.consistent && p.reasons.includes("acquisition_lifecycle_mismatch")));
            assert.ok(Object.values(report.authority).every(v => v === false));
        }
    });
    integration("#086 one live member drift invalidates every sibling but not another acquisition: " + protocol, async () => {
        const f = await setup(protocol), initial = await f.service.capture(f.command), latest = await f.service.revise(successor(f, initial));
        const other = await f.service.capture(captureCommand(f.equipment.id, f.variant.id, protocol, f.command.namespace));
        const members = await db!.acquisitionEvidenceMember.findMany({ where: { revisionId: latest.revisionId } });
        // Corrupt a sibling outside the requested construct; displayed observation notes stay stable.
        const badId = members.find(m => m.memberKey === (protocol === "physical_measurement" ? "barrel_diameter" : "near_center_response_consistency"))!.evidenceId;
        await assert.rejects(db!.equipmentDNAEvidenceRecord.update({ where: { id: badId }, data: { notes: "Ordinary update must still fail" } }), /REGISTERED_EVIDENCE_IMMUTABLE/);
        const request = { equipmentId: f.equipment.id, equipmentVariantId: f.variant.id, construct: protocol === "physical_measurement" ? "actual_mass" : "startup_demand" };
        const before = await new GovernedOperationalEvidenceReportService(new PrismaGovernedConstructEvidenceProjectionRepository(db!)).load(request);
        await db!.$transaction(async tx => {
            await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica");
            await tx.$executeRaw`UPDATE equipment_dna_evidence_records SET notes='Independent drift injection' WHERE id=${badId}::uuid`;
        });
        const { runGovernedOperationalEvidenceReport } = await import("../governed-operational-evidence-report-cli.js");
        for (const mode of ["evidence", "readiness"] as const) {
            const output: string[] = [];
            const report = await runGovernedOperationalEvidenceReport(["--equipment=" + f.equipment.id, "--variant=" + f.variant.id, "--construct=" + request.construct], mode, { client: db!, write: text => output.push(text) });
            const affected = report.provenance!.filter(p => p.latestRevisionId === latest.revisionId);
            assert.equal(affected.length, protocol === "physical_measurement" ? 5 : 13);
            assert.deepEqual(new Set(affected.map(p => p.evidenceId)), new Set(members.map(m => m.evidenceId)));
            assert.ok(affected.every(p => p.currentRevisionId === null && p.history.every(r => !r.current) && p.history.length === 2 && !p.history.at(-1)!.complete && !p.history.at(-1)!.consistent && p.reasons.includes("registered_evidence_or_provenance_drift")));
            const healthy = report.provenance!.filter(p => p.latestRevisionId === other.revisionId);
            assert.equal(healthy.length, affected.length);
            assert.ok(healthy.every(p => p.currentRevisionId === other.revisionId && p.history[0]!.consistent));
            assert.deepEqual(report.constructs, before.constructs);
            assert.deepEqual(report.authority, before.authority);
            assert.ok(Object.values(report.authority).every(v => v === false));
            for (const p of affected) assert.ok(output[0]!.split("\n").some(line => line.startsWith("- " + p.evidenceId + ": ") && line.includes("verified current revision none")));
        }
        // The affected live row may be absent from a consumer's requested inventory entirely.
        const subset = await db!.$transaction(async tx => {
            await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
            return readAcquisitionProvenanceInSnapshot(tx, await tx.equipmentDNAEvidenceRecord.findMany({ where: { id: { in: members.filter(m => m.evidenceId !== badId).map(m => m.evidenceId) } } }));
        }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
        assert.equal(subset.length, members.length - 1);
        assert.ok(subset.every(p => p.currentRevisionId === null && !p.history.at(-1)!.consistent));
    });
}

async function acquisitionState(acquisitionId: string) {
    return {
        revisions: await db!.evidenceAcquisitionRevision.findMany({ where: { acquisitionId }, orderBy: { ordinal: "asc" }, include: { members: true, inputs: true } }),
        evidence: await db!.equipmentDNAEvidenceRecord.findMany({ where: { acquisitionBinding: { acquisitionId } }, orderBy: { id: "asc" } })
    };
}
for (const protocol of ["physical_measurement", "human_calibration"] as const) for (const fault of ["live-member", "lifecycle", "member-snapshot", "participant", "upstream", "payload-hash", "binding"] as const) {
    integration("#086 replay revalidates present integrity without rewriting history: " + protocol + ":" + fault, async () => {
        const f = await setup(protocol), first = await f.service.capture(f.command);
        const valid = await f.service.capture(f.command);
        assert.equal(valid.current, true); assert.equal(valid.replayed, true); assert.equal(valid.revisionId, first.revisionId);
        const correction = successor(f, first), latest = await f.service.revise(correction);
        assert.equal((await f.service.revise(correction)).current, true);
        const historical = await f.service.capture(f.command);
        assert.equal(historical.current, false); assert.equal(historical.revisionId, first.revisionId); assert.equal(historical.latestRevisionId, latest.revisionId);
        await db!.$transaction(async tx => {
            await tx.$executeRawUnsafe("SET LOCAL session_replication_role=replica");
            const r = await tx.evidenceAcquisitionRevision.findUniqueOrThrow({ where: { id: latest.revisionId }, include: { members: true } });
            if (fault === "binding") await tx.acquisitionEvidenceBinding.delete({ where: { evidenceId: r.members[0]!.evidenceId } });
            if (fault === "live-member") await tx.equipmentDNAEvidenceRecord.update({ where: { id: r.members[0]!.evidenceId }, data: { notes: "Replay integrity fault" } });
            if (fault === "member-snapshot") { const m = r.members[0]!; await tx.acquisitionEvidenceMember.update({ where: { revisionId_evidenceId: { revisionId: r.id, evidenceId: m.evidenceId } }, data: { snapshot: { ...(m.snapshot as object), notes: "Corrupt snapshot" } } }); }
            if (fault === "participant") await tx.evidenceAcquisitionRevision.update({ where: { id: r.id }, data: protocol === "physical_measurement" ? { operatorId: null } : { evaluatorId: null } });
            if (fault === "payload-hash") await tx.evidenceAcquisitionRevision.update({ where: { id: r.id }, data: { fingerprint: "0".repeat(64) } });
            if (fault === "lifecycle" || fault === "upstream") {
                const payload: any = structuredClone(r.payload);
                if (fault === "lifecycle") Object.assign(payload, { operation: "withdraw", ordinal: 99, actorId: "other-actor" });
                else payload.declaration.upstream = { state: "declared_inputs", inputs: [{ type: "unresolved", reference: "missing:resolution", basis: "Contradicts resolved inputs" }] };
                await tx.evidenceAcquisitionRevision.update({ where: { id: r.id }, data: { payload, fingerprint: acquisitionFingerprint(payload) } });
            }
        });
        const damaged = await acquisitionState(first.acquisitionId);
        const replay = await f.service.revise(correction);
        assert.equal(replay.current, false); assert.equal(replay.currentRevisionId, null); assert.equal(replay.revisionId, latest.revisionId); assert.equal(replay.latestRevisionId, latest.revisionId); assert.equal(replay.replayed, true);
        assert.ok(replay.reasons.length > 0); assert.ok(Object.values(replay.authority).every(value => value === false));
        const captureReplay = await f.service.capture(f.command);
        assert.equal(captureReplay.current, false); assert.equal(captureReplay.revisionId, first.revisionId);
        await assert.rejects(f.service.capture({ ...f.command, declaration: { ...f.command.declaration, reason: "Conflicting replay" } }), /IDEMPOTENCY_CONFLICT/);
        assert.deepEqual(await acquisitionState(first.acquisitionId), damaged);
        const { runGovernedOperationalEvidenceReport } = await import("../governed-operational-evidence-report-cli.js");
        for (const mode of ["evidence", "readiness"] as const) {
            const report = await runGovernedOperationalEvidenceReport(["--equipment=" + f.equipment.id, "--variant=" + f.variant.id, "--construct=" + (protocol === "physical_measurement" ? "actual_mass" : "startup_demand")], mode, { client: db!, write() {} });
            assert.ok(report.provenance.every(p => p.currentRevisionId === null));
            assert.ok(report.provenance.filter(p => p.registration === "registered_declaration").every(p => p.latestRevisionId === latest.revisionId));
            assert.ok(Object.values(report.authority).every(value => value === false));
        }
    });
}
async function upstreamSQLFixture(protocol: "physical_measurement" | "human_calibration" = "physical_measurement") {
    const f = await setup(protocol);
    const source = await db!.equipmentDNAEvidenceRecord.create({ data: { equipmentId: f.equipment.id, targetLevel: "equipment", attributeKey: "legacy", attributeDefinitionVersion: "1.0", sourceType: "manufacturer_specification", sourceName: "Upstream fixture", method: "direct_specification", rawValue: { test: true } } });
    const command = { ...f.command, declaration: { ...f.command.declaration, upstream: { state: "declared_inputs" as const, inputs: [{ type: "evidence" as const, id: source.id, basis: "Supplier observation" }] } } };
    const receipt = await f.service.capture(command);
    const prior = await db!.evidenceAcquisitionRevision.findUniqueOrThrow({ where: { id: receipt.revisionId }, include: { members: true, inputs: true } });
    const { members: oldMembers, inputs: oldInputs, ...old } = prior;
    const r: any = { ...old, id: randomUUID(), ordinal: 2, operation: "correct", predecessorId: prior.id, sealed: false, idempotencyKey: randomUUID(), payload: structuredClone(prior.payload) };
    Object.assign(r.payload, { operation: r.operation, ordinal: r.ordinal, predecessorId: r.predecessorId });
    const members = oldMembers.map(m => ({ ...m, revisionId: r.id }));
    const inputs: any[] = oldInputs.map(i => ({ ...i, id: randomUUID(), revisionId: r.id, declaration: structuredClone(i.declaration) }));
    return { ...f, command, receipt, r, members, inputs };
}
async function insertUpstreamSuccessor(f: Awaited<ReturnType<typeof upstreamSQLFixture>>) {
    f.r.fingerprint = acquisitionFingerprint(f.r.payload);
    return db!.$transaction(async tx => {
        assert.deepEqual(await tx.$queryRawUnsafe("SHOW session_replication_role"), [{ session_replication_role: "origin" }]);
        await tx.$executeRawUnsafe("INSERT INTO evidence_acquisition_revisions SELECT * FROM jsonb_populate_record(NULL::evidence_acquisition_revisions,$1::jsonb)", JSON.stringify(f.r));
        for (const m of f.members) await tx.$executeRawUnsafe("INSERT INTO acquisition_evidence_members SELECT * FROM jsonb_populate_record(NULL::acquisition_evidence_members,$1::jsonb)", JSON.stringify(m));
        for (const i of f.inputs) await tx.$executeRawUnsafe("INSERT INTO acquisition_input_declarations SELECT * FROM jsonb_populate_record(NULL::acquisition_input_declarations,$1::jsonb)", JSON.stringify(i));
        await tx.evidenceAcquisitionRevision.update({ where: { id: f.r.id }, data: { sealed: true } });
    });
}
for (const fault of ["endpoint", "basis", "type", "state", "empty", "duplicate", "column", "kind", "metadata", "fingerprint", "limit", "no-rationale"] as const) {
    integration("#086 ordinary SQL rejects contradictory upstream " + fault, async () => {
        const f = await upstreamSQLFixture();
        const u = f.r.payload.declaration.upstream;
        if (fault === "endpoint") { u.inputs[0].id = randomUUID(); u.inputs[0].basis = "Contradicts resolved manifest"; }
        if (fault === "basis") u.inputs[0].basis = "Different basis";
        if (fault === "type") u.inputs[0].type = "revision";
        if (fault === "state") u.state = "not_declared";
        if (fault === "empty") { u.inputs = []; f.r.payload.inputs = []; f.inputs.splice(0); }
        if (fault === "duplicate") { u.inputs.push(u.inputs[0]); f.r.payload.inputs.push(f.r.payload.inputs[0]); f.inputs.push({ ...f.inputs[0], id: randomUUID() }); }
        if (fault === "column") { const other = await db!.equipmentDNAEvidenceRecord.create({ data: { equipmentId: f.equipment.id, targetLevel: "equipment", attributeKey: "other", attributeDefinitionVersion: "1.0", sourceType: "manufacturer_specification", sourceName: "Other", method: "direct_specification" } }); f.inputs[0].evidenceId = other.id; }
        if (fault === "kind") { f.inputs[0].kind = "unresolved"; f.inputs[0].evidenceId = null; }
        if (fault === "metadata") { f.r.payload.inputs[0].verified = true; f.inputs[0].declaration.verified = true; }
        if (fault === "fingerprint") { f.r.payload.inputs[0].targetFingerprint = "invalid"; f.inputs[0].declaration.targetFingerprint = "invalid"; }
        if (fault === "limit") { u.inputs = Array(65).fill(u.inputs[0]); }
        if (fault === "no-rationale") { u.state = "declared_no_known_inputs"; u.inputs = []; f.r.payload.inputs = []; f.inputs.splice(0); }
        await assert.rejects(insertUpstreamSuccessor(f), /ACQUISITION_INPUT_(MANIFEST|DECLARATION)_MISMATCH/);
        assert.equal(await db!.evidenceAcquisitionRevision.count({ where: { acquisitionId: f.receipt.acquisitionId } }), 1);
    });
}
for (const protocol of ["physical_measurement", "human_calibration"] as const) {
    integration("#086 rehashed declared/resolved conflict fails projection, receipts and both reports: " + protocol, async () => {
        const f = await upstreamSQLFixture(protocol);
        const valid = await f.service.capture(f.command); assert.equal(valid.current, true);
        const r = await db!.evidenceAcquisitionRevision.findUniqueOrThrow({ where: { id: f.receipt.revisionId } });
        const payload: any = structuredClone(r.payload);
        payload.declaration.upstream.inputs = [{ type: "evidence", id: randomUUID(), basis: "Contradicts resolved manifest" }];
        await db!.$transaction(async tx => { await tx.$executeRawUnsafe("SET LOCAL session_replication_role=replica"); await tx.evidenceAcquisitionRevision.update({ where: { id: r.id }, data: { payload, fingerprint: acquisitionFingerprint(payload) } }); });
        const snapshot = await acquisitionState(r.acquisitionId);
        const receipt = await f.service.capture(f.command); assert.equal(receipt.current, false); assert.ok(receipt.reasons.includes("acquisition_upstream_mismatch"));
        const { runGovernedOperationalEvidenceReport } = await import("../governed-operational-evidence-report-cli.js");
        for (const mode of ["evidence", "readiness"] as const) {
            const report = await runGovernedOperationalEvidenceReport(["--equipment=" + f.equipment.id, "--variant=" + f.variant.id, "--construct=actual_mass"], mode, { client: db!, write() {} });
            const registered = report.provenance.filter(p => p.registration === "registered_declaration");
            assert.equal(registered.length, protocol === "physical_measurement" ? 5 : 13);
            assert.ok(registered.every(p => p.currentRevisionId === null && p.latestRevisionId === r.id && p.reasons.includes("acquisition_upstream_mismatch") && !p.history.at(-1)!.complete && !p.history.at(-1)!.consistent));
        }
        assert.deepEqual(await acquisitionState(r.acquisitionId), snapshot);
    });
    integration("#086 legitimate mixed upstream declarations resolve without claiming independence: " + protocol, async () => {
        const f = await upstreamSQLFixture(protocol);
        const next = captureCommand(f.equipment.id, f.variant.id, protocol, f.command.namespace);
        const reference = f.r.payload.inputs[0].id as string;
        const command = { ...next, declaration: { ...next.declaration, upstream: { state: "declared_inputs" as const, inputs: [{ type: "evidence" as const, id: reference, basis: "Source evidence" }, { type: "revision" as const, id: f.receipt.revisionId, basis: "Prior acquisition" }, { type: "unresolved" as const, reference: "external:unknown", basis: "Supplier locator" }] } } };
        const receipt = await f.service.capture(command); assert.equal(receipt.current, true);
        const report = await new GovernedOperationalEvidenceReportService(new PrismaGovernedConstructEvidenceProjectionRepository(db!)).load({ equipmentId: f.equipment.id, equipmentVariantId: f.variant.id, construct: "actual_mass" });
        const views = report.provenance.filter(p => p.latestRevisionId === receipt.revisionId);
        assert.ok(views.every(p => p.currentRevisionId === receipt.revisionId && p.reasons.includes("upstream_unresolved") && p.history.at(-1)!.consistent && !p.history.at(-1)!.complete));
        assert.ok(Object.values(report.authority).every(value => value === false));
    });
}
integration("#086 ordinary SQL accepts matching reordered upstream correspondence", async () => {
    const f = await upstreamSQLFixture();
    const second = await db!.equipmentDNAEvidenceRecord.create({ data: { equipmentId: f.equipment.id, targetLevel: "equipment", attributeKey: "other", attributeDefinitionVersion: "1.0", sourceType: "manufacturer_specification", sourceName: "Second input", method: "direct_specification", rawValue: { another: true } } });
    const declared = { type: "evidence", id: second.id, basis: "Second supplier observation" };
    const resolved = { ...declared, targetFingerprint: acquisitionFingerprint(evidenceSemantics(second as unknown as Record<string, unknown>)) };
    f.r.payload.declaration.upstream.inputs.push(declared);
    f.r.payload.inputs.push(resolved);
    f.inputs.push({ id: randomUUID(), revisionId: f.r.id, kind: "evidence", evidenceId: second.id, targetRevisionId: null, declaration: resolved });
    f.r.payload.inputs.reverse(); f.inputs.reverse();
    await insertUpstreamSuccessor(f);
    const report = await new GovernedOperationalEvidenceReportService(new PrismaGovernedConstructEvidenceProjectionRepository(db!)).load({ equipmentId: f.equipment.id, equipmentVariantId: f.variant.id, construct: "actual_mass" });
    assert.ok(report.provenance.filter(p => p.registration === "registered_declaration").every(p => p.currentRevisionId === f.r.id && p.history.at(-1)!.complete && p.history.at(-1)!.consistent));
});

for (const protocol of ["physical_measurement", "human_calibration"] as const) for (const depth of [2, 3]) for (const fault of ["fingerprint", "participant", "member", "snapshot", "upstream", "unsealed", "lifecycle"] as const) {
    integration("#086 stored predecessor corruption revokes replay and reports: " + protocol + ":" + depth + ":" + fault, async () => {
        const f = await setup(protocol), first = await f.service.capture(f.command);
        const healthyCommand = captureCommand(f.equipment.id, f.variant.id, protocol, f.command.namespace);
        const healthy = await f.service.capture(healthyCommand);
        let latest = first, correction = successor(f, first);
        for (let ordinal = 2; ordinal <= depth; ordinal++) {
            correction = successor(f, latest);
            latest = await f.service.revise(correction);
            assert.equal(latest.current, true);
        }
        const members = await db!.acquisitionEvidenceMember.findMany({ where: { revisionId: first.revisionId }, orderBy: { evidenceId: "asc" } });
        await db!.$transaction(async tx => {
            await tx.$executeRawUnsafe("SET LOCAL session_replication_role=replica");
            const r = await tx.evidenceAcquisitionRevision.findUniqueOrThrow({ where: { id: first.revisionId } });
            if (fault === "fingerprint") await tx.evidenceAcquisitionRevision.update({ where: { id: r.id }, data: { fingerprint: "0".repeat(64) } });
            if (fault === "participant") await tx.evidenceAcquisitionRevision.update({ where: { id: r.id }, data: protocol === "physical_measurement" ? { operatorId: null } : { evaluatorId: null } });
            if (fault === "member") await tx.acquisitionEvidenceMember.delete({ where: { revisionId_evidenceId: { revisionId: r.id, evidenceId: members[0]!.evidenceId } } });
            if (fault === "snapshot") await tx.acquisitionEvidenceMember.update({ where: { revisionId_evidenceId: { revisionId: r.id, evidenceId: members[0]!.evidenceId } }, data: { snapshot: { ...(members[0]!.snapshot as object), notes: "Corrupt historical snapshot" } } });
            if (fault === "unsealed") await tx.evidenceAcquisitionRevision.update({ where: { id: r.id }, data: { sealed: false } });
            if (fault === "upstream" || fault === "lifecycle") {
                const payload: any = structuredClone(r.payload);
                if (fault === "upstream") payload.declaration.upstream = { state: "declared_inputs", inputs: [{ type: "unresolved", reference: "missing:resolution", basis: "Contradicts stored inputs" }] };
                else payload.actorId = "other-actor";
                await tx.evidenceAcquisitionRevision.update({ where: { id: r.id }, data: { payload, fingerprint: acquisitionFingerprint(payload) } });
            }
        });
        const damaged = await acquisitionState(first.acquisitionId);
        const replay = await f.service.revise(correction);
        assert.equal(replay.current, false); assert.equal(replay.currentRevisionId, null);
        assert.equal(replay.revisionId, latest.revisionId); assert.equal(replay.latestRevisionId, latest.revisionId); assert.equal(replay.replayed, true);
        assert.ok(replay.reasons.includes("acquisition_predecessor_integrity_drift"));
        assert.equal((await f.service.capture(healthyCommand)).current, true);
        const { runGovernedOperationalEvidenceReport } = await import("../governed-operational-evidence-report-cli.js");
        for (const mode of ["evidence", "readiness"] as const) {
            const output: string[] = [];
            const report = await runGovernedOperationalEvidenceReport(["--equipment=" + f.equipment.id, "--variant=" + f.variant.id, "--construct=" + (protocol === "physical_measurement" ? "actual_mass" : "startup_demand")], mode, { client: db!, write: text => output.push(text) });
            const affected = report.provenance.filter(p => p.latestRevisionId === latest.revisionId);
            assert.equal(affected.length, protocol === "physical_measurement" ? 5 : 13);
            assert.ok(affected.every(p => p.currentRevisionId === null && p.history.length === depth && p.history[0]!.revisionId === first.revisionId && p.history.at(-1)!.revisionId === latest.revisionId && p.history.every(r => !r.current) && !p.history.at(-1)!.consistent && !p.history.at(-1)!.complete && p.reasons.includes("acquisition_predecessor_integrity_drift")));
            const unaffected = report.provenance.filter(p => p.latestRevisionId === healthy.revisionId);
            assert.equal(unaffected.length, affected.length);
            assert.ok(unaffected.every(p => p.currentRevisionId === healthy.revisionId));
            assert.ok(Object.values(report.authority).every(value => value === false));
            for (const p of affected) assert.ok(output[0]!.split("\n").some(line => line.startsWith("- " + p.evidenceId + ": ") && line.includes("verified current revision none")));
        }
        // A caller may request only healthy siblings, never the damaged historical member.
        const subset = await db!.$transaction(async tx => {
            await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
            return readAcquisitionProvenanceInSnapshot(tx, await tx.equipmentDNAEvidenceRecord.findMany({ where: { id: { in: members.slice(1).map(m => m.evidenceId) } } }));
        }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
        assert.equal(subset.length, members.length - 1);
        assert.ok(subset.every(p => p.currentRevisionId === null && p.latestRevisionId === latest.revisionId));
        assert.deepEqual(await acquisitionState(first.acquisitionId), damaged);
    });
}
for (const protocol of ["physical_measurement", "human_calibration"] as const) integration("#086 valid multi-correction history tolerates historical live differences and withdraws: " + protocol, async () => {
    const f = await setup(protocol), first = await f.service.capture(f.command);
    const m = await db!.acquisitionEvidenceMember.findFirstOrThrow({ where: { revisionId: first.revisionId } });
    await db!.$transaction(async tx => {
        await tx.$executeRawUnsafe("SET LOCAL session_replication_role=replica");
        await tx.equipmentDNAEvidenceRecord.update({ where: { id: m.evidenceId }, data: { notes: "Explicitly accepted by subsequent correction" } });
    });
    const secondCommand = successor(f, first), second = await f.service.revise(secondCommand);
    const thirdCommand = successor(f, second), third = await f.service.revise(thirdCommand);
    assert.equal(second.current, true); assert.equal(third.current, true);
    assert.equal((await f.service.revise(thirdCommand)).current, true);
    const superseded = await f.service.revise(secondCommand);
    assert.equal(superseded.current, false); assert.equal(superseded.revisionId, second.revisionId); assert.equal(superseded.latestRevisionId, third.revisionId);
    const { runGovernedOperationalEvidenceReport } = await import("../governed-operational-evidence-report-cli.js");
    async function reports(expected: string | null, count: number) {
        for (const mode of ["evidence", "readiness"] as const) {
            const report = await runGovernedOperationalEvidenceReport(["--equipment=" + f.equipment.id, "--variant=" + f.variant.id, "--construct=actual_mass"], mode, { client: db!, write() {} });
            assert.equal(report.provenance.length, protocol === "physical_measurement" ? 5 : 13);
            assert.ok(report.provenance.every(p => p.currentRevisionId === expected && p.history.length === count && !p.history[0]!.current && p.history.at(-1)!.consistent && !p.reasons.includes("acquisition_predecessor_integrity_drift")));
        }
    }
    await reports(third.revisionId, 3);
    const withdrawalCommand = successor(f, third, "withdraw"), withdrawn = await f.service.revise(withdrawalCommand);
    const state = await acquisitionState(first.acquisitionId);
    assert.equal(withdrawn.current, false); assert.equal(withdrawn.withdrawn, true);
    const replay = await f.service.revise(withdrawalCommand);
    assert.equal(replay.currentRevisionId, null); assert.equal(replay.latestRevisionId, withdrawn.revisionId); assert.equal(replay.withdrawn, true);
    assert.equal((await f.service.revise(thirdCommand)).current, false);
    await reports(null, 4);
    await assert.rejects(f.service.revise(successor(f, withdrawn)), /ACQUISITION_WITHDRAWN/);
    assert.deepEqual(await acquisitionState(first.acquisitionId), state);
});
