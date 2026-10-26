import assert from "node:assert/strict";
import test from "node:test";
import { evidenceSemantics, acquisitionFingerprint, canonicalAcquisitionJSON, exactEvidenceReplay, normalizeDeclaration, provenanceReasons, acquisitionAuthority } from "../acquisition-provenance.js";
import { StrongerEvidenceAcquisitionCaptureService } from "../stronger-evidence-acquisition-capture.js";
import { captureCommand } from "./acquisition-provenance.fixture.js";
import type { PrismaClient } from "@prisma/client";
const command = () => captureCommand("11111111-1111-4111-a111-111111111111", "22222222-2222-4222-a222-222222222222");
test("#086 object order is semantic while meaningful array order and numeric bits remain distinct", () => {
    assert.equal(acquisitionFingerprint({ a: 1, b: { c: 2 } }), acquisitionFingerprint({ b: { c: 2 }, a: 1 }));
    assert.notEqual(acquisitionFingerprint([1, 2]), acquisitionFingerprint([2, 1]));
    assert.notEqual(acquisitionFingerprint(1), acquisitionFingerprint(1 + Number.EPSILON));
    assert.equal(canonicalAcquisitionJSON({ a: undefined, b: null }), '{"b":null}');
});
for (const value of [NaN, Infinity, -Infinity, 1n, () => 1, Symbol("x"), [undefined]])
    test("#086 rejects non-JSON numeric/value input " + String(value), () => assert.throws(() => acquisitionFingerprint(value)));
test("#086 exact persisted replay checks all meaningful fields and separates status", () => {
    const row = { id: "e", rawValue: { a: 1, b: 2 }, normalizedValue: { value: 1 }, sourceDate: new Date("2026-10-01"), equipmentId: "a", method: "m" };
    assert.equal(exactEvidenceReplay(row, { ...row, rawValue: { b: 2, a: 1 }, sourceDate: "2026-10-01T00:00:00.000Z" }), true);
    for (const key of ["equipmentId", "equipmentVariantId", "method", "sourceReference", "attributeKey", "sourceType", "sourceName", "notes", "unit", "evaluatorReference"])
        assert.equal(exactEvidenceReplay(row, { ...row, [key]: "changed" }), false);
    assert.equal(exactEvidenceReplay(row, { ...row, normalizedValue: { value: 1 + Number.EPSILON } }), false);
    assert.equal(exactEvidenceReplay({ ...row, status: "active" }, { ...row, status: "withdrawn" }), true);
});
test("#086 deterministic declaration sorting preserves unknown dependence", () => { const d = command().declaration; assert.ok(provenanceReasons(normalizeDeclaration(d)).includes("upstream_not_declared")); assert.equal(acquisitionAuthority.independenceEstablished, false); });
for (const invalid of ["missing-rationale", "empty-inputs", "duplicate-inputs", "invalid-participant", "too-many-inputs"])
    test("#086 invalid declaration " + invalid, () => {
        const d = structuredClone(command().declaration) as any;
        if (invalid === "missing-rationale")
            d.upstream = { state: "declared_no_known_inputs", inputs: [] };
        if (invalid === "empty-inputs")
            d.upstream = { state: "declared_inputs", inputs: [] };
        if (invalid === "duplicate-inputs")
            d.upstream = { state: "declared_inputs", inputs: [{ type: "unresolved", reference: "x", basis: "declared" }, { type: "unresolved", reference: "x", basis: "declared" }] };
        if (invalid === "invalid-participant")
            d.specimen = { kind: "person", state: "registered_declaration", key: "x" };
        if (invalid === "too-many-inputs")
            d.upstream = { state: "declared_inputs", inputs: Array.from({ length: 65 }, (_, i) => ({ type: "unresolved", reference: String(i), basis: "declared" })) };
        assert.throws(() => normalizeDeclaration(d));
    });
