import { PrismaClient } from "@prisma/client";
import { buildEquipmentDNAEvidenceReadModel, multiSourceEvidenceClassValues, type EquipmentDNACatalogFactInput, type EquipmentDNAEvidenceItem, type EquipmentDNAEvidenceRecordInput, type EquipmentDNAEvidenceReadModel } from "@ninery/equipment-intelligence";

const prisma = new PrismaClient();
const options = new Map(process.argv.slice(2).filter((arg) => arg.startsWith("--")).map((arg) => { const [key, ...value] = arg.slice(2).split("="); return [key!, value.join("=")]; }));

try {
  const equipmentId = required("equipment"); const variantId = options.get("variant") || undefined; const specimen = options.get("specimen") || undefined;
  const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId }, include: { variants: { orderBy: [{ sku: "asc" }, { id: "asc" }] }, specifications: { orderBy: { specificationCode: "asc" } } } });
  if (!equipment) throw new Error(`Equipment not found: ${equipmentId}`);
  const variant = variantId ? equipment.variants.find((item) => item.id === variantId) : undefined;
  if (variantId && !variant) throw new Error(`Variant ${variantId} does not belong to equipment ${equipmentId}.`);
  const rows = await prisma.equipmentDNAEvidenceRecord.findMany({ where: { equipmentId, ...(variantId ? { OR: [{ targetLevel: "equipment" }, { equipmentVariantId: variantId }] } : {}) }, orderBy: [{ sourceDate: "asc" }, { sourceReference: "asc" }, { id: "asc" }] });
  const records = rows.map((row): EquipmentDNAEvidenceRecordInput => ({ id: row.id, equipmentId: row.equipmentId ?? undefined, equipmentVariantId: row.equipmentVariantId ?? undefined, targetLevel: row.targetLevel, attributeKey: row.attributeKey, sourceType: row.sourceType, sourceName: row.sourceName, sourceReference: row.sourceReference ?? undefined, sourceDate: row.sourceDate ?? undefined, method: row.method, rawValue: row.rawValue ?? undefined, normalizedValue: row.normalizedValue ?? undefined, unit: row.unit ?? undefined, notes: row.notes ?? undefined, status: row.status, evaluatorType: row.evaluatorType ?? undefined, evaluatorReference: row.evaluatorReference ?? undefined })).filter((record) => !specimen || rawString(record.rawValue, "specimenReference") === specimen);
  const model = buildEquipmentDNAEvidenceReadModel({
    identity: { equipmentId: equipment.id, manufacturer: equipment.manufacturer, model: equipment.model, modelYear: equipment.modelYear ?? undefined, certification: equipment.certification, variant: variant ? { id: variant.id, sku: variant.sku ?? undefined, lengthInches: decimal(variant.lengthInches), weightOunces: decimal(variant.weightOunces), dropWeight: variant.dropWeight ?? undefined } : undefined },
    catalogFacts: catalogFacts(equipment, variant), records
  });
  print(model, specimen);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1;
} finally { await prisma.$disconnect(); }

function catalogFacts(equipment: Awaited<ReturnType<typeof prisma.equipment.findUnique>> & { specifications?: readonly { specificationCode: string; valueText: string | null; valueNumber: unknown; unit: string | null; source: string | null; verifiedAt: Date | null }[] }, variant: { id: string; sku: string | null; lengthInches: unknown; weightOunces: unknown; dropWeight: number | null } | undefined): EquipmentDNACatalogFactInput[] {
  const facts: EquipmentDNACatalogFactInput[] = [
    fact("certification", equipment.certification, undefined, "equipment"), fact("construction", equipment.construction, undefined, "equipment"), fact("material", equipment.material, undefined, "equipment"), fact("barrel_diameter", decimal(equipment.barrelDiameter), "inches", "equipment")
  ].filter((item): item is EquipmentDNACatalogFactInput => item.value !== undefined && item.value !== null);
  if (variant) facts.push(fact("length", decimal(variant.lengthInches), "inches", "variant"), fact("weight", decimal(variant.weightOunces), "ounces", "variant"), fact("drop", variant.dropWeight, undefined, "variant"));
  for (const specification of equipment.specifications ?? []) facts.push({ key: specification.specificationCode, value: specification.valueText ?? decimal(specification.valueNumber), unit: specification.unit ?? undefined, level: "equipment", sourceName: specification.source ?? "Ninery equipment specifications", verifiedAt: specification.verifiedAt ?? undefined });
  return facts.filter((item) => item.value !== undefined && item.value !== null);
}

function fact(key: string, value: unknown, unit: string | undefined, level: "equipment" | "variant"): EquipmentDNACatalogFactInput { return { key, value, unit, level, sourceName: "Ninery equipment catalog", sourceReference: `catalog:${key}` }; }

