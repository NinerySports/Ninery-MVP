import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Prisma } from "@prisma/client";
import {
  CONTAMINATED_ATLAS_EQUIPMENT_ID,
  CONTAMINATED_ATLAS_VARIANT_ID,
  EXTERNAL_CLAIM_CONCURRENCY_MAX_ATTEMPTS,
  ExternalClaimIngestionError,
  GovernedExternalClaimIngestionService,
  qualificationFingerprint,
  type ExternalClaimIngestionInput,
  type ExternalClaimIngestionRecord,
  type ExternalClaimIngestionRepository,
  type ExternalClaimPersistenceUnit
} from "../external-claim-ingestion.js";
import { buildAtlasUsssaProductionCaptureInputs } from "../atlas-usssa-production-ingestion.fixture.js";
import { assessCurrentGovernance, PrismaExternalClaimIngestionRepository, SOURCE_GOVERNANCE_OPERATIONAL_POLICY_VERSION } from "../prisma-external-claim-ingestion-repository.js";

const CLEAN_EQUIPMENT = "748ae67e-0b10-40d6-8ef6-28d6953d1d40";
const CLEAN_VARIANT = "0844a8e0-8b9a-42ba-9b6f-50f288832e58";

class MemoryRepository implements ExternalClaimIngestionRepository {
  readonly records = new Map<string, ExternalClaimIngestionRecord>();
  readonly units: ExternalClaimPersistenceUnit[] = [];
  failKeys = new Set<string>();
  resolutionBlockers: string[] = [];
  transaction<T>(operation: (repository: ExternalClaimIngestionRepository) => Promise<T>): Promise<T> { return operation(this); }
  isRecognizedConcurrencyError(_error?: unknown) { return false; }
  async resolveTrustedContext(input: ExternalClaimIngestionInput, claim: ExternalClaimIngestionInput["claims"][number]) {
    return { source: input.source, identity: this.resolutionBlockers.length ? { ...claim.identity, certainty: "unresolved" as const, equipmentId: undefined, equipmentVariantId: undefined } : claim.identity, authority: this.resolutionBlockers.length ? "unknown" as const : claim.authority, governanceRevision: { id: "11111111-1111-5111-a111-111111111111", revisionNumber: 1, version: "1.0", effectiveAt: new Date(0) }, blockers: this.resolutionBlockers };
  }
  async findByIdempotencyKey(key: string, semanticFingerprint: string) {
    const record = this.records.get(key);
    if (record && record.semanticFingerprint !== semanticFingerprint) throw new ExternalClaimIngestionError("SEMANTIC_FINGERPRINT_MISMATCH", "Idempotency key collided with different semantic input.");
    return record;
  }
  async persist(unit: ExternalClaimPersistenceUnit) {
    if (this.failKeys.has(unit.claim.externalClaimKey)) throw new Error("forced claim failure");
    this.units.push(unit);
    const record: ExternalClaimIngestionRecord = { idempotencyKey: unit.idempotencyKey, semanticFingerprint: unit.semanticFingerprint, qualificationSemanticFingerprint: unit.qualificationSemanticFingerprint, claimSlotKey: unit.claimSlotKey, sourceId: unit.sourceId, documentId: unit.documentId, extractionRunId: unit.extractionRunId, identityAssertionId: unit.identityAssertionId, rawClaimId: unit.rawClaimId, normalizedClaimId: unit.normalizedClaimId, dependencyAssessmentId: unit.dependencyAssessmentId, constructRelationshipId: unit.constructRelationshipId, qualificationDecisionId: unit.qualificationDecisionId, qualification: unit.qualification, reviewReady: unit.reviewReady };
    this.records.set(unit.idempotencyKey, record);
    return record;
  }
}

const retryable = new Error("synthetic recognized concurrency failure");

