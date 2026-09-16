import { PrismaClient } from "@prisma/client";
import { assessEquipmentDNAConstructSynthesisReadiness, buildEquipmentDNAEvidenceReadModel, type EquipmentDNACatalogFactInput, type EquipmentDNAEvidenceRecordInput } from "@ninery/equipment-intelligence";

const prisma = new PrismaClient();
const options = new Map(process.argv.slice(2).filter((arg) => arg.startsWith("--")).map((arg) => { const [key, ...value] = arg.slice(2).split("="); return [key!, value.join("=")]; }));

try {
  const equipmentId = required("equipment"); const variantId = required("variant"); const focusedConstruct = options.get("construct");
  const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId }, include: { variants: true, specifications: true } });
  if (!equipment) throw new Error(`Equipment not found: ${equipmentId}`);
  const variant = equipment.variants.find((item) => item.id === variantId);
  if (!variant) throw new Error(`Variant ${variantId} does not belong to equipment ${equipmentId}.`);
  const rows = await prisma.equipmentDNAEvidenceRecord.findMany({ where: { equipmentId, OR: [{ targetLevel: "equipment" }, { equipmentVariantId: variantId }] }, orderBy: [{ sourceDate: "asc" }, { sourceReference: "asc" }, { id: "asc" }] });
  const allV11 = await prisma.equipmentDNAEvidenceRecord.findMany({ where: { sourceType: "structured_expert_evaluation", sourceReference: { startsWith: "physical-bat-evaluation:1.1:" } }, select: { equipmentId: true } });
  const equipmentCoverage = unique(allV11.map((item) => item.equipmentId).filter(isString)).length;
  const crossEquipmentCalibrationState = equipmentCoverage > 1 ? "cross_equipment_started" as const : "single_equipment_only" as const;
  const records = rows.map(toInput);
  const readModel = buildEquipmentDNAEvidenceReadModel({ identity: { equipmentId, manufacturer: equipment.manufacturer, model: equipment.model, modelYear: equipment.modelYear ?? undefined, certification: equipment.certification, variant: { id: variant.id, sku: variant.sku ?? undefined, lengthInches: decimal(variant.lengthInches), weightOunces: decimal(variant.weightOunces), dropWeight: variant.dropWeight ?? undefined } }, catalogFacts: catalogFacts(equipment, variant), records });
  const result = assessEquipmentDNAConstructSynthesisReadiness({ readModel, crossEquipmentCalibrationState, equipmentCoverageCount: equipmentCoverage });
  const constructs = focusedConstruct ? result.constructs.filter((item) => item.construct === focusedConstruct) : result.constructs;
  if (focusedConstruct && !constructs.length) throw new Error(`Construct is not in the current sufficiency profiles: ${focusedConstruct}`);
  const human = readModel.evidenceByClass.structured_human_evaluation;
  console.log("EQUIPMENT DNA CONSTRUCT SYNTHESIS READINESS");
  console.log(`Version: ${result.version}\nEquipment: ${equipment.modelYear ?? "unknown year"} ${equipment.manufacturer} ${equipment.model}\nEquipment ID: ${equipmentId}\nVariant: ${variant.lengthInches}/${variant.weightOunces}/${variant.dropWeight} (${variant.sku ?? variant.id})`);
  console.log(`Cross-equipment calibration: ${result.crossEquipmentCalibrationState}\nEquipment coverage: ${result.equipmentCoverageCount}\nProtocol coverage: ${result.protocolVersions.join(", ") || "none"}`);
  console.log(`Physical measurement records visible: ${readModel.evidenceByClass.direct_physical_measurement.length}\nHuman evaluation records visible: ${human.length}\nHuman sessions / evaluator groups: ${unique(human.map((item) => item.sessionReference).filter(isString)).length} / ${unique(human.map((item) => item.independenceGroup).filter(isString)).length}`);
  console.log(`Physical context inventory: ${readModel.evidenceByClass.direct_physical_measurement.map((item) => item.claimKey).join(", ") || "none"} (not assigned as direct behavioral evidence)`);
  const v11Sessions = unique(human.filter((item) => item.protocolVersion === "1.1").map((item) => item.sessionReference).filter(isString));
  for (const session of v11Sessions) { const sessionItems = human.filter((item) => item.sessionReference === session); const first = sessionItems[0]; const raw = object(first?.rawObservation); const evaluator = first?.operatorOrEvaluatorReference; const priorProtocol = human.some((item) => item.operatorOrEvaluatorReference === evaluator && item.protocolVersion !== "1.1"); console.log(`Protocol v1.1 session: ${session}; evaluator ${evaluator ?? "not recorded"}; equipment relationship ${String(raw.evaluatorRelationship ?? "not recorded")}; protocol participation ${priorProtocol ? "repeat_protocol_participant" : "first_protocol_participant"}; independent contribution ${String(raw.independentSourceContribution ?? "not recorded")}`); }
  console.log(`Missing evidence classes: ${readModel.missingEvidenceClasses.join(", ") || "none"}`);
  console.log("\nCONSTRUCTS");
  for (const item of constructs) {
    console.log(`\n${item.construct}`);
    console.log(`Support / readiness: ${item.supportState} / ${item.readiness}`);
    console.log(`Policy / profile: ${item.synthesisPolicyState} / ${item.profileVersion}`);
    console.log(`Relevant classes: ${item.relevantEvidenceClasses.join(", ")}`);
    console.log(`Records / sessions / sources / independent sources: ${item.recordCount} / ${item.sessionCount} / ${item.sourceOrEvaluatorCount} / ${item.independentSourceCount}`);
    console.log(`Protocols / corroboration: ${item.protocolVersions.join(", ") || "none"} / ${item.corroboration}`);
    console.log(`Evidence roles: ${item.evidence.length ? item.evidence.map((entry) => `${entry.evidence.id}:${entry.role}`).join(", ") : "none"}`);
    console.log(`Gaps: ${item.gaps.length ? item.gaps.map((gap) => gap.code).join(", ") : "none"}`);
    console.log(`Blockers: ${item.blockers.length ? item.blockers.map((blocker) => blocker.code).join(", ") : "none"}`);
    console.log(`Why: ${item.explanation.join(" ")}`);
  }
  console.log("\nSUMMARY"); for (const [state, count] of Object.entries(result.counts)) console.log(`${state}: ${count}`);
  console.log("\nFIREWALL STATUS\nBehavioral synthesis performed: no\nCanonical Equipment DNA changed: no\nNumeric references changed: no\nModeled estimates created: no\nRecommendation impact: none\nWrites performed: no");
} catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; } finally { await prisma.$disconnect(); }

