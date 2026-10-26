import { createHash } from "node:crypto";
import { physicalMeasurementTypes, physicalEvaluationProtocolV11Questions } from "@ninery/equipment-intelligence";
import type { PhysicalMeasurementSession, PhysicalEvaluationProtocolV11CalibrationSessionInput } from "@ninery/equipment-intelligence";
export const ACQUISITION_PROVENANCE_VERSION = "1.0" as const;
export type CaptureAction = "capture" | "register_existing" | "correct" | "withdraw";
export type CaptureGrant = {
    readonly actorId: string;
    readonly namespace: string;
    readonly issuer: string;
    readonly actions: readonly CaptureAction[];
};
export interface CaptureAuthorizer {
    authorize(credential: unknown, namespace: string, action: CaptureAction): Promise<CaptureGrant | undefined>;
}
export const unavailableCaptureAuthorizer: CaptureAuthorizer = { async authorize() { return undefined; } };
export type ParticipantDeclaration = {
    readonly kind: "specimen" | "instrument" | "person";
    readonly key?: string;
    readonly state: "registered_declaration" | "unresolved";
    readonly label?: string;
};
export type AcquisitionInput = {
    readonly type: "evidence" | "revision" | "unresolved";
    readonly id?: string;
    readonly reference?: string;
    readonly basis: string;
};
export type ProvenanceDeclaration = {
    readonly supplier: string;
    readonly reason: string;
    readonly specimen: ParticipantDeclaration;
    readonly operator?: ParticipantDeclaration;
    readonly evaluator?: ParticipantDeclaration;
    readonly instruments: Readonly<Record<string, ParticipantDeclaration>>;
    readonly upstream: {
        readonly state: "not_declared" | "declared_inputs" | "declared_no_known_inputs";
        readonly rationale?: string;
        readonly inputs: readonly AcquisitionInput[];
    };
    readonly conditions: Readonly<Record<string, unknown>>;
    readonly limitations: readonly string[];
};
export type CapturePacket = {
    readonly protocol: "physical_measurement";
    readonly session: PhysicalMeasurementSession;
} | {
    readonly protocol: "human_calibration";
    readonly session: PhysicalEvaluationProtocolV11CalibrationSessionInput;
};
export type CaptureCommand = {
    readonly namespace: string;
    readonly credential: unknown;
    readonly idempotencyKey: string;
    readonly declaration: ProvenanceDeclaration;
    readonly packet: CapturePacket;
    readonly registerExisting?: boolean;
};
export type AcquisitionLifecycleCommand = {
    readonly namespace: string;
    readonly credential: unknown;
    readonly idempotencyKey: string;
    readonly acquisitionId: string;
    readonly expectedRevisionId: string;
    readonly action: "correct" | "withdraw";
    readonly declaration: ProvenanceDeclaration;
    readonly evidenceIds?: readonly string[];
};
export class AcquisitionError extends Error {
    constructor(readonly code: string) { super(code); this.name = "AcquisitionError"; }
}
export function requireText(value: unknown, code = "INVALID_TEXT"): asserts value is string { if (typeof value !== "string" || !value.trim() || value !== value.trim() || value.includes("<"))
    throw new AcquisitionError(code); }