class RetryRepository extends MemoryRepository {
  attempts = 0;
  constructor(private readonly mode: "commit_then_retry" | "exhaust" | "nonretryable") { super(); }
  override async transaction<T>(operation: (repository: ExternalClaimIngestionRepository) => Promise<T>): Promise<T> {
    this.attempts += 1;
    if (this.mode === "nonretryable") throw new Error("arbitrary failure");
    if (this.mode === "exhaust") throw retryable;
    const result = await operation(this);
    if (this.attempts === 1) throw retryable;
    return result;
  }
  override isRecognizedConcurrencyError(error: unknown) { return error === retryable; }
}

test("deterministic manufacturer specification reaches review-ready qualification with every authority closed", async () => {
  const repository = new MemoryRepository();
  const result = await new GovernedExternalClaimIngestionService(repository).ingest(base());
  assert.equal(result.failed.length, 0); assert.equal(result.succeeded.length, 1);
  assert.equal(result.succeeded[0]!.qualification.state, "qualified");
  assert.deepEqual(Object.values(result.succeeded[0]!.reviewReady.authority), [false, false, false, false, false, false, false]);
  assert.equal(repository.units[0]!.graph.normalizedClaims[0]!.evidenceClass, "verified_catalog_fact");
  assert.equal(repository.units[0]!.graph.constructRelationships[0]!.constructValueCreated, false);
});

test("exact replay creates no duplicate current-state knowledge", async () => {
  const repository = new MemoryRepository(); const service = new GovernedExternalClaimIngestionService(repository);
  const first = await service.ingest(base()); const second = await service.ingest(base());
  assert.deepEqual(second, first); assert.equal(repository.units.length, 1); assert.equal(repository.records.size, 1);
});

test("recognized concurrency retry rereads the durable winner and reports bounded attempts", async () => {
  const repository = new RetryRepository("commit_then_retry");
  const events: Array<{ phase: string; attempt: number; durableRead?: boolean }> = [];
  const result = await new GovernedExternalClaimIngestionService(repository, (event) => events.push(event)).ingest(base());
  assert.equal(result.failed.length, 0);
  assert.equal(repository.attempts, 2);
  assert.deepEqual(events.map(({ phase, attempt }) => ({ phase, attempt })), [
    { phase: "attempt", attempt: 1 }, { phase: "retryable_error", attempt: 1 },
    { phase: "attempt", attempt: 2 }, { phase: "success", attempt: 2 }
  ]);
  assert.equal(events.at(-1)?.durableRead, true);
  assert.equal(repository.units.length, 1);
});

test("recognized concurrency retries stop at the exported three-attempt bound", async () => {
  const repository = new RetryRepository("exhaust");
  const events: Array<{ phase: string; attempt: number }> = [];
  const result = await new GovernedExternalClaimIngestionService(repository, (event) => events.push(event)).ingest(base());
  assert.equal(result.failed[0]?.code, "CLAIM_PIPELINE_FAILED");
  assert.equal(repository.attempts, EXTERNAL_CLAIM_CONCURRENCY_MAX_ATTEMPTS);
  assert.equal(events.filter((event) => event.phase === "retryable_error").length, EXTERNAL_CLAIM_CONCURRENCY_MAX_ATTEMPTS);
});

test("nonretryable failures escape the retry loop immediately", async () => {
  const repository = new RetryRepository("nonretryable");
  const result = await new GovernedExternalClaimIngestionService(repository).ingest(base());
  assert.equal(result.failed[0]?.message, "arbitrary failure");
  assert.equal(repository.attempts, 1);
});

test("Prisma retry classification permits only uniqueness and serializable-conflict errors", () => {
  const repository = Object.create(PrismaExternalClaimIngestionRepository.prototype) as PrismaExternalClaimIngestionRepository;
  const prismaError = (code: string) => new Prisma.PrismaClientKnownRequestError(code, { code, clientVersion: "test" });
  assert.equal(repository.isRecognizedConcurrencyError(prismaError("P2002")), true);
  assert.equal(repository.isRecognizedConcurrencyError(prismaError("P2034")), true);
  assert.equal(repository.isRecognizedConcurrencyError(prismaError("P2025")), false);
  assert.equal(repository.isRecognizedConcurrencyError(new Error("arbitrary")), false);
});

