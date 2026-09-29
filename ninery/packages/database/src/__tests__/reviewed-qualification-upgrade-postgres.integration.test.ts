import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { transpileModule, ModuleKind, ScriptTarget } from "typescript";
import { PrismaExternalClaimIngestionRepository } from "../prisma-external-claim-ingestion-repository.js";
import { PrismaReviewedQualificationRepository } from "../prisma-reviewed-dimension-qualification-convergence-repository.js";
import { ReviewedDimensionQualificationConvergenceService } from "../reviewed-dimension-qualification-convergence.js";
import { GovernedSupportingContextBridgeService } from "../governed-supporting-context-bridge.js";
import { PrismaGovernedSupportingContextBridgeRepository } from "../prisma-governed-supporting-context-bridge-repository.js";
import { convergenceFixture } from "./reviewed-qualification.fixture.js";
import type { ExternalClaimIngestionRecord } from "../external-claim-ingestion.js";

const url = process.env.TEST_DATABASE_URL;
const integration = url ? test : test.skip;
const baseline = "52c108cf255b71f349e4dfa065e832dac5088e21";

integration("#078 populated seven-to-eight upgrade preserves historical NULL and Q1", async () => {
  assert.ok(url);
  const connection = new URL(url);
  assert.equal(connection.hostname, "127.0.0.1");
  assert.ok(/ticket_07[89]/.test(connection.pathname) && connection.pathname.includes("disposable"), "Upgrade testing requires a disposable #078/#079 database");
  const databaseName = `ticket_078_upgrade_${randomUUID().replaceAll("-", "")}_disposable`;
  const admin = new PrismaClient({ datasources: { db: { url } } });
  await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
  await admin.$disconnect();
  connection.pathname = `/${databaseName}`;
  const upgradeUrl = connection.toString();
  const directory = mkdtempSync(join(tmpdir(), "ninery-ticket-078-seven-upgrade-"));
  const packageRoot = process.cwd();
  const prismaCli = resolve(packageRoot, "node_modules/prisma/build/index.js");
  const currentMigrations = resolve(packageRoot, "prisma/migrations");
  const oldSchema = gitFile("prisma/schema.prisma");
  assert.ok(!oldSchema.includes("proposedEvidenceClass String?"));
  writeFileSync(join(directory, "schema.prisma"), oldSchema.replace(/generator client \{/, 'generator client {\n  output = "./client"'));
  writeFileSync(join(directory, "package.json"), '{"type":"module"}');
  cpSync(resolve(packageRoot, "node_modules/@prisma/client"), join(directory, "node_modules/@prisma/client"), { recursive: true, dereference: true });
  mkdirSync(join(directory, "migrations"));
  const folders = readdirSync(currentMigrations).filter(name => /^\d/.test(name));
  assert.equal(folders.length, 8);
  const eighth = "20260926000000_preserve_proposed_evidence_class";
  for (const folder of folders.filter(name => name !== eighth)) cpSync(join(currentMigrations, folder), join(directory, "migrations", folder), { recursive: true });
  cpSync(join(currentMigrations, "migration_lock.toml"), join(directory, "migrations/migration_lock.toml"));
  const env = { ...process.env, DATABASE_URL: upgradeUrl, PRISMA_GENERATE_SKIP_AUTOINSTALL: "1" };
  const prisma = (...args: string[]) => execFileSync(process.execPath, [prismaCli, ...args, `--schema=${join(directory, "schema.prisma")}`], { env, encoding: "utf8", timeout: 120000 });
  prisma("migrate", "deploy");
  prisma("generate");
  const equipmentImport = pathToFileURL(resolve(packageRoot, "../equipment-intelligence/dist/index.js")).href;
  const clientImport = pathToFileURL(join(directory, "client/index.js")).href;
  for (const filename of ["external-claim-ingestion", "prisma-external-claim-ingestion-repository"]) {
    const source = gitFile(`src/${filename}.ts`).replaceAll('"@ninery/equipment-intelligence"', JSON.stringify(equipmentImport)).replaceAll('"@prisma/client"', JSON.stringify(clientImport));
    writeFileSync(join(directory, `${filename}.js`), transpileModule(source, { compilerOptions: { module: ModuleKind.ES2022, target: ScriptTarget.ES2022 } }).outputText);
  }
  writeFileSync(join(directory, "package.json"), '{"type":"module"}');
  // Execute the exact old implementation against its matching generated client.
  writeFileSync(join(directory, "populate.js"), `
import { PrismaClient } from ${JSON.stringify(clientImport)};
import { GovernedExternalClaimIngestionService, externalClaimUuid } from './external-claim-ingestion.js';
import { PrismaExternalClaimIngestionRepository } from './prisma-external-claim-ingestion-repository.js';
import { writeFileSync } from 'node:fs';
const db = new PrismaClient();
try {
const equipment = await db.equipment.create({data:{manufacturer:'Historical upgrade fixture',model:'legacy',modelYear:2026,category:'bat',certification:'USSSA'}});
const variant = await db.equipmentVariant.create({data:{equipmentId:equipment.id,lengthInches:30,weightOunces:20,dropWeight:-10,sku:'UPGRADE-LEGACY'}});
const identity={id:'target',certainty:'exact_variant_match',manufacturer:equipment.manufacturer,model:equipment.model,modelYear:2026,certification:'USSSA',lengthInches:30,weightOunces:20,drop:-10,equipmentId:equipment.id,equipmentVariantId:variant.id,limitations:[]};
const source={stableKey:'upgrade-legacy-source',displayName:'Historical fixture',sourceType:'manufacturer_primary',publisherIdentity:'Historical fixture',sourceVersion:'1.0'};
await db.externalEvidenceSource.create({data:{id:externalClaimUuid('source:'+source.stableKey),...source,metadata:{sourceAuthorityResolved:true}}});
const input={source,document:{sourceReference:'https://example.invalid/legacy',documentType:'product_page',title:'Historical fixture',capturedAt:new Date('2026-09-24'),availability:'available',boundedContent:'30-inch'},extraction:{logicalRunKey:'legacy-run',method:'deterministic_parser',extractorType:'software',extractorId:'legacy-parser',extractorVersion:'1.0',schemaVersion:'1.0',executedAt:new Date('2026-09-24')},targetIdentity:identity,claims:[{externalClaimKey:'length',sourceLocation:'length',rawText:'30-inch',claimType:'factual_specification',authority:'authoritative',authorityRationale:'Historical specification.',identity,normalization:{claimKey:'nominal_length',value:30,unit:'in',method:'unit_conversion',version:'1.0',vocabularyKnown:true,evidenceClass:'verified_catalog_fact'},dependency:{type:'original',rationale:'Primary source.'}}]};
const result=await new GovernedExternalClaimIngestionService(new PrismaExternalClaimIngestionRepository(db)).ingest(input);
if(result.failed.length || !result.succeeded[0]) throw new Error('Legacy ingestion failed');
writeFileSync(${JSON.stringify(join(directory, "legacy-record.json"))},JSON.stringify(result.succeeded[0]));
} finally {await db.$disconnect();}
`);
  execFileSync(process.execPath, [join(directory, "populate.js")], { env, encoding: "utf8", timeout: 120000 });
  const record: ExternalClaimIngestionRecord = JSON.parse(readFileSync(join(directory, "legacy-record.json"), "utf8"));
  const client = new PrismaClient({ datasources: { db: { url: upgradeUrl } }, transactionOptions: { maxWait: 30000, timeout: 30000 } });
  try {
    const before = await client.$queryRawUnsafe<Array<Record<string, unknown>>>('SELECT * FROM "external_evidence_normalized_claims"');
    const qBefore = await client.$queryRawUnsafe<Array<Record<string, unknown>>>('SELECT * FROM "external_evidence_qualification_decisions"');
    assert.equal(before.length, 1); assert.equal(qBefore.length, 1);
    assert.ok(!Object.hasOwn(before[0]!, "proposedEvidenceClass"));
    cpSync(join(currentMigrations, eighth), join(directory, "migrations", eighth), { recursive: true });
    // The approved migration is applied to a populated seven-migration database.
    prisma("migrate", "deploy");
    const after = await client.externalEvidenceNormalizedClaim.findMany();
    const columns = await client.$queryRaw<Array<{ is_nullable: string; column_default: string | null; data_type: string }>>`SELECT is_nullable, column_default, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='external_evidence_normalized_claims' AND column_name='proposedEvidenceClass'`;
    assert.deepEqual(columns, [{ is_nullable: "YES", column_default: null, data_type: "text" }]);
    assert.equal(after.length, 1); assert.equal(after[0]!.proposedEvidenceClass, null);
    const { proposedEvidenceClass: _nullProposal, ...historicalFields } = after[0]!;
    assert.deepEqual(historicalFields, before[0]);
    assert.deepEqual(await client.$queryRawUnsafe('SELECT * FROM "external_evidence_qualification_decisions"'), qBefore);
    const historical = await new PrismaExternalClaimIngestionRepository(client).findByIdempotencyKey(record.idempotencyKey, record.semanticFingerprint);
    assert.ok(historical); assert.equal(historical.qualificationDecisionId, record.qualificationDecisionId);
    const locator = { ingestionIdempotencyKey: record.idempotencyKey, ingestionSemanticFingerprint: record.semanticFingerprint, claimSlotKey: record.claimSlotKey, sourceId: record.sourceId };
    await assert.rejects(() => new ReviewedDimensionQualificationConvergenceService(new PrismaReviewedQualificationRepository(client)).converge(locator), /missing_durable_proposed_evidence_class/);
    await assert.rejects(() => new GovernedSupportingContextBridgeService(new PrismaGovernedSupportingContextBridgeRepository(client)).persist({
      ...locator, expectedQualificationDecisionId: record.qualificationDecisionId, expectedReviewDecisionId: record.qualificationDecisionId,
      identityScope: "exact_variant", direction: "lower", idempotencyKey: "historical-proposal-must-not-be-inferred"
    }), /missing_durable_proposed_evidence_class/);
    assert.equal(await client.externalEvidenceQualificationDecision.count(), 1);
    const fresh = await convergenceFixture(client);
    const normalized = await client.externalEvidenceNormalizedClaim.findUniqueOrThrow({ where: { id: fresh.record.normalizedClaimId } });
    assert.equal(normalized.proposedEvidenceClass, fresh.input.claims[0]!.normalization.evidenceClass);
    assert.equal(normalized.evidenceClass, "unclassified");
    assert.equal((await client.externalEvidenceNormalizedClaim.findUniqueOrThrow({ where: { id: record.normalizedClaimId } })).proposedEvidenceClass, null);
    const migrations = await client.$queryRaw<Array<{ count: bigint }>>`SELECT count(*)::bigint AS count FROM "_prisma_migrations" WHERE "finished_at" IS NOT NULL`;
    assert.equal(migrations[0]!.count, 8n);
  } finally { await client.$disconnect(); }
});

function gitFile(path: string) { return execFileSync("git", ["show", `${baseline}:ninery/packages/database/${path}`], { encoding: "utf8" }); }
