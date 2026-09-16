import { EquipmentDNARepository } from "../../../equipment-intelligence/src/equipment-dna.repository.ts";
import { EquipmentDNAService } from "../../../equipment-intelligence/src/equipment-dna.service.ts";
import {
  CanonicalEquipmentDNAProfileLoader,
  adaptLegacyEquipmentDNAProfile,
  compareCanonicalAndLegacyEquipmentDNA,
  evaluateCanonicalEquipmentDNAAdmission,
  scalarCanonicalValue,
  type CanonicalEquipmentDNAAdmissionDecision,
  type CanonicalEquipmentDNAProfileLoaderRepository
} from "../../../equipment-intelligence/src/index.ts";
import { prisma } from "../seeds/client.ts";

const demoTargets = [
  { manufacturer: "Rawlings", model: "ICON", modelYear: 2026, selectedSku: "RAW-ICON-USA-30-22" },
  { manufacturer: "Louisville Slugger", model: "Atlas", modelYear: 2026, selectedSku: "LS-ATLAS-USA-30-22" },
  { manufacturer: "Easton", model: "Hype Fire", modelYear: 2026, selectedSku: "EAS-HYPE-USA-30-22" }
] as const;

const deterministicReportDate = new Date("2026-07-21T00:00:00.000Z");

async function main() {
  const loader = new CanonicalEquipmentDNAProfileLoader(createCanonicalRepository());
  const legacyService = new EquipmentDNAService(new EquipmentDNARepository(prisma));

  console.log("Equipment DNA Admission Gate");
  console.log("Live recommendation use: no");
  console.log("");

  for (const target of demoTargets) {
    try {
      const equipment = await prisma.equipment.findFirst({
        where: { manufacturer: target.manufacturer, model: target.model, modelYear: target.modelYear },
        include: { variants: { where: { sku: target.selectedSku } } }
      });
      if (!equipment || equipment.variants.length === 0) {
        printLoadFailure(`${target.manufacturer} ${target.model}`, `Missing equipment or selected variant ${target.selectedSku}.`);
        continue;
      }

      const variant = equipment.variants[0];
      const canonicalProfile = await loader.loadCanonicalEquipmentDNAProfile({
        equipmentId: equipment.id,
        equipmentVariantId: variant.id,
        generatedAt: deterministicReportDate
      });
      const legacyProfile = await legacyService.getEquipmentVariantDNA(variant.id);
      const shadowComparison = compareCanonicalAndLegacyEquipmentDNA({
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
      const decision = evaluateCanonicalEquipmentDNAAdmission({
        canonicalProfile,
        shadowComparison,
        evaluatedAt: deterministicReportDate
      });

      printDecision(decision, canonicalProfile.variantLabel);
    } catch (error) {
      printLoadFailure(`${target.manufacturer} ${target.model}`, error instanceof Error ? error.message : String(error));
    }
  }
}

function printDecision(decision: CanonicalEquipmentDNAAdmissionDecision, variantLabel?: string) {
  console.log(decision.equipmentName);
  console.log(`Variant: ${variantLabel ?? decision.equipmentVariantId ?? "missing"}`);
  console.log(`Admission outcome: ${decision.outcome}`);
  console.log(`Shadow eligible: ${decision.eligibleForShadow ? "yes" : "no"}`);
  console.log(`Internal candidate eligible: ${decision.eligibleForInternalCandidate ? "yes" : "no"}`);
  console.log("Live recommendation use: no");
  console.log(`Policy version: ${decision.policyVersion}`);
  console.log(`Canonical profile version: ${decision.versionAssessment.actual.canonicalProfileVersion}`);
  console.log(`Shadow comparison version: ${decision.versionAssessment.actual.shadowComparisonVersion}`);
  console.log(`Maturity: ${decision.sourceSummary.maturity}`);
  console.log(
    `Required mapping coverage: ${decision.mappingCoverage.successfullyComparedKeys.length}/${decision.mappingCoverage.requiredComparableKeys.length}`
  );
  console.log(
    `Specifications: ${decision.sourceSummary.specificationMatchCount}/${decision.sourceSummary.specificationMatchCount + decision.sourceSummary.specificationProblemCount} aligned`
  );
  console.log(`Shadow status: ${decision.sourceSummary.shadowStatus}`);
  if (decision.blockers.length > 0) {
    console.log("Blockers:");
    for (const blocker of decision.blockers) {
      console.log(`- ${blocker.code}: ${blocker.message}`);
    }
  } else {
    console.log("Blockers: none");
  }
  if (decision.warnings.length > 0) {
    console.log("Warnings:");
    for (const warning of decision.warnings) {
      console.log(`- ${warning.code}: ${warning.message}`);
    }
  } else {
    console.log("Warnings: none");
  }
  console.log("Next actions:");
  for (const action of decision.nextActions) {
    console.log(`- ${action}`);
  }
  console.log("");
}

function printLoadFailure(label: string, message: string) {
  console.log(label);
  console.log("Admission outcome: blocked_invalid_profile");
  console.log("Shadow eligible: no");
  console.log("Internal candidate eligible: no");
  console.log("Live recommendation use: no");
  console.log(`Error: ${message}`);
  console.log("");
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