test("governance policy is versioned and fails closed for authority, dependency, state, and ambiguity", () => {
  const active = { sourceType: "manufacturer_primary", state: "active", authorityScope: { claimAuthority: "authoritative" }, dependencyKnowledge: { state: "claim_level_assessment_required" } };
  assert.deepEqual(assessCurrentGovernance([active], "factual_specification", "authoritative"), { policyVersion: SOURCE_GOVERNANCE_OPERATIONAL_POLICY_VERSION, blockers: [], quarantineReasons: [], dependencyBlocked: false });
  assert.ok(assessCurrentGovernance([{ ...active, authorityScope: { claimAuthority: "authoritative", authorizedClaimTypes: [] } }], "factual_specification", "authoritative").blockers.includes("source_governance_authority_scope_changed"));
  assert.ok(assessCurrentGovernance([{ ...active, authorityScope: { claimAuthority: "authoritative", authorizedClaimTypes: "invalid" } }], "factual_specification", "authoritative").blockers.includes("source_governance_authority_scope_changed"));
  assert.ok(assessCurrentGovernance([{ ...active, dependencyKnowledge: { state: "unknown" } }], "factual_specification", "authoritative").blockers.includes("source_governance_dependency_unresolved"));
  assert.ok(assessCurrentGovernance([{ ...active, state: "unexpected" }], "factual_specification", "authoritative").blockers.includes("source_governance_state_inactive"));
  assert.ok(assessCurrentGovernance([active, active], "factual_specification", "authoritative").blockers.includes("source_governance_ambiguous"));
});

test("Ticket #076 migration enforces same-source governance at the PostgreSQL boundary", () => {
  const sql = readFileSync("prisma/migrations/20260918000000_harden_external_claim_ingestion/migration.sql", "utf8");
  assert.ok(sql.includes('LOCK TABLE "external_evidence_qualification_decisions" IN ACCESS EXCLUSIVE MODE;'));
  assert.ok(sql.includes('FOREIGN KEY ("supersedesRevisionId", "sourceId")'));
  assert.ok(sql.includes('FOREIGN KEY ("sourceGovernanceRevisionId", "sourceId")'));
  assert.ok(sql.includes("enforce_external_qualification_source_lineage"));
  assert.ok(sql.includes("qualification governance source does not match claim source"));
  assert.ok(sql.includes("external_evidence_legacy_qualification_exemptions"));
  assert.ok(sql.includes("legacy qualification exemptions are a sealed migration-time snapshot"));
  assert.ok(sql.includes("new qualifications require source-governance lineage"));
  const begin = sql.indexOf("BEGIN;");
  const lock = sql.indexOf('LOCK TABLE "external_evidence_qualification_decisions" IN ACCESS EXCLUSIVE MODE;');
  const snapshot = sql.indexOf('INSERT INTO "external_evidence_legacy_qualification_exemptions"');
  const seal = sql.indexOf('CREATE TRIGGER "external_legacy_qualification_exemptions_sealed"');
  const enforcement = sql.indexOf('CREATE TRIGGER "external_qualification_source_lineage"');
  const commit = sql.lastIndexOf("COMMIT;");
  assert.ok(begin >= 0);
  assert.ok(begin < lock);
  assert.ok(lock < snapshot);
  assert.ok(snapshot < seal);
  assert.ok(seal < enforcement);
  assert.ok(enforcement < commit);
  assert.equal(/\bDROP\s+(TABLE|COLUMN)\b/i.test(sql), false);
});

