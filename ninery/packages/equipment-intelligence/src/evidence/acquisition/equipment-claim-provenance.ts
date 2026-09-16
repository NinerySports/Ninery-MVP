import { multiSourceEvidenceClassValues } from "../equipment-multi-source-strategy.types.js";
import type { EquipmentClaimConflict, EquipmentClaimIdentityAssertion, EquipmentClaimProvenanceAnalysis, EquipmentClaimProvenanceGraph, EquipmentNormalizedClaim, EquipmentSourceClaim } from "./equipment-claim-provenance.types.js";
import { EquipmentClaimProvenanceValidationError, equipmentClaimTypeValues, equipmentClaimVerificationStateValues, equipmentSourceTypeValues } from "./equipment-claim-provenance.types.js";

export const EQUIPMENT_CLAIM_PROVENANCE_MODEL_VERSION = "1.0";

export function analyzeEquipmentClaimProvenance(graph: EquipmentClaimProvenanceGraph): EquipmentClaimProvenanceAnalysis {
  validateEquipmentClaimProvenance(graph);
  const raw = sorted(graph.rawClaims); const normalized = sorted(graph.normalizedClaims);
  const groupIds = unique(raw.map((claim) => claim.independenceGroupId)).sort();
  const lineageGroups = groupIds.map((id) => ({ id, rawClaimIds: raw.filter((claim) => claim.independenceGroupId === id).map((claim) => claim.id), normalizedClaimIds: normalized.filter((claim) => rawById(raw, claim.rawClaimId).independenceGroupId === id).map((claim) => claim.id) }));
  return { version: EQUIPMENT_CLAIM_PROVENANCE_MODEL_VERSION, documentCount: graph.documents.length, rawClaimCount: raw.length, normalizedClaimCount: normalized.length, sourceCount: unique(raw.map((claim) => claim.sourceId)).length, independentClaimGroupCount: groupIds.length, lineageGroups, conflicts: findConflicts(normalized, raw), firewalls: { aiCreatedEvidenceSource: false, normalizationIncreasedIndependence: false, marketingCreatedBehavioralDNA: false, constructValuesCreated: false, modeledDerivativeCorroboratedInput: false, writesPerformed: false, recommendationImpact: "none" } };
}

export function validateEquipmentClaimProvenance(graph: EquipmentClaimProvenanceGraph): void {
  const issues: string[] = []; const sources = ids(graph.sources); const documents = ids(graph.documents); const runs = ids(graph.extractionRuns); const identities = ids(graph.identities); const raw = ids(graph.rawClaims); const normalized = ids(graph.normalizedClaims);
  duplicateIds(graph, issues);
  for (const document of graph.documents) { requireRef(sources, document.sourceId, `document:${document.id}:source`, issues); if (document.upstreamDocumentId) requireRef(documents, document.upstreamDocumentId, `document:${document.id}:upstream`, issues); if (document.supersedesDocumentId === document.id) issues.push(`document:${document.id}:self_supersession`); }
  for (const claim of graph.rawClaims) { requireRef(sources, claim.sourceId, `claim:${claim.id}:source`, issues); requireRef(documents, claim.documentId, `claim:${claim.id}:document`, issues); requireRef(runs, claim.extractionRunId, `claim:${claim.id}:extraction`, issues); requireRef(identities, claim.identityAssertionId, `claim:${claim.id}:identity`, issues); if (claim.supersedesClaimId) { requireRef(raw, claim.supersedesClaimId, `claim:${claim.id}:supersedes`, issues); if (claim.supersedesClaimId === claim.id) issues.push(`claim:${claim.id}:self_supersession`); } }
  for (const claim of graph.normalizedClaims) { requireRef(raw, claim.rawClaimId, `normalized:${claim.id}:raw`, issues); requireRef(identities, claim.identityAssertionId, `normalized:${claim.id}:identity`, issues); if (!multiSourceEvidenceClassValues.includes(claim.evidenceClass)) issues.push(`normalized:${claim.id}:invalid_evidence_class`); }
  for (const dependency of graph.dependencies) { requireRef(raw, dependency.claimId, `dependency:${dependency.id}:claim`, issues); if (!["original", "independent_observation", "unknown_dependency"].includes(dependency.dependencyType) && !dependency.upstreamClaimId) issues.push(`dependency:${dependency.id}:upstream_required`); if (dependency.upstreamClaimId) { requireRef(raw, dependency.upstreamClaimId, `dependency:${dependency.id}:upstream`, issues); if (dependency.claimId === dependency.upstreamClaimId) issues.push(`dependency:${dependency.id}:self_dependency`); const child = graph.rawClaims.find((claim) => claim.id === dependency.claimId); const parent = graph.rawClaims.find((claim) => claim.id === dependency.upstreamClaimId); if (child && parent && ["syndicated_from", "derived_from", "copied_from", "shared_upstream"].includes(dependency.dependencyType) && child.independenceGroupId !== parent.independenceGroupId) issues.push(`dependency:${dependency.id}:dependent_claim_marked_independent`); } }
  detectCycles(graph.dependencies.map((item) => [item.claimId, item.upstreamClaimId] as const), issues, "claim_dependency_cycle");
  for (const relationship of graph.constructRelationships) { requireRef(normalized, relationship.normalizedClaimId, `relationship:${relationship.id}:claim`, issues); if (relationship.constructValueCreated) issues.push(`relationship:${relationship.id}:construct_value_forbidden`); const claim = graph.normalizedClaims.find((item) => item.id === relationship.normalizedClaimId); const rawClaim = claim && graph.rawClaims.find((item) => item.id === claim.rawClaimId); if (rawClaim?.claimType === "marketing_claim" && relationship.role !== "not_applicable" && relationship.role !== "candidate_only") issues.push(`relationship:${relationship.id}:marketing_behavior_forbidden`); }
  for (const lineage of graph.modeledLineages) { requireRef(normalized, lineage.normalizedClaimId, `model:${lineage.normalizedClaimId}:output`, issues); if (!lineage.inputNormalizedClaimIds.length || !lineage.inputIndependenceGroupIds.length) issues.push(`model:${lineage.normalizedClaimId}:input_lineage_required`); lineage.inputNormalizedClaimIds.forEach((id) => requireRef(normalized, id, `model:${lineage.normalizedClaimId}:input`, issues)); const output = graph.normalizedClaims.find((item) => item.id === lineage.normalizedClaimId); const outputRaw = output && graph.rawClaims.find((item) => item.id === output.rawClaimId); if (outputRaw && !lineage.inputIndependenceGroupIds.includes(outputRaw.independenceGroupId)) issues.push(`model:${lineage.normalizedClaimId}:must_inherit_input_lineage`); }
  detectCycles(graph.modeledLineages.flatMap((lineage) => lineage.inputNormalizedClaimIds.map((input) => [lineage.normalizedClaimId, input] as const)), issues, "modeled_lineage_cycle");
  if (issues.length) throw new EquipmentClaimProvenanceValidationError(unique(issues).sort());
}

