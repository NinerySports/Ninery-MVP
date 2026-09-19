import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Prisma, PrismaClient } from "@prisma/client";
import { CONTAMINATED_ATLAS_EQUIPMENT_ID, CONTAMINATED_ATLAS_VARIANT_ID, externalClaimUuid, GovernedExternalClaimIngestionService, qualificationFingerprint, type ExternalClaimIngestionInput } from "../external-claim-ingestion.js";
import { PrismaExternalClaimIngestionRepository } from "../prisma-external-claim-ingestion-repository.js";

const url = process.env.TEST_DATABASE_URL;
const integration = url ? test : test.skip;
const db = url ? new PrismaClient({ datasources: { db: { url } } }) : undefined;
type ConflictWithMembers = Prisma.ExternalEvidenceConflictCaseGetPayload<{ include: { members: { include: { normalizedClaim: true } }; resolutions: true } }>;

integration("Ticket #076 production ingestion PostgreSQL boundary", async () => {
  assert.ok(db);
  const equipment = await db.equipment.create({ data: { manufacturer: "Integration", model: randomUUID(), modelYear: 2026, category: "bat", certification: "USSSA" } });
  const variant = await db.equipmentVariant.create({ data: { equipmentId: equipment.id, lengthInches: 30, weightOunces: 20, dropWeight: -10, sku: `INT-${randomUUID()}` } });
  const otherVariant = await db.equipmentVariant.create({ data: { equipmentId: equipment.id, lengthInches: 31, weightOunces: 21, dropWeight: -10, sku: `INT-${randomUUID()}` } });
  const reverseVariant = await db.equipmentVariant.create({ data: { equipmentId: equipment.id, lengthInches: 32, weightOunces: 22, dropWeight: -10, sku: `INT-${randomUUID()}` } });
  const forwardVariant = await db.equipmentVariant.create({ data: { equipmentId: equipment.id, lengthInches: 33, weightOunces: 23, dropWeight: -10, sku: `INT-${randomUUID()}` } });
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

  // 6: the relational trigger prevents mutation before repository verification;
  // qualification fingerprint behavior is tested without weakening that trigger.
  await assert.rejects(() => db.externalEvidenceQualificationDecision.update({ where: { id: first.succeeded[0]!.qualificationDecisionId }, data: { state: "not_eligible" } }));
  const persistedQualificationRow = await db.externalEvidenceQualificationDecision.findUniqueOrThrow({ where: { id: first.succeeded[0]!.qualificationDecisionId } });
  const validFingerprint = persistedQualificationRow.semanticFingerprint;
  const alteredFingerprint = qualificationFingerprint({ qualification: { ...first.succeeded[0]!.qualification, state: "not_eligible" }, normalizedClaimId: first.succeeded[0]!.normalizedClaimId, rawClaimId: first.succeeded[0]!.rawClaimId, identityAssertionId: first.succeeded[0]!.identityAssertionId, dependencyAssessmentId: first.succeeded[0]!.dependencyAssessmentId, constructRelationshipId: first.succeeded[0]!.constructRelationshipId, sourceGovernanceRevisionId: first.succeeded[0]!.reviewReady.historicalSourceGovernanceRevisionId, authority: first.succeeded[0]!.qualification.authority! });
  assert.notEqual(alteredFingerprint, validFingerprint);

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
  const incompatibleConcurrent = await Promise.all([
    service.ingest(withClaim(concurrentInput, { normalization: { ...concurrentInput.claims[0]!.normalization, value: 32 } })),
    service.ingest(withClaim(concurrentInput, { normalization: { ...concurrentInput.claims[0]!.normalization, value: 33 } }))
  ]);
  assert.notEqual(incompatibleConcurrent[0].succeeded[0]!.normalizedClaimId, incompatibleConcurrent[1].succeeded[0]!.normalizedClaimId);
  const incompatibleCurrent = await Promise.all([
    service.ingest(withClaim(concurrentInput, { normalization: { ...concurrentInput.claims[0]!.normalization, value: 32 } })),
    service.ingest(withClaim(concurrentInput, { normalization: { ...concurrentInput.claims[0]!.normalization, value: 33 } }))
  ]);
  assert.ok(incompatibleCurrent.every((result) => result.succeeded[0]!.reviewReady.qualificationState === "review_required"));
  const repository = new PrismaExternalClaimIngestionRepository(db);
  const collisionChecks = await Promise.allSettled([repository.findByIdempotencyKey(first.succeeded[0]!.idempotencyKey, "bad-a"), repository.findByIdempotencyKey(first.succeeded[0]!.idempotencyKey, "bad-b")]);
  assert.ok(collisionChecks.every((result) => result.status === "rejected"));

  // 12-14: conflicts affect both members, replay, and reverse insertion order.
  assert.equal(changedValue.succeeded[0]!.qualification.state, "review_required");
  const earlierAfterConflict = await service.ingest(input);
  assert.equal(earlierAfterConflict.succeeded[0]!.reviewReady.historicalQualificationState, "qualified");
  assert.equal(earlierAfterConflict.succeeded[0]!.reviewReady.qualificationState, "review_required");
  assert.deepEqual(await service.ingest(input), earlierAfterConflict);
  const forward = fixture(equipment.id, forwardVariant.id); await registerSource(forward);
  const forwardBInput = withClaim({ ...forward, extraction: { ...forward.extraction, logicalRunKey: `${forward.extraction.logicalRunKey}:second`, executedAt: new Date("2026-09-17T00:00:00.000Z") } }, { normalization: { ...forward.claims[0]!.normalization, value: 31 } });
  const forwardAResult = (await service.ingest(forward)).succeeded[0]!;
  const forwardBResult = (await service.ingest(forwardBInput)).succeeded[0]!;
  const reverse = fixture(equipment.id, reverseVariant.id); await registerSource(reverse);
  const reverseBInput = withClaim(reverse, { normalization: { ...reverse.claims[0]!.normalization, value: 31 } });
  const reverseAInput = { ...reverse, extraction: { ...reverse.extraction, logicalRunKey: `${reverse.extraction.logicalRunKey}:second`, executedAt: new Date("2026-09-17T00:00:00.000Z") } };
  const reverseBResult = (await service.ingest(reverseBInput)).succeeded[0]!;
  const reverseAResult = (await service.ingest(reverseAInput)).succeeded[0]!;
  for (const record of [forwardAResult, forwardBResult, reverseAResult, reverseBResult]) {
    const currentRecord = (await service.ingest(record.normalizedClaimId === forwardAResult.normalizedClaimId ? forward : record.normalizedClaimId === forwardBResult.normalizedClaimId ? forwardBInput : record.normalizedClaimId === reverseAResult.normalizedClaimId ? reverseAInput : reverseBInput)).succeeded[0]!;
    assert.equal(currentRecord.reviewReady.qualificationState, "review_required");
    assert.ok(currentRecord.reviewReady.blockers.includes("claim_conflicting"));
    assert.equal(currentRecord.reviewReady.unresolvedConflictIds.length, 1);
  }
  const forwardOperational = [(await service.ingest(forward)).succeeded[0]!, (await service.ingest(forwardBInput)).succeeded[0]!];
  const reverseOperational = [(await service.ingest(reverseAInput)).succeeded[0]!, (await service.ingest(reverseBInput)).succeeded[0]!];
  const conflictSemantics = (record: typeof forwardAResult) => ({ state: record.reviewReady.qualificationState, blockers: [...record.reviewReady.blockers].sort(), reasons: [...record.reviewReady.reasons].sort(), gaps: [...record.qualification.gaps].sort(), warnings: [...record.qualification.warnings].sort(), unresolvedConflictCount: record.reviewReady.unresolvedConflictIds.length, currentConflict: record.reviewReady.quarantineReasons.includes("current_conflict") });
  assert.deepEqual(forwardOperational.map(conflictSemantics), reverseOperational.map(conflictSemantics));
  const forwardHistory = await db.externalEvidenceNormalizedClaim.findMany({ where: { id: { in: [forwardAResult.normalizedClaimId, forwardBResult.normalizedClaimId] } }, include: { rawClaim: { include: { extractionRun: true } } }, orderBy: [{ rawClaim: { extractionRun: { executedAt: "asc" } } }, { id: "asc" }] });
  const reverseHistory = await db.externalEvidenceNormalizedClaim.findMany({ where: { id: { in: [reverseAResult.normalizedClaimId, reverseBResult.normalizedClaimId] } }, include: { rawClaim: { include: { extractionRun: true } } }, orderBy: [{ rawClaim: { extractionRun: { executedAt: "asc" } } }, { id: "asc" }] });
  assert.deepEqual(forwardHistory.map((row) => row.normalizedValue), [30, 31]);
  assert.deepEqual(reverseHistory.map((row) => row.normalizedValue), [31, 30]);
  for (const seed of [forwardAResult, reverseAResult]) {
    const conflictRow: ConflictWithMembers = await db.externalEvidenceConflictCase.findFirstOrThrow({ where: { members: { some: { normalizedClaimId: seed.normalizedClaimId } } }, include: { members: { include: { normalizedClaim: true } }, resolutions: true } });
    assert.deepEqual(conflictRow.members.map((member) => member.normalizedClaim.normalizedValue).sort((a, b) => Number(a) - Number(b)), [30, 31]);
    assert.equal(conflictRow.resolutions.length, 0);
  }

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

  // 20a: document revisions use the same precise slot contract and never cross-supersede.
  const documentV2Input: ExternalClaimIngestionInput = { ...multiInput, document: { ...multiInput.document, revisionLabel: "publisher-v2", boundedContent: "USSSA certified; 2.625 inch barrel." }, extraction: { ...multiInput.extraction, logicalRunKey: `${multiInput.extraction.logicalRunKey}:document-v2`, executedAt: new Date("2026-09-20T00:00:00.000Z") }, claims: [multiInput.claims[0]!, { ...multiInput.claims[1]!, rawText: "2.625 inch barrel", normalization: { ...multiInput.claims[1]!.normalization, value: 2.625 } }] };
  const documentV2 = await service.ingest(documentV2Input);
  assert.equal(documentV2.succeeded.length, 2);
  const documentV1Replay = await service.ingest(multiInput);
  assert.ok(documentV1Replay.succeeded.every((record) => !record.reviewReady.current && record.reviewReady.supersessionReason === "document_revision"));
  const v1Claims = await db.externalEvidenceClaim.findMany({ where: { id: { in: multiFirst.succeeded.map((record) => record.rawClaimId) } }, include: { supersededBy: true } });
  assert.ok(v1Claims.every((claim) => claim.supersededBy.length === 1));
  assert.equal(new Set(v1Claims.map((claim) => claim.claimSlotKey)).size, 2);
  assert.deepEqual(await service.ingest(multiInput), documentV1Replay);

  // 21-23: unknown-vocabulary, AI, and editorial/unclassified projections replay exactly.
  const unknown = fixture(equipment.id, variant.id); await registerSource(unknown); const unknownInput = withClaim(unknown, { normalization: { ...unknown.claims[0]!.normalization, vocabularyKnown: false } });
  const unknownFirst = await service.ingest(unknownInput); const unknownReplay = await service.ingest(unknownInput); assert.deepEqual(unknownReplay, unknownFirst); assert.ok(unknownReplay.succeeded[0]!.reviewReady.quarantineReasons.includes("unknown_normalization_vocabulary"));
  const ai = fixture(equipment.id, variant.id); await registerSource(ai); const aiInput: ExternalClaimIngestionInput = { ...ai, extraction: { ...ai.extraction, method: "ai_assisted", extractorType: "ai_model", providerModelId: "provider/model" } };
  const aiFirst = await service.ingest(aiInput); const aiReplay = await service.ingest(aiInput); assert.deepEqual(aiReplay, aiFirst); assert.ok(aiReplay.succeeded[0]!.reviewReady.quarantineReasons.includes("ai_extraction_requires_review")); assert.ok(!aiReplay.succeeded[0]!.reviewReady.quarantineReasons.includes("processing_requires_review"));
  const editorial = fixture(equipment.id, variant.id); await registerSource(editorial); const editorialInput = withClaim(editorial, { claimType: "subjective_observation", normalization: { ...editorial.claims[0]!.normalization, evidenceClass: "verified_catalog_fact" } });
  const editorialFirst = await service.ingest(editorialInput); const editorialReplay = await service.ingest(editorialInput); assert.deepEqual(editorialReplay, editorialFirst); assert.equal(editorialReplay.succeeded[0]!.reviewReady.normalizedProposal.evidenceClass, "unclassified");
  const unresolvedDependency = fixture(equipment.id, variant.id); await registerSource(unresolvedDependency); const unresolvedDependencyInput = withClaim(unresolvedDependency, { dependency: { type: "suspected_dependency", rationale: "Possible syndication requires review." } });
  const unresolvedDependencyFirst = await service.ingest(unresolvedDependencyInput); assert.deepEqual(await service.ingest(unresolvedDependencyInput), unresolvedDependencyFirst);

  // 24-25: contaminated identities perform zero writes and no supporting role/canonical output is created.
  const beforeBlocked = await lineageCounts();
  for (const targetIdentity of [{ ...input.targetIdentity, equipmentId: CONTAMINATED_ATLAS_EQUIPMENT_ID }, { ...input.targetIdentity, equipmentVariantId: CONTAMINATED_ATLAS_VARIANT_ID }]) await assert.rejects(() => service.ingest({ ...input, targetIdentity }));
  assert.deepEqual(await lineageCounts(), beforeBlocked);
  assert.equal(await db.externalSupportingRoleDecision.count({ where: { normalizedClaimId: { in: [first.succeeded[0]!.normalizedClaimId, editorialFirst.succeeded[0]!.normalizedClaimId] } } }), 0);
  assert.equal(await db.equipmentDNAAttributeEvaluation.count({ where: { OR: [{ equipmentId: equipment.id }, { equipmentVariantId: { in: [variant.id, otherVariant.id] } }] } }), 0);
  const beforeStopBoundary = await downstreamCounts();
  const stopBoundaryInput = fixture(equipment.id, variant.id); await registerSource(stopBoundaryInput);
  assert.equal((await service.ingest(stopBoundaryInput)).failed.length, 0);
  assert.deepEqual(await downstreamCounts(), beforeStopBoundary);

  // 26-30: governance history, material reevaluation, ambiguity, and database source lineage.
  const governanceInput = fixture(equipment.id, variant.id); await registerSource(governanceInput);
  const governanceFirst = (await service.ingest(governanceInput)).succeeded[0]!;
  assert.deepEqual((await service.ingest(governanceInput)).succeeded[0], governanceFirst);
  const g1 = await db.externalEvidenceSourceGovernanceRevision.findUniqueOrThrow({ where: { id: governanceFirst.reviewReady.historicalSourceGovernanceRevisionId } });
  const g1Snapshot = structuredClone(g1);
  const historicalQualificationSnapshot = await historicalQualificationMaterial(governanceFirst.qualificationDecisionId);
  const beforeGovernanceEvolution = await governanceAuthorityCounts();
  const g2 = await db.externalEvidenceSourceGovernanceRevision.create({ data: { sourceId: g1.sourceId, revisionNumber: 2, governanceVersion: "1.0", sourceType: g1.sourceType, publisherIdentity: g1.publisherIdentity, authorityScope: { claimAuthority: "authoritative", authorizedClaimTypes: [] }, dependencyKnowledge: { state: "claim_level_assessment_required" }, state: "active", reviewerType: "system", reviewerReference: "ticket-076-postgres-governance-fixture", rationale: "Authority scope no longer covers factual specifications.", effectiveAt: new Date("2026-09-21T00:00:00.000Z"), supersedesRevisionId: g1.id, idempotencyKey: `governance-g2:${g1.id}` } });
  const governanceReplay = (await service.ingest(governanceInput)).succeeded[0]!;
  assert.deepEqual(await db.externalEvidenceSourceGovernanceRevision.findUniqueOrThrow({ where: { id: g1.id } }), g1Snapshot);
  assert.deepEqual(await historicalQualificationMaterial(governanceFirst.qualificationDecisionId), historicalQualificationSnapshot);
  assert.equal(governanceReplay.reviewReady.historicalSourceGovernanceRevisionId, g1.id);
  assert.equal(governanceReplay.reviewReady.currentSourceGovernanceRevisionId, g2.id);
  assert.equal(governanceReplay.reviewReady.sourceGovernanceChanged, true);
  assert.equal(governanceReplay.reviewReady.historicalQualificationState, governanceFirst.reviewReady.historicalQualificationState);
  assert.equal(governanceReplay.reviewReady.qualificationState, "review_required");
  assert.ok(governanceReplay.reviewReady.blockers.includes("source_governance_authority_scope_changed"));
  assert.deepEqual(await governanceAuthorityCounts(), beforeGovernanceEvolution);
  assert.equal((await db.externalEvidenceSourceGovernanceRevision.findMany({ where: { sourceId: g1.sourceId }, include: { supersededBy: true } })).filter((row) => row.supersededBy.length === 0).length, 1);

  const g3 = await db.externalEvidenceSourceGovernanceRevision.create({ data: { sourceId: g1.sourceId, revisionNumber: 3, governanceVersion: "1.0", sourceType: g1.sourceType, publisherIdentity: g1.publisherIdentity, authorityScope: { claimAuthority: "authoritative" }, dependencyKnowledge: { state: "unknown" }, state: "active", reviewerType: "system", reviewerReference: "ticket-076-postgres-governance-fixture", rationale: "Dependency knowledge became uncertain.", effectiveAt: new Date("2026-09-22T00:00:00.000Z"), supersedesRevisionId: g2.id, idempotencyKey: `governance-g3:${g1.id}` } });
  const dependencyReplay = (await service.ingest(governanceInput)).succeeded[0]!;
  assert.equal(dependencyReplay.reviewReady.currentSourceGovernanceRevisionId, g3.id);
  assert.equal(dependencyReplay.reviewReady.dependencyState, "unknown_dependency");
  assert.ok(dependencyReplay.reviewReady.blockers.includes("source_governance_dependency_unresolved"));
  assert.equal(dependencyReplay.reviewReady.authority.independenceEstablished, false);
  assert.deepEqual(await governanceAuthorityCounts(), beforeGovernanceEvolution);

  await db.externalEvidenceSourceGovernanceRevision.create({ data: { sourceId: g1.sourceId, revisionNumber: 4, governanceVersion: "1.0", sourceType: g1.sourceType, publisherIdentity: g1.publisherIdentity, authorityScope: { claimAuthority: "authoritative" }, dependencyKnowledge: { state: "claim_level_assessment_required" }, state: "active", reviewerType: "system", reviewerReference: "ticket-076-postgres-governance-fixture", rationale: "First current branch.", effectiveAt: new Date("2026-09-23T00:00:00.000Z"), supersedesRevisionId: g3.id, idempotencyKey: `governance-g4a:${g1.id}` } });
  await db.externalEvidenceSourceGovernanceRevision.create({ data: { sourceId: g1.sourceId, revisionNumber: 5, governanceVersion: "1.0", sourceType: g1.sourceType, publisherIdentity: g1.publisherIdentity, authorityScope: { claimAuthority: "authoritative" }, dependencyKnowledge: { state: "claim_level_assessment_required" }, state: "active", reviewerType: "system", reviewerReference: "ticket-076-postgres-governance-fixture", rationale: "Second unsuperseded branch.", effectiveAt: new Date("2026-09-23T00:00:01.000Z"), idempotencyKey: `governance-g4b:${g1.id}` } });
  const ambiguousReplay = (await service.ingest(governanceInput)).succeeded[0]!;
  assert.equal(ambiguousReplay.reviewReady.qualificationState, "review_required");
  assert.ok(ambiguousReplay.reviewReady.blockers.includes("source_governance_ambiguous"));
  assert.deepEqual(await governanceAuthorityCounts(), beforeGovernanceEvolution);

  const sourceB = await db.externalEvidenceSource.create({ data: { stableKey: `source-b-${randomUUID()}`, displayName: "Source B", sourceType: "manufacturer_primary", sourceVersion: "1.0" } });
  await assert.rejects(() => db.externalEvidenceSourceGovernanceRevision.create({ data: { sourceId: sourceB.id, revisionNumber: 1, governanceVersion: "1.0", sourceType: "manufacturer_primary", authorityScope: { claimAuthority: "authoritative" }, dependencyKnowledge: { state: "claim_level_assessment_required" }, state: "active", reviewerType: "system", reviewerReference: "negative-test", rationale: "Invalid cross-source predecessor.", effectiveAt: new Date(), supersedesRevisionId: g1.id, idempotencyKey: `invalid-cross-source:${g1.id}` } }));
  const governanceB = await db.externalEvidenceSourceGovernanceRevision.create({ data: { sourceId: sourceB.id, revisionNumber: 1, governanceVersion: "1.0", sourceType: "manufacturer_primary", authorityScope: { claimAuthority: "authoritative" }, dependencyKnowledge: { state: "claim_level_assessment_required" }, state: "active", reviewerType: "system", reviewerReference: "negative-test", rationale: "Valid Source B governance.", effectiveAt: new Date(), idempotencyKey: `source-b-governance:${sourceB.id}` } });
  const persistedQualification = await db.externalEvidenceQualificationDecision.findUniqueOrThrow({ where: { id: governanceFirst.qualificationDecisionId } });
  const copyQualification = (overrides: Partial<Prisma.ExternalEvidenceQualificationDecisionUncheckedCreateInput> = {}): Prisma.ExternalEvidenceQualificationDecisionUncheckedCreateInput => ({
    ...persistedQualification,
    reasons: persistedQualification.reasons as Prisma.InputJsonValue, gaps: persistedQualification.gaps as Prisma.InputJsonValue, blockers: persistedQualification.blockers as Prisma.InputJsonValue, warnings: persistedQualification.warnings as Prisma.InputJsonValue, limitations: persistedQualification.limitations as Prisma.InputJsonValue,
    proposedEvidenceInput: persistedQualification.proposedEvidenceInput === null ? Prisma.JsonNull : persistedQualification.proposedEvidenceInput as Prisma.InputJsonValue,
    id: randomUUID(), idempotencyKey: `qualification-copy:${randomUUID()}`, decidedAt: new Date(), ...overrides
  });
  const validQualification = await db.externalEvidenceQualificationDecision.create({ data: copyQualification({ sourceId: g1.sourceId, sourceGovernanceRevisionId: g1.id }) });
  assert.equal(validQualification.sourceId, g1.sourceId);
  await assert.rejects(() => db.externalEvidenceQualificationDecision.create({ data: copyQualification({ sourceId: null, sourceGovernanceRevisionId: null }) }));
  await assert.rejects(() => db.externalEvidenceQualificationDecision.create({ data: copyQualification({ sourceId: g1.sourceId, sourceGovernanceRevisionId: null }) }));
  await assert.rejects(() => db.externalEvidenceQualificationDecision.create({ data: copyQualification({ sourceId: null, sourceGovernanceRevisionId: g1.id }) }));
  await assert.rejects(() => db.externalEvidenceQualificationDecision.create({ data: copyQualification({ sourceId: g1.sourceId, sourceGovernanceRevisionId: governanceB.id }) }));
  await assert.rejects(() => db.externalEvidenceQualificationDecision.create({ data: copyQualification({ sourceId: sourceB.id, sourceGovernanceRevisionId: governanceB.id }) }));
  await assert.rejects(() => db.externalEvidenceLegacyQualificationExemption.create({ data: { qualificationId: randomUUID(), reason: "Arbitrary post-migration exemption." } }));

  async function registerSource(value: ExternalClaimIngestionInput) {
    await db!.externalEvidenceSource.upsert({ where: { stableKey: value.source.stableKey }, update: {}, create: { id: externalClaimUuid(`source:${value.source.stableKey}`), stableKey: value.source.stableKey, displayName: value.source.displayName, sourceType: value.source.sourceType, publisherIdentity: value.source.publisherIdentity, sourceVersion: value.source.sourceVersion, metadata: { sourceAuthorityResolved: true } } });
  }
  async function lineageCounts() { return { sources: await db!.externalEvidenceSource.count(), governance: await db!.externalEvidenceSourceGovernanceRevision.count(), documents: await db!.externalEvidenceDocument.count(), extractions: await db!.externalEvidenceExtractionRun.count(), identities: await db!.externalEvidenceIdentityAssertion.count(), claims: await db!.externalEvidenceClaim.count(), normalized: await db!.externalEvidenceNormalizedClaim.count(), dependencies: await db!.externalEvidenceDependencyAssessment.count(), constructs: await db!.externalEvidenceConstructRelationship.count(), qualifications: await db!.externalEvidenceQualificationDecision.count(), conflicts: await db!.externalEvidenceConflictCase.count(), conflictMembers: await db!.externalEvidenceConflictMember.count(), reviews: await db!.externalEvidenceReviewDecision.count(), supporting: await db!.externalSupportingRoleDecision.count() }; }
  async function downstreamCounts() { return { supporting: await db!.externalSupportingRoleDecision.count(), acceptedConstructs: await db!.externalEvidenceConstructRelationship.count({ where: { reviewState: { in: ["reviewed_accepted", "reviewed_with_limitations"] } } }), acceptedDependencyReviews: await db!.externalEvidenceDependencyAssessment.count({ where: { reviewedState: { in: ["reviewed_accepted", "reviewed_with_limitations"] } } }), acceptedReviewDecisions: await db!.externalEvidenceReviewDecision.count({ where: { decision: { in: ["reviewed_accepted", "reviewed_with_limitations"] } } }), canonicalEvaluations: await db!.equipmentDNAAttributeEvaluation.count({ where: { OR: [{ equipmentId: equipment.id }, { equipmentVariantId: { in: [variant.id, otherVariant.id, reverseVariant.id, forwardVariant.id] } }] } }) }; }
  async function historicalQualificationMaterial(id: string) { const row = await db!.externalEvidenceQualificationDecision.findUniqueOrThrow({ where: { id }, include: { normalizedClaim: { include: { rawClaim: true } } } }); return { id: row.id, state: row.state, sourceGovernanceRevisionId: row.sourceGovernanceRevisionId, sourceId: row.sourceId, contractVersion: row.contractVersion, authority: row.normalizedClaim.rawClaim.authority, proposedEvidenceClass: row.proposedEvidenceClass, proposedEvidenceInput: row.proposedEvidenceInput, proposedTargetLevel: row.proposedTargetLevel, reasons: row.reasons, gaps: row.gaps, blockers: row.blockers, warnings: row.warnings, limitations: row.limitations, semanticFingerprint: row.semanticFingerprint, normalizedClaimId: row.normalizedClaimId, constructRelationshipId: row.constructRelationshipId, idempotencyKey: row.idempotencyKey }; }
  async function governanceAuthorityCounts() { return { claims: await db!.externalEvidenceClaim.count(), normalizedClaims: await db!.externalEvidenceNormalizedClaim.count(), independentDependencies: await db!.externalEvidenceDependencyAssessment.count({ where: { independenceGroupId: { not: null } } }), dnaEvidence: await db!.equipmentDNAEvidenceRecord.count(), supporting: await db!.externalSupportingRoleDecision.count(), canonicalOrNumericEvaluations: await db!.equipmentDNAAttributeEvaluation.count(), dnaScores: await db!.equipmentDNAScore.count(), recommendations: await db!.recommendation.count(), recommendationItems: await db!.recommendationItem.count(), decisionBooks: await db!.decisionBook.count() }; }
});