test("qualification semantic fingerprint covers material persisted output", async () => {
  const repository = new MemoryRepository();
  const record = (await new GovernedExternalClaimIngestionService(repository).ingest(base())).succeeded[0]!;
  const unit = repository.units[0]!;
  const correct = qualificationFingerprint({ qualification: record.qualification, normalizedClaimId: record.normalizedClaimId, rawClaimId: record.rawClaimId, identityAssertionId: record.identityAssertionId, dependencyAssessmentId: record.dependencyAssessmentId, constructRelationshipId: record.constructRelationshipId, sourceGovernanceRevisionId: record.reviewReady.historicalSourceGovernanceRevisionId, authority: record.qualification.authority! });
  const altered = qualificationFingerprint({ qualification: { ...record.qualification, state: "not_eligible" }, normalizedClaimId: record.normalizedClaimId, rawClaimId: record.rawClaimId, identityAssertionId: record.identityAssertionId, dependencyAssessmentId: record.dependencyAssessmentId, constructRelationshipId: record.constructRelationshipId, sourceGovernanceRevisionId: record.reviewReady.historicalSourceGovernanceRevisionId, authority: record.qualification.authority! });
  assert.equal(correct, unit.qualificationSemanticFingerprint);
  assert.notEqual(altered, correct);
});

test("changed content creates a document successor identity without rewriting old provenance", async () => {
  const repository = new MemoryRepository(); const service = new GovernedExternalClaimIngestionService(repository);
  const first = (await service.ingest(base())).succeeded[0]!;
  const changed = (await service.ingest(base({ document: { ...base().document, boundedContent: "Captured manufacturer specification revision two." } }))).succeeded[0]!;
  assert.notEqual(changed.documentId, first.documentId); assert.notEqual(changed.rawClaimId, first.rawClaimId); assert.equal(repository.records.size, 2);
});

test("capture time is event metadata while publisher revision is document identity", async () => {
  const repository = new MemoryRepository(); const service = new GovernedExternalClaimIngestionService(repository);
  const firstInput = base();
  const first = (await service.ingest(firstInput)).succeeded[0]!;
  const recaptured = (await service.ingest({ ...firstInput, document: { ...firstInput.document, capturedAt: new Date("2026-09-17") } })).succeeded[0]!;
  const revised = (await service.ingest({ ...firstInput, document: { ...firstInput.document, revisionLabel: "publisher-revision-2" } })).succeeded[0]!;
  assert.equal(recaptured.documentId, first.documentId);
  assert.equal(recaptured.idempotencyKey, first.idempotencyKey);
  assert.notEqual(revised.documentId, first.documentId);
});

test("removed or unavailable source state creates an auditable document-state revision", async () => {
  const repository = new MemoryRepository(); const service = new GovernedExternalClaimIngestionService(repository);
  const first = (await service.ingest(base())).succeeded[0]!;
  const input = base(); const unavailable = (await service.ingest({ ...input, document: { ...input.document, availability: "unavailable" } })).succeeded[0]!;
  assert.notEqual(unavailable.documentId, first.documentId); assert.equal(repository.records.size, 2);
});

test("changed extraction implementation preserves document but creates new extraction and claim lineage", async () => {
  const repository = new MemoryRepository(); const service = new GovernedExternalClaimIngestionService(repository);
  const first = (await service.ingest(base())).succeeded[0]!;
  const changed = (await service.ingest(base({ extraction: { ...base().extraction, extractorVersion: "2.0" } }))).succeeded[0]!;
  assert.equal(changed.documentId, first.documentId); assert.notEqual(changed.extractionRunId, first.extractionRunId); assert.notEqual(changed.rawClaimId, first.rawClaimId);
});

test("same-version intentional extraction is historical while retry of one logical run is idempotent", async () => {
  const repository = new MemoryRepository(); const service = new GovernedExternalClaimIngestionService(repository);
  const input = base();
  const first = (await service.ingest(input)).succeeded[0]!;
  const retry = (await service.ingest(input)).succeeded[0]!;
  const laterInput = { ...input, extraction: { ...input.extraction, logicalRunKey: "catalog-parser-run-2", executedAt: new Date("2026-09-17") } };
  const later = (await service.ingest(laterInput)).succeeded[0]!;
  assert.equal(retry.extractionRunId, first.extractionRunId);
  assert.equal(retry.idempotencyKey, first.idempotencyKey);
  assert.notEqual(later.extractionRunId, first.extractionRunId);
  assert.equal(later.reviewReady.extraction.extractorVersion, first.reviewReady.extraction.extractorVersion);
});

