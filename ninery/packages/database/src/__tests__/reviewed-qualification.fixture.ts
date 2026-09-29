import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { externalClaimUuid, GovernedExternalClaimIngestionService, type ExternalClaimIngestionInput } from "../external-claim-ingestion.js";
import { PrismaExternalClaimIngestionRepository } from "../prisma-external-claim-ingestion-repository.js";
import { GovernedExternalClaimReviewService, type ReviewedSupportingInterpretation } from "../external-claim-review.js";
import { PrismaGovernedReviewRepository } from "../prisma-external-claim-review-repository.js";
import { ReviewedDimensionQualificationConvergenceService } from "../reviewed-dimension-qualification-convergence.js";
import { PrismaReviewedQualificationRepository } from "../prisma-reviewed-dimension-qualification-convergence-repository.js";

export async function convergenceFixture(db: PrismaClient) {
  const equipment = await db.equipment.create({ data: { manufacturer: "Convergence Fixture", model: randomUUID(), modelYear: 2026, category: "bat", certification: "USSSA" } });
  const variant = await db.equipmentVariant.create({ data: { equipmentId: equipment.id, lengthInches: 30, weightOunces: 20, dropWeight: -10, sku: `CONVERGENCE-${randomUUID()}` } });
  const identity = { id: "target", certainty: "exact_variant_match" as const, manufacturer: equipment.manufacturer, model: equipment.model, modelYear: 2026, certification: "USSSA", lengthInches: 30, weightOunces: 20, drop: -10, equipmentId: equipment.id, equipmentVariantId: variant.id, limitations: [] };
  const input: ExternalClaimIngestionInput = {
    source: { stableKey: `convergence-source-${randomUUID()}`, displayName: "Synthetic external expert", sourceType: "independent_expert_review", publisherIdentity: "Synthetic expert", sourceVersion: "fixture-source-1.0" },
    document: { sourceReference: `https://example.invalid/${randomUUID()}`, documentType: "review_article", title: "Synthetic bounded observation", capturedAt: new Date("2026-09-24"), availability: "available", boundedContent: "Easy to start moving." },
    extraction: { logicalRunKey: `convergence-run-${randomUUID()}`, method: "deterministic_parser", extractorType: "software", extractorId: "synthetic-parser", extractorVersion: "1.0", schemaVersion: "1.0", executedAt: new Date("2026-09-24") },
    targetIdentity: identity, claims: [{ externalClaimKey: "startup", sourceLocation: "startup-observation", rawText: "Easy to start moving.", claimType: "subjective_observation", authority: "observational", authorityRationale: "Registered synthetic expert observation.", identity,
      normalization: { claimKey: "startup_demand", value: "easy", method: "controlled_vocabulary", version: "1.0", vocabularyKnown: true, evidenceClass: "structured_human_evaluation" },
      dependency: { type: "unknown_dependency", rationale: "Requires governed independence review." },
      construct: { proposedConstruct: "startup_demand", method: "controlled_vocabulary", confidence: "high", version: "1.0", rationale: "Startup construct proposal." } }] };
  await db.externalEvidenceSource.create({ data: { id: externalClaimUuid(`source:${input.source.stableKey}`), stableKey: input.source.stableKey, displayName: input.source.displayName, sourceType: input.source.sourceType, publisherIdentity: input.source.publisherIdentity, sourceVersion: input.source.sourceVersion, metadata: { sourceAuthorityResolved: true } } });
  const ingestion = new GovernedExternalClaimIngestionService(new PrismaExternalClaimIngestionRepository(db));
  const result = await ingestion.ingest(input);
  if (result.failed.length || !result.succeeded[0]) throw new Error("Synthetic ingestion failed");
  const record = result.succeeded[0];
  const locator = { ingestionIdempotencyKey: record.idempotencyKey, ingestionSemanticFingerprint: record.semanticFingerprint, claimSlotKey: record.claimSlotKey, sourceId: record.sourceId };
  const token = Symbol("human");
  const authorizer = { async authorize(credential: unknown) { return credential === token ? { id: "convergence-human", authority: "external_claim_reviewer" as const } : undefined; } };
  const review = new GovernedExternalClaimReviewService(new PrismaGovernedReviewRepository(db), authorizer);
  const convergence = new ReviewedDimensionQualificationConvergenceService(new PrismaReviewedQualificationRepository(db));
  const dimensionCommand = async () => ({ ...locator, expectedStateFingerprint: (await review.inspect(locator)).stateFingerprint, credential: token, decision: "reviewed_accepted" as const, reason: "Explicit synthetic human review.", idempotencyKey: randomUUID() });
  const dependency = async () => review.reviewDependency({ ...await dimensionCommand(), dependencyType: "independent_observation", independenceGroupId: `expert:${record.sourceId}` });
  const construct = async () => review.reviewConstruct({ ...await dimensionCommand(), role: "supporting_context", mappingConfidence: "high" });
  const content = async (supportingInterpretation?: ReviewedSupportingInterpretation) => review.reviewClaim({
    ...await dimensionCommand(), expectedStateFingerprint: (await review.inspect(locator, supportingInterpretation)).stateFingerprint,
    supportingInterpretation
  });
  return { db, equipment, variant, input, ingestion, record, locator, review, convergence, dimensionCommand, dependency, construct, content, token, authorizer };
}
