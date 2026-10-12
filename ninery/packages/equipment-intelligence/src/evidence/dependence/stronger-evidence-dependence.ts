import { STRONGER_EVIDENCE_DEPENDENCE_VERSION, type DependenceBasis, type DependenceEdge, type DependenceNode, type DependenceReason, type DependenceRelationshipKind, type StrongerEvidenceDependenceInput, type StrongerEvidenceDependenceResult } from "./stronger-evidence-dependence.types.js";

type Reference = { kind: DependenceRelationshipKind; path: string; value: string; namespace: string };
const object = (value: unknown): Record<string, unknown> | undefined => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const text = (value: unknown): value is string => typeof value === "string" && !!value.trim() && !value.includes("<");
const sorted = <T extends string>(values: readonly T[]): T[] => [...new Set(values)].sort();

export function assessStrongerEvidenceDependence(input: StrongerEvidenceDependenceInput): StrongerEvidenceDependenceResult {
  const groups = new Map<string, typeof input.contextRecords[number][]>();
  for (const record of input.contextRecords) groups.set(record.id, [...(groups.get(record.id) ?? []), record]);
  const nodes: DependenceNode[] = [];
  const links: { from: string; to: string; reference: string }[] = [];
  const references = new Map<string, Reference[]>();
  for (const id of sorted([...groups.keys(), ...input.assessments.map(item => item.evidenceRecordId)])) {
    const records = groups.get(id) ?? [];
    const assessments = input.assessments.filter(item => item.evidenceRecordId === id);
    const assessment = assessments.length === 1 ? assessments[0] : undefined;
    const reasons: DependenceReason[] = ["source_independence_not_established"];
    const refs: Reference[] = [];
    if (records.length !== 1 || assessments.length > 1) reasons.push(records.length ? "duplicate_identity_conflict" : "missing_provenance");
    const record = records.length === 1 ? records[0] : undefined;
    const raw = object(record?.rawValue);
    if (record?.equipmentId !== input.request.equipmentId || (record.equipmentVariantId && record.equipmentVariantId !== input.request.equipmentVariantId)) reasons.push("scope_mismatch");
    const add = (kind: DependenceRelationshipKind, path: string, value: unknown, namespace: string, required = false) => {
      if (value === undefined || value === null) { if (required) reasons.push("missing_provenance"); }
      else if (!text(value)) reasons.push("malformed_provenance");
      else refs.push({ kind, path, value, namespace });
    };
    const verifyAcquisitionIdentity = (prefix: string, session: unknown, dimension: unknown) => {
      if (!text(record?.sourceReference) || !text(session) || !text(dimension)) {
        reasons.push("malformed_provenance");
      } else if (record.sourceReference !== `${prefix}:${session}:${dimension}`) {
        reasons.push("conflicting_provenance");
      }
    };
    if (!raw) reasons.push("missing_provenance");
    else if (record?.sourceType === "structured_expert_evaluation" && raw.protocolVersion === "1.1") {
      const evaluator = object(raw.evaluator);
      if (record.evaluatorReference !== evaluator?.evaluatorId) reasons.push("conflicting_provenance");
      add("shared_evaluator", "evaluatorReference", record.evaluatorReference, "human-evaluator", true);
      add("shared_session", "rawValue.sessionId", raw.sessionId, "physical-evaluation:1.1", true);
      if (raw.measurementSessionId !== undefined) reasons.push("conflicting_provenance");
      verifyAcquisitionIdentity("physical-bat-evaluation:1.1", raw.sessionId, raw.dimensionKey);
    } else if (record?.sourceType === "objective_measurement" && raw.protocol === "ninery_physical_measurement" && raw.protocolVersion === "1.0") {
      if (record.evaluatorReference && record.evaluatorReference !== raw.operatorId) reasons.push("conflicting_provenance");
      add("shared_operator", "rawValue.operatorId", raw.operatorId, "measurement-operator", true);
      add("shared_session", "rawValue.measurementSessionId", raw.measurementSessionId, "physical-measurement:1.0", true);
      add("shared_specimen", "rawValue.specimenReference", raw.specimenReference, `equipment:${record.equipmentId}`, true);
      add("shared_instrument", "rawValue.instrument.instrumentReference", object(raw.instrument)?.instrumentReference, "measurement-instrument", true);
      if (raw.sessionId !== undefined) reasons.push("conflicting_provenance");
      verifyAcquisitionIdentity("physical-measurement:1.0", raw.measurementSessionId, record.attributeKey);
      if (!text(raw.measurementType)) reasons.push("malformed_provenance");
      else if (raw.measurementType !== record.attributeKey) reasons.push("conflicting_provenance");
    } else reasons.push("reference_namespace_unestablished");
    if (raw?.upstreamClaimId !== undefined) reasons.push("reference_namespace_unestablished", "upstream_endpoint_unresolved");
    if (raw?.inputEvidenceReferences !== undefined) {
      if (!Array.isArray(raw.inputEvidenceReferences) || !raw.inputEvidenceReferences.every(text)) reasons.push("malformed_provenance");
      else for (const reference of sorted(raw.inputEvidenceReferences as string[])) {
        const namespace = reference.startsWith("physical-measurement:1.0:") ? "physical-measurement:1.0" : reference.startsWith("physical-bat-evaluation:1.1:") ? "physical-bat-evaluation:1.1" : undefined;
        if (!namespace) { reasons.push("reference_namespace_unestablished", "upstream_endpoint_unresolved"); continue; }
        add("shared_upstream_reference", "rawValue.inputEvidenceReferences", reference, namespace);
        const endpoints = input.contextRecords.filter(candidate => {
          const metadata = object(candidate.rawValue);
          const expected = namespace === "physical-measurement:1.0"
            ? candidate.sourceType === "objective_measurement" && metadata?.protocolVersion === "1.0" && text(metadata.measurementSessionId) ? `physical-measurement:1.0:${metadata.measurementSessionId}:${candidate.attributeKey}` : undefined
            : candidate.sourceType === "structured_expert_evaluation" && metadata?.protocolVersion === "1.1" && text(metadata.sessionId) && text(metadata.dimensionKey) ? `physical-bat-evaluation:1.1:${metadata.sessionId}:${metadata.dimensionKey}` : undefined;
          return candidate.equipmentId === input.request.equipmentId && candidate.id !== id && candidate.sourceReference === reference && expected === reference;
        });
        if (endpoints.length !== 1) reasons.push("upstream_endpoint_unresolved");
        else links.push({ from: id, to: endpoints[0]!.id, reference });
      }
    }
    const valid = !!assessment && ["admissible", "admissible_with_restrictions"].includes(assessment.disposition) && assessment.permittedAssessment !== "none" && assessment.provenance.complete && record?.status === "active" && reasons.length === 1;
    if (!valid) reasons.push("context_only_endpoint");
    nodes.push({ recordId: id, disposition: assessment?.disposition, evaluatorState: assessment?.dependence.state ?? "unresolved", participation: valid ? "assessment" : "context_only", sourceIndependence: "not_established", reasons: sorted(reasons) });
    references.set(id, reasons.some(reason => ["duplicate_identity_conflict", "malformed_provenance", "conflicting_provenance"].includes(reason)) ? [] : refs);
  }
  const edges: DependenceEdge[] = [];
  for (const link of links) {
    const from = nodes.find(node => node.recordId === link.from); const to = nodes.find(node => node.recordId === link.to);
    if (!from || !to || from.reasons.includes("malformed_provenance") || from.reasons.includes("conflicting_provenance") || from.reasons.includes("duplicate_identity_conflict")) continue;
    const participation = from.participation === "assessment" && to.participation === "assessment" ? "assessment" : "context_only";
    edges.push({ ...link, kind: "documented_upstream_link", directed: true, basis: [{ recordId: link.from, fieldPath: "rawValue.inputEvidenceReferences", reference: link.reference }, { recordId: link.to, fieldPath: "sourceReference", reference: link.reference }], participation, reasons: participation === "assessment" ? [] : ["context_only_endpoint"] });
  }
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const left = nodes[i]!; const right = nodes[j]!;
    const participation = left.participation === "assessment" && right.participation === "assessment" ? "assessment" : "context_only";
    const basisFor = (a: Reference, b: Reference): DependenceBasis[] => [{ recordId: left.recordId, fieldPath: a.path, reference: a.value }, { recordId: right.recordId, fieldPath: b.path, reference: b.value }];
    for (const a of references.get(left.recordId) ?? []) for (const b of references.get(right.recordId) ?? []) if (a.kind === b.kind && a.namespace === b.namespace && a.value === b.value) edges.push({ from: left.recordId, to: right.recordId, kind: a.kind, directed: false, basis: basisFor(a, b), participation, reasons: participation === "assessment" ? [] : ["context_only_endpoint"] });
    const a = groups.get(left.recordId)?.[0]; const b = groups.get(right.recordId)?.[0];
    const ar = object(a?.rawValue); const br = object(b?.rawValue);
    const shared = edges.filter(edge => edge.from === left.recordId && edge.to === right.recordId);
    const actorShared = shared.some(edge => edge.kind === "shared_evaluator" || edge.kind === "shared_operator");
    if (a && b && a.equipmentVariantId === b.equipmentVariantId && a.attributeKey === b.attributeKey && ar?.dimensionKey === br?.dimensionKey && actorShared && shared.some(edge => edge.kind === "shared_session")) edges.push({ from: left.recordId, to: right.recordId, kind: "same_acquisition_dimension", directed: false, basis: shared.flatMap(edge => edge.basis), participation, reasons: participation === "assessment" ? [] : ["context_only_endpoint"] });
  }
  return { version: STRONGER_EVIDENCE_DEPENDENCE_VERSION, nodes, edges: edges.sort((a,b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to) || a.kind.localeCompare(b.kind)), independentGroups: [], authority: { independenceEstablished: false, sufficiencyGranted: false, comparabilityGranted: false, aggregationPerformed: false, canonicalValueCreated: false, numericValueCreated: false, synthesisGranted: false, compatibilityGranted: false, recommendationGranted: false, decisionBookGranted: false } };
}