test("extraction identity requires a logical run key and valid execution time", async () => {
  const input = base();
  await assert.rejects(() => new GovernedExternalClaimIngestionService(new MemoryRepository()).ingest({ ...input, extraction: { ...input.extraction, logicalRunKey: "" } }), (error: unknown) => error instanceof ExternalClaimIngestionError && error.code === "EXTRACTION_IDENTITY_INCOMPLETE");
  await assert.rejects(() => new GovernedExternalClaimIngestionService(new MemoryRepository()).ingest({ ...input, extraction: { ...input.extraction, executedAt: new Date("invalid") } }), (error: unknown) => error instanceof ExternalClaimIngestionError && error.code === "EXTRACTION_IDENTITY_INCOMPLETE");
});

test("changed normalization version preserves raw claim and creates a new interpretation", async () => {
  const repository = new MemoryRepository(); const service = new GovernedExternalClaimIngestionService(repository);
  const first = (await service.ingest(base())).succeeded[0]!;
  const input = base(); const changed = (await service.ingest({ ...input, claims: [{ ...input.claims[0]!, normalization: { ...input.claims[0]!.normalization, version: "2.0" } }] })).succeeded[0]!;
  assert.equal(changed.rawClaimId, first.rawClaimId); assert.notEqual(changed.normalizedClaimId, first.normalizedClaimId);
});

for (const certainty of ["ambiguous", "conflicting"] as const) {
  test(`${certainty} identity is quarantined and cannot bypass qualification`, async () => {
    const input = base(); const result = await new GovernedExternalClaimIngestionService(new MemoryRepository()).ingest({ ...input, claims: [{ ...input.claims[0]!, identity: { ...input.claims[0]!.identity, certainty, equipmentId: undefined, equipmentVariantId: undefined } }] });
    assert.ok(result.succeeded[0]!.reviewReady.quarantineReasons.includes(`identity_${certainty}`)); assert.notEqual(result.succeeded[0]!.qualification.state, "qualified");
  });
}

test("family-only applicability cannot leak onto an exact variant", async () => {
  const input = base(); const result = await new GovernedExternalClaimIngestionService(new MemoryRepository()).ingest({ ...input, claims: [{ ...input.claims[0]!, identity: { ...input.claims[0]!.identity, certainty: "family_only" } }] });
  assert.equal(result.succeeded[0]!.reviewReady.equipmentVariantId, undefined); assert.ok(result.succeeded[0]!.reviewReady.quarantineReasons.includes("identity_family_only"));
});

test("a mismatched variant becomes conflicting rather than crossing equipment identity", async () => {
  const input = base(); const result = await new GovernedExternalClaimIngestionService(new MemoryRepository()).ingest({ ...input, claims: [{ ...input.claims[0]!, identity: { ...input.claims[0]!.identity, equipmentVariantId: "11111111-1111-4111-a111-111111111111" } }] });
  assert.equal(result.succeeded[0]!.reviewReady.identityCertainty, "conflicting"); assert.equal(result.succeeded[0]!.reviewReady.equipmentVariantId, undefined);
});

test("unknown dependency remains unknown and suspected syndication is explicit", async () => {
  for (const dependency of [
    { type: "unknown_dependency" as const, rationale: "Lineage unavailable." },
    { type: "suspected_dependency" as const, rationale: "Similar product copy requires review." }
  ]) {
    const input = base(); const result = await new GovernedExternalClaimIngestionService(new MemoryRepository()).ingest({ ...input, claims: [{ ...input.claims[0]!, dependency }] });
    assert.equal(result.succeeded[0]!.reviewReady.dependencyState, "unknown_dependency");
    assert.ok(result.succeeded[0]!.reviewReady.quarantineReasons.some((item) => item === "dependency_unknown" || item === "suspected_syndication"));
  }
});

