import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Prisma, PrismaClient } from "@prisma/client";
import { CONTAMINATED_ATLAS_EQUIPMENT_ID, CONTAMINATED_ATLAS_VARIANT_ID, externalClaimUuid, GovernedExternalClaimIngestionService, type ExternalClaimIngestionInput } from "../external-claim-ingestion.js";
import { PrismaExternalClaimIngestionRepository } from "../prisma-external-claim-ingestion-repository.js";

const url = process.env.TEST_DATABASE_URL;
const integration = url ? test : test.skip;
const db = url ? new PrismaClient({ datasources: { db: { url } } }) : undefined;

integration("Ticket #076 production ingestion PostgreSQL boundary", async () => {
  assert.ok(db);
  const equipment = await db.equipment.create({ data: { manufacturer: "Integration", model: randomUUID(), modelYear: 2026, category: "bat", certification: "USSSA" } });
  const variant = await db.equipmentVariant.create({ data: { equipmentId: equipment.id, lengthInches: 30, weightOunces: 20, dropWeight: -10, sku: `INT-${randomUUID()}` } });
  const otherVariant = await db.equipmentVariant.create({ data: { equipmentId: equipment.id, lengthInches: 31, weightOunces: 21, dropWeight: -10, sku: `INT-${randomUUID()}` } });
  const service = new GovernedExternalClaimIngestionService(new PrismaExternalClaimIngestionRepository(db));

  // 1-2: exact replay and complete durable projection equality.
  const input = fixture(equipment.id, variant.id); await registerSource(input);
  const first = await service.ingest(input); const replay = await service.ingest(input);
  assert.equal(first.failed.length, 0); assert.deepEqual(replay, first);
  assert.equal(await db.externalEvidenceQualificationDecision.count({ where: { idempotencyKey: first.succeeded[0]!.idempotencyKey } }), 1);

  // 3-5: same-version value/unit changes and cross-variant isolation.
  const changedValue = await service.ingest(withClaim(input, { normalization: { ...input.claims[0]!.normalization, value: 31 } }));
  const changedUnit = await service.ingest(withClaim(input, { normalization: { ...input.claims[0]!.normalization, unit: "cm" } }));
  assert.notEqual(changedValue.succeeded[0]!.normalizedClaimId, first.succeeded[0]!.normalizedClaimId);
  assert.notEqual(changedUnit.succeeded[0]!.normalizedClaimId, first.succeeded[0]!.normalizedClaimId);
  const crossVariant = fixture(equipment.id, otherVariant.id, { sourceStableKey: input.source.stableKey, sourceReference: input.document.sourceReference }); await registerSource(crossVariant);
  const crossVariantResult = await service.ingest(crossVariant);
  assert.equal(crossVariantResult.succeeded[0]!.reviewReady.equipmentVariantId, otherVariant.id);
  assert.notEqual(crossVariantResult.succeeded[0]!.identityAssertionId, first.succeeded[0]!.identityAssertionId);

  // 6: persisted semantic corruption fails closed even when IDs are unchanged.
  const original = await db.externalEvidenceNormalizedClaim.findUniqueOrThrow({ where: { id: first.succeeded[0]!.normalizedClaimId } });
  await db.externalEvidenceNormalizedClaim.update({ where: { id: original.id }, data: { normalizedValue: 999 } });
  assert.equal((await service.ingest(input)).failed[0]!.code, "SEMANTIC_FINGERPRINT_MISMATCH");
  await db.externalEvidenceNormalizedClaim.update({ where: { id: original.id }, data: { normalizedValue: original.normalizedValue === null ? Prisma.JsonNull : original.normalizedValue } });

  // 7-8: fabricated review and untrusted authority cannot pass.
  const forged = fixture(equipment.id, variant.id); await registerSource(forged);
  const forgedResult = await service.ingest(withClaim(forged, { dependency: { ...forged.claims[0]!.dependency, humanReviewed: true, reviewerReference: "forged" } as ExternalClaimIngestionInput["claims"][number]["dependency"] }));
  assert.equal(forgedResult.failed[0]!.code, "CALLER_REVIEW_PROVENANCE_FORBIDDEN");
  const untrusted = fixture(equipment.id, variant.id); const untrustedResult = await service.ingest(untrusted);
  assert.equal(untrustedResult.succeeded[0]!.qualification.state, "review_required");
  assert.ok(untrustedResult.succeeded[0]!.reviewReady.quarantineReasons.includes("source_authority_unresolved"));

  // 9: transaction rollback leaves no partial lineage.
  const rollbackInput = fixture(equipment.id, variant.id); await registerSource(rollbackInput); const beforeRollback = await lineageCounts();
  const failed = await service.ingest(withClaim(rollbackInput, { dependency: { type: "shared_upstream", rationale: "Missing upstream for rollback.", upstreamClaimId: randomUUID() } }));
  assert.equal(failed.failed.length, 1); assert.deepEqual(await lineageCounts(), beforeRollback);

  // 10-11: identical concurrency converges and fingerprint collisions fail closed.
  const concurrentInput = fixture(equipment.id, variant.id); await registerSource(concurrentInput);
  const concurrent = await Promise.all([service.ingest(concurrentInput), service.ingest(concurrentInput)]); assert.deepEqual(concurrent[0], concurrent[1]);
  const repository = new PrismaExternalClaimIngestionRepository(db);
  const collisionChecks = await Promise.allSettled([repository.findByIdempotencyKey(first.succeeded[0]!.idempotencyKey, "bad-a"), repository.findByIdempotencyKey(first.succeeded[0]!.idempotencyKey, "bad-b")]);
  assert.ok(collisionChecks.every((result) => result.status === "rejected"));

  // 12-14: conflicts affect both members, replay, and reverse insertion order.
  assert.equal(changedValue.succeeded[0]!.qualification.state, "review_required");
  const earlierAfterConflict = await service.ingest(input);
  assert.equal(earlierAfterConflict.succeeded[0]!.reviewReady.historicalQualificationState, "qualified");
  assert.equal(earlierAfterConflict.succeeded[0]!.reviewReady.qualificationState, "review_required");
  const reverse = fixture(equipment.id, otherVariant.id); await registerSource(reverse);
  const reverseBInput = withClaim(reverse, { normalization: { ...reverse.claims[0]!.normalization, value: 31 } });
  await service.ingest(reverseBInput); assert.equal((await service.ingest(reverse)).succeeded[0]!.qualification.state, "review_required");
  assert.equal((await service.ingest(reverseBInput)).succeeded[0]!.reviewReady.qualificationState, "review_required");

  // 15-17: same-version rerun, same logical-run retry, and extractor v2.
  const laterInput = { ...input, extraction: { ...input.extraction, logicalRunKey: `${input.extraction.logicalRunKey}:later`, executedAt: new Date("2026-09-17T00:00:00.000Z") } };
  const later = await service.ingest(laterInput); const retry = await service.ingest(laterInput);
  const v2 = await service.ingest({ ...input, extraction: { ...input.extraction, logicalRunKey: `${input.extraction.logicalRunKey}:v2`, extractorVersion: "2.0", executedAt: new Date("2026-09-18T00:00:00.000Z") } });
  assert.notEqual(later.succeeded[0]!.extractionRunId, first.succeeded[0]!.extractionRunId); assert.deepEqual(retry, later); assert.notEqual(v2.succeeded[0]!.extractionRunId, later.succeeded[0]!.extractionRunId);

  // 18-20: two assertions at one location occupy separate slots; reruns update matching slots only and add no independence.
  const multi = fixture(equipment.id, variant.id); await registerSource(multi); const sameLocation = "specifications/table-row-1";
  const multiInput: ExternalClaimIngestionInput = { ...multi, claims: [
    { ...multi.claims[0]!, externalClaimKey: "certification", sourceLocation: sameLocation, rawText: "USSSA certified", claimType: "certification_claim", normalization: { ...multi.claims[0]!.normalization, claimKey: "certification", value: "USSSA", unit: undefined } },
    { ...multi.claims[0]!, externalClaimKey: "barrel", sourceLocation: sameLocation, rawText: "2.75 inch barrel", normalization: { ...multi.claims[0]!.normalization, claimKey: "barrel_diameter", value: 2.75, unit: "in" } }
  ] };
  const multiFirst = await service.ingest(multiInput); assert.equal(multiFirst.succeeded.length, 2); assert.ok(multiFirst.succeeded.every((record) => record.reviewReady.current));
  const multiV2Input = { ...multiInput, extraction: { ...multiInput.extraction, logicalRunKey: `${multiInput.extraction.logicalRunKey}:v2`, executedAt: new Date("2026-09-19T00:00:00.000Z") } };
  const multiV2 = await service.ingest(multiV2Input); assert.ok(multiV2.succeeded.every((record) => record.reviewReady.current));
  const multiOld = await service.ingest(multiInput); assert.ok(multiOld.succeeded.every((record) => !record.reviewReady.current));
  assert.ok(multiOld.succeeded.every((record) => record.reviewReady.supersededByExtractionRunId === multiV2.succeeded[0]!.extractionRunId));
  const dependencies = await db.externalEvidenceDependencyAssessment.findMany({ where: { claimId: { in: [...multiFirst.succeeded, ...multiV2.succeeded].map((record) => record.rawClaimId) } } });
  assert.ok(dependencies.every((row) => row.independenceGroupId === null && row.reviewedState === "review_pending"));

  // 21-23: unknown-vocabulary, AI, and editorial/unclassified projections replay exactly.
  const unknown = fixture(equipment.id, variant.id); await registerSource(unknown); const unknownInput = withClaim(unknown, { normalization: { ...unknown.claims[0]!.normalization, vocabularyKnown: false } });
  const unknownFirst = await service.ingest(unknownInput); const unknownReplay = await service.ingest(unknownInput); assert.deepEqual(unknownReplay, unknownFirst); assert.ok(unknownReplay.succeeded[0]!.reviewReady.quarantineReasons.includes("unknown_normalization_vocabulary"));
  const ai = fixture(equipment.id, variant.id); await registerSource(ai); const aiInput: ExternalClaimIngestionInput = { ...ai, extraction: { ...ai.extraction, method: "ai_assisted", extractorType: "ai_model", providerModelId: "provider/model" } };
  const aiFirst = await service.ingest(aiInput); const aiReplay = await service.ingest(aiInput); assert.deepEqual(aiReplay, aiFirst); assert.ok(aiReplay.succeeded[0]!.reviewReady.quarantineReasons.includes("ai_extraction_requires_review")); assert.ok(!aiReplay.succeeded[0]!.reviewReady.quarantineReasons.includes("processing_requires_review"));
  const editorial = fixture(equipment.id, variant.id); await registerSource(editorial); const editorialInput = withClaim(editorial, { claimType: "subjective_observation", normalization: { ...editorial.claims[0]!.normalization, evidenceClass: "verified_catalog_fact" } });
  const editorialFirst = await service.ingest(editorialInput); const editorialReplay = await service.ingest(editorialInput); assert.deepEqual(editorialReplay, editorialFirst); assert.equal(editorialReplay.succeeded[0]!.reviewReady.normalizedProposal.evidenceClass, "unclassified");

  // 24-25: contaminated identities perform zero writes and no supporting role/canonical output is created.
  const beforeBlocked = await lineageCounts();
  for (const targetIdentity of [{ ...input.targetIdentity, equipmentId: CONTAMINATED_ATLAS_EQUIPMENT_ID }, { ...input.targetIdentity, equipmentVariantId: CONTAMINATED_ATLAS_VARIANT_ID }]) await assert.rejects(() => service.ingest({ ...input, targetIdentity }));
  assert.deepEqual(await lineageCounts(), beforeBlocked);
  assert.equal(await db.externalSupportingRoleDecision.count({ where: { normalizedClaimId: { in: [first.succeeded[0]!.normalizedClaimId, editorialFirst.succeeded[0]!.normalizedClaimId] } } }), 0);
  assert.equal(await db.equipmentDNAAttributeEvaluation.count({ where: { OR: [{ equipmentId: equipment.id }, { equipmentVariantId: { in: [variant.id, otherVariant.id] } }] } }), 0);

  async function registerSource(value: ExternalClaimIngestionInput) {
    await db!.externalEvidenceSource.upsert({ where: { stableKey: value.source.stableKey }, update: {}, create: { id: externalClaimUuid(`source:${value.source.stableKey}`), stableKey: value.source.stableKey, displayName: value.source.displayName, sourceType: value.source.sourceType, publisherIdentity: value.source.publisherIdentity, sourceVersion: value.source.sourceVersion, metadata: { sourceAuthorityResolved: true } } });
  }
  async function lineageCounts() { return { documents: await db!.externalEvidenceDocument.count(), extractions: await db!.externalEvidenceExtractionRun.count(), identities: await db!.externalEvidenceIdentityAssertion.count(), claims: await db!.externalEvidenceClaim.count(), normalized: await db!.externalEvidenceNormalizedClaim.count(), dependencies: await db!.externalEvidenceDependencyAssessment.count(), constructs: await db!.externalEvidenceConstructRelationship.count(), qualifications: await db!.externalEvidenceQualificationDecision.count() }; }
});