function toInput(row: Awaited<ReturnType<typeof prisma.equipmentDNAEvidenceRecord.findMany>>[number]): EquipmentDNAEvidenceRecordInput { return { id: row.id, equipmentId: row.equipmentId ?? undefined, equipmentVariantId: row.equipmentVariantId ?? undefined, targetLevel: row.targetLevel, attributeKey: row.attributeKey, sourceType: row.sourceType, sourceName: row.sourceName, sourceReference: row.sourceReference ?? undefined, sourceDate: row.sourceDate ?? undefined, method: row.method, rawValue: row.rawValue ?? undefined, normalizedValue: row.normalizedValue ?? undefined, unit: row.unit ?? undefined, notes: row.notes ?? undefined, status: row.status, evaluatorType: row.evaluatorType ?? undefined, evaluatorReference: row.evaluatorReference ?? undefined }; }
function catalogFacts(equipment: { certification: string; construction: string | null; material: string | null; barrelDiameter: unknown; specifications: readonly { specificationCode: string; valueText: string | null; valueNumber: unknown; unit: string | null; source: string | null; verifiedAt: Date | null }[] }, variant: { lengthInches: unknown; weightOunces: unknown; dropWeight: number | null }): EquipmentDNACatalogFactInput[] { const candidates: EquipmentDNACatalogFactInput[] = [fact("certification", equipment.certification, undefined, "equipment"), fact("construction", equipment.construction, undefined, "equipment"), fact("material", equipment.material, undefined, "equipment"), fact("barrel_diameter", decimal(equipment.barrelDiameter), "inches", "equipment"), fact("length", decimal(variant.lengthInches), "inches", "variant"), fact("weight", decimal(variant.weightOunces), "ounces", "variant"), fact("drop", variant.dropWeight, undefined, "variant")]; for (const specification of equipment.specifications) candidates.push({ key: specification.specificationCode, value: specification.valueText ?? decimal(specification.valueNumber), unit: specification.unit ?? undefined, level: "equipment", sourceName: specification.source ?? "Ninery equipment specifications", verifiedAt: specification.verifiedAt ?? undefined }); return candidates.filter((item) => item.value !== null && item.value !== undefined); }
function fact(key: string, value: unknown, unit: string | undefined, level: "equipment" | "variant"): EquipmentDNACatalogFactInput { return { key, value, unit, level, sourceName: "Ninery equipment catalog", sourceReference: `catalog:${key}` }; }
function decimal(value: unknown) { if (value === null || value === undefined) return undefined; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : undefined; }
function object(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function unique<T>(values: readonly T[]): T[] { return [...new Set(values)]; }
function isString(value: string | null | undefined): value is string { return typeof value === "string"; }
function required(key: string) { const value = options.get(key); if (!value) throw new Error(`--${key}=<value> is required.`); return value; }