test("#086 no trusted provider means no transaction and no fallback", async () => { let read = false; const client = { $transaction() { read = true; } } as unknown as PrismaClient; await assert.rejects(new StrongerEvidenceAcquisitionCaptureService(client).capture(command()), /CAPTURE_NOT_AUTHORIZED/); assert.equal(read, false); });
test("#086 declared-no-known-inputs grants no independence", () => { const d = command().declaration; const n = normalizeDeclaration({ ...d, upstream: { state: "declared_no_known_inputs", rationale: "Supplier knows of none.", inputs: [] } }); assert.equal(n.upstream.state, "declared_no_known_inputs"); assert.ok(Object.values(acquisitionAuthority).every(x => x === false)); });


for(const field of ["root","participant","input"])test("#086 rejects caller supplied verification authority on "+field,()=>{const d=structuredClone(command().declaration) as any;if(field==="root")d.verified=true;if(field==="participant")d.specimen.independentlyVerified=true;if(field==="input")d.upstream={state:"declared_inputs",inputs:[{type:"unresolved",reference:"x",basis:"declared",verified:true}]};assert.throws(()=>normalizeDeclaration(d),/UNKNOWN_DECLARATION_FIELD/);});

import { buildPhysicalMeasurementEvidence, reviewPhysicalMeasurementSession } from "@ninery/equipment-intelligence";
import { readAcquisitionProvenanceInSnapshot } from "../acquisition-provenance-projection.js";
import type { Prisma } from "@prisma/client";
async function projectionFixture(change: (revision: any) => void = () => {}, afterFingerprint: (revision: any) => void = () => {}, changeInventory: (rows: any[]) => void = () => {}, selectInventory: (rows: any[]) => any[] = rows => rows, history: (r: any) => any[] = r => [r], ownership: (rows: any[]) => any[] = rows => rows) {
    const c = command();
    if (c.packet.protocol !== "physical_measurement") throw Error();
    const s = c.packet.session;
    const review = reviewPhysicalMeasurementSession(s);
    const rows = s.measurementBlocks.map(b => {
        const e = buildPhysicalMeasurementEvidence(s, b, review.blocks.find(x => x.measurementType === b.measurementType)!.quality);
        return evidenceSemantics({ ...e, attributeDefinitionVersion: "physical-measurement-1.0", targetLevel: "variant", sourceType: "objective_measurement", method: "instrument_measurement" }) as typeof e;
    });
    const a = { id: "root", namespaceId: c.namespace, protocolFamily: c.packet.protocol, sessionKey: s.measurementSessionId, equipmentId: s.equipmentId, equipmentVariantId: s.equipmentVariantId };
    const participant = (d: any, id: string) => ({ id, namespaceId: c.namespace, kind: d.kind, localKey: d.key, equipmentId: d.kind === "specimen" ? s.equipmentId : null, equipmentVariantId: d.kind === "specimen" ? s.equipmentVariantId : null });
    const members = rows.map(e => ({ evidenceId: e.id, memberKey: e.attributeKey, snapshot: e, fingerprint: acquisitionFingerprint(e), instrumentId: e.attributeKey, instrument: participant(c.declaration.instruments[e.attributeKey], e.attributeKey) }));
    const r: any = { id: "revision", acquisitionId: a.id, predecessorId: null, ordinal: 1, operation: "capture", capturedAt: new Date(), actorId: "actor", sealed: true, expectedCount: 5, specimenId: "specimen", specimen: participant(c.declaration.specimen, "specimen"), operatorId: "operator", operator: participant(c.declaration.operator, "operator"), evaluatorId: null, evaluator: null, members, inputs: [], payload: { operation: "capture", ordinal: 1, predecessorId: null, actorId: "actor", version: "1.0", namespace: c.namespace, acquisitionId: a.id, packet: c.packet, declaration: { ...c.declaration, upstream: { state: "declared_no_known_inputs", rationale: "Declared", inputs: [] } }, inputs: [] } };
    change(r);
    r.payload.manifest = r.members.map((m: any) => ({ evidenceId: m.evidenceId, memberKey: m.memberKey, fingerprint: m.fingerprint })).sort((a: any, b: any) => a.evidenceId.localeCompare(b.evidenceId));
    r.fingerprint = acquisitionFingerprint(r.payload);
    afterFingerprint(r);
    changeInventory(rows);
    const tx = { equipmentDNAEvidenceRecord: { findMany: async () => rows }, evidenceAcquisitionRevision: { findMany: async () => [] }, $queryRaw: async () => [{ isolation: "repeatable read", readOnly: "on" }], acquisitionEvidenceBinding: { findMany: async (args: any) => args.include ? selectInventory(rows).map(e => ({ evidenceId: e.id, acquisitionId: a.id, acquisition: { ...a, revisions: history(r).map(revision => ({ ...revision, members: revision.members.map((member: any) => ({ ...member, acquisitionId: a.id, revisionId: revision.id })) })) } })) : ownership(rows.map(e => ({ evidenceId: e.id, acquisitionId: a.id }))) } } as unknown as Prisma.TransactionClient;
    return readAcquisitionProvenanceInSnapshot(tx, selectInventory(rows) as any);
}
test("#086 projection reports a full registry-backed declaration without positive authority", async () => {
    const view = await projectionFixture();
    assert.ok(view.every(v => v.history[0]!.complete && v.history[0]!.consistent));
    assert.ok(view.every(v => Object.values(v.authority).every(a => a === false)));
});
test("#086 projection independently rejects self-consistent incomplete membership and absent current membership", async () => {
    const view = await projectionFixture(r => { r.members = r.members.slice(0, 1); r.expectedCount = 1; });
    assert.ok(view.every(v => !v.history[0]!.complete && !v.history[0]!.consistent && v.reasons.includes("protocol_manifest_incomplete")));
    assert.equal(view.filter(v => v.currentRevisionId === null).length, 5);
});
for (const role of ["specimen", "operator", "instrument"] as const) test("#086 projection resolves registered " + role + " identities rather than trusting declarations", async () => {
    const view = await projectionFixture(r => {
        if (role === "instrument") { r.members[0].instrumentId = null; r.members[0].instrument = null; }
        else { r[role + "Id"] = null; r[role] = null; }
    });
    assert.ok(view.every(v => !v.history[0]!.complete && !v.history[0]!.consistent && v.reasons.includes("participant_registry_mismatch")));
    assert.ok(view.every(v => v.currentRevisionId === null && !v.history[0]!.current && v.latestRevisionId === "revision"));
    if (role === "specimen") assert.ok(view.every(v => v.reasons.includes("specimen_unresolved")));
});
test("#086 unresolved specimen stays explicitly unresolved with no positive authority", async () => {
    const view = await projectionFixture(r => { r.specimenId = null; r.specimen = null; r.payload.declaration.specimen = { kind: "specimen", state: "unresolved" }; });
    assert.ok(view.every(v => !v.history[0]!.complete && v.history[0]!.consistent && v.reasons.includes("specimen_unresolved")));
    assert.ok(view.every(v => v.authority.independentlyVerified === false));
    assert.ok(view.every(v => v.currentRevisionId === "revision" && v.latestRevisionId === "revision" && v.history[0]!.current));
});