function withClaim(input: ExternalClaimIngestionInput, changes: Partial<ExternalClaimIngestionInput["claims"][number]>): ExternalClaimIngestionInput { return { ...input, claims: [{ ...input.claims[0]!, ...changes }] }; }

function fixture(equipmentId: string, equipmentVariantId: string, options: { sourceStableKey?: string; sourceReference?: string } = {}): ExternalClaimIngestionInput {
  const identity = { id: "target", certainty: "exact_variant_match" as const, manufacturer: "Integration", model: "Test", modelYear: 2026, certification: "USSSA", lengthInches: 30, weightOunces: 20, drop: -10, equipmentId, equipmentVariantId, limitations: [] };
  const stableKey = options.sourceStableKey ?? `integration-${randomUUID()}`;
  return { source: { stableKey, displayName: "Integration Manufacturer", sourceType: "manufacturer_primary", publisherIdentity: "Integration Manufacturer", sourceVersion: "1.0" }, document: { sourceReference: options.sourceReference ?? `https://example.invalid/${randomUUID()}`, documentType: "product_page", title: "Bounded integration capture", capturedAt: new Date("2026-09-16"), availability: "available", boundedContent: "30-inch manufacturer specification." }, extraction: { logicalRunKey: `integration:${randomUUID()}`, method: "deterministic_parser", extractorType: "software", extractorId: "integration-parser", extractorVersion: "1.0", schemaVersion: "1.0", executedAt: new Date("2026-09-16") }, targetIdentity: identity, claims: [{ externalClaimKey: "length", sourceLocation: "specifications/length", rawText: "30-inch", claimType: "factual_specification", authority: "authoritative", authorityRationale: "Manufacturer specification.", identity, normalization: { claimKey: "nominal_length", value: 30, unit: "in", method: "unit_conversion", version: "1.0", vocabularyKnown: true, evidenceClass: "verified_catalog_fact" }, dependency: { type: "original", rationale: "Primary source." } }] };
}

test.after(async () => { await db?.$disconnect(); });
