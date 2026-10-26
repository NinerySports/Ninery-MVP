import type { Prisma, EquipmentDNAEvidenceRecord } from "@prisma/client";
import { AcquisitionError, acquisitionLifecycleMatches, acquisitionUpstreamMatches, acquisitionStructureReasons, acquisitionAuthority, acquisitionFingerprint, evidenceSemantics, provenanceReasons, type ProvenanceDeclaration } from "./acquisition-provenance.js";
/** Shared integrity decision for protected reports and capture receipts. No evidence authority. */
export async function auditAcquisitionProvenance(tx: Prisma.TransactionClient, inventory: readonly EquipmentDNAEvidenceRecord[]) {
    if ("$transaction" in tx) throw new AcquisitionError("ACQUISITION_INTEGRITY_TRANSACTION_REQUIRED");
    const settings = await tx.$queryRaw<{ isolation: string }[]>`SELECT current_setting('transaction_isolation') AS isolation`;
    if (settings.length !== 1 || settings[0]?.isolation !== "repeatable read") throw new AcquisitionError("ACQUISITION_INTEGRITY_SNAPSHOT_REQUIRED");
    const bindings = await tx.acquisitionEvidenceBinding.findMany({ where: { evidenceId: { in: inventory.map(x => x.id) } }, include: { acquisition: { include: { revisions: { orderBy: { ordinal: "asc" }, include: { members: { include: { instrument: true } }, inputs: true, specimen: true, operator: true, evaluator: true } } } } } });
    const acquisitions = [...new Map(bindings.map(b => [b.acquisitionId, b.acquisition])).values()];
    const inputs = acquisitions.flatMap(a => a.revisions.flatMap(r => r.inputs));
    // Read all manifest members, including siblings outside the caller's inventory scope.
    const evidenceIds = [...new Set([...acquisitions.flatMap(a => a.revisions.flatMap(r => r.members.map(m => m.evidenceId))), ...inputs.flatMap(x => x.evidenceId ? [x.evidenceId] : [])])];
    const liveEvidence = evidenceIds.length ? await tx.equipmentDNAEvidenceRecord.findMany({ where: { id: { in: evidenceIds } } }) : [];
    const liveById = new Map(liveEvidence.map(e => [e.id, e]));
    const ownership = evidenceIds.length ? await tx.acquisitionEvidenceBinding.findMany({ where: { evidenceId: { in: evidenceIds } } }) : [];
    const ownerById = new Map(ownership.map(row => [row.evidenceId, row.acquisitionId]));
    const liveDriftByRevision = new Map(acquisitions.flatMap(a => a.revisions.map(r => [r.id, r.members.some(m => {
        const live = liveById.get(m.evidenceId);
        return !live || acquisitionFingerprint(evidenceSemantics(live as unknown as Record<string, unknown>)) !== m.fingerprint;
    })] as const)));
    const lifecycleByAcquisition = new Map(acquisitions.map(a => [a.id, a.revisions.every((r, index, revisions) => {
        const prior = revisions[index - 1];
        return r.acquisitionId === a.id && acquisitionLifecycleMatches(r) && r.ordinal === index + 1 && (prior
            ? prior.sealed && prior.operation !== "withdraw" && r.predecessorId === prior.id && ["correct", "withdraw"].includes(r.operation)
            : r.predecessorId === null && ["capture", "register_existing"].includes(r.operation));
    })]));
    // Immutable stored history is required by every successor. Historical snapshots may
    // legitimately differ from live evidence after a correction, so live/endpoint drift
    // and declaration completeness are deliberately excluded from this chain gate.
    const storedIntegrity = new Map<string, { drift: boolean; reasons: string[] }>();
    for (const a of acquisitions) {
        let predecessorReasons: string[] = [];
        for (const r of a.revisions) {
            const payload = r.payload as unknown as { manifest: readonly unknown[]; inputs: readonly unknown[] };
            const members = r.members.map(m => ({ evidenceId: m.evidenceId, memberKey: m.memberKey, fingerprint: m.fingerprint })).sort((a, b) => a.evidenceId.localeCompare(b.evidenceId));
            const structureReasons = [...acquisitionStructureReasons(a, r), ...(r.members.some(m => m.acquisitionId !== a.id || m.revisionId !== r.id || ownerById.get(m.evidenceId) !== a.id) ? ["acquisition_binding_mismatch"] : []), ...(!acquisitionUpstreamMatches(payload, r.inputs) ? ["acquisition_upstream_mismatch"] : []), ...(!lifecycleByAcquisition.get(a.id) ? ["acquisition_lifecycle_mismatch"] : [])];
            const drift = structureReasons.length > 0 || !r.sealed || acquisitionFingerprint(payload) !== r.fingerprint || acquisitionFingerprint(members) !== acquisitionFingerprint(payload.manifest) || r.members.some(m => acquisitionFingerprint(m.snapshot) !== m.fingerprint) || acquisitionFingerprint(r.inputs.map(i => i.declaration).sort((a, b) => acquisitionFingerprint(a).localeCompare(acquisitionFingerprint(b)))) !== acquisitionFingerprint([...payload.inputs].sort((a, b) => acquisitionFingerprint(a).localeCompare(acquisitionFingerprint(b))));
            const reasons = [...new Set([...structureReasons, ...(drift ? ["registered_evidence_or_provenance_drift"] : []), ...predecessorReasons])];
            storedIntegrity.set(r.id, { drift: drift || predecessorReasons.length > 0, reasons });
            if (reasons.length) predecessorReasons = [...new Set([...reasons, "acquisition_predecessor_integrity_drift"])];
        }
    }
    const upstreamRevisions = inputs.some(x => x.targetRevisionId) ? await tx.evidenceAcquisitionRevision.findMany({ where: { id: { in: [...new Set(inputs.flatMap(x => x.targetRevisionId ? [x.targetRevisionId] : []))] } }, include: { successors: { select: { id: true } } } }) : [];
    const byId = new Map(bindings.map(x => [x.evidenceId, x]));
    return inventory.map(evidence => {
        const binding = byId.get(evidence.id);
        if (!binding)
            return { evidenceId: evidence.id, registration: "unbound" as const, latestRevisionId: null, currentRevisionId: null, history: [], reasons: ["legacy_or_unbound_evidence"], authority: acquisitionAuthority };
        const revisions = binding.acquisition.revisions;
        const latest = revisions.at(-1);
        if (!latest)
            throw new AcquisitionError("ACQUISITION_HISTORY_MISSING");
        const history = revisions.map(r => {
            const payload = r.payload as unknown as {
                packet: {
                    protocol: string;
                };
                declaration: ProvenanceDeclaration;
                manifest: readonly {
                    evidenceId: string;
                    memberKey: string;
                    fingerprint: string;
                }[];
                inputs: readonly {
                    type: string;
                    id?: string;
                    targetFingerprint?: string;
                }[];
            };
            const integrity = storedIntegrity.get(r.id)!;
            const structureReasons = integrity.reasons;
            const drift = integrity.drift;
            const member = r.members.find(m => m.evidenceId === evidence.id);
            const liveDrift = liveDriftByRevision.get(r.id) || (!!member && acquisitionFingerprint(evidenceSemantics(evidence as unknown as Record<string, unknown>)) !== member.fingerprint);
            const endpointReasons = payload.inputs.flatMap(input => { if (input.type === "evidence") {
                const e = liveById.get(input.id!.toLowerCase());
                return !e || acquisitionFingerprint(evidenceSemantics(e as unknown as Record<string, unknown>)) !== input.targetFingerprint ? ["upstream_evidence_drift"] : e.status !== "active" ? ["upstream_evidence_inactive"] : [];
            } if (input.type === "revision") {
                const u = upstreamRevisions.find(x => x.id === input.id?.toLowerCase());
                return !u?.sealed || u.fingerprint !== input.targetFingerprint ? ["upstream_revision_drift"] : u.operation === "withdraw" || u.successors.length ? ["upstream_revision_not_current"] : [];
            } return []; });
            const missingInstruments = payload.packet.protocol === "physical_measurement" && payload.manifest.some(m => !payload.declaration.instruments[m.memberKey]);
            const requiredActorMissing = payload.packet.protocol === "physical_measurement" ? !payload.declaration.operator : !payload.declaration.evaluator;
            const reasons = [...new Set([...provenanceReasons(payload.declaration), ...structureReasons, ...(requiredActorMissing ? ["protocol_actor_declaration_missing"] : []), ...endpointReasons, ...(missingInstruments ? ["instrument_declaration_missing"] : []), ...(drift || liveDrift ? ["registered_evidence_or_provenance_drift"] : []), ...(!member ? ["not_in_revision_manifest"] : []), ...(r.operation === "withdraw" ? ["provenance_withdrawn"] : []), ...(r.id !== latest.id ? ["provenance_superseded"] : [])])].sort();
            const consistent = !!member && !drift && !liveDrift && !endpointReasons.some(reason => reason.endsWith("_drift"));
            // Latest is recorded history; current additionally requires verified integrity.
            const current = r.id === latest.id && r.operation !== "withdraw" && consistent;
            return { revisionId: r.id, fingerprint: r.fingerprint, ordinal: r.ordinal, operation: r.operation, current, capturedAt: r.capturedAt.toISOString(), actorId: r.actorId, declaration: payload.declaration, manifest: payload.manifest, inputs: payload.inputs, ancestry: "not_evaluated" as const, complete: !!member && !drift && !liveDrift && provenanceReasons(payload.declaration).length === 0 && !missingInstruments && !requiredActorMissing, consistent, reasons };
        });
        const latestView = history.at(-1)!;
        return { evidenceId: evidence.id, registration: "registered_declaration" as const, latestRevisionId: latest.id, currentRevisionId: latestView.current ? latestView.revisionId : null, history, reasons: latestView.reasons, authority: acquisitionAuthority };
    });
}

