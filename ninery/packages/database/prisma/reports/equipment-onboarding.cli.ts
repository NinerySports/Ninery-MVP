import {
  EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION,
  validateEquipmentDNAAttributeValue,
  type EquipmentDNAAttributeKey
} from "../../../equipment-intelligence/src/attributes/index.ts";
import {
  demariniTheGoods2023UsaOnboardingPacket,
  reviewRealWorldEquipmentOnboardingPacket,
  type RealWorldEquipmentEvidenceClassification,
  type RealWorldEquipmentEvidenceNature,
  type RealWorldEquipmentEvidencePacket,
  type RealWorldEquipmentOnboardingPacket
} from "../../../equipment-intelligence/src/onboarding/index.ts";
import { prisma } from "../seeds/client.ts";

const command = process.argv[2] ?? "show";
const args = parseArgs(process.argv.slice(3));

try {
  await run(command, args);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

async function run(action: string, options: Record<string, string | boolean>) {
  const packet = demariniTheGoods2023UsaOnboardingPacket;
  if (action === "help") return printHelp();
  if (action === "prepare" || action === "validate" || action === "readiness" || action === "show" || action === "evidence") {
    const review = reviewRealWorldEquipmentOnboardingPacket(packet);
    const existing = await safeFindExistingProduct(packet);
    printReview(review, {
      existing: existing.exists,
      existingStatus: existing.status,
      includeEvidence: action === "evidence" || action === "show"
    });
    console.log("Production recommendation model changed: no");
    console.log("Live recommendation activation allowed: no");
    console.log("Public API changed: no");
    console.log("Web UI changed: no");
    console.log("Writes performed: no");
    return;
  }
  if (action === "commit") {
    if (!hasFlag(options, "confirm")) {
      console.log("Real-World Equipment Catalog Onboarding");
      console.log("Commit requires --confirm.");
      console.log("Writes performed: no");
      return;
    }
    const result = await commitPacket(packet);
    console.log("Real-World Equipment Catalog Onboarding Commit");
    console.log(`Equipment: ${result.equipmentId}`);
    console.log(`Created equipment: ${result.createdEquipment ? "yes" : "no"}`);
    console.log(`Variants upserted: ${result.variantsUpserted}`);
    console.log(`Specifications upserted: ${result.specificationsUpserted}`);
    console.log(`Evidence upserted: ${result.evidenceUpserted}`);
    console.log(`Evaluations upserted: ${result.evaluationsUpserted}`);
    console.log("Live recommendation activation allowed: no");
    return;
  }
  throw new Error(`Unknown equipment onboarding command: ${action}.`);
}

async function commitPacket(packet: RealWorldEquipmentOnboardingPacket) {
  const review = reviewRealWorldEquipmentOnboardingPacket(packet);
  const existing = await findExistingProduct(packet);
  const equipmentData = {
    manufacturer: packet.manufacturer,
    model: packet.model,
    modelYear: packet.modelYear,
    category: packet.category,
    certification: packet.certification,
    material: packet.material,
    construction: packet.construction,
    barrelDiameter: packet.barrelDiameter,
    status: packet.status
  };
  const equipment = existing
    ? await prisma.equipment.update({ where: { id: existing.id }, data: equipmentData })
    : await prisma.equipment.create({ data: equipmentData });
  let variantsUpserted = 0;
  const variantsBySku = new Map<string, { id: string; sku: string | null }>();
  for (const variant of packet.variants) {
    const row = await prisma.equipmentVariant.upsert({
      where: { sku: variant.sku },
      update: {
        equipmentId: equipment.id,
        lengthInches: variant.lengthInches,
        weightOunces: variant.weightOunces,
        dropWeight: variant.dropWeight
      },
      create: {
        equipmentId: equipment.id,
        lengthInches: variant.lengthInches,
        weightOunces: variant.weightOunces,
        dropWeight: variant.dropWeight,
        sku: variant.sku
      }
    });
    variantsBySku.set(variant.sku, row);
    variantsUpserted += 1;
  }

  let specificationsUpserted = 0;
  const specifications = [
    ["product_identifier", packet.productIdentifier, undefined, undefined],
    ["certification", packet.certification, undefined, undefined],
    ["barrel_diameter", undefined, packet.barrelDiameter, "in"],
    ["construction", packet.construction, undefined, undefined],
    ["material", packet.material, undefined, undefined],
    ["construction_family", packet.constructionFamily, undefined, undefined],
    ["barrel", packet.barrel, undefined, undefined],
    ["handle", packet.handle, undefined, undefined],
    ["connection", packet.connection, undefined, undefined],
    ["end_cap", packet.endCap, undefined, undefined]
  ] as const;
  for (const [specificationCode, valueText, valueNumber, unit] of specifications) {
    if (valueText === undefined && valueNumber === undefined) continue;
    await prisma.equipmentSpecification.upsert({
      where: { equipmentId_specificationCode: { equipmentId: equipment.id, specificationCode } },
      update: { valueText, valueNumber, unit, source: packet.productKey, verifiedAt: new Date("2026-08-14T00:00:00.000Z") },
      create: { equipmentId: equipment.id, specificationCode, valueText, valueNumber, unit, source: packet.productKey, verifiedAt: new Date("2026-08-14T00:00:00.000Z") }
    });
    specificationsUpserted += 1;
  }

  let evidenceUpserted = 0;
  let evaluationsUpserted = 0;
  for (const evidence of packet.evidence) {
    const variant = evidence.variantSku ? variantsBySku.get(evidence.variantSku) : undefined;
    const evidenceRow = await upsertEvidence(packet, equipment.id, variant?.id, evidence);
    evidenceUpserted += 1;
    if (evidence.attributeKey && evidence.normalizedValue !== undefined && evidence.nature === "objective") {
      const validation = validateEquipmentDNAAttributeValue(evidence.attributeKey, evidence.normalizedValue);
      if (!validation.valid) throw new Error(validation.errors.join(" "));
      const evaluation = await upsertEvaluation(packet, equipment.id, variant?.id, evidence, validation.normalizedValue);
      await prisma.equipmentDNAAttributeEvaluationEvidence.upsert({
        where: { evaluationId_evidenceRecordId: { evaluationId: evaluation.id, evidenceRecordId: evidenceRow.id } },
        update: {},
        create: { evaluationId: evaluation.id, evidenceRecordId: evidenceRow.id }
      });
      evaluationsUpserted += 1;
    }
  }

  return {
    equipmentId: equipment.id,
    createdEquipment: !existing,
    variantsUpserted,
    specificationsUpserted,
    evidenceUpserted,
    evaluationsUpserted,
    review
  };
}

async function upsertEvidence(
  packet: RealWorldEquipmentOnboardingPacket,
  equipmentId: string,
  equipmentVariantId: string | undefined,
  evidence: RealWorldEquipmentEvidencePacket
) {
  const existing = await prisma.equipmentDNAEvidenceRecord.findFirst({
    where: {
      equipmentId: equipmentVariantId ? undefined : equipmentId,
      equipmentVariantId,
      attributeKey: evidence.attributeKey ?? "product_identity",
      attributeDefinitionVersion: EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION,
      sourceReference: evidence.sourceReference,
      method: mapEvidenceMethod(evidence)
    }
  });
  const data = {
    equipmentId: equipmentVariantId ? undefined : equipmentId,
    equipmentVariantId,
    targetLevel: equipmentVariantId ? "variant" as const : "equipment" as const,
    attributeKey: evidence.attributeKey ?? "product_identity",
    attributeDefinitionVersion: EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION,
    sourceType: mapEvidenceSourceType(evidence.classification),
    sourceName: evidence.sourceName,
    sourceReference: evidence.sourceReference,
    method: mapEvidenceMethod(evidence),
    rawValue: evidence.rawValue,
    normalizedValue: evidence.normalizedValue,
    unit: evidence.unit,
    notes: `${evidence.notes} Evidence nature: ${evidence.nature}. Original classification: ${evidence.classification}. Product key: ${packet.productKey}.`,
    status: "active" as const,
    evaluatorType: "system" as const,
    evaluatorReference: `real-world-onboarding:${packet.version}`
  };
  return existing
    ? prisma.equipmentDNAEvidenceRecord.update({ where: { id: existing.id }, data })
    : prisma.equipmentDNAEvidenceRecord.create({ data });
}

async function upsertEvaluation(
  packet: RealWorldEquipmentOnboardingPacket,
  equipmentId: string,
  equipmentVariantId: string | undefined,
  evidence: RealWorldEquipmentEvidencePacket,
  value: string | number | boolean
) {
  const existing = await prisma.equipmentDNAAttributeEvaluation.findFirst({
    where: {
      equipmentId: equipmentVariantId ? undefined : equipmentId,
      equipmentVariantId,
      attributeKey: evidence.attributeKey,
      attributeDefinitionVersion: EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION,
      status: "active"
    }
  });
  const data = {
    equipmentId: equipmentVariantId ? undefined : equipmentId,
    equipmentVariantId,
    targetLevel: equipmentVariantId ? "variant" as const : "equipment" as const,
    attributeKey: evidence.attributeKey as EquipmentDNAAttributeKey,
    attributeDefinitionVersion: EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION,
    value,
    confidence: evidence.confidence ?? "high",
    evaluationMethod: "direct_specification" as const,
    evaluationVersion: existing?.evaluationVersion ?? 1,
    status: "active" as const,
    rationale: `Objective onboarding specification for ${packet.displayName}: ${evidence.notes}`,
    evaluatedAt: new Date("2026-08-14T00:00:00.000Z")
  };
  return existing
    ? prisma.equipmentDNAAttributeEvaluation.update({ where: { id: existing.id }, data })
    : prisma.equipmentDNAAttributeEvaluation.create({ data });
}

async function findExistingProduct(packet: RealWorldEquipmentOnboardingPacket) {
  return prisma.equipment.findFirst({
    where: { manufacturer: packet.manufacturer, model: packet.model, modelYear: packet.modelYear, certification: packet.certification },
    include: { variants: true }
  });
}

function printReview(
  review: ReturnType<typeof reviewRealWorldEquipmentOnboardingPacket>,
  options: { existing: boolean | undefined; existingStatus: string; includeEvidence: boolean }
) {
  console.log("Real-World Equipment Catalog Onboarding v1.0");
  console.log(`${review.productLabel}`);
  console.log(`Catalog record exists: ${options.existing === undefined ? "unknown" : options.existing ? "yes" : "no"} (${options.existingStatus})`);
  console.log(`Identity ready: ${review.identityReady ? "yes" : "no"}`);
  console.log(`Specification ready: ${review.specificationReady ? "yes" : "no"}`);
  console.log(`Canonical profile ready: ${review.canonicalProfileReady ? "yes" : "no"}`);
  console.log(`Genuine-study ready: ${review.genuineStudyReady ? "yes" : "no"}`);
  console.log(`Recommendation activation blocked: ${review.statuses.includes("recommendation_activation_blocked") ? "yes" : "no"}`);
  printList("Variants", review.variantSkus);
  printList("Statuses", review.statuses);
  printList("Unresolved required attributes", review.unresolvedAttributes);
  printList("Conflicting evidence", review.conflictingEvidence.length ? review.conflictingEvidence : ["none"]);
  printList("Numeric references created", review.numericReferencesCreated.length ? review.numericReferencesCreated : ["none"]);
  if (options.includeEvidence) {
    console.log("Evidence inventory:");
    for (const item of review.evidenceInventory) {
      console.log(`- ${item.evidenceKey} | ${item.classification} | ${item.nature} | ${item.attributeKey ?? "product_identity"} | ${item.sourceReference}`);
    }
  }
  printList("Blockers", review.blockers.length ? review.blockers : ["none"]);
  printList("Warnings", review.warnings);
}

async function safeFindExistingProduct(packet: RealWorldEquipmentOnboardingPacket): Promise<{ exists: boolean | undefined; status: string }> {
  try {
    const row = await findExistingProduct(packet);
    return { exists: Boolean(row), status: row ? "database reachable" : "not found in reachable database" };
  } catch (error) {
    return {
      exists: undefined,
      status: `database check unavailable: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`
    };
  }
}

function printHelp() {
  console.log("Equipment Onboarding Commands");
  console.log("prepare | validate | show | evidence | readiness");
  console.log("commit --confirm");
}

function printList(label: string, values: readonly string[]) {
  console.log(`${label}:`);
  for (const value of values) console.log(`- ${value}`);
}

function mapEvidenceSourceType(classification: RealWorldEquipmentEvidenceClassification) {
  const mapping = {
    manufacturer_specification: "manufacturer_specification",
    retailer_product_specification: "other",
    structured_internal_evaluation: "structured_expert_evaluation",
    physical_equipment_verification: "objective_measurement",
    observational_evidence: "field_observation",
    derived_internal_reference: "internal_derived",
    unknown_unverified: "other"
  } as const;
  return mapping[classification];
}

function mapEvidenceMethod(evidence: { method: string; classification?: RealWorldEquipmentEvidenceClassification; nature?: RealWorldEquipmentEvidenceNature }) {
  if (evidence.method === "instrument_measurement") return "instrument_measurement";
  if (evidence.method === "standardized_rubric") return "standardized_rubric";
  if (evidence.method === "direct_specification") return "direct_specification";
  return "manual_review";
}

function parseArgs(values: readonly string[]) {
  const result: Record<string, string | boolean> = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith("--")) result[key] = true;
    else {
      result[key] = next;
      index += 1;
    }
  }
  return result;
}

function hasFlag(options: Record<string, string | boolean>, key: string): boolean {
  return options[key] === true;
}