export function claimAppliesToIdentity(assertion: EquipmentClaimIdentityAssertion, target: EquipmentClaimIdentityAssertion): boolean {
  if ([assertion.certainty, target.certainty].some((state) => ["ambiguous", "conflicting", "unresolved", "family_only"].includes(state))) return false;
  const keys = ["equipmentId", "equipmentVariantId", "manufacturer", "model", "modelYear", "certification", "constructionRevision", "lengthInches", "weightOunces", "drop", "sku"] as const;
  return keys.every((key) => assertion[key] === undefined || target[key] === undefined || assertion[key] === target[key]);
}

function findConflicts(claims: readonly EquipmentNormalizedClaim[], raw: readonly EquipmentSourceClaim[]): EquipmentClaimConflict[] {
  const conflicts: EquipmentClaimConflict[] = [];
  const current = claims.filter((item) => item.verificationState !== "superseded");
  const scopes = unique(current.map((item) => `${item.identityAssertionId}\u0000${item.claimKey}`)).sort();
  for (const scope of scopes) { const [identityId, key] = scope.split("\u0000"); const candidates = current.filter((item) => item.identityAssertionId === identityId && item.claimKey === key); const values = unique(candidates.map((item) => stable(item.normalizedValue))); const groups = unique(candidates.map((item) => rawById(raw, item.rawClaimId).independenceGroupId)); if (values.length > 1 && groups.length > 1) conflicts.push({ claimKey: key!, normalizedClaimIds: candidates.map((item) => item.id).sort(), independenceGroupIds: groups.sort(), state: "independent_disagreement", automaticWinnerSelected: false, toleranceApplied: false }); }
  return conflicts;
}
function rawById(items: readonly EquipmentSourceClaim[], id: string) { return items.find((item) => item.id === id)!; }
function ids(items: readonly { readonly id: string }[]) { return new Set(items.map((item) => item.id)); }
function requireRef(set: ReadonlySet<string>, id: string, label: string, issues: string[]) { if (!set.has(id)) issues.push(`${label}:missing_reference`); }
function sorted<T extends { readonly id: string }>(items: readonly T[]): T[] { return [...items].sort((a, b) => a.id.localeCompare(b.id)); }
function unique<T>(items: readonly T[]): T[] { return [...new Set(items)]; }
function stable(value: unknown): string { return JSON.stringify(value, Object.keys(value && typeof value === "object" && !Array.isArray(value) ? value as object : {}).sort()); }
function duplicateIds(graph: EquipmentClaimProvenanceGraph, issues: string[]) { const all = [...graph.sources, ...graph.documents, ...graph.extractionRuns, ...graph.identities, ...graph.rawClaims, ...graph.normalizedClaims, ...graph.dependencies, ...graph.constructRelationships].map((item) => item.id); if (new Set(all).size !== all.length) issues.push("duplicate_graph_id"); }
function detectCycles(edges: readonly (readonly [string, string | undefined])[], issues: string[], code: string) { const map = new Map<string, string[]>(); for (const [from, to] of edges) if (to) map.set(from, [...(map.get(from) ?? []), to]); const visiting = new Set<string>(); const visited = new Set<string>(); const visit = (node: string): boolean => { if (visiting.has(node)) return true; if (visited.has(node)) return false; visiting.add(node); for (const next of map.get(node) ?? []) if (visit(next)) return true; visiting.delete(node); visited.add(node); return false; }; for (const node of map.keys()) if (visit(node)) { issues.push(code); return; } }

export const equipmentClaimProvenanceTaxonomies = { sourceTypes: equipmentSourceTypeValues, claimTypes: equipmentClaimTypeValues, evidenceClasses: multiSourceEvidenceClassValues, verificationStates: equipmentClaimVerificationStateValues } as const;
