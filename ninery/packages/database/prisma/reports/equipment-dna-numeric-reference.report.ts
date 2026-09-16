import {
  CanonicalEquipmentDNAProfileLoader,
  createLegacyDerivedBalanceNumericReference,
  loadEquipmentDNANumericReferenceProfile,
  scalarCanonicalValue,
  validateBalanceNumericReference,
  toEquipmentDNANumericReferenceCandidate,
  type CanonicalEquipmentDNAProfileLoaderRepository
} from "../../../equipment-intelligence/src/index.ts";
import { EquipmentDNARepository } from "../../../equipment-intelligence/src/equipment-dna.repository.ts";
import { EquipmentDNAService } from "../../../equipment-intelligence/src/equipment-dna.service.ts";
import { prisma } from "../seeds/client.ts";

const demoTargets = [
  { manufacturer: "Rawlings", model: "ICON", modelYear: 2026, selectedSku: "RAW-ICON-USA-30-22" },
  { manufacturer: "Louisville Slugger", model: "Atlas", modelYear: 2026, selectedSku: "LS-ATLAS-USA-30-22" },
  { manufacturer: "Easton", model: "Hype Fire", modelYear: 2026, selectedSku: "EAS-HYPE-USA-30-22" }
] as const;

const reportGeneratedAt = new Date("2026-07-21T00:00:00.000Z");

async function main() {
  const loader = new CanonicalEquipmentDNAProfileLoader(createCanonicalRepository());
  const legacyService = new EquipmentDNAService(new EquipmentDNARepository(prisma));

  console.log("Equipment DNA Numeric Reference");
  console.log("");
  console.log("Live recommendation use: no");
  console.log("Canonical ordinal remains authoritative.");
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
        generatedAt: reportGeneratedAt
      });
      const numericProfile = loadEquipmentDNANumericReferenceProfile(canonicalProfile);
      const legacyProfile = await legacyService.getEquipmentVariantDNA(variant.id);
      const balanceReference = legacyProfile.scores.balance === undefined ? undefined : createLegacyDerivedBalanceNumericReference({
        sourceValue: legacyProfile.scores.balance,
        equipmentId: legacyProfile.equipmentId,
        equipmentVariantId: legacyProfile.variantId,
        sourceReference: `legacy:SWING_BALANCE:${legacyProfile.equipmentId}:${legacyProfile.variantId ?? "model"}`
      });
      const balanceValidation = balanceReference ? validateBalanceNumericReference({
        ordinal: balanceReference.ordinal,
        numericReference: toEquipmentDNANumericReferenceCandidate(balanceReference),
        conversionExplanation: balanceReference.rationale,
        sourceValue: balanceReference.sourceValue
      }) : undefined;
      const coreReferences = numericProfile.references.filter((item) => item.supported === "supported" && item.attributeKey !== "balance_profile" && item.attributeKey !== "predictability_support");
      const predictabilityReference = numericProfile.references.find((item) => item.attributeKey === "predictability_support");

      console.log(canonicalProfile.equipmentName);
      console.log(`Variant: ${variant.sku ?? variant.id}`);
      console.log(`Model version: ${numericProfile.version}`);
      console.log(`Core references: ${coreReferences.filter((item) => item.validationStatus === "pass").length}/${coreReferences.length} valid`);
      console.log("Core supported attributes:");
      for (const reference of coreReferences) {
        console.log(`- ${label(reference.attributeKey)}`);
        console.log(`  Ordinal: ${String(reference.ordinalValue)}`);
        console.log(`  Numeric Reference: ${reference.numericReference?.numericValue ?? "missing"}`);
        console.log(`  Confidence: ${reference.numericReference?.confidence ?? "missing"}`);
        console.log(`  Method: ${reference.numericReference?.referenceMethod ?? "missing"}`);
        console.log(`  Consistency: ${reference.validationStatus === "pass" ? "PASS" : reference.validationStatus.toUpperCase()}`);
      }
      console.log("Optional balance reference:");
      if (balanceReference) {
        console.log(`- Balance Profile`);
        console.log(`  Ordinal: ${balanceReference.ordinal}`);
        console.log(`  Numeric Reference: ${balanceReference.canonicalValue}`);
        console.log(`  Direction: 0 balanced -> 100 end-loaded`);
        console.log(`  Source legacy value: ${balanceReference.sourceValue}`);
        console.log(`  Conversion: ${balanceReference.conversionStrategy}`);
        console.log(`  Confidence: ${balanceReference.confidence}`);
        console.log(`  Consistency: ${balanceValidation?.valid ? "PASS" : "FAIL"}`);
      } else {
        console.log("- unavailable");
      }
      console.log("Optional predictability reference:");
      if (predictabilityReference?.numericReference) {
        console.log("- Predictability Support");
        console.log(`  Ordinal: ${String(predictabilityReference.ordinalValue)}`);
        console.log(`  Numeric Reference: ${predictabilityReference.numericReference.numericValue}`);
        console.log(`  Method: ${predictabilityReference.numericReference.referenceMethod}`);
        console.log(`  Confidence: ${predictabilityReference.numericReference.confidence}`);
        console.log(`  Consistency: ${predictabilityReference.validationStatus === "pass" ? "PASS" : predictabilityReference.validationStatus.toUpperCase()}`);
      } else {
        console.log("- unavailable");
      }
      const unsupported = numericProfile.unsupportedAttributes.join(", ");
      console.log(`Unsupported attributes: ${unsupported}`);
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
          sourceDate: link.evidenceRecord.sourceDate ?? undefined,
          retrievedAt: link.evidenceRecord.retrievedAt ?? undefined,
          method: link.evidenceRecord.method,
          rawValue: link.evidenceRecord.rawValue ?? undefined,
          normalizedValue: link.evidenceRecord.normalizedValue ?? undefined,
          unit: link.evidenceRecord.unit ?? undefined,
          notes: link.evidenceRecord.notes ?? undefined,
          status: link.evidenceRecord.status,
          evaluatorType: link.evidenceRecord.evaluatorType ?? undefined,
          evaluatorReference: link.evidenceRecord.evaluatorReference ?? undefined,
          createdAt: link.evidenceRecord.createdAt,
          updatedAt: link.evidenceRecord.updatedAt
        }))
      }));
    }
  };
}

function label(attributeKey: string): string {
  return attributeKey
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

main().finally(async () => prisma.$disconnect());
