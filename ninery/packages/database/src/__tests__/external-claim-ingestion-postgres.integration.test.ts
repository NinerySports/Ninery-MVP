import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { GovernedExternalClaimIngestionService, type ExternalClaimIngestionInput } from "../external-claim-ingestion.js";
import { PrismaExternalClaimIngestionRepository } from "../prisma-external-claim-ingestion-repository.js";

const url = process.env.TEST_DATABASE_URL;
const integration = url ? test : test.skip;
const db = url ? new PrismaClient({ datasources: { db: { url } } }) : undefined;

integration("production ingestion repository is atomic and idempotent on isolated PostgreSQL", async () => {
  assert.ok(db);
  const equipment = await db.equipment.create({ data: { manufacturer: "Integration", model: randomUUID(), modelYear: 2026, category: "bat", certification: "USSSA" } });
  const variant = await db.equipmentVariant.create({ data: { equipmentId: equipment.id, lengthInches: 30, weightOunces: 20, dropWeight: -10, sku: `INT-${randomUUID()}` } });
  const input = fixture(equipment.id, variant.id);
  const service = new GovernedExternalClaimIngestionService(new PrismaExternalClaimIngestionRepository(db));

  const first = await service.ingest(input);
  assert.equal(first.failed.length, 0); assert.equal(first.succeeded.length, 1);
  const replay = await service.ingest(input);
  assert.equal(replay.succeeded[0]!.qualificationDecisionId, first.succeeded[0]!.qualificationDecisionId);
  assert.equal(replay.succeeded[0]!.normalizedClaimId, first.succeeded[0]!.normalizedClaimId);
  assert.equal(await db.externalEvidenceQualificationDecision.count({ where: { idempotencyKey: first.succeeded[0]!.idempotencyKey } }), 1);
  assert.equal(await db.externalSupportingRoleDecision.count({ where: { normalizedClaimId: first.succeeded[0]!.normalizedClaimId } }), 0);
  assert.equal(await db.equipmentDNAAttributeEvaluation.count({ where: { OR: [{ equipmentId: equipment.id }, { equipmentVariantId: variant.id }] } }), 0);

  const changed = await service.ingest({ ...input, document: { ...input.document, boundedContent: `${input.document.boundedContent} revised` } });
  assert.notEqual(changed.succeeded[0]!.documentId, first.succeeded[0]!.documentId);
  assert.equal((await db.externalEvidenceDocument.findUnique({ where: { id: changed.succeeded[0]!.documentId } }))?.supersedesDocumentId, first.succeeded[0]!.documentId);
  assert.equal((await db.externalEvidenceClaim.findUnique({ where: { id: changed.succeeded[0]!.rawClaimId } }))?.supersedesClaimId, first.succeeded[0]!.rawClaimId);
  const changedVersion = await service.ingest({ ...input, extraction: { ...input.extraction, extractorVersion: "2.0" } });
  assert.equal(changedVersion.succeeded[0]!.documentId, first.succeeded[0]!.documentId);
  assert.notEqual(changedVersion.succeeded[0]!.extractionRunId, first.succeeded[0]!.extractionRunId);

  const conflictInput: ExternalClaimIngestionInput = { ...input, claims: [{ ...input.claims[0]!, externalClaimKey: "conflicting-length", normalization: { ...input.claims[0]!.normalization, value: 31 } }] };
  const conflict = await service.ingest(conflictInput);
  assert.equal(conflict.succeeded[0]!.qualification.state, "review_required");
  assert.ok(conflict.succeeded[0]!.reviewReady.quarantineReasons.includes("current_conflict"));
  assert.equal(await db.externalEvidenceConflictMember.count({ where: { normalizedClaimId: conflict.succeeded[0]!.normalizedClaimId } }), 1);

  const beforeClaims = await db.externalEvidenceClaim.count();
  const failing: ExternalClaimIngestionInput = { ...input, claims: [{ ...input.claims[0]!, externalClaimKey: "bad-upstream", dependency: { type: "shared_upstream", rationale: "Deliberately missing upstream for rollback test.", upstreamClaimId: randomUUID() } }] };
  const failed = await service.ingest(failing);
  assert.equal(failed.failed.length, 1);
  assert.equal(await db.externalEvidenceClaim.count(), beforeClaims, "claim transaction rolls back all lineage rows");
});

function fixture(equipmentId: string, equipmentVariantId: string): ExternalClaimIngestionInput {
  const identity = { id: "target", certainty: "exact_variant_match" as const, manufacturer: "Integration", model: "Test", modelYear: 2026, certification: "USSSA", lengthInches: 30, weightOunces: 20, drop: -10, equipmentId, equipmentVariantId, limitations: [] };
  return {
    source: { stableKey: `integration-${randomUUID()}`, displayName: "Integration Manufacturer", sourceType: "manufacturer_primary", publisherIdentity: "Integration Manufacturer", sourceVersion: "1.0" },
    document: { sourceReference: `https://example.invalid/${randomUUID()}`, documentType: "product_page", title: "Bounded integration capture", capturedAt: new Date("2026-09-16"), availability: "available", boundedContent: "30-inch manufacturer specification." },
    extraction: { method: "deterministic_parser", extractorType: "software", extractorId: "integration-parser", extractorVersion: "1.0", schemaVersion: "1.0", executedAt: new Date("2026-09-16") },
    targetIdentity: identity,
    claims: [{ externalClaimKey: "length", rawText: "30-inch", claimType: "factual_specification", authority: "authoritative", authorityRationale: "Manufacturer specification.", identity, normalization: { claimKey: "nominal_length", value: 30, unit: "in", method: "unit_conversion", version: "1.0", vocabularyKnown: true, evidenceClass: "verified_catalog_fact" }, dependency: { type: "original", rationale: "Primary source." } }]
  };
}

test.after(async () => { await db?.$disconnect(); });
