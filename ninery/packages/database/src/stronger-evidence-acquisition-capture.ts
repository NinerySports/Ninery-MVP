import { auditAcquisitionProvenance } from "./acquisition-provenance-integrity.js";
import { Prisma, type PrismaClient, type EquipmentDNAEvidenceRecord } from "@prisma/client";
import { buildPhysicalMeasurementEvidence, reviewPhysicalMeasurementSession, reviewProtocolV11CalibrationSession, physicalMeasurementTypes, physicalEvaluationProtocolV11Questions } from "@ninery/equipment-intelligence";
import { AcquisitionError, acquisitionId, acquisitionFingerprint, canonicalAcquisitionJSON, evidenceSemantics, exactEvidenceReplay, normalizeDeclaration, requireText, unavailableCaptureAuthorizer, acquisitionAuthority, provenanceReasons, type CaptureAuthorizer, type CaptureGrant, type CaptureAction, type CaptureCommand, type AcquisitionLifecycleCommand, type ProvenanceDeclaration, type ParticipantDeclaration } from "./acquisition-provenance.js";
type Tx = Prisma.TransactionClient;
const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(canonicalAcquisitionJSON(value)) as Prisma.InputJsonValue;
export type AcquisitionReceipt = {
    acquisitionId: string;
    revisionId: string;
    fingerprint: string;
    latestRevisionId: string;
    currentRevisionId: string | null;
    reasons: string[];
    current: boolean;
    withdrawn: boolean;
    replayed: boolean;
    authority: typeof acquisitionAuthority;
};
/** Only trusted application construction supplies the allowlist/authorizer. There is no credential/name fallback. */
export class StrongerEvidenceAcquisitionCaptureService {
    constructor(private readonly client: PrismaClient, private readonly authorizer: CaptureAuthorizer = unavailableCaptureAuthorizer, private readonly namespaceOwners: Readonly<Record<string, string>> = {}) { }
    private async authorize(namespace: string, credential: unknown, action: CaptureAction): Promise<CaptureGrant> {
        requireText(namespace);
        const issuer = Object.hasOwn(this.namespaceOwners, namespace) ? this.namespaceOwners[namespace] : undefined;
        const grant = issuer ? await this.authorizer.authorize(credential, namespace, action) : undefined;
        if (!grant || grant.namespace !== namespace || grant.issuer !== issuer || !grant.actions.includes(action))
            throw new AcquisitionError("CAPTURE_NOT_AUTHORIZED");
        requireText(grant.actorId);
        return grant;
    }
    async capture(command: CaptureCommand): Promise<AcquisitionReceipt> {
        const action = command.registerExisting ? "register_existing" : "capture";
        const grant = await this.authorize(command.namespace, command.credential, action);
        requireText(command.idempotencyKey);
        if (!["physical_measurement", "human_calibration"].includes(command.packet.protocol))
            throw new AcquisitionError("UNSUPPORTED_PROTOCOL");
        const declaration = normalizeDeclaration(command.declaration);
        const session = command.packet.session;
        const sessionKey = "measurementSessionId" in session ? session.measurementSessionId : session.sessionId;
        requireText(sessionKey);
        const rootId = acquisitionId({ namespace: command.namespace, family: command.packet.protocol, sessionKey });
        const commandFingerprint = acquisitionFingerprint({ action, actorId: grant.actorId, namespace: command.namespace, packet: command.packet, declaration });
        return this.transaction(async (tx) => {
            await this.lock(tx, rootId);
            const replay = await this.replay(tx, command.idempotencyKey, commandFingerprint);
            if (replay)
                return replay;
            const variant = await tx.equipmentVariant.findUnique({ where: { id: session.equipmentVariantId }, include: { equipment: true } });
            if (!variant || variant.equipmentId !== session.equipmentId || variant.lengthInches === null || variant.weightOunces === null || variant.dropWeight === null)
                throw new AcquisitionError("ACQUISITION_VARIANT_MISMATCH");
            await tx.$queryRaw `SELECT id FROM equipment WHERE id=${variant.equipmentId}::uuid FOR SHARE`;
            await tx.$queryRaw `SELECT id FROM equipment_variants WHERE id=${variant.id}::uuid FOR SHARE`;
            // Reread after locks so a waited catalog successor cannot be validated from stale facts.
            const locked = await tx.equipmentVariant.findUniqueOrThrow({ where: { id: variant.id }, include: { equipment: true } });
            if (locked.equipmentId !== session.equipmentId)
                throw new AcquisitionError("ACQUISITION_VARIANT_MISMATCH");
            if (locked.equipment.modelYear === null || locked.lengthInches === null || locked.weightOunces === null || locked.dropWeight === null)
                throw new AcquisitionError("CATALOG_IDENTITY_INCOMPLETE");
            const catalog = { equipmentId: locked.equipmentId, equipmentVariantId: locked.id, manufacturer: locked.equipment.manufacturer, model: locked.equipment.model, modelYear: locked.equipment.modelYear!, certification: locked.equipment.certification, nominalLengthInches: Number(locked.lengthInches), nominalWeightOunces: Number(locked.weightOunces), nominalDrop: locked.dropWeight! };
            let records: Record<string, unknown>[];
            if (command.packet.protocol === "physical_measurement") {
                const s = command.packet.session;
                const review = reviewPhysicalMeasurementSession(s, catalog);
                if (!review.persistenceEligible)
                    throw new AcquisitionError("PACKET_INCOMPLETE:" + review.blockers.join(","));
                const quality = new Map(review.blocks.map(x => [x.measurementType, x.quality]));
                records = s.measurementBlocks.map(block => { const r = buildPhysicalMeasurementEvidence(s, block, quality.get(block.measurementType)!); return { id: r.id, equipmentId: r.equipmentId, equipmentVariantId: r.equipmentVariantId, targetLevel: "variant", attributeKey: r.attributeKey, attributeDefinitionVersion: "physical-measurement-1.0", sourceType: "objective_measurement", sourceName: "Ninery Physical Measurement Protocol v1.0", sourceReference: r.sourceReference, sourceDate: new Date(r.sourceDate), method: "instrument_measurement", rawValue: r.rawValue, normalizedValue: r.normalizedValue, unit: r.unit, notes: "Immutable specimen-level direct physical measurement. Not eligible for behavioral inference, canonical evaluation, numeric behavioral references, or recommendations.", status: "active", evaluatorType: "staff", evaluatorReference: r.operatorId }; });
                this.checkInitialParticipant(declaration.operator, s.operatorId);
                this.checkInitialParticipant(declaration.specimen, s.specimenReference);
                for (const block of s.measurementBlocks)
                    this.checkInitialParticipant(declaration.instruments[block.measurementType], block.instrument.instrumentReference);
            }
            else {
                const s = command.packet.session;
                const v = s.physicalVerification;
                if (v.manufacturer !== catalog.manufacturer || v.model !== catalog.model || v.modelYear !== catalog.modelYear || v.certification !== catalog.certification || v.lengthInches !== catalog.nominalLengthInches || v.weightOunces !== catalog.nominalWeightOunces || v.dropWeight !== catalog.nominalDrop)
                    throw new AcquisitionError("VERIFICATION_CATALOG_MISMATCH");
                await tx.$queryRaw `SELECT pg_advisory_xact_lock(hashtextextended(${"evaluator:" + s.equipmentId + ":" + s.evaluator.evaluatorId},0))::text`;
                const prior = await tx.equipmentDNAEvidenceRecord.findMany({ where: { equipmentId: s.equipmentId, sourceReference: { startsWith: "physical-bat-evaluation:" } } });
                const existing = prior.flatMap(row => { const raw = row.rawValue as Record<string, unknown> | null; return row.equipmentId && row.sourceReference && row.evaluatorReference && typeof raw?.sessionId === "string" && typeof raw.protocolVersion === "string" ? [{ evidenceRecordId: row.id, equipmentId: row.equipmentId, evaluatorId: row.evaluatorReference, sessionId: raw.sessionId, protocolVersion: raw.protocolVersion, sourceReference: row.sourceReference, evaluatedAt: row.sourceDate?.toISOString() }] : []; });
                const review = reviewProtocolV11CalibrationSession(s, existing);
                if (!review.persistenceEligible)
                    throw new AcquisitionError("PACKET_INCOMPLETE:" + review.blockers.join(","));
                records = review.evidence.map(r => ({ id: r.id, equipmentId: r.equipmentId, equipmentVariantId: r.equipmentVariantId, targetLevel: "equipment", attributeKey: r.attributeKey, attributeDefinitionVersion: "1.0", sourceType: "structured_expert_evaluation", sourceName: "Ninery Physical Bat Evaluation Protocol v1.1 Calibration", sourceReference: r.sourceReference, sourceDate: new Date(r.evaluationDate), method: "standardized_rubric", rawValue: r.rawValue, notes: "Protocol v1.1 calibration evidence only. Excluded from canonical evaluation, numeric references, recommendations, and genuine transition activation.", status: "active", evaluatorType: "staff", evaluatorReference: r.evaluatorId }));
                this.checkInitialParticipant(declaration.evaluator, s.evaluator.evaluatorId);
            }
            // Native INSERT ... ON CONFLICT DO NOTHING waits for competing inserts without mutating immutable ownership.
            await tx.captureNamespace.createMany({ data: [{ id: command.namespace, issuer: grant.issuer }], skipDuplicates: true });
            const ns = await tx.captureNamespace.findUniqueOrThrow({ where: { id: command.namespace } });
            if (ns.issuer !== grant.issuer)
                throw new AcquisitionError("NAMESPACE_OWNER_CONFLICT");
            if (await tx.evidenceAcquisition.findUnique({ where: { id: rootId } }))
                throw new AcquisitionError("ACQUISITION_ALREADY_REGISTERED");
            await tx.evidenceAcquisition.create({ data: { id: rootId, namespaceId: command.namespace, protocolFamily: command.packet.protocol, sessionKey, equipmentId: session.equipmentId, equipmentVariantId: session.equipmentVariantId } });
            const rows: EquipmentDNAEvidenceRecord[] = [];
            for (const data of records.sort((a, b) => String(a.id).localeCompare(String(b.id)))) {
                await tx.$queryRaw `SELECT pg_advisory_xact_lock(hashtextextended(${"evidence:" + String(data.id)},0))::text`;
                await tx.$queryRaw `SELECT id FROM equipment_dna_evidence_records WHERE id=${String(data.id)}::uuid FOR UPDATE`;
                const existing = await tx.equipmentDNAEvidenceRecord.findUnique({ where: { id: String(data.id) } });
                if (existing) {
                    if (!exactEvidenceReplay(existing as unknown as Record<string, unknown>, data))
                        throw new AcquisitionError("EVIDENCE_REPLAY_CONFLICT");
                    rows.push(existing);
                }
                else {
                    if (command.registerExisting)
                        throw new AcquisitionError("EXISTING_PACKET_REQUIRED");
                    if (await tx.equipmentDNAEvidenceRecord.findFirst({ where: { sourceReference: String(data.sourceReference) } }))
                        throw new AcquisitionError("EVIDENCE_SOURCE_COLLISION");
                    const clean = { ...data, rawValue: json(data.rawValue), normalizedValue: data.normalizedValue === undefined ? Prisma.DbNull : json(data.normalizedValue) };
                    rows.push(await tx.equipmentDNAEvidenceRecord.create({ data: clean as unknown as Prisma.EquipmentDNAEvidenceRecordUncheckedCreateInput }));
                }
                const binding = await tx.acquisitionEvidenceBinding.findUnique({ where: { evidenceId: String(data.id) } });
                if (binding && binding.acquisitionId !== rootId)
                    throw new AcquisitionError("EVIDENCE_OWNER_CONFLICT");
                await tx.acquisitionEvidenceBinding.create({ data: { evidenceId: String(data.id), acquisitionId: rootId } });
            }
            return this.append(tx, { rootId, namespace: command.namespace, family: command.packet.protocol, actorId: grant.actorId, key: command.idempotencyKey, commandFingerprint, declaration, rows, operation: action, ordinal: 1, packet: command.packet });
        });
    }
    async revise(command: AcquisitionLifecycleCommand): Promise<AcquisitionReceipt> {
        const grant = await this.authorize(command.namespace, command.credential, command.action);
        requireText(command.idempotencyKey);
        const declaration = normalizeDeclaration(command.declaration);
        const commandFingerprint = acquisitionFingerprint({ action: command.action, namespace: command.namespace, actorId: grant.actorId, acquisitionId: command.acquisitionId, expectedRevisionId: command.expectedRevisionId, declaration, evidenceIds: command.evidenceIds ? [...command.evidenceIds].sort() : null });
        return this.transaction(async (tx) => {
            await this.lock(tx, command.acquisitionId);
            const replay = await this.replay(tx, command.idempotencyKey, commandFingerprint);
            if (replay)
                return replay;
            const root = await tx.evidenceAcquisition.findUniqueOrThrow({ where: { id: command.acquisitionId }, include: { namespace: true } });
            if (root.namespace.issuer !== grant.issuer)
                throw new AcquisitionError("NAMESPACE_OWNER_CONFLICT");
            if (root.namespaceId !== command.namespace)
                throw new AcquisitionError("NAMESPACE_SCOPE_CONFLICT");
            const prior = await tx.evidenceAcquisitionRevision.findFirstOrThrow({ where: { acquisitionId: root.id }, orderBy: { ordinal: "desc" }, include: { members: true } });
            if (prior.id !== command.expectedRevisionId)
                throw new AcquisitionError("STALE_PREDECESSOR");
            if (prior.operation === "withdraw")
                throw new AcquisitionError("ACQUISITION_WITHDRAWN");
            if (!prior.sealed || acquisitionFingerprint(prior.payload) !== prior.fingerprint || prior.members.some(m => acquisitionFingerprint(m.snapshot) !== m.fingerprint))
                throw new AcquisitionError("ACQUISITION_HISTORY_DRIFT");
            const payload = prior.payload as unknown as {
                packet: CaptureCommand["packet"];
                declaration: ProvenanceDeclaration;
            };
            if (command.action === "withdraw" && command.evidenceIds)
                throw new AcquisitionError("WITHDRAWAL_MANIFEST_IMMUTABLE");
            const ids = command.evidenceIds ? [...command.evidenceIds] : prior.members.map(x => x.evidenceId);
            if (new Set(ids).size !== ids.length)
                throw new AcquisitionError("DUPLICATE_MANIFEST");
            const rows = await tx.equipmentDNAEvidenceRecord.findMany({ where: { id: { in: ids } }, orderBy: { id: "asc" } });
            if (rows.length !== ids.length)
                throw new AcquisitionError("MISSING_MANIFEST_EVIDENCE");
            for (const row of rows) {
                const binding = await tx.acquisitionEvidenceBinding.findUnique({ where: { evidenceId: row.id } });
                if (binding?.acquisitionId !== root.id)
                    throw new AcquisitionError("EVIDENCE_OWNER_CONFLICT");
            }
            if (command.action === "withdraw" && canonicalAcquisitionJSON({ ...declaration, reason: "" }) !== canonicalAcquisitionJSON({ ...payload.declaration, reason: "" }))
                throw new AcquisitionError("WITHDRAWAL_DECLARATION_CHANGED");
            return this.append(tx, { rootId: root.id, namespace: root.namespaceId, family: root.protocolFamily, actorId: grant.actorId, key: command.idempotencyKey, commandFingerprint, declaration, rows, operation: command.action, ordinal: prior.ordinal + 1, predecessorId: prior.id, packet: payload.packet });
        });
    }
    private checkInitialParticipant(p: ParticipantDeclaration | undefined, key: string) { if (!p || (p.state === "registered_declaration" && p.key !== key))
        throw new AcquisitionError("PARTICIPANT_ASSERTION_MISMATCH"); }
    private async lock(tx: Tx, id: string) { await tx.$queryRaw `SELECT pg_advisory_xact_lock(hashtextextended(${"acquisition:" + id},0))::text`; }
    private async replay(tx: Tx, key: string, fingerprint: string): Promise<AcquisitionReceipt | undefined> { const r = await tx.evidenceAcquisitionRevision.findUnique({ where: { idempotencyKey: key } }); if (!r)
        return; if (r.commandFingerprint !== fingerprint)
        throw new AcquisitionError("IDEMPOTENCY_CONFLICT"); return this.receipt(tx, r, true); }
    private async transaction<T>(operation: (tx: Tx) => Promise<T>): Promise<T> {
        // A retry restarts the entire snapshot after a concurrent winner; it never edits history.
        for (let attempt = 0; ; attempt++) {
            try { return await this.client.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, maxWait: 30000, timeout: 30000 }); }
            catch (error) {
                if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034" || attempt >= 4) throw error;
            }
        }
    }
    private async receipt(tx: Tx, r: { id: string; acquisitionId: string; fingerprint: string; operation: string }, replayed: boolean): Promise<AcquisitionReceipt> {
        const latest = await tx.evidenceAcquisitionRevision.findFirstOrThrow({ where: { acquisitionId: r.acquisitionId }, orderBy: { ordinal: "desc" } });
        const rows = await tx.equipmentDNAEvidenceRecord.findMany({ where: { acquisitionBinding: { acquisitionId: r.acquisitionId } } });
        const views = await auditAcquisitionProvenance(tx, rows);
        const current = views.length > 0 && views.every(view => view.currentRevisionId === r.id);
        const reasons = [...new Set(views.flatMap(view => view.history.find(revision => revision.revisionId === r.id)?.reasons ?? view.reasons))].sort();
        if (!views.length) reasons.push("acquisition_manifest_missing");
        return { acquisitionId: r.acquisitionId, revisionId: r.id, fingerprint: r.fingerprint, latestRevisionId: latest.id, currentRevisionId: current ? r.id : null, reasons, current, withdrawn: latest.operation === "withdraw", replayed, authority: acquisitionAuthority };
    }
    private async participant(tx: Tx, p: ParticipantDeclaration | undefined, namespace: string, actorId: string, root: {
        equipmentId: string;
        equipmentVariantId: string;
    }): Promise<string | null> {
        if (!p || p.state !== "registered_declaration")
            return null;
        const id = acquisitionId({ namespace, kind: p.kind, key: p.key });
        const data = { id, namespaceId: namespace, kind: p.kind, localKey: p.key!, registeredBy: actorId, ...(p.kind === "specimen" ? { equipmentId: root.equipmentId, equipmentVariantId: root.equipmentVariantId } : {}) };
        await tx.acquisitionParticipant.createMany({ data: [data], skipDuplicates: true });
        const existing = await tx.acquisitionParticipant.findUniqueOrThrow({ where: { id } });
        if (existing.namespaceId !== namespace || existing.kind !== p.kind || existing.localKey !== p.key || (p.kind === "specimen" && (existing.equipmentId !== root.equipmentId || existing.equipmentVariantId !== root.equipmentVariantId)))
            throw new AcquisitionError("PARTICIPANT_IDENTITY_CONFLICT");
        return id;
    }
    private async append(tx: Tx, c: {
        rootId: string;
        namespace: string;
        family: string;
        actorId: string;
        key: string;
        commandFingerprint: string;
        declaration: ProvenanceDeclaration;
        rows: EquipmentDNAEvidenceRecord[];
        operation: string;
        ordinal: number;
        predecessorId?: string;
        packet: CaptureCommand["packet"];
    }): Promise<AcquisitionReceipt> {
        const root = await tx.evidenceAcquisition.findUniqueOrThrow({ where: { id: c.rootId } });
        const key = (r: EquipmentDNAEvidenceRecord) => c.family === "human_calibration" ? String((r.rawValue as Record<string, unknown>)?.dimensionKey) : r.attributeKey;
        const expected: readonly string[] = c.family === "human_calibration" ? physicalEvaluationProtocolV11Questions.map(x => x.dimensionKey) : physicalMeasurementTypes;
        const manifest = c.rows.map(row => ({ evidenceId: row.id, memberKey: key(row), fingerprint: acquisitionFingerprint(evidenceSemantics(row as unknown as Record<string, unknown>)) })).sort((a, b) => a.evidenceId.localeCompare(b.evidenceId));
        if (manifest.length !== expected.length || new Set(manifest.map(x => x.memberKey)).size !== expected.length || expected.some(k => !manifest.some(m => m.memberKey === k)))
            throw new AcquisitionError("MANIFEST_INCOMPLETE");
        for (const row of c.rows)
            if (row.equipmentId !== root.equipmentId || row.equipmentVariantId !== root.equipmentVariantId)
                throw new AcquisitionError("MANIFEST_SCOPE_CONFLICT");
        if (Object.keys(c.declaration.instruments).some(k => !expected.includes(k)))
            throw new AcquisitionError("UNKNOWN_INSTRUMENT_MEMBER");
        const specimenId = await this.participant(tx, c.declaration.specimen, c.namespace, c.actorId, root), operatorId = await this.participant(tx, c.declaration.operator, c.namespace, c.actorId, root), evaluatorId = await this.participant(tx, c.declaration.evaluator, c.namespace, c.actorId, root);
        const resolved = [];
        for (const input of c.declaration.upstream.inputs) {
            if (input.type === "evidence") {
                const e = await tx.equipmentDNAEvidenceRecord.findUnique({ where: { id: input.id! } });
                if (!e || e.equipmentId !== root.equipmentId || c.rows.some(x => x.id === e.id))
                    throw new AcquisitionError("UPSTREAM_ENDPOINT_UNRESOLVED");
                resolved.push({ ...input, targetFingerprint: acquisitionFingerprint(evidenceSemantics(e as unknown as Record<string, unknown>)) });
            }
            else if (input.type === "revision") {
                const r = await tx.evidenceAcquisitionRevision.findUnique({ where: { id: input.id! }, include: { acquisition: true } });
                if (!r?.sealed || r.acquisition.equipmentId !== root.equipmentId || r.acquisitionId === root.id)
                    throw new AcquisitionError("UPSTREAM_ENDPOINT_UNRESOLVED");
                resolved.push({ ...input, targetFingerprint: r.fingerprint });
            }
            else
                resolved.push(input);
        }
        const payload = { version: "1.0", namespace: c.namespace, acquisitionId: root.id, operation: c.operation, ordinal: c.ordinal, predecessorId: c.predecessorId ?? null, actorId: c.actorId, packet: c.packet, declaration: c.declaration, manifest, inputs: resolved, ancestry: "not_evaluated" };
        const fingerprint = acquisitionFingerprint(payload), id = acquisitionId({ revision: c.key, commandFingerprint: c.commandFingerprint });
        const revision = await tx.evidenceAcquisitionRevision.create({ data: { id, acquisitionId: root.id, ordinal: c.ordinal, predecessorId: c.predecessorId, operation: c.operation, actorId: c.actorId, idempotencyKey: c.key, commandFingerprint: c.commandFingerprint, fingerprint, payload: json(payload), expectedCount: manifest.length, specimenId, operatorId, evaluatorId } });
        for (const member of manifest) {
            const row = c.rows.find(x => x.id === member.evidenceId)!;
            const instrumentId = await this.participant(tx, c.declaration.instruments[member.memberKey], c.namespace, c.actorId, root);
            await tx.acquisitionEvidenceMember.create({ data: { revisionId: id, acquisitionId: root.id, ...member, snapshot: json(evidenceSemantics(row as unknown as Record<string, unknown>)), instrumentId } });
        }
        for (const [i, input] of resolved.entries())
            await tx.acquisitionInputDeclaration.create({ data: { id: acquisitionId({ revision: id, input: i }), revisionId: id, kind: input.type, evidenceId: input.type === "evidence" ? input.id : undefined, targetRevisionId: input.type === "revision" ? input.id : undefined, declaration: json(input) } });
        await tx.evidenceAcquisitionRevision.update({ where: { id }, data: { sealed: true } });
        return this.receipt(tx, revision, false);
    }
}
/** No provider is configured by default. Actual CLI commits fail closed until trusted application integration exists. */
export function operationalAcquisitionCapture(client: PrismaClient) { return new StrongerEvidenceAcquisitionCaptureService(client); }
export { provenanceReasons };