function print(model: EquipmentDNAEvidenceReadModel, specimen?: string) {
  const variant = model.identity.variant;
  console.log("EQUIPMENT DNA EVIDENCE READ MODEL");
  console.log(`Version: ${model.version}\n\nEQUIPMENT IDENTITY\nEquipment: ${model.identity.manufacturer} ${model.identity.model}${model.identity.modelYear ? ` ${model.identity.modelYear}` : ""}\nEquipment ID: ${model.identity.equipmentId}`);
  console.log(`Variant: ${variant ? `${variant.lengthInches ?? "?"} in / ${variant.weightOunces ?? "?"} oz / ${variant.dropWeight ?? "?"} (${variant.sku ?? variant.id})` : "all variants"}`);
  if (specimen) console.log(`Specimen filter: ${specimen}`);
  console.log("\nEVIDENCE INVENTORY"); for (const evidenceClass of multiSourceEvidenceClassValues) console.log(`- ${evidenceClass}: ${model.evidenceClassCounts[evidenceClass]}`);
  section("CATALOG EVIDENCE", model.evidenceByClass.verified_catalog_fact, printCatalog);
  section("PHYSICAL MEASUREMENT EVIDENCE", model.evidenceByClass.direct_physical_measurement, printPhysical);
  section("STRUCTURED HUMAN EVALUATION EVIDENCE", model.evidenceByClass.structured_human_evaluation, printHuman);
  section("CONTROLLED MECHANICAL TESTS", model.evidenceByClass.controlled_mechanical_test, printGeneric);
  section("STRUCTURED FIELD OBSERVATIONS", model.evidenceByClass.structured_field_observation, printGeneric);
  section("MODELED ESTIMATES", model.evidenceByClass.modeled_estimate, printGeneric);
  console.log("\nCONSTRUCT SUPPORT");
  for (const support of model.constructSupport) console.log(`- ${support.construct}: ${support.supportState}; evidence ${support.evidence.length}; classes ${support.evidenceClassesRepresented.join(", ") || "none"}; sources ${support.sourceCount}; sessions ${support.sessionCount}; specimens ${support.specimenCount}; synthesis sufficient: no`);
  console.log("\nCONFLICT / DIFFERENCE SUMMARY");
  if (!model.differences.length) console.log("- no comparable catalog/specimen pairs"); else for (const difference of model.differences) console.log(`- ${difference.key}: ${difference.state}. ${difference.explanation}`);
  console.log(`\nMISSING EVIDENCE\n${model.missingEvidenceClasses.length ? model.missingEvidenceClasses.map((item) => `- ${item}`).join("\n") : "- none"}`);
  console.log("\nFIREWALL STATUS\nCanonical changes: none\nNumeric reference changes: none\nModeled estimates created: none\nRecommendation impact: none\nWrites performed: no");
}

function section(title: string, items: readonly EquipmentDNAEvidenceItem[], printer: (item: EquipmentDNAEvidenceItem) => void) { console.log(`\n${title}`); if (!items.length) console.log("- none"); else items.forEach(printer); }
function printCatalog(item: EquipmentDNAEvidenceItem) { console.log(`- ${item.claimKey}: ${compact(item.rawObservation)}; level ${item.knowledgeLevel}; source ${item.sourceName}`); }
function printPhysical(item: EquipmentDNAEvidenceItem) { const raw = rawObject(item.rawObservation); const instrument = rawObject(raw.instrument); const trials = Array.isArray(raw.trials) ? raw.trials.map((trial) => rawObject(trial).value).filter((value) => value !== undefined) : []; console.log(`- ${item.claimKey}`); console.log(`  specimen/session: ${item.specimenReference ?? "not recorded"} / ${item.sessionReference ?? "not recorded"}`); console.log(`  observed: ${String(raw.observedQuantity ?? item.claimKey)}; trials ${trials.length ? trials.join(", ") : "not recorded"} ${String(raw.rawUnit ?? item.unit ?? "")}`.trimEnd()); console.log(`  median: ${compact(item.aggregate)} ${String(raw.rawUnit ?? item.unit ?? "")}`.trimEnd()); console.log(`  method/protocol: ${item.method} / ${item.protocolVersion ?? "not recorded"}`); console.log(`  normalized: ${compact(item.normalizedRepresentation)}`); if (item.derivation) console.log(`  derived ${item.derivation.quantity ?? "value"}: ${compact(item.derivation.value)}; method ${item.derivation.method ?? "recorded deterministic conversion"}; independent measurement: no`); console.log(`  instrument state: ${String(instrument.instrumentReference ?? "not recorded")} / ${String(instrument.calibrationStatus ?? "not recorded")}`); console.log(`  quality/limitations: ${item.qualityState ?? "not recorded"}; ${item.limitations.join("; ") || "none recorded"}`); }
function printHuman(item: EquipmentDNAEvidenceItem) { console.log(`- ${item.claimKey}: ${compact(item.normalizedRepresentation)}; protocol ${item.protocolVersion ?? "not recorded"}; session ${item.sessionReference ?? "not recorded"}; evaluator ${item.operatorOrEvaluatorReference ?? "not recorded"}; independence group ${item.independenceGroup ?? "not recorded"}`); }
function printGeneric(item: EquipmentDNAEvidenceItem) { console.log(`- ${item.claimKey}: ${compact(item.normalizedRepresentation ?? item.rawObservation)}; source ${item.sourceName}; method ${item.method}`); }
function compact(value: unknown) { return value === undefined ? "not recorded" : JSON.stringify(value); }
function rawObject(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function decimal(value: unknown): number | undefined { if (value === null || value === undefined) return undefined; const number = Number(value); return Number.isFinite(number) ? number : undefined; }
function rawString(value: unknown, key: string) { return value && typeof value === "object" && !Array.isArray(value) && typeof (value as Record<string, unknown>)[key] === "string" ? (value as Record<string, string>)[key] : undefined; }
function required(key: string) { const value = options.get(key); if (!value) throw new Error(`--${key}=<uuid> is required.`); return value; }