test("AI cannot establish independence, verification, or approval and retains model provenance", async () => {
  const input = base({ extraction: { logicalRunKey: "ai-run-1", method: "ai_assisted", extractorType: "ai_model", extractorId: "extractor", extractorVersion: "1", schemaVersion: "1", providerModelId: "provider/model", executedAt: new Date("2026-09-16") } });
  const result = await new GovernedExternalClaimIngestionService(new MemoryRepository()).ingest({ ...input, claims: [{ ...input.claims[0]!, dependency: { type: "independent_observation", rationale: "AI guessed independence." } }] });
  const record = result.succeeded[0]!;
  assert.equal(record.reviewReady.dependencyState, "unknown_dependency"); assert.equal(record.reviewReady.authority.humanApproved, false); assert.equal(record.reviewReady.authority.independenceEstablished, false);
  assert.equal(record.reviewReady.extraction.providerModelId, "provider/model"); assert.ok(record.reviewReady.quarantineReasons.includes("ai_extraction_requires_review"));
});

test("caller-controlled human review and reviewer provenance are rejected", async () => {
  for (const shortcut of [{ humanReviewed: true }, { reviewerReference: "forged-human" }, { reviewerIdentity: "operator" }, { independenceGroupId: "fake-independent" }]) {
    const input = base();
    const result = await new GovernedExternalClaimIngestionService(new MemoryRepository()).ingest({
      ...input,
      claims: [{ ...input.claims[0]!, dependency: { ...input.claims[0]!.dependency, ...shortcut } as ExternalClaimIngestionInput["claims"][number]["dependency"] }]
    });
    assert.equal(result.succeeded.length, 0);
    assert.equal(result.failed[0]!.code, "CALLER_REVIEW_PROVENANCE_FORBIDDEN");
  }
});

test("semantic identifiers change for normalized value, unit, claim type, and identity while canonical JSON replays", async () => {
  const repository = new MemoryRepository(); const service = new GovernedExternalClaimIngestionService(repository);
  const original = (await service.ingest(base())).succeeded[0]!;
  const input = base(); const claim = input.claims[0]!;
  const variants = [
    { ...claim, normalization: { ...claim.normalization, value: 31 } },
    { ...claim, normalization: { ...claim.normalization, unit: "cm" } },
    { ...claim, claimType: "identity_claim" as const },
    { ...claim, identity: { ...claim.identity, certainty: "equipment_model_match" as const, equipmentVariantId: undefined } }
  ];
  for (const changed of variants) assert.notEqual((await service.ingest({ ...input, claims: [changed] })).succeeded[0]!.idempotencyKey, original.idempotencyKey);
  const reordered = { ...claim, rawStructuredValue: { b: 2, a: 1 } };
  const reorderedAgain = { ...claim, rawStructuredValue: { a: 1, b: 2 } };
  assert.equal((await service.ingest({ ...input, claims: [reordered] })).succeeded[0]!.idempotencyKey, (await service.ingest({ ...input, claims: [reorderedAgain] })).succeeded[0]!.idempotencyKey);
  const ordered = { ...claim, rawStructuredValue: { values: ["first", "second"] } };
  const reversed = { ...claim, rawStructuredValue: { values: ["second", "first"] } };
  assert.notEqual((await service.ingest({ ...input, claims: [ordered] })).succeeded[0]!.idempotencyKey, (await service.ingest({ ...input, claims: [reversed] })).succeeded[0]!.idempotencyKey);
});

test("unknown vocabulary and low-confidence construct mapping are review-ready, not guessed", async () => {
  const input = base(); const claim = input.claims[0]!;
  const result = await new GovernedExternalClaimIngestionService(new MemoryRepository()).ingest({ ...input, claims: [{ ...claim, normalization: { ...claim.normalization, vocabularyKnown: false }, construct: { proposedConstruct: "startup_demand", method: "keyword_candidate", confidence: "low", version: "1.0", rationale: "Candidate phrase only." } }] });
  assert.ok(result.succeeded[0]!.reviewReady.quarantineReasons.includes("unknown_normalization_vocabulary")); assert.ok(result.succeeded[0]!.reviewReady.quarantineReasons.includes("construct_mapping_uncertain"));
});

