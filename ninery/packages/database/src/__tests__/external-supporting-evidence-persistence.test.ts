import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { ExternalSupportingEvidencePersistenceService, ExternalSupportingPersistenceError, type ExternalSupportingDecisionInsert, type ExternalSupportingPersistenceCommand, type ExternalSupportingPersistenceContext, type ExternalSupportingPersistenceRepository, type PersistedExternalSupportingDecision } from "../external-supporting-evidence-persistence.js";

const command: ExternalSupportingPersistenceCommand = { rawClaimId: "raw-1", normalizedClaimId: "normalized-1", dependencyAssessmentId: "dependency-1", constructRelationshipId: "relationship-1", qualificationDecisionId: "qualification-1", reviewDecisionId: "review-1", identityScope: "drop_family", direction: "lower", idempotencyKey: "supporting-role:raw-1:startup-demand:v1" };
const validContext: ExternalSupportingPersistenceContext = {
  rawClaim: { id: "raw-1", claimType: "subjective_observation", verificationState: "source_confirmed", supersededByCount: 0,
    document: { sourceId: "source-1", source: { id: "source-1", sourceType: "independent_expert_review" } },
    identity: { certainty: "equipment_model_match", equipmentId: "equipment-1", manufacturerMatches: true, modelMatches: true, modelYearMatches: true, certificationMatches: true, productFamilyMatches: true, dropMatches: true } },
  normalizedClaim: { id: "normalized-1", rawClaimId: "raw-1", verificationState: "source_confirmed" },
  dependencyAssessment: { id: "dependency-1", claimId: "raw-1", dependencyType: "independent_observation", independenceGroupId: "reviewer-lineage-1", reviewedState: "reviewed_accepted", supersededByCount: 0 },
  constructRelationship: { id: "relationship-1", normalizedClaimId: "normalized-1", proposedConstruct: "startup_demand", mappingConfidence: "high", mappingVersion: "1.0", policyVersion: "1.0-provisional", role: "supporting_context", reviewState: "reviewed_accepted", constructValueCreated: false, supersededByCount: 0 },
  qualification: { id: "qualification-1", normalizedClaimId: "normalized-1", constructRelationshipId: "relationship-1", contractVersion: "1.0", state: "context_only" },
  review: { id: "review-1", normalizedClaimId: "normalized-1", constructRelationshipId: "relationship-1", decision: "reviewed_accepted", reviewerType: "human", reviewerReference: "human-reviewer-1" }, unresolvedConflictCount: 0
};

class MemoryRepository implements ExternalSupportingPersistenceRepository {
  readonly records: ExternalSupportingDecisionInsert[] = [];
  constructor(public context: ExternalSupportingPersistenceContext | undefined = validContext) {}
  async transaction<T>(operation: (repository: ExternalSupportingPersistenceRepository) => Promise<T>): Promise<T> { return operation(this); }
  async loadContext() { return this.context; }
  async findDecisionByIdempotencyKey(key: string) { const item = this.records.find((record) => record.idempotencyKey === key); return item ? persisted(item) : undefined; }
  async createDecision(data: ExternalSupportingDecisionInsert) { this.records.push(Object.freeze(data)); return persisted(data); }
}

test("persists only the exact valid human-approved claim and construct path", async () => {
  const repository = new MemoryRepository(); const result = await new ExternalSupportingEvidencePersistenceService(repository).persist(command);
  assert.equal(result.eligible, true); assert.equal(result.role, "supporting_context"); assert.equal(repository.records.length, 1);
  assert.deepEqual(authority(repository.records[0]!), [0, 0, 0, 0, false, false, false, false, false, false]);
});

for (const [name, change] of [
  ["no human approval", { review: { ...validContext.review, decision: "review_pending" } }],
  ["AI review masquerading as human", { review: { ...validContext.review, reviewerType: "ai" } }],
  ["rejected human review", { review: { ...validContext.review, decision: "reviewed_rejected" } }],
  ["unknown dependency", { dependencyAssessment: { ...validContext.dependencyAssessment, dependencyType: "unknown_dependency", independenceGroupId: undefined } }],
  ["dependent claim with fake independent group", { dependencyAssessment: { ...validContext.dependencyAssessment, dependencyType: "shared_upstream", independenceGroupId: "fake-independent" } }],
  ["ineligible construct", { constructRelationship: { ...validContext.constructRelationship, proposedConstruct: "response_degradation" } }],
  ["invalid qualification", { qualification: { ...validContext.qualification, state: "not_eligible" } }],
  ["superseded raw claim", { rawClaim: { ...validContext.rawClaim, supersededByCount: 1 } }],
  ["superseded normalized claim", { normalizedClaim: { ...validContext.normalizedClaim, verificationState: "superseded" } }],
  ["conflicting claim", { rawClaim: { ...validContext.rawClaim, verificationState: "conflicting" } }],
  ["unresolved conflict membership", { unresolvedConflictCount: 1 }]
] as const) {
  test(`rejects ${name}`, async () => { const repository = new MemoryRepository({ ...validContext, ...change } as ExternalSupportingPersistenceContext); await assert.rejects(() => new ExternalSupportingEvidencePersistenceService(repository).persist(command), ExternalSupportingPersistenceError); assert.equal(repository.records.length, 0); });
}

