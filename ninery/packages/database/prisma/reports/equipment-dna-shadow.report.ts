import { EquipmentDNARepository } from "../../../equipment-intelligence/src/equipment-dna.repository.ts";
import { EquipmentDNAService } from "../../../equipment-intelligence/src/equipment-dna.service.ts";
import {
  CanonicalEquipmentDNAProfileLoader,
  adaptLegacyEquipmentDNAProfile,
  compareCanonicalAndLegacyEquipmentDNA,
  scalarCanonicalValue,
  type CanonicalEquipmentDNAProfileLoaderRepository
} from "../../../equipment-intelligence/src/profiles/index.ts";
import { prisma } from "../seeds/client.ts";

const demoTargets = [
  { manufacturer: "Rawlings", model: "ICON", modelYear: 2026, selectedSku: "RAW-ICON-USA-30-22" },
  { manufacturer: "Louisville Slugger", model: "Atlas", modelYear: 2026, selectedSku: "LS-ATLAS-USA-30-22" },
  { manufacturer: "Easton", model: "Hype Fire", modelYear: 2026, selectedSku: "EAS-HYPE-USA-30-22" }
] as const;

async function main() {
  const loader = new CanonicalEquipmentDNAProfileLoader(createCanonicalRepository());
  const legacyService = new EquipmentDNAService(new EquipmentDNARepository(prisma));

  console.log("Equipment DNA Shadow Comparison");
  console.log("");

  for (const target of demoTargets) {
    try {
      const equipment = await prisma.equipment.findFirst({
        where: { manufacturer: target.manufacturer, model: target.model, modelYear: target.modelYear },
        include: { variants: { where: { sku: target.selectedSku } } }
      });
      if (!equipment || equipment.variants.length === 0) {
        console.log(`${target.manufacturer} ${target.model}`);
        console.log(`Error: missing equipment or selected variant ${target.selectedSku}.`);
        console.log("");
        continue;
      }
      const variant = equipment.variants[0];
      const canonicalProfile = await loader.loadCanonicalEquipmentDNAProfile({
        equipmentId: equipment.id,
        equipmentVariantId: variant.id,
        generatedAt: new Date("2026-07-20T00:00:00.000Z")
      });
      const legacyProfile = await legacyService.getEquipmentVariantDNA(variant.id);
      const result = compareCanonicalAndLegacyEquipmentDNA({
        canonicalProfile,
        legacyProfile: adaptLegacyEquipmentDNAProfile(legacyProfile),
        catalog: {
          length: decimalToNumber(variant.lengthInches),
          weight: decimalToNumber(variant.weightOunces),
          drop: variant.dropWeight ?? undefined,
          certification: equipment.certification,
          barrelDiameter: decimalToNumber(equipment.barrelDiameter)
        }
      });

      console.log(`${equipment.manufacturer} ${equipment.model}`);
      console.log(`Variant: ${variant.sku ?? variant.id}`);
      console.log(`Canonical readiness: ${result.canonicalProfileReady ? "ready" : "not ready"}`);
      console.log(`Maturity: ${result.canonicalMaturity}`);
      console.log(`Specifications: ${result.specificationChecks.filter((check) => check.status === "match").length}/${result.specificationChecks.length} aligned`);
      console.log("Behavior comparisons:");
      for (const comparison of result.comparedAttributes) {
        console.log(`- ${comparison.canonicalKey}: ${comparison.status}`);
      }
      console.log(`Overall: ${result.overallStatus}`);
      const material = result.comparedAttributes.filter((comparison) => comparison.status === "material_difference");
      if (material.length > 0) {
        console.log("Material differences:");
        for (const comparison of material) {
          console.log(`- ${comparison.canonicalKey}`);
          console.log(`  Canonical: ${comparison.canonicalValue}`);
          console.log(`  Canonical numeric comparison: ${comparison.canonicalNumericEquivalent ?? "n/a"}`);
          console.log(`  Legacy score: ${comparison.legacyValue ?? "missing"}`);
          console.log(`  Strategy: ${comparison.comparisonStrategy}`);
          console.log(`  Explanation: ${comparison.explanation}`);
        }
      }
      console.log("");
    } catch (error) {
      console.log(`${target.manufacturer} ${target.model}`);
      console.log(`Error: ${error instanceof Error ? error.message : String(error)}`);
      console.log("");
    }
  }
}

function createCanonicalRepository(): CanonicalEquipmentDNAProfileLoaderRepository {
  return {
    async getEquipmentForCanonicalProfile(equipmentId: string) {
      return prisma.equipment.findUnique({ where: { id: equipmentId } });
    },
    async getVariantForCanonicalProfile(equipmentVariantId: string) {
      return prisma.equipmentVariant.findUnique({ where: { id: equipmentVariantId } });
    },
    async listActiveCanonicalEvaluations(input: { equipmentId: string; equipmentVariantId?: string }) {
      const rows = await prisma.equipmentDNAAttributeEvaluation.findMany({
        where: {
          OR: [{ equipmentId: input.equipmentId }, ...(input.equipmentVariantId ? [{ equipmentVariantId: input.equipmentVariantId }] : [])],
          status: "active"
        },
        include: { evidenceLinks: { include: { evidenceRecord: true } } },
        orderBy: [{ targetLevel: "asc" }, { attributeKey: "asc" }, { evaluationVersion: "desc" }]
      });
      return rows.map((row) => ({
        id: row.id,
        equipmentId: row.equipmentId ?? undefined,
        equipmentVariantId: row.equipmentVariantId ?? undefined,
        targetLevel: row.targetLevel,
        attributeKey: row.attributeKey,
        attributeDefinitionVersion: row.attributeDefinitionVersion,
        value: scalarCanonicalValue(row.value),
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
      }));
    }
  };
}

function decimalToNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") return value.toNumber();
  return Number(value);
}

main().finally(async () => prisma.$disconnect());