for (const drift of ["revision_fingerprint", "member_snapshot", "unsealed", "live_evidence", "upstream_evidence", "upstream_revision"] as const) test("#086 integrity drift never remains current: " + drift, async () => {
    const view = await projectionFixture(r => {
        if (drift === "upstream_evidence" || drift === "upstream_revision") {
            const input = { type: drift === "upstream_evidence" ? "evidence" : "revision", id: "missing-upstream", basis: "Declared input", targetFingerprint: "0".repeat(64) };
            r.payload.inputs = [input];
            r.inputs = [{ ...(input.type === "evidence" ? { evidenceId: input.id } : { targetRevisionId: input.id }), declaration: input }];
            r.payload.declaration.upstream = { state: "declared_inputs", inputs: [{ type: input.type, id: input.id, basis: input.basis }] };
        }
    }, r => {
        if (drift === "revision_fingerprint") r.fingerprint = "0".repeat(64);
        if (drift === "member_snapshot") r.members[0].snapshot = { ...r.members[0].snapshot, notes: "tampered" };
        if (drift === "unsealed") r.sealed = false;
    }, rows => {
        if (drift === "live_evidence") rows[0] = { ...rows[0], notes: "tampered" };
    });
    const affected = view;
    assert.ok(affected.every(v => !v.history[0]!.consistent && !v.history[0]!.current && v.currentRevisionId === null));
    assert.ok(affected.every(v => v.latestRevisionId === "revision" && v.history[0]!.revisionId === "revision"));
    assert.ok(affected.every(v => Object.values(v.authority).every(value => value === false)));
});
test("#086 withdrawal preserves latest recorded revision without current provenance", async () => {
    const view = await projectionFixture(r => { r.operation = "withdraw"; });
    assert.ok(view.every(v => v.latestRevisionId === "revision" && v.currentRevisionId === null && !v.history[0]!.current));
});

