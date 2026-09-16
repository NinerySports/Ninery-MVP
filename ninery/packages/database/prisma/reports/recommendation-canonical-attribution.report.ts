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
import {
  analyzeCanonicalCandidateVariance,
  runCanonicalCandidateRecommendationDualRun,
  type CanonicalCandidateRecommendationRequest,
  type CanonicalCandidateVarianceAttribution
} from "../../../recommendation-intelligence/src/index.ts";
import { prisma } from "../seeds/client.ts";

const demoTargets = [
  { manufacturer: "Rawlings", model: "ICON", modelYear: 2026, selectedSku: "RAW-ICON-USA-30-22" },
  { manufacturer: "Louisville Slugger", model: "Atlas", modelYear: 2026, selectedSku: "LS-ATLAS-USA-30-22" },
  { manufacturer: "Easton", model: "Hype Fire", modelYear: 2026, selectedSku: "EAS-HYPE-USA-30-22" }
] as const;

const deterministicReportDate = new Date("2026-07-23T00:00:00.000Z");

async function main() {
  const request = await buildDemoRequest();
  const dualRun = await runCanonicalCandidateRecommendationDualRun(request);
  const attribution = analyzeCanonicalCandidateVariance({ request, dualRun, analyzedAt: deterministicReportDate });
  printReport(attribution);
}

async function buildDemoRequest(): Promise<CanonicalCandidateRecommendationRequest> {
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
    if (!equipment || equipment.variants.length === 0) throw new Error(`Missing demo equipment or variant ${target.selectedSku}.`);
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
    admissionDecisions.push(evaluateCanonicalEquipmentDNAAdmission({ canonicalProfile, shadowComparison, evaluatedAt: deterministicReportDate }));
  }

  return { playerInput: playerDNA, requestContext: context, legacyEquipmentInputs, canonicalProfiles, admissionDecisions, evaluatedAt: deterministicReportDate };
}

function printReport(attribution: CanonicalCandidateVarianceAttribution) {
  console.log("Canonical Candidate Variance Attribution");
  console.log("");
  console.log(`Attribution version: ${attribution.attributionVersion}`);
  console.log(`Calibration version: ${attribution.calibrationVersion}`);
  console.log("");
  console.log("Legacy winner:");
  console.log(attribution.legacyWinner.label);
  console.log("");
  console.log("Canonical candidate winner:");
  console.log(attribution.candidateWinner?.label ?? "none");
  console.log("");
  if (attribution.pairwiseWinnerAttribution) {
    console.log(`Legacy ICON-Atlas gap: ${formatSigned(attribution.pairwiseWinnerAttribution.legacyScoreGap)} ${attribution.legacyWinner.label}`);
    console.log(`Candidate ICON-Atlas gap: ${formatSigned(attribution.pairwiseWinnerAttribution.candidateScoreGap)} ${attribution.candidateWinner?.label ?? "candidate"}`);
    console.log(`Total gap swing: ${formatSigned(attribution.pairwiseWinnerAttribution.gapSwing)} toward ${attribution.candidateWinner?.label ?? "candidate winner"}`);
    console.log("");
  }
  console.log("Primary causes:");
  attribution.primaryCauses.forEach((cause) => {
    console.log(`${cause.rank}. ${cause.code}`);
    console.log(`   ${cause.summary}`);
    if (cause.estimatedGapContribution !== undefined) console.log(`   Estimated gap contribution: ${formatSigned(cause.estimatedGapContribution)}`);
  });
  console.log("");
  console.log("Input-value differences by bat:");
  for (const equipment of attribution.equipment) {
    console.log(`${equipment.equipment.label}`);
    for (const field of equipment.inputVariance.filter((item) => item.direction !== "unchanged")) {
      console.log(`- ${field.recommendationField}: ${field.legacyValue ?? "missing"} -> ${field.candidateValue ?? "missing"} (${field.direction})`);
    }
  }
  console.log("");
  console.log("Pairwise dimension attribution:");
  for (const item of attribution.pairwiseWinnerAttribution?.dimensionGapContributions.slice().sort((a, b) => Math.abs(b.contributionToGapSwing) - Math.abs(a.contributionToGapSwing)).slice(0, 8) ?? []) {
    console.log(`- ${item.dimension}: ${formatSigned(item.contributionToGapSwing)} toward ${labelForEquipmentId(attribution, item.favoredEquipmentId)}`);
  }
  console.log(`Residual: ${formatSigned(attribution.pairwiseWinnerAttribution?.residualGapSwing ?? 0)}`);
  console.log(`Tie-breaker: ${attribution.pairwiseWinnerAttribution?.tieBreakerContribution ?? "No pairwise tie-breaker analysis available."}`);
  console.log("");
  console.log("Mapping compression:");
  for (const entry of attribution.mappingCompression.entries) {
    console.log(`- ${entry.canonicalKey}: legacy distinct ${entry.distinctLegacyValueCount}, candidate distinct ${entry.distinctCandidateValueCount}, retained ratio ${entry.gapRetainedRatio ?? "n/a"}, compression ${entry.compressionDetected ? "yes" : "no"}, boundary amplification ${entry.boundaryAmplificationDetected ? "yes" : "no"}`);
  }
  console.log("");
  console.log("Missing-attribute impact:");
  attribution.missingAttributeImpact.conclusions.forEach((item) => console.log(`- ${item}`));
  console.log("");
  console.log("Calibration scenarios:");
  for (const scenario of attribution.calibrationScenarios) {
    console.log(`- ${scenario.name}: ${scenario.completed ? scenario.winner?.label ?? "no winner" : `failed (${scenario.failureReason})`}`);
  }
  console.log("");
  console.log("Winner stability:");
  attribution.winnerStability.conclusions.forEach((item) => console.log(`- ${item}`));
  console.log("");
  console.log("Numeric-value preservation recommendation:");
  console.log(attribution.numericValuePreservationRecommendation);
  console.log("");
  console.log("Architecture:");
  console.log(`- balance_profile: ${attribution.architectureRecommendations.balance_profile}`);
  console.log(`- confidence_building_potential: ${attribution.architectureRecommendations.confidence_building_potential}`);
  console.log(`- transition_difficulty: ${attribution.architectureRecommendations.transition_difficulty}`);
  console.log("");
  console.log("Cautions:");
  attribution.cautions.forEach((item) => console.log(`- ${item}`));
  console.log("");
  console.log("Live recommendation source:");
  console.log("legacy");
  console.log("");
  console.log("Candidate affects live result:");
  console.log("no");
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

function formatSigned(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

function labelForEquipmentId(attribution: CanonicalCandidateVarianceAttribution, equipmentId: string | undefined): string {
  if (!equipmentId) return "neither";
  return attribution.equipment.find((item) => item.equipment.equipmentId === equipmentId)?.equipment.label ?? equipmentId;
}

main().finally(async () => prisma.$disconnect());
