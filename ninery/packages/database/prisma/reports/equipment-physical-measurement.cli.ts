import { readFile } from "node:fs/promises";
import { Prisma, PrismaClient } from "@prisma/client";
import { buildPhysicalMeasurementEvidence, buildPhysicalMeasurementSessionTemplate, comparePhysicalMeasurementEvidence, persistPhysicalMeasurementSession, physicalMeasurementEvidenceIsSemanticallyEqual, reviewPhysicalMeasurementSession, type PhysicalMeasurementEvidenceRecord, type PhysicalMeasurementSession } from "@ninery/equipment-intelligence";

const prisma = new PrismaClient();
const [command = "help", ...args] = process.argv.slice(2);
const options = new Map(args.filter((arg) => arg.startsWith("--")).map((arg) => { const [key, ...value] = arg.slice(2).split("="); return [key!, value.join("=") || "true"]; }));

try {
  if (command === "prepare") await prepare();
  else if (command === "validate") await validate();
  else if (command === "commit") await commit();
  else if (command === "report") await report();
  else if (command === "status") await status();
  else help();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

async function prepare() {
  const equipmentId = required("equipment");
  const equipmentVariantId = required("variant");
  const variant = await prisma.equipmentVariant.findUnique({ where: { id: equipmentVariantId }, include: { equipment: true } });
  if (!variant || variant.equipmentId !== equipmentId) throw new Error("Equipment/variant identity was not found or does not match.");
  if (variant.lengthInches === null || variant.weightOunces === null || variant.dropWeight === null) throw new Error("Variant nominal length, weight, and drop are required to prepare a packet.");
  const packet = buildPhysicalMeasurementSessionTemplate({ equipmentId, equipmentVariantId, manufacturer: variant.equipment.manufacturer, model: variant.equipment.model, modelYear: variant.equipment.modelYear, certification: variant.equipment.certification, nominalLengthInches: Number(variant.lengthInches), nominalWeightOunces: Number(variant.weightOunces), nominalDrop: variant.dropWeight, barrelMethod: diameterMethod("barrel-method"), handleMethod: diameterMethod("handle-method") });
  console.log(JSON.stringify(packet, null, 2));
  console.error("Measurements populated: no\nEvidence created: 0\nWrites performed: no");
}

async function validate() {
  const packet = await loadPacket();
  printReview(reviewPhysicalMeasurementSession(packet, await loadCatalogIdentity(packet.equipmentId, packet.equipmentVariantId)));
  console.log("Writes performed: no");
}

async function commit() {
  const packet = await loadPacket();
  const confirmed = options.get("confirm") === "true";
  const result = await persistPhysicalMeasurementSession(packet, repository(), confirmed, await loadCatalogIdentity(packet.equipmentId, packet.equipmentVariantId));
  printReview(result.review);
  console.log(`Created: ${result.created}`);
  console.log(`Unchanged/idempotent: ${result.unchanged}`);
  console.log(`Writes performed: ${result.writesPerformed ? "yes" : "no"}`);
}

async function report() {
  const packet = await loadPacket();
  const review = reviewPhysicalMeasurementSession(packet);
  const byType = new Map(review.blocks.map((block) => [block.measurementType, block]));
  console.log("PHYSICAL SPECIMEN MEASUREMENTS");
  console.log(`Equipment: ${packet.equipmentId}\nVariant: ${packet.equipmentVariantId}\nSpecimen: ${packet.specimenReference}`);
  console.log("\nCATALOG VS MEASURED");
  printComparison("Nominal weight", `${packet.physicalVerification.nominalWeightOunces} oz`, "Measured actual mass", byType.get("actual_mass"));
  printComparison("Nominal length", `${packet.physicalVerification.nominalLengthInches} in`, "Measured overall length", byType.get("overall_length"));
  printComparison("Balance point", "measured only", "Measured", byType.get("balance_point"));
  printComparison("Barrel diameter catalog", "not represented in this packet", "Measured", byType.get("barrel_diameter"));
  printComparison("Handle diameter", "measured only", "Measured", byType.get("handle_diameter"));
  console.log("Differences are descriptive only. No behavioral or recommendation inference was performed.");
  console.log("Writes performed: no");
}

async function status() {
  const packet = await loadPacket();
  const review = reviewPhysicalMeasurementSession(packet, await loadCatalogIdentity(packet.equipmentId, packet.equipmentVariantId));
  if (!review.persistenceEligible) throw new Error(`Physical measurement status blocked: ${review.blockers.join(", ")}.`);
  const quality = new Map(review.blocks.map((block) => [block.measurementType, block.quality]));
  const records = packet.measurementBlocks.map((block) => buildPhysicalMeasurementEvidence(packet, block, quality.get(block.measurementType)!));
  let unchanged = 0; let missing = 0; let conflicts = 0;
  console.log(`PHYSICAL MEASUREMENT REPLAY STATUS\nSession: ${packet.measurementSessionId}`);
  for (const record of records) {
    const existing = await prisma.equipmentDNAEvidenceRecord.findUnique({ where: { id: record.id } });
    if (!existing) { missing += 1; console.log(`- ${record.attributeKey}: missing`); continue; }
    const differences = comparePhysicalMeasurementEvidence(existing, record);
    if (!differences.length) { unchanged += 1; console.log(`- ${record.attributeKey}: unchanged/idempotent`); }
    else {
      conflicts += 1;
      console.log(`- ${record.attributeKey}: conflict (${differences.map((item) => item.field).join(", ")})`);
      for (const difference of differences) {
        console.log(`  persisted ${difference.field}: ${JSON.stringify(difference.persisted)}`);
        console.log(`  generated ${difference.field}: ${JSON.stringify(difference.generated)}`);
      }
    }
  }
  console.log(`Created if confirmed: ${missing}\nUnchanged/idempotent if confirmed: ${unchanged}\nConflicts: ${conflicts}\nWrites performed: no`);
}

function repository() {
  return {
    async persistSessionAtomically(records: readonly PhysicalMeasurementEvidenceRecord[]) {
      return prisma.$transaction(async (tx) => {
        let created = 0; let unchanged = 0;
        for (const record of records) {
          const existing = await tx.equipmentDNAEvidenceRecord.findUnique({ where: { id: record.id } });
          if (existing) {
            if (!physicalMeasurementEvidenceIsSemanticallyEqual(existing, record)) throw new Error(`Physical measurement identity collision for ${record.sourceReference}; immutable evidence was not overwritten.`);
            unchanged += 1; continue;
          }
          const collision = await tx.equipmentDNAEvidenceRecord.findFirst({ where: { sourceReference: record.sourceReference } });
          if (collision) throw new Error(`Physical measurement source reference collision for ${record.sourceReference}; no records were written.`);
          await tx.equipmentDNAEvidenceRecord.create({ data: evidenceData(record) }); created += 1;
        }
        return { created, unchanged };
      });
    }
  };
}

function evidenceData(record: PhysicalMeasurementEvidenceRecord): Prisma.EquipmentDNAEvidenceRecordUncheckedCreateInput { return { id: record.id, equipmentId: record.equipmentId, equipmentVariantId: record.equipmentVariantId, targetLevel: "variant", attributeKey: record.attributeKey, attributeDefinitionVersion: "physical-measurement-1.0", sourceType: "objective_measurement", sourceName: "Ninery Physical Measurement Protocol v1.0", sourceReference: record.sourceReference, sourceDate: new Date(record.sourceDate), method: "instrument_measurement", rawValue: JSON.parse(JSON.stringify(record.rawValue)) as Prisma.InputJsonObject, normalizedValue: JSON.parse(JSON.stringify(record.normalizedValue)) as Prisma.InputJsonObject, unit: record.unit, notes: "Immutable specimen-level direct physical measurement. Not eligible for behavioral inference, canonical evaluation, numeric behavioral references, or recommendations.", status: "active", evaluatorType: "staff", evaluatorReference: record.operatorId }; }
async function loadCatalogIdentity(equipmentId: string, equipmentVariantId: string) { const variant = await prisma.equipmentVariant.findUnique({ where: { id: equipmentVariantId }, include: { equipment: true } }); if (!variant || variant.equipmentId !== equipmentId || variant.lengthInches === null || variant.weightOunces === null || variant.dropWeight === null) throw new Error("Equipment/variant identity was not found, did not match, or lacks nominal specifications."); return { equipmentId, equipmentVariantId, manufacturer: variant.equipment.manufacturer, model: variant.equipment.model, modelYear: variant.equipment.modelYear, certification: variant.equipment.certification, nominalLengthInches: Number(variant.lengthInches), nominalWeightOunces: Number(variant.weightOunces), nominalDrop: variant.dropWeight }; }
async function loadPacket() { return JSON.parse(await readFile(required("file"), "utf8")) as PhysicalMeasurementSession; }
function required(key: string) { const value = options.get(key); if (!value) throw new Error(`--${key}=<value> is required.`); return value; }
function printReview(review: ReturnType<typeof reviewPhysicalMeasurementSession>) { console.log(`Session: ${review.sessionId}\nValid: ${review.valid ? "yes" : "no"}\nPersistence eligible: ${review.persistenceEligible ? "yes" : "no"}`); for (const block of review.blocks) { console.log(`- ${block.measurementType}: ${block.quality}; method ${block.method}; observed ${block.observedQuantity}; trials ${block.repeatability.trialCount}; median ${block.aggregate ?? "unavailable"} ${block.aggregateUnit}; spread ${block.repeatability.range ?? "unavailable"}; threshold ${block.repeatability.threshold}`); if (block.derivationMethod) console.log(`  derived diameter: ${block.normalizedAggregate} ${block.normalizedUnit}; derivation ${block.derivationMethod}`); } if (review.blockers.length) console.log(`Blockers:\n${review.blockers.map((item) => `- ${item}`).join("\n")}`); if (review.warnings.length) console.log(`Warnings:\n${review.warnings.map((item) => `- ${item}`).join("\n")}`); console.log("Behavioral evaluations planned: 0\nNumeric references planned: 0\nRecommendation impact: none"); }
function printComparison(leftLabel: string, left: string, rightLabel: string, block: ReturnType<typeof reviewPhysicalMeasurementSession>["blocks"][number] | undefined) { console.log(`${leftLabel}: ${left}`); if (block?.normalizedAggregate === undefined) { console.log(`${rightLabel}: not measured`); return; } console.log(`${rightLabel}: ${formatNumber(block.normalizedAggregate)} ${block.normalizedUnit}`); console.log(`Method: ${block.method}`); console.log(`Direct observation: ${formatNumber(block.aggregate!)} ${block.aggregateUnit} ${block.observedQuantity}`); if (block.derivationMethod) console.log(`Derivation: ${block.derivationMethod}; derived value is not an independent measurement`); }
function formatNumber(value: number) { return Number(value.toFixed(12)).toString(); }
function diameterMethod(key: string) { const value = options.get(key); if (!value || value === "direct-caliper") return "direct_caliper" as const; if (value === "circumference-derived") return "circumference_derived" as const; throw new Error(`--${key} must be direct-caliper or circumference-derived.`); }
function help() { console.log("Commands: prepare --equipment=<uuid> --variant=<uuid> [--barrel-method=direct-caliper|circumference-derived] [--handle-method=direct-caliper|circumference-derived] | validate --file=<json> | status --file=<json> | commit --file=<json> [--confirm] | report --file=<json>"); }
