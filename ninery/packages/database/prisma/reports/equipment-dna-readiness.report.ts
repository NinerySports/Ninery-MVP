import {
  assessEquipmentDNARecommendationReadiness,
  assessEquipmentDNAMaturity,
  type EquipmentDNAAttributeEvaluation
} from "../../../equipment-intelligence/src/evidence/index.ts";
import { prisma } from "../seeds/client.ts";

const demoTargets = [
  { manufacturer: "Rawlings", model: "ICON", modelYear: 2026, selectedSku: "RAW-ICON-USA-30-22" },
  { manufacturer: "Louisville Slugger", model: "Atlas", modelYear: 2026, selectedSku: "LS-ATLAS-USA-30-22" },
  { manufacturer: "Easton", model: "Hype Fire", modelYear: 2026, selectedSku: "EAS-HYPE-USA-30-22" }
] as const;

async function main() {
  console.log("Equipment DNA Readiness");
  console.log("");

  for (const target of demoTargets) {
    const equipment = await prisma.equipment.findFirst({
      where: { manufacturer: target.manufacturer, model: target.model, modelYear: target.modelYear },
      include: { variants: { where: { sku: target.selectedSku } } }
    });

    if (!equipment || equipment.variants.length === 0) {
      console.log(`${target.manufacturer} ${target.model}`);
      console.log("Equipment profile: not ready");
      console.log(`Missing seeded equipment or selected variant ${target.selectedSku}.`);
      console.log("");
      continue;
    }

    const variant = equipment.variants[0];
    const rows = await prisma.equipmentDNAAttributeEvaluation.findMany({
      where: {
        OR: [{ equipmentId: equipment.id }, { equipmentVariantId: variant.id }],
        status: "active"
      },
      include: { evidenceLinks: { include: { evidenceRecord: true } } },
      orderBy: [{ targetLevel: "asc" }, { attributeKey: "asc" }]
    });

    const evaluations = rows.map((row) => ({
      id: row.id,
      equipmentId: row.equipmentId ?? undefined,
      equipmentVariantId: row.equipmentVariantId ?? undefined,
      targetLevel: row.targetLevel,
      attributeKey: row.attributeKey,
      attributeDefinitionVersion: row.attributeDefinitionVersion,
      value: scalarValue(row.value),
      confidence: row.confidence,
      evaluationMethod: row.evaluationMethod,
      evaluationVersion: row.evaluationVersion,
      status: row.status,
      rationale: row.rationale ?? undefined,
      evaluatedAt: row.evaluatedAt ?? undefined,
      evidenceRecords: row.evidenceLinks.map((link) => ({
        id: link.evidenceRecord.id,
        equipmentId: link.evidenceRecord.equipmentId ?? undefined,
        equipmentVariantId: link.evidenceRecord.equipmentVariantId ?? undefined,
        targetLevel: link.evidenceRecord.targetLevel,
        attributeKey: link.evidenceRecord.attributeKey,
        attributeDefinitionVersion: link.evidenceRecord.attributeDefinitionVersion,
        sourceType: link.evidenceRecord.sourceType,
        sourceName: link.evidenceRecord.sourceName,
        sourceReference: link.evidenceRecord.sourceReference ?? undefined,
        method: link.evidenceRecord.method,
        rawValue: link.evidenceRecord.rawValue ?? undefined,
        normalizedValue: link.evidenceRecord.normalizedValue ?? undefined,
        unit: link.evidenceRecord.unit ?? undefined,
        notes: link.evidenceRecord.notes ?? undefined,
        status: link.evidenceRecord.status
      }))
    })) satisfies EquipmentDNAAttributeEvaluation[];

    const readiness = assessEquipmentDNARecommendationReadiness({ evaluations });
    const maturity = assessEquipmentDNAMaturity({ evaluations });
    const completeCount = 9 - readiness.missingRequiredAttributes.length - readiness.invalidAttributes.length;

    console.log(`${equipment.manufacturer} ${equipment.model}`);
    console.log(`Equipment profile: ${readiness.ready ? "ready" : "not ready"}`);
    console.log(`Selected variant: ${variant.sku ?? "unknown"} ${readiness.ready ? "ready" : "not ready"}`);
    console.log(`Maturity: ${maturity.maturity}`);
    console.log(`Required attributes: ${completeCount}/9`);
    console.log(
      `Confidence concerns: ${
        readiness.insufficientConfidenceAttributes.length ? readiness.insufficientConfidenceAttributes.join(", ") : "none"
      }`
    );
    printList("Missing", readiness.missingRequiredAttributes);
    printList("Invalid", readiness.invalidAttributes);
    if (readiness.experimentalAttributesIgnored.length) {
      printList("Experimental ignored", readiness.experimentalAttributesIgnored);
    }
    console.log("");
  }
}

function scalarValue(value: unknown): string | number | boolean {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  throw new Error("Equipment DNA evaluation value must be scalar.");
}

function printList(label: string, values: readonly string[]) {
  if (!values.length) return;
  console.log(`${label}:`);
  for (const value of values) {
    console.log(`- ${value}`);
  }
}

main().finally(async () => prisma.$disconnect());
