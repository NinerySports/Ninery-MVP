import { PlayerDNAApplicationService } from "../../../player-intelligence/src/index.ts";
import { EquipmentDNARepository } from "../../../equipment-intelligence/src/equipment-dna.repository.ts";
import { EquipmentDNAService } from "../../../equipment-intelligence/src/equipment-dna.service.ts";
import {
  CanonicalEquipmentDNAProfileLoader,
  adaptLegacyEquipmentDNAProfile,
  compareCanonicalAndLegacyEquipmentDNA,
  evaluateCanonicalEquipmentDNAAdmission,
  scalarCanonicalValue,
  type CanonicalEquipmentDNAAdmissionDecision,
  type CanonicalEquipmentDNAProfile,
  type CanonicalEquipmentDNAProfileLoaderRepository
} from "../../../equipment-intelligence/src/index.ts";
import type { CanonicalCandidateRecommendationRequest } from "../../../recommendation-intelligence/src/index.ts";
import { prisma } from "../seeds/client.ts";

const demoTargets = [
  { manufacturer: "Rawlings", model: "ICON", modelYear: 2026, selectedSku: "RAW-ICON-USA-30-22" },
  { manufacturer: "Louisville Slugger", model: "Atlas", modelYear: 2026, selectedSku: "LS-ATLAS-USA-30-22" },
  { manufacturer: "Easton", model: "Hype Fire", modelYear: 2026, selectedSku: "EAS-HYPE-USA-30-22" }
] as const;

export const deterministicReportDate = new Date("2026-07-22T00:00:00.000Z");

export async function loadCanonicalDemoRecommendationRequest(): Promise<CanonicalCandidateRecommendationRequest> {
  const player = await prisma.player.findFirst({
    where: { firstName: "Jackson", lastName: "Sanders", graduationYear: 2033, family: { name: "Sanders Family" } }
  });
  if (!player) throw new Error("Demo player was not found. Run pnpm seed first.");

  const playerDNA = await new PlayerDNAApplicationService(prisma).generatePlayerDNA(
    player.id,
    { forceRegenerate: false },
    { developmentBypass: true }
  );
  const context = {
    playerId: player.id,
    playerDNAProfileId: playerDNA.profileId,
    certification: "USA" as const,
    category: "bat" as const,
    variantPreferences: { length: 30, drop: -8 },
    budget: { maximum: 400 },
    resultLimit: 3,
    forceRegenerate: true
  };

  const loader = new CanonicalEquipmentDNAProfileLoader(createCanonicalRepository());
  const legacyService = new EquipmentDNAService(new EquipmentDNARepository(prisma));
  const legacyEquipmentInputs = [];
  const canonicalProfiles: CanonicalEquipmentDNAProfile[] = [];
  const admissionDecisions: CanonicalEquipmentDNAAdmissionDecision[] = [];

  for (const target of demoTargets) {
    const equipment = await prisma.equipment.findFirst({
      where: { manufacturer: target.manufacturer, model: target.model, modelYear: target.modelYear },
      include: { variants: { where: { sku: target.selectedSku } } }
    });
    if (!equipment || equipment.variants.length === 0) throw new Error(`Missing demo equipment or selected variant ${target.selectedSku}.`);
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
    legacyEquipmentInputs.push(legacyProfile);
    canonicalProfiles.push(canonicalProfile);
    admissionDecisions.push(evaluateCanonicalEquipmentDNAAdmission({
      canonicalProfile,
      shadowComparison,
      evaluatedAt: deterministicReportDate
    }));
  }

  return { playerInput: playerDNA, requestContext: context, legacyEquipmentInputs, canonicalProfiles, admissionDecisions, evaluatedAt: deterministicReportDate };
}

export function equipmentLabel(equipment: { manufacturer: string; model: string; modelYear?: number }) {
  return `${equipment.manufacturer} ${equipment.model}${equipment.modelYear ? ` ${equipment.modelYear}` : ""}`;
}

export function orderedLabels(result: { primaryRecommendation?: { equipment: { manufacturer: string; model: string; modelYear?: number } }; alternatives: Array<{ equipment: { manufacturer: string; model: string; modelYear?: number } }>; nonRecommended: Array<{ equipment: { manufacturer: string; model: string; modelYear?: number } }> }) {
  return [...(result.primaryRecommendation ? [result.primaryRecommendation] : []), ...result.alternatives, ...result.nonRecommended].map((item) => equipmentLabel(item.equipment));
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
        where: { OR: [{ equipmentId: input.equipmentId }, ...(input.equipmentVariantId ? [{ equipmentVariantId: input.equipmentVariantId }] : [])], status: "active" },
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
          status: link.evidenceRecord.status,
          evaluatorType: link.evidenceRecord.evaluatorType ?? undefined,
          evaluatorReference: link.evidenceRecord.evaluatorReference ?? undefined
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