export function canonicalAcquisitionJSON(value: unknown): string {
    if (value instanceof Date)
        return JSON.stringify(value.toISOString());
    if (typeof value === "number" && !Number.isFinite(value))
        throw new AcquisitionError("NON_FINITE_NUMBER");
    if (Array.isArray(value))
        return "[" + value.map(item => { if (item === undefined)
            throw new AcquisitionError("UNDEFINED_ARRAY_ITEM"); return canonicalAcquisitionJSON(item); }).join(",") + "]";
    if (value && typeof value === "object")
        return "{" + Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => JSON.stringify(k) + ":" + canonicalAcquisitionJSON(v)).join(",") + "}";
    if (value === undefined || typeof value === "bigint" || typeof value === "function" || typeof value === "symbol")
        throw new AcquisitionError("UNSUPPORTED_JSON_VALUE");
    return JSON.stringify(value);
}
export function acquisitionFingerprint(value: unknown): string { return createHash("sha256").update(canonicalAcquisitionJSON({ version: ACQUISITION_PROVENANCE_VERSION, value })).digest("hex"); }
export function acquisitionId(value: unknown): string { const h = acquisitionFingerprint(value).slice(0, 32); return h.slice(0, 8) + "-" + h.slice(8, 12) + "-5" + h.slice(13, 16) + "-a" + h.slice(17, 20) + "-" + h.slice(20); }
export function normalizeDeclaration(input: ProvenanceDeclaration): ProvenanceDeclaration {
    const keys=(value:object,allowed:readonly string[])=>{if(Object.keys(value).some(k=>!allowed.includes(k)))throw new AcquisitionError("UNKNOWN_DECLARATION_FIELD");};
    if(!input || typeof input!=="object")throw new AcquisitionError("INVALID_DECLARATION");
    keys(input,["supplier","reason","specimen","operator","evaluator","instruments","upstream","conditions","limitations"]);
    requireText(input.supplier);
    requireText(input.reason);
    const participant = (p: ParticipantDeclaration, kind: ParticipantDeclaration["kind"]) => {
        if (!p || p.kind !== kind || !["registered_declaration", "unresolved"].includes(p.state))
            throw new AcquisitionError("INVALID_PARTICIPANT");
        if (p.state === "registered_declaration")
            requireText(p.key, "PARTICIPANT_KEY_REQUIRED");
        if (p.key !== undefined)
            requireText(p.key);
        if (p.label !== undefined)
            requireText(p.label);
        keys(p,["kind","key","state","label"]);
        return p;
    };
    participant(input.specimen, "specimen");
    if (input.operator)
        participant(input.operator, "person");
    if (input.evaluator)
        participant(input.evaluator, "person");
    if (!input.instruments || !input.conditions || Array.isArray(input.conditions) || !Array.isArray(input.limitations))
        throw new AcquisitionError("INVALID_DECLARATION");
    for (const [key, p] of Object.entries(input.instruments)) {
        requireText(key);
        participant(p, "instrument");
    }
    if (!input.upstream || !["not_declared", "declared_inputs", "declared_no_known_inputs"].includes(input.upstream.state) || !Array.isArray(input.upstream.inputs) || input.upstream.inputs.length > 64)
        throw new AcquisitionError("INVALID_UPSTREAM");
    if ((input.upstream.state === "declared_inputs") !== (input.upstream.inputs.length > 0))
        throw new AcquisitionError("INVALID_UPSTREAM_STATE");
    if (input.upstream.state === "declared_no_known_inputs")
        requireText(input.upstream.rationale, "UPSTREAM_RATIONALE_REQUIRED");
    keys(input.upstream,["state","rationale","inputs"]);
    for (const p of input.upstream.inputs) {
        keys(p,["type","id","reference","basis"]);
        requireText(p.basis);
        if (!["evidence", "revision", "unresolved"].includes(p.type))
            throw new AcquisitionError("INVALID_ENDPOINT");
        if (p.type === "unresolved") {
            requireText(p.reference);
            if (p.id !== undefined)
                throw new AcquisitionError("INVALID_ENDPOINT");
        }
        else {
            if (!/^[0-9a-f-]{36}$/i.test(p.id ?? ""))
                throw new AcquisitionError("INVALID_ENDPOINT");
            if (p.reference !== undefined)
                throw new AcquisitionError("INVALID_ENDPOINT");
        }
    }
    const inputs = [...input.upstream.inputs].sort((a, b) => canonicalAcquisitionJSON(a).localeCompare(canonicalAcquisitionJSON(b)));
    if (new Set(inputs.map(x => canonicalAcquisitionJSON(x))).size !== inputs.length)
        throw new AcquisitionError("DUPLICATE_ENDPOINT");
    for (const s of input.limitations)
        requireText(s);
    const result = { ...input, limitations: [...new Set(input.limitations)].sort(), upstream: { ...input.upstream, inputs } };
    canonicalAcquisitionJSON(result);
    return JSON.parse(canonicalAcquisitionJSON(result)) as ProvenanceDeclaration;
}
/** Persisted fields only. Status is a separate lifecycle restriction, never an observation rewrite. */
export function evidenceSemantics(row: Record<string, unknown>) {
    const names = ["id", "equipmentId", "equipmentVariantId", "targetLevel", "attributeKey", "attributeDefinitionVersion", "sourceType", "sourceName", "sourceReference", "sourceDate", "retrievedAt", "method", "rawValue", "normalizedValue", "unit", "notes", "evaluatorType", "evaluatorReference"];
    return Object.fromEntries(names.map(key => [key, row[key] ?? null]));
}
export function exactEvidenceReplay(left: Record<string, unknown>, right: Record<string, unknown>): boolean { return canonicalAcquisitionJSON(evidenceSemantics(left)) === canonicalAcquisitionJSON(evidenceSemantics(right)); }
export function provenanceReasons(d: ProvenanceDeclaration): string[] { return [...(d.specimen.state === "unresolved" ? ["specimen_unresolved"] : []), ...(!d.operator && !d.evaluator ? ["actor_unresolved"] : []), ...[d.operator, d.evaluator, ...Object.values(d.instruments)].flatMap(p => p?.state === "unresolved" ? ["participant_unresolved"] : []), ...(d.upstream.state === "not_declared" ? ["upstream_not_declared"] : []), ...d.upstream.inputs.flatMap(p => p.type === "unresolved" ? ["upstream_unresolved"] : [])].filter((v, i, a) => a.indexOf(v) === i).sort(); }
export const acquisitionAuthority = { independentlyVerified: false, independenceEstablished: false, comparabilityGranted: false, sufficiencyGranted: false, synthesisGranted: false, recommendationGranted: false, directContributionGranted: false } as const;