test("rejects cross-claim and cross-construct review", async () => {
  for (const review of [{ ...validContext.review, normalizedClaimId: "normalized-other" }, { ...validContext.review, constructRelationshipId: "relationship-other" }]) {
    await assert.rejects(() => new ExternalSupportingEvidencePersistenceService(new MemoryRepository({ ...validContext, review })).persist(command), (error: unknown) => error instanceof ExternalSupportingPersistenceError && error.code === "CROSS_LINEAGE_REFERENCE");
  }
});

test("rejects a qualification belonging to another claim or construct", async () => {
  for (const qualification of [{ ...validContext.qualification, normalizedClaimId: "normalized-other" }, { ...validContext.qualification, constructRelationshipId: "relationship-other" }]) {
    await assert.rejects(() => new ExternalSupportingEvidencePersistenceService(new MemoryRepository({ ...validContext, qualification })).persist(command), (error: unknown) => error instanceof ExternalSupportingPersistenceError && error.code === "CROSS_LINEAGE_REFERENCE");
  }
});

test("rejects mismatched source/document and equipment/variant provenance", async () => {
  const badSource = { ...validContext, rawClaim: { ...validContext.rawClaim, document: { sourceId: "source-other", source: validContext.rawClaim.document.source } } };
  await assert.rejects(() => new ExternalSupportingEvidencePersistenceService(new MemoryRepository(badSource)).persist(command), (error: unknown) => error instanceof ExternalSupportingPersistenceError && error.code === "SOURCE_DOCUMENT_MISMATCH");
  const badVariant = { ...validContext, rawClaim: { ...validContext.rawClaim, identity: { ...validContext.rawClaim.identity, equipmentVariantId: "variant-1", variantEquipmentId: "equipment-other" } } };
  await assert.rejects(() => new ExternalSupportingEvidencePersistenceService(new MemoryRepository(badVariant)).persist(command), (error: unknown) => error instanceof ExternalSupportingPersistenceError && error.code === "EQUIPMENT_VARIANT_MISMATCH");
});

test("exact replay is idempotent and conflicting replay cannot mutate history", async () => {
  const repository = new MemoryRepository(); const service = new ExternalSupportingEvidencePersistenceService(repository);
  const first = await service.persist(command); const replay = await service.persist(command);
  assert.deepEqual(replay, first); assert.equal(repository.records.length, 1); assert.ok(Object.isFrozen(repository.records[0]));
  await assert.rejects(() => service.persist({ ...command, direction: "higher" }), (error: unknown) => error instanceof ExternalSupportingPersistenceError && error.code === "IDEMPOTENCY_CONFLICT");
});

test("current eligibility fails closed after later conflict or supersession without deleting history", async () => {
  const repository = new MemoryRepository(); const service = new ExternalSupportingEvidencePersistenceService(repository); await service.persist(command);
  const conflict = service.assessCurrentEligibility(command, { ...validContext, unresolvedConflictCount: 1 });
  const superseded = service.assessCurrentEligibility(command, { ...validContext, rawClaim: { ...validContext.rawClaim, supersededByCount: 1 } });
  assert.equal(conflict.eligible, false); assert.equal(superseded.eligible, false); assert.equal(repository.records.length, 1);
});

test("pending migration enforces append-only history, bounded policy, bindings, and cycle prevention", () => {
  const sql = readFileSync("prisma/migrations/20260916000000_add_external_supporting_evidence_persistence/migration.sql", "utf8");
  for (const marker of ["prevent_external_evidence_mutation", "prevent_external_claim_supersession_cycle", "prevent_external_document_supersession_cycle", "prevent_external_dependency_supersession_cycle", "prevent_external_construct_supersession_cycle", "validate_external_supporting_role_decision", "external_evidence_construct_relationships", "reviewerType", "reviewed_accepted", "startup_demand", "rotational_demand", "SOURCE_DOCUMENT"] ) assert.ok(sql.includes(marker), `missing migration protection: ${marker}`);
  for (const authority of ["directEvidenceContribution", "structuredContribution", "physicalContribution", "controlledContribution", "canonicalValueCreated", "numericValueCreated", "synthesisEligibilityGranted", "compatibilityAuthorityGranted", "recommendationAuthorityGranted", "decisionBookAuthorityGranted"]) assert.match(sql, new RegExp(`"${authority}"(?:=| = )(?:0|false)`), `missing authority firewall: ${authority}`);
  for (const table of ["external_evidence_dependency_assessments", "external_evidence_construct_relationships", "external_evidence_qualification_decisions", "external_evidence_review_decisions", "external_evidence_conflict_cases", "external_evidence_conflict_resolutions", "external_supporting_role_decisions"]) assert.match(sql, new RegExp(`BEFORE UPDATE OR DELETE ON "${table}"`), `missing append-only trigger: ${table}`);
});

function persisted(data: ExternalSupportingDecisionInsert): PersistedExternalSupportingDecision { return { id: `decision-${data.idempotencyKey}`, idempotencyKey: data.idempotencyKey, decisionFingerprint: data.decisionFingerprint, eligible: data.eligible, role: data.role }; }
function authority(data: ExternalSupportingDecisionInsert) { return [data.directEvidenceContribution, data.structuredContribution, data.physicalContribution, data.controlledContribution, data.canonicalValueCreated, data.numericValueCreated, data.synthesisEligibilityGranted, data.compatibilityAuthorityGranted, data.recommendationAuthorityGranted, data.decisionBookAuthorityGranted]; }