for (const field of ["operation", "ordinal", "predecessorId", "actorId"] as const) test("#086 lifecycle payload mismatch clears all current provenance: " + field, async () => {
    const view = await projectionFixture(r => { r.payload[field] = field === "ordinal" ? 99 : field === "operation" ? "withdraw" : "other-value"; });
    assert.equal(view.length, 5);
    assert.ok(view.every(p => p.currentRevisionId === null && p.latestRevisionId === "revision" && p.history.every(r => !r.current) && !p.history[0]!.consistent && !p.history[0]!.complete && p.reasons.includes("acquisition_lifecycle_mismatch")));
});
for (const fault of ["gap", "wrong-predecessor", "after-withdrawal", "wrong-root"] as const) test("#086 projection rejects contradictory lifecycle chain: " + fault, async () => {
    const view = await projectionFixture(() => {}, () => {}, () => {}, rows => rows, r => {
        const initial = structuredClone(r);
        const next = { ...r, id: "successor", ordinal: 2, operation: "correct", predecessorId: initial.id, payload: { ...r.payload, ordinal: 2, operation: "correct", predecessorId: initial.id } };
        if (fault === "gap") next.ordinal = next.payload.ordinal = 3;
        if (fault === "wrong-predecessor") next.predecessorId = next.payload.predecessorId = "wrong";
        if (fault === "after-withdrawal") { initial.operation = initial.payload.operation = "withdraw"; initial.fingerprint = acquisitionFingerprint(initial.payload); }
        if (fault === "wrong-root") next.acquisitionId = next.payload.acquisitionId = "other-root";
        next.fingerprint = acquisitionFingerprint(next.payload);
        return [initial, next];
    });
    assert.ok(view.every(p => p.currentRevisionId === null && p.latestRevisionId === "successor" && p.history.length === 2 && p.history.every(r => !r.current) && p.reasons.includes("acquisition_lifecycle_mismatch")));
});
test("#086 legitimate correction and terminal withdrawal preserve complete historical chain", async () => {
    for (const withdraw of [false, true]) {
        const view = await projectionFixture(() => {}, () => {}, () => {}, rows => rows, r => {
            const next = { ...r, id: "corrected", ordinal: 2, operation: "correct", predecessorId: r.id, payload: { ...r.payload, ordinal: 2, operation: "correct", predecessorId: r.id } };
            next.fingerprint = acquisitionFingerprint(next.payload);
            if (!withdraw) return [r, next];
            const last = { ...next, id: "withdrawn", ordinal: 3, operation: "withdraw", predecessorId: next.id, payload: { ...next.payload, ordinal: 3, operation: "withdraw", predecessorId: next.id } };
            last.fingerprint = acquisitionFingerprint(last.payload);
            return [r, next, last];
        });
        assert.ok(view.every(p => p.currentRevisionId === (withdraw ? null : "corrected") && p.latestRevisionId === (withdraw ? "withdrawn" : "corrected") && p.history.every(r => r.consistent && r.complete) && !p.history[0]!.current));
    }
});
test("#086 sibling live drift outside requested inventory invalidates shared acquisition", async () => {
    const view = await projectionFixture(() => {}, () => {}, rows => { rows[0] = { ...rows[0], notes: "corrupt sibling" }; }, rows => rows.slice(1, 2));
    assert.equal(view.length, 1);
    assert.equal(view[0]!.currentRevisionId, null);
    assert.equal(view[0]!.history[0]!.consistent, false);
    assert.ok(view[0]!.reasons.includes("registered_evidence_or_provenance_drift"));
});