/** Structural audit only: a registered identity never proves physical identity or independence. */
type RegistryParticipant = { id: string; namespaceId: string; kind: string; localKey: string; equipmentId: string | null; equipmentVariantId: string | null };
type AcquisitionScope = { id: string; namespaceId: string; protocolFamily: string; sessionKey: string; equipmentId: string; equipmentVariantId: string };
export function acquisitionStructureReasons(a: AcquisitionScope, r: {
    expectedCount: number; payload: unknown;
    specimenId: string | null; operatorId: string | null; evaluatorId: string | null;
    specimen: RegistryParticipant | null; operator: RegistryParticipant | null; evaluator: RegistryParticipant | null;
    members: readonly { memberKey: string; snapshot: unknown; instrumentId: string | null; instrument: RegistryParticipant | null }[];
}): string[] {
    const p = r.payload as { version: string; namespace: string; acquisitionId: string; packet: CapturePacket; declaration: ProvenanceDeclaration };
    const s = p.packet?.session;
    const physical = a.protocolFamily === "physical_measurement";
    const expected: readonly string[] = physical ? physicalMeasurementTypes : a.protocolFamily === "human_calibration" ? physicalEvaluationProtocolV11Questions.map(q => q.dimensionKey) : [];
    const version = physical ? "1.0" : "1.1";
    const protocolValid = s && p.version === "1.0" && p.namespace === a.namespaceId && p.acquisitionId === a.id && p.packet.protocol === a.protocolFamily && s.protocolVersion === version && s.equipmentId === a.equipmentId && s.equipmentVariantId === a.equipmentVariantId && (physical ? "measurementSessionId" in s && s.measurementSessionId === a.sessionKey && s.protocol === "ninery_physical_measurement" : "sessionId" in s && s.sessionId === a.sessionKey && s.questionnaireVersion === "1.1");
    const membershipValid = expected.length > 0 && r.expectedCount === expected.length && r.members.length === expected.length && new Set(r.members.map(m => m.memberKey)).size === expected.length && expected.every(k => r.members.some(m => m.memberKey === k)) && r.members.every(m => {
        const e = m.snapshot as Record<string, unknown>; const raw = e.rawValue as Record<string, unknown> | null;
        const attribute = physical ? m.memberKey : physicalEvaluationProtocolV11Questions.find(q => q.dimensionKey === m.memberKey)?.attributeKey;
        return e.equipmentId === a.equipmentId && e.equipmentVariantId === a.equipmentVariantId && e.attributeKey === attribute && raw?.protocolVersion === version && e.attributeDefinitionVersion === (physical ? "physical-measurement-1.0" : "1.0") && e.sourceType === (physical ? "objective_measurement" : "structured_expert_evaluation") && e.method === (physical ? "instrument_measurement" : "standardized_rubric") && e.targetLevel === (physical ? "variant" : "equipment") && (physical ? raw.measurementSessionId === a.sessionKey && raw.measurementType === m.memberKey && raw.protocol === "ninery_physical_measurement" : raw.sessionId === a.sessionKey && raw.dimensionKey === m.memberKey && raw.questionnaireVersion === "1.1") && e.sourceReference === (physical ? "physical-measurement:1.0:" : "physical-bat-evaluation:1.1:") + a.sessionKey + ":" + m.memberKey;
    });
    const matches = (d: ParticipantDeclaration | undefined, id: string | null, row: RegistryParticipant | null, kind: ParticipantDeclaration["kind"]) => !d ? id === null && row === null : d.kind === kind && (d.state === "unresolved" ? id === null && row === null : d.state === "registered_declaration" && !!d.key?.trim() && row?.id === id && row.namespaceId === a.namespaceId && row.kind === kind && row.localKey === d.key && (kind !== "specimen" || row.equipmentId === a.equipmentId && row.equipmentVariantId === a.equipmentVariantId));
    const d = p.declaration;
    const specimenValid = !!d?.specimen && matches(d.specimen, r.specimenId, r.specimen, "specimen");
    const participantsValid = specimenValid && !!(physical ? d?.operator : d?.evaluator) && matches(d.operator, r.operatorId, r.operator, "person") && matches(d.evaluator, r.evaluatorId, r.evaluator, "person") && !!d.instruments && Object.keys(d.instruments).every(k => expected.includes(k)) && r.members.every(m => (!physical || !!d.instruments[m.memberKey]) && matches(d.instruments[m.memberKey], m.instrumentId, m.instrument, "instrument"));
    return [...(!protocolValid || !membershipValid ? ["protocol_manifest_incomplete"] : []), ...(!participantsValid ? ["participant_registry_mismatch"] : []), ...(!specimenValid ? ["specimen_unresolved"] : [])];
}