test("marketing language cannot become structured human or behavioral authority", async () => {
  const input = base(); const claim = input.claims[0]!;
  const result = await new GovernedExternalClaimIngestionService(new MemoryRepository()).ingest({ ...input, claims: [{ ...claim, claimType: "marketing_claim", normalization: { ...claim.normalization, evidenceClass: "structured_human_evaluation" }, construct: { proposedConstruct: "startup_demand", method: "keyword_candidate", confidence: "high", version: "1.0", rationale: "Marketing phrase." } }] });
  assert.equal(result.succeeded[0]!.qualification.state, "not_eligible"); assert.ok(result.succeeded[0]!.reviewReady.quarantineReasons.includes("marketing_not_behavioral_authority"));
});

test("untrusted source authority and unresolved catalog identity cannot qualify", async () => {
  const repository = new MemoryRepository();
  repository.resolutionBlockers = ["source_authority_unresolved", "catalog_identity_unresolved"];
  const result = await new GovernedExternalClaimIngestionService(repository).ingest(base());
  assert.equal(result.succeeded[0]!.qualification.state, "review_required");
  assert.equal(result.succeeded[0]!.reviewReady.identityCertainty, "unresolved");
  assert.ok(result.succeeded[0]!.reviewReady.quarantineReasons.includes("source_authority_unresolved"));
});

test("qualification review_required and not_eligible remain distinct from approval", async () => {
  const ai = await new GovernedExternalClaimIngestionService(new MemoryRepository()).ingest(base({ extraction: { logicalRunKey: "ai-run-2", method: "ai_assisted", extractorType: "ai_model", extractorId: "x", extractorVersion: "1", schemaVersion: "1", providerModelId: "p/m", executedAt: new Date("2026-09-16") } }));
  assert.equal(ai.succeeded[0]!.qualification.state, "review_required");
  const input = base(); const marketing = await new GovernedExternalClaimIngestionService(new MemoryRepository()).ingest({ ...input, claims: [{ ...input.claims[0]!, claimType: "marketing_claim" }] });
  assert.equal(marketing.succeeded[0]!.qualification.state, "not_eligible"); assert.equal(marketing.succeeded[0]!.reviewReady.authority.humanApproved, false);
});

test("one failed claim is rolled back and isolated while another succeeds; retry is idempotent", async () => {
  const repository = new MemoryRepository(); repository.failKeys.add("fail"); const input = base();
  const batch = { ...input, claims: [{ ...input.claims[0]!, externalClaimKey: "ok" }, { ...input.claims[0]!, externalClaimKey: "fail", normalization: { ...input.claims[0]!.normalization, value: 31 } }] };
  const first = await new GovernedExternalClaimIngestionService(repository).ingest(batch);
  assert.equal(first.succeeded.length, 1); assert.equal(first.failed.length, 1); assert.equal(repository.records.size, 1);
  repository.failKeys.clear(); const retry = await new GovernedExternalClaimIngestionService(repository).ingest(batch);
  assert.equal(retry.succeeded.length, 2); assert.equal(repository.records.size, 2); assert.equal(repository.units.length, 2);
});

test("contaminated Atlas USA identity is rejected before any persistence", async () => {
  for (const target of [{ equipmentId: CONTAMINATED_ATLAS_EQUIPMENT_ID }, { equipmentVariantId: CONTAMINATED_ATLAS_VARIANT_ID }]) {
    const repository = new MemoryRepository(); const input = base();
    await assert.rejects(() => new GovernedExternalClaimIngestionService(repository).ingest({ ...input, targetIdentity: { ...input.targetIdentity, ...target } }), (error: unknown) => error instanceof ExternalClaimIngestionError && error.code === "CONTAMINATED_ATLAS_IDENTITY_BLOCKED");
    assert.equal(repository.records.size, 0);
  }
});

