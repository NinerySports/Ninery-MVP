import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { externalClaimUuid, GovernedExternalClaimIngestionService, type ExternalClaimIngestionInput } from "../external-claim-ingestion.js";
import { PrismaExternalClaimIngestionRepository } from "../prisma-external-claim-ingestion-repository.js";
import { GovernedExternalClaimReviewService, GovernedReviewError, type ClaimReviewCommand } from "../external-claim-review.js";
import { PrismaGovernedReviewRepository } from "../prisma-external-claim-review-repository.js";

const url = process.env.TEST_DATABASE_URL;
const integration = url ? test : test.skip;
const db = url ? new PrismaClient({ datasources: { db: { url } } }) : undefined;

integration("Ticket #077 exact-state PostgreSQL review boundary", async () => {
  assert.ok(db);
  const equipment = await db.equipment.create({ data: { manufacturer: "Review Fixture", model: randomUUID(), modelYear: 2026, category: "bat", certification: "USSSA" } });
  const variant = await db.equipmentVariant.create({ data: { equipmentId: equipment.id, lengthInches: 30, weightOunces: 20, dropWeight: -10, sku: `REVIEW-${randomUUID()}` } });
  const input = fixture(equipment.id, variant.id, equipment.model);
  await db.externalEvidenceSource.create({ data: { id: externalClaimUuid(`source:${input.source.stableKey}`), stableKey: input.source.stableKey, displayName: input.source.displayName,
    sourceType: input.source.sourceType, publisherIdentity: input.source.publisherIdentity, sourceVersion: "1.0", metadata: { sourceAuthorityResolved: true } } });
  const ingestion = new GovernedExternalClaimIngestionService(new PrismaExternalClaimIngestionRepository(db));
  const ingested = await ingestion.ingest(input);
  assert.deepEqual(ingested.failed, []);
  const record = ingested.succeeded[0]!;
  const token = Symbol("trusted-review-session");
  const authorizer = { async authorize(credential: unknown) { return credential === token ? { id: "reviewer-integration", authority: "external_claim_reviewer" as const } : undefined; } };
  const review = new GovernedExternalClaimReviewService(new PrismaGovernedReviewRepository(db), authorizer);
  const locator = { ingestionIdempotencyKey: record.idempotencyKey, ingestionSemanticFingerprint: record.semanticFingerprint, claimSlotKey: record.claimSlotKey, sourceId: record.sourceId };
  const before = await review.inspect(locator);
  const command: ClaimReviewCommand = { ...locator, expectedStateFingerprint: before.stateFingerprint, credential: token,
    decision: "reviewed_accepted", reason: "Source wording and target checked.", idempotencyKey: `review:${randomUUID()}` };
  await assert.rejects(() => review.reviewClaim({ ...command, credential: { reviewerType: "human", reviewerReference: "forged" } }), GovernedReviewError);
  const first = await review.reviewClaim(command);
  assert.equal((await review.reviewClaim(command)).id, first.id);
  assert.equal((await review.inspect(locator)).applicableDecision?.id, first.id);
  assert.equal(await db.externalEvidenceReviewDecision.count({ where: { idempotencyKey: command.idempotencyKey } }), 1);
  const concurrent = await Promise.allSettled([
    review.reviewClaim({ ...command, expectedPriorDecisionId: first.id, idempotencyKey: `review:${randomUUID()}`, decision: "reviewed_rejected" }),
    review.reviewClaim({ ...command, expectedPriorDecisionId: first.id, idempotencyKey: `review:${randomUUID()}`, decision: "reviewed_returned" })
  ]);
  assert.equal(concurrent.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(concurrent.filter((item) => item.status === "rejected").length, 1);
  assert.equal((await review.inspect(locator)).historicalDecisions.some((item) => item.decision.id === first.id), true);
  await assert.rejects(() => db.externalEvidenceReviewDecision.update({ where: { id: first.id }, data: { decision: "reviewed_rejected" } }));
  await assert.rejects(() => db.externalEvidenceReviewDecision.create({ data: { normalizedClaimId: first.normalizedClaimId, constructRelationshipId: first.constructRelationshipId,
    decision: "reviewed_accepted", reviewerType: "human", reviewerReference: "alternate-writer", reason: "forged binding", limitations: [], idempotencyKey: randomUUID(),
    governedReviewVersion: "1.0", reviewedBinding: { ...first.reviewedBinding, qualificationSemanticFingerprint: "0".repeat(64) },
    reviewedStateFingerprint: first.reviewedStateFingerprint, decisionFingerprint: first.decisionFingerprint } }));

  const dependencyKey = `dependency-review:${randomUUID()}`;
  await review.reviewDependency({ ...command, idempotencyKey: dependencyKey, dependencyType: "independent_observation", independenceGroupId: `reviewed-${randomUUID()}` });
  assert.equal(await db.externalEvidenceDependencyAssessment.count({ where: { idempotencyKey: dependencyKey } }), 1);
  const afterDependency = await review.inspect(locator);
  assert.equal(afterDependency.applicableDecision, undefined);
  assert.equal(afterDependency.historicalDecisions[0]?.reason, "changed_meaning");
  assert.equal((await review.reviewClaim(command)).id, first.id);

  const next = await ingestion.ingest({ ...input, extraction: { ...input.extraction, logicalRunKey: `later-${randomUUID()}`, executedAt: new Date("2026-09-25") } });
  assert.deepEqual(next.failed, []);
  assert.equal((await review.inspect(locator)).applicableDecision, undefined);
  const documentV2 = await ingestion.ingest({ ...input, document: { ...input.document, boundedContent: "30-inch revised specification.", capturedAt: new Date("2026-09-26") },
    extraction: { ...input.extraction, logicalRunKey: `document-v2-${randomUUID()}`, executedAt: new Date("2026-09-26") } });
  assert.deepEqual(documentV2.failed, []);
  const newer = documentV2.succeeded[0]!;
  const newerLocator = { ingestionIdempotencyKey: newer.idempotencyKey, ingestionSemanticFingerprint: newer.semanticFingerprint, claimSlotKey: newer.claimSlotKey, sourceId: newer.sourceId };
  const newerStatus = await review.inspect(newerLocator);
  assert.equal(newer.reviewReady.current, true);
  const newerDecision = await review.reviewClaim({ ...newerLocator, credential: token, expectedStateFingerprint: newerStatus.stateFingerprint,
    decision: "reviewed_accepted", reason: "Reviewed the governing document revision.", idempotencyKey: `review:${randomUUID()}` });
  const lateOldDocument = await ingestion.ingest({ ...input, extraction: { ...input.extraction, logicalRunKey: `late-old-${randomUUID()}`, executedAt: new Date("2026-09-27") } });
  assert.deepEqual(lateOldDocument.failed, []);
  assert.equal((await review.inspect(newerLocator)).applicableDecision?.id, newerDecision.id);
  assert.equal(await db.externalSupportingRoleDecision.count({ where: { rawClaimId: record.rawClaimId } }), 0);
  assert.equal(await db.equipmentDNAAttributeEvaluation.count({ where: { equipmentId: equipment.id } }), 0);
});

function fixture(equipmentId: string, equipmentVariantId: string, model: string): ExternalClaimIngestionInput {
  const identity = { id: "target", certainty: "exact_variant_match" as const, manufacturer: "Review Fixture", model, modelYear: 2026, certification: "USSSA", lengthInches: 30,
    weightOunces: 20, drop: -10, equipmentId, equipmentVariantId, limitations: [] };
  return { source: { stableKey: `review-source-${randomUUID()}`, displayName: "Review Fixture", sourceType: "manufacturer_primary", publisherIdentity: "Review Fixture", sourceVersion: "1.0" },
    document: { sourceReference: `https://example.invalid/${randomUUID()}`, documentType: "product_page", title: "Bounded fixture", capturedAt: new Date("2026-09-24"), availability: "available", boundedContent: "30-inch specification." },
    extraction: { logicalRunKey: `review-run-${randomUUID()}`, method: "deterministic_parser", extractorType: "software", extractorId: "fixture-parser", extractorVersion: "1.0", schemaVersion: "1.0", executedAt: new Date("2026-09-24") },
    targetIdentity: identity, claims: [{ externalClaimKey: "length", sourceLocation: "specifications/length", rawText: "30-inch", claimType: "factual_specification", authority: "authoritative", authorityRationale: "Registered source.",
      identity, normalization: { claimKey: "nominal_length", value: 30, unit: "in", method: "unit_conversion", version: "1.0", vocabularyKnown: true, evidenceClass: "verified_catalog_fact" },
      dependency: { type: "original", rationale: "Primary source." } }] };
}

test.after(async () => { await db?.$disconnect(); });