/** The payload is retained verbatim; disagreement with lifecycle columns is corruption. */
export function acquisitionLifecycleMatches(r: {
    acquisitionId: string; ordinal: number; predecessorId: string | null; operation: string; actorId: string; payload: unknown;
}): boolean {
    const p = r.payload as Record<string, unknown> | null;
    return !!p && p.acquisitionId === r.acquisitionId && p.operation === r.operation && p.ordinal === r.ordinal && p.predecessorId === r.predecessorId && p.actorId === r.actorId && !!r.actorId.trim();
}

/** Resolution may add only a fingerprint; it cannot substitute supplier endpoints or basis. */
export function acquisitionUpstreamMatches(payload: unknown, rows: readonly { kind: string; evidenceId: string | null; targetRevisionId: string | null; declaration: unknown }[]): boolean {
    const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
    const text = (value: unknown): value is string => typeof value === "string" && !!value.trim() && value === value.trim() && !value.includes("<");
    const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    const shape = (value: unknown, resolved: boolean): value is Record<string, unknown> => {
        if (!object(value) || Object.keys(value).some(k => !["type", "id", "reference", "basis", ...(resolved ? ["targetFingerprint"] : [])].includes(k)) || !text(value.basis)) return false;
        if (value.type === "unresolved") return text(value.reference) && !Object.hasOwn(value, "id") && !Object.hasOwn(value, "targetFingerprint");
        return ["evidence", "revision"].includes(String(value.type)) && uuid(value.id) && !Object.hasOwn(value, "reference") && (!resolved || typeof value.targetFingerprint === "string" && /^[0-9a-f]{64}$/.test(value.targetFingerprint));
    };
    if (!object(payload) || !object(payload.declaration) || !object(payload.declaration.upstream)) return false;
    const upstream = payload.declaration.upstream;
    if (Object.keys(upstream).some(k => !["state", "rationale", "inputs"].includes(k)) || !["not_declared", "declared_inputs", "declared_no_known_inputs"].includes(String(upstream.state)) || !Array.isArray(upstream.inputs) || !Array.isArray(payload.inputs)) return false;
    if (upstream.inputs.length > 64 || (upstream.state === "declared_inputs") !== (upstream.inputs.length > 0) || upstream.state === "declared_no_known_inputs" && !text(upstream.rationale)) return false;
    const declared = upstream.inputs, resolved = payload.inputs;
    if (!declared.every(input => shape(input, false)) || !resolved.every(input => shape(input, true))) return false;
    const sorted = (items: readonly unknown[]) => items.map(item => canonicalAcquisitionJSON(item)).sort();
    const declarationKeys = sorted(declared);
    if (new Set(declarationKeys).size !== declarationKeys.length || canonicalAcquisitionJSON(declarationKeys) !== canonicalAcquisitionJSON(sorted(resolved.map(input => { const { targetFingerprint, ...declaration } = input; return declaration; })))) return false;
    if (canonicalAcquisitionJSON(sorted(rows.map(row => row.declaration))) !== canonicalAcquisitionJSON(sorted(resolved))) return false;
    return rows.every(row => {
        const input = row.declaration;
        if (!shape(input, true) || row.kind !== input.type) return false;
        if (input.type === "evidence") return row.targetRevisionId === null && row.evidenceId?.toLowerCase() === String(input.id).toLowerCase();
        if (input.type === "revision") return row.evidenceId === null && row.targetRevisionId?.toLowerCase() === String(input.id).toLowerCase();
        return row.evidenceId === null && row.targetRevisionId === null;
    });
}