test("ingestion exposes no automatic #075, canonical, numeric, synthesis, compatibility, recommendation, ranking, or Decision Book authority", async () => {
  const record = (await new GovernedExternalClaimIngestionService(new MemoryRepository()).ingest(base())).succeeded[0]!;
  assert.equal(record.reviewReady.authority.supportingRoleCreated, false); assert.equal(record.reviewReady.authority.canonicalValueCreated, false); assert.equal(record.reviewReady.authority.numericValueCreated, false); assert.equal(record.reviewReady.authority.synthesisGranted, false); assert.equal(record.reviewReady.authority.recommendationGranted, false);
  assert.equal("compatibilityAuthority" in record.reviewReady.authority, false); assert.equal("ranking" in record.reviewReady.authority, false); assert.equal("decisionBook" in record.reviewReady.authority, false);
});

test("clean Atlas USSSA controlled captures traverse the production boundary without promoting the old research graph", async () => {
  const repository = new MemoryRepository(); const service = new GovernedExternalClaimIngestionService(repository);
  const results = await Promise.all(buildAtlasUsssaProductionCaptureInputs().map((input) => service.ingest(input)));
  assert.equal(results.reduce((sum, item) => sum + item.succeeded.length, 0), 5);
  assert.equal(results.reduce((sum, item) => sum + item.failed.length, 0), 0);
  assert.equal(new Set(repository.units.map((unit) => unit.sourceId)).size, 5);
  assert.equal(new Set(repository.units.map((unit) => unit.documentId)).size, 5);
  assert.equal(repository.units.some((unit) => unit.identity.equipmentId === CONTAMINATED_ATLAS_EQUIPMENT_ID || unit.identity.equipmentVariantId === CONTAMINATED_ATLAS_VARIANT_ID), false);
  assert.ok(results.flatMap((item) => item.succeeded).every((record) => Object.values(record.reviewReady.authority).every((value) => value === false)));
  assert.ok(results.flatMap((item) => item.succeeded).filter((record) => record.reviewReady.quarantineReasons.length > 0).length >= 4);
});

function base(overrides: Partial<ExternalClaimIngestionInput> = {}): ExternalClaimIngestionInput {
  const targetIdentity = { id: "target", certainty: "exact_variant_match" as const, manufacturer: "Louisville Slugger", model: "Atlas", modelYear: 2026, certification: "USSSA", lengthInches: 30, weightOunces: 20, drop: -10, sku: "LS-ATLAS-USSSA-30-20", manufacturerProductId: "WBL41210102030", equipmentId: CLEAN_EQUIPMENT, equipmentVariantId: CLEAN_VARIANT, limitations: [] };
  return {
    source: { stableKey: "louisville-slugger", displayName: "Louisville Slugger", sourceType: "manufacturer_primary", publisherIdentity: "Louisville Slugger", sourceVersion: "1.0" },
    document: { sourceReference: "https://www.slugger.com/en-us/product/atlas-usssa-10-2026-wbl4121", documentType: "product_page", title: "2026 Atlas USSSA -10", capturedAt: new Date("2026-09-10"), availability: "available", boundedContent: "Captured manufacturer specification: 30-inch size, USSSA, drop ten." },
    extraction: { logicalRunKey: "catalog-parser-run-1", method: "deterministic_parser", extractorType: "software", extractorId: "catalog-parser", extractorVersion: "1.0", schemaVersion: "1.0", executedAt: new Date("2026-09-16") },
    targetIdentity,
    claims: [{ externalClaimKey: "length-30", sourceLocation: "specifications", rawText: "30-inch size", claimType: "factual_specification", authority: "authoritative", authorityRationale: "Manufacturer product specification.", identity: targetIdentity, normalization: { claimKey: "nominal_length", value: 30, unit: "in", originalValue: "30-inch", method: "unit_conversion", version: "1.0", vocabularyKnown: true, evidenceClass: "verified_catalog_fact" }, dependency: { type: "original", rationale: "Primary manufacturer source." }, limitations: ["Captured bounded claim text, not a full copyrighted document."] }],
    ...overrides
  };
}