import { acquisitionUpstreamMatches } from "../acquisition-provenance.js";
function upstreamFixture() {
    const id = "11111111-1111-4111-a111-111111111111";
    const declared = { type: "evidence", id, basis: "Supplier observation" };
    const resolved = { ...declared, targetFingerprint: "a".repeat(64) };
    return { payload: { declaration: { upstream: { state: "declared_inputs", inputs: [declared] } }, inputs: [resolved] }, rows: [{ kind: "evidence", evidenceId: id as string | null, targetRevisionId: null as string | null, declaration: resolved }] };
}
for (const fault of ["endpoint", "basis", "type", "column", "kind", "state", "empty", "duplicate", "metadata", "fingerprint", "null-inputs", "too-many"] as const) test("#086 upstream audit rejects contradictory input " + fault, () => {
    const f: any = upstreamFixture();
    if (fault === "endpoint") f.payload.declaration.upstream.inputs[0].id = "22222222-2222-4222-a222-222222222222";
    if (fault === "basis") f.payload.declaration.upstream.inputs[0].basis = "Different supplier basis";
    if (fault === "type") f.payload.declaration.upstream.inputs[0].type = "revision";
    if (fault === "column") f.rows[0].evidenceId = "22222222-2222-4222-a222-222222222222";
    if (fault === "kind") f.rows[0].kind = "revision";
    if (fault === "state") f.payload.declaration.upstream.state = "not_declared";
    if (fault === "empty") { f.payload.declaration.upstream.inputs = []; f.payload.inputs = []; f.rows = []; }
    if (fault === "duplicate") { f.payload.declaration.upstream.inputs.push(f.payload.declaration.upstream.inputs[0]); f.payload.inputs.push(f.payload.inputs[0]); f.rows.push(f.rows[0]); }
    if (fault === "metadata") f.payload.inputs[0].verified = true;
    if (fault === "fingerprint") f.payload.inputs[0].targetFingerprint = "invalid";
    if (fault === "null-inputs") f.payload.inputs = null;
    if (fault === "too-many") { f.payload.declaration.upstream.inputs = Array(65).fill(f.payload.declaration.upstream.inputs[0]); }
    assert.equal(acquisitionUpstreamMatches(f.payload, f.rows), false);
});
test("#086 upstream audit accepts evidence/revision resolution and unresolved supplier locators without granting authority", () => {
    const f: any = upstreamFixture();
    assert.equal(acquisitionUpstreamMatches(f.payload, f.rows), true);
    const revision = { type: "revision", id: "22222222-2222-4222-a222-222222222222", basis: "Prior revision", targetFingerprint: "b".repeat(64) };
    const unresolved = { type: "unresolved", reference: "external:unresolved", basis: "Supplier locator" };
    f.payload.inputs.push(revision, unresolved);
    f.payload.declaration.upstream.inputs.push({ type: revision.type, id: revision.id, basis: revision.basis }, unresolved);
    f.rows.push({ kind: "revision", evidenceId: null, targetRevisionId: revision.id, declaration: revision }, { kind: "unresolved", evidenceId: null, targetRevisionId: null, declaration: unresolved });
    f.payload.inputs.reverse(); f.rows.reverse();
    assert.equal(acquisitionUpstreamMatches(f.payload, f.rows), true);
    assert.ok(Object.values(acquisitionAuthority).every(value => value === false));
});
for (const state of ["not_declared", "declared_no_known_inputs"]) test("#086 upstream audit preserves legitimate empty state " + state, () => {
    const upstream = { state, inputs: [], ...(state === "declared_no_known_inputs" ? { rationale: "No inputs known to supplier" } : {}) };
    assert.equal(acquisitionUpstreamMatches({ declaration: { upstream }, inputs: [] }, []), true);
    if (state === "declared_no_known_inputs") assert.equal(acquisitionUpstreamMatches({ declaration: { upstream: { ...upstream, rationale: "" } }, inputs: [] }, []), false);
});
for (const fault of ["declared-endpoint", "relational-endpoint", "invalid-state"] as const) test("#086 rehashed upstream contradiction clears projection completeness/consistency/currentness: " + fault, async () => {
    const view = await projectionFixture(r => {
        const f: any = upstreamFixture();
        r.payload.declaration.upstream = f.payload.declaration.upstream;
        r.payload.inputs = f.payload.inputs; r.inputs = f.rows;
        if (fault === "declared-endpoint") r.payload.declaration.upstream.inputs[0].id = "22222222-2222-4222-a222-222222222222";
        if (fault === "relational-endpoint") r.inputs[0].evidenceId = "22222222-2222-4222-a222-222222222222";
        if (fault === "invalid-state") r.payload.declaration.upstream.state = "not_declared";
    });
    assert.ok(view.every(p => p.currentRevisionId === null && !p.history[0]!.complete && !p.history[0]!.consistent && p.reasons.includes("acquisition_upstream_mismatch")));
});