function withClaim(input: ExternalClaimIngestionInput, changes: Partial<ExternalClaimIngestionInput["claims"][number]>): ExternalClaimIngestionInput { return { ...input, claims: [{ ...input.claims[0]!, ...changes }] }; }

function fixture(equipmentId: string, equipmentVariantId: string, options: { sourceStableKey?: string; sourceReference?: string } = {}): ExternalClaimIngestionInput {
  const identity = { id: "target", certainty: "exact_variant_match" as const, manufacturer: "Integration", model: "Test", modelYear: 2026, certification: "USSSA", lengthInches: 30, weightOunces: 20, drop: -10, equipmentId, equipmentVariantId, limitations: [] };
  const stableKey = options.sourceStableKey ?? `integration-${randomUUID()}`;
  return { source: { stableKey, displayName: "Integration Manufacturer", sourceType: "manufacturer_primary", publisherIdentity: "Integration Manufacturer", sourceVersion: "1.0" }, document: { sourceReference: options.sourceReference ?? `https://example.invalid/${randomUUID()}`, documentType: "product_page", title: "Bounded integration capture", capturedAt: new Date("2026-09-16"), availability: "available", boundedContent: "30-inch manufacturer specification." }, extraction: { logicalRunKey: `integration:${randomUUID()}`, method: "deterministic_parser", extractorType: "software", extractorId: "integration-parser", extractorVersion: "1.0", schemaVersion: "1.0", executedAt: new Date("2026-09-16") }, targetIdentity: identity, claims: [{ externalClaimKey: "length", sourceLocation: "specifications/length", rawText: "30-inch", claimType: "factual_specification", authority: "authoritative", authorityRationale: "Manufacturer specification.", identity, normalization: { claimKey: "nominal_length", value: 30, unit: "in", method: "unit_conversion", version: "1.0", vocabularyKnown: true, evidenceClass: "verified_catalog_fact" }, dependency: { type: "original", rationale: "Primary source." } }] };
}

test.after(async () => { await db?.$disconnect(); });