import { auditAcquisitionProvenance } from "../acquisition-provenance-integrity.js";
test("#086 shared audit rejects root clients before any reads", async () => {
    let read = false;
    const root = { $transaction() {}, async $queryRaw() { read = true; return [{ isolation: "repeatable read" }]; } } as unknown as Prisma.TransactionClient;
    await assert.rejects(auditAcquisitionProvenance(root, []), /ACQUISITION_INTEGRITY_TRANSACTION_REQUIRED/);
    assert.equal(read, false);
});
test("#086 shared audit rejects unprotected ReadCommitted receipt snapshots", async () => {
    const tx = { async $queryRaw() { return [{ isolation: "read committed" }]; } } as unknown as Prisma.TransactionClient;
    await assert.rejects(auditAcquisitionProvenance(tx, []), /ACQUISITION_INTEGRITY_SNAPSHOT_REQUIRED/);
});

for (const fault of ["missing", "wrong-owner"]) test("#086 one invalid ownership binding clears acquisition-wide currentness: " + fault, async () => {
    const view = await projectionFixture(() => {}, () => {}, () => {}, rows => rows, r => [r], bindings => fault === "missing" ? bindings.slice(1) : bindings.map((binding, i) => i ? binding : { ...binding, acquisitionId: "other-acquisition" }));
    assert.ok(view.every(p => p.currentRevisionId === null && !p.history[0]!.consistent && p.reasons.includes("acquisition_binding_mismatch")));
});

for (const depth of [2, 3]) for (const fault of ["fingerprint", "participant", "member", "snapshot", "upstream", "unsealed", "lifecycle"] as const) test("#086 stored predecessor integrity reaches latest projection: " + depth + ":" + fault, async () => {
    const view = await projectionFixture(() => {}, () => {}, () => {}, rows => rows.slice(1), r => {
        const revisions = [structuredClone(r)];
        for (let ordinal = 2; ordinal <= depth; ordinal++) {
            const prior = revisions.at(-1)!;
            const next = { ...structuredClone(r), id: "revision-" + ordinal, ordinal, operation: "correct", predecessorId: prior.id, payload: { ...structuredClone(r.payload), ordinal, operation: "correct", predecessorId: prior.id } };
            next.fingerprint = acquisitionFingerprint(next.payload);
            revisions.push(next);
        }
        const damaged = revisions[0]!;
        if (fault === "fingerprint") damaged.fingerprint = "0".repeat(64);
        if (fault === "participant") { damaged.operatorId = null; damaged.operator = null; }
        if (fault === "member") damaged.members.shift();
        if (fault === "snapshot") damaged.members[0].snapshot.notes = "Stored history corruption";
        if (fault === "unsealed") damaged.sealed = false;
        if (fault === "lifecycle") { damaged.payload.actorId = "other-actor"; damaged.fingerprint = acquisitionFingerprint(damaged.payload); }
        if (fault === "upstream") { damaged.payload.declaration.upstream = { state: "declared_inputs", inputs: [{ type: "unresolved", reference: "unresolved", basis: "Missing resolution" }] }; damaged.fingerprint = acquisitionFingerprint(damaged.payload); }
        return revisions;
    });
    assert.equal(view.length, 4);
    assert.ok(view.every(p => p.latestRevisionId === "revision-" + depth && p.currentRevisionId === null && p.history.length === depth && p.history.every(r => !r.current) && !p.history.at(-1)!.consistent && !p.history.at(-1)!.complete && p.reasons.includes("acquisition_predecessor_integrity_drift")));
});
