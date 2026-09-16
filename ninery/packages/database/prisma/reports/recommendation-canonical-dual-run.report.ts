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
  runCanonicalCandidateRecommendationDualRun,
  type CanonicalCandidateDualRunResult
} from "../../../recommendation-intelligence/src/index.ts";
import { prisma } from "../seeds/client.ts";

const demoTargets = [
  { manufacturer: "Rawlings", model: "ICON", modelYear: 2026, selectedSku: "RAW-ICON-USA-30-22" },
  { manufacturer: "Louisville Slugger", model: "Atlas", modelYear: 2026, selectedSku: "LS-ATLAS-USA-30-22" },
  { manufacturer: "Easton", model: "Hype Fire", modelYear: 2026, selectedSku: "EAS-HYPE-USA-30-22" }
] as const;

const deterministicReportDate = new Date("2026-07-22T00:00:00.000Z");

async function main() {
  const player = await prisma.player.findFirst({
    where: {
      firstName: "Jackson",
      lastName: "Sanders",
      graduationYear: 2033,
      family: { name: "Sanders Family" }
    }
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
    if (!equipment || equipment.variants.length === 0) {
      throw new Error(`Missing demo equipment or selected variant ${target.selectedSku}.`);
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
    const admissionDecision = evaluateCanonicalEquipmentDNAAdmission({
      canonicalProfile,
      shadowComparison,
      evaluatedAt: deterministicReportDate
    });
    legacyEquipmentInputs.push(legacyProfile);
    canonicalProfiles.push(canonicalProfile);
    admissionDecisions.push(admissionDecision);
  }

  const result = await runCanonicalCandidateRecommendationDualRun({
    playerInput: playerDNA,
    requestContext: context,
    legacyEquipmentInputs,
    canonicalProfiles,
    admissionDecisions,
    evaluatedAt: deterministicReportDate
  });

  printReport(result);
}

function printReport(result: CanonicalCandidateDualRunResult) {
  console.log("Canonical Candidate Recommendation Dual-Run");
  console.log("");
  console.log("Legacy authoritative winner:");
  console.log(result.legacyAuthoritative.primaryRecommendation ? equipmentLabel(result.legacyAuthoritative.primaryRecommendation.equipment) : "none");
  console.log("");
  console.log("Canonical candidate winner:");
  console.log(result.canonicalCandidate?.primaryRecommendation ? equipmentLabel(result.canonicalCandidate.primaryRecommendation.equipment) : "none");
  console.log("");
  console.log("Classification:");
  console.log(result.variance.classification);
  console.log("");
  console.log("Candidate execution:");
  console.log(result.candidateExecutionStatus);
  console.log("");
  console.log("Eligibility:");
  console.log(`${result.variance.eligibility.filter((item) => !item.changed).length}/${result.variance.eligibility.length} unchanged`);
  console.log("");
  console.log("Ranking:");
  const legacyOrder = orderedLabels(result.legacyAuthoritative);
  const candidateOrder = result.canonicalCandidate ? orderedLabels(result.canonicalCandidate) : [];
  for (let index = 0; index < Math.max(legacyOrder.length, candidateOrder.length); index += 1) {
    console.log(`${index + 1}. ${legacyOrder[index] ?? "none"} -> ${candidateOrder[index] ?? "none"}`);
  }
  console.log("");
  console.log("Overall score differences:");
  for (const item of result.variance.overallScores) {
    console.log(`- ${equipmentIdLabel(result, item.equipmentId)}: ${formatScore(item.legacyScore)} -> ${formatScore(item.candidateScore)} (${formatDelta(item.delta)})`);
  }
  console.log("");
  console.log("Dimension differences:");
  for (const item of result.variance.dimensionScores.filter((dimension) => dimension.severity !== "negligible")) {
    console.log(`- ${equipmentIdLabel(result, item.equipmentId)} ${item.dimension}: ${formatScore(item.legacyScore)} -> ${formatScore(item.candidateScore)} (${formatDelta(item.delta)})`);
  }
  if (result.variance.dimensionScores.every((dimension) => dimension.severity === "negligible")) console.log("- none above negligible thresholds");
  console.log("");
  console.log("Confidence differences:");
  for (const item of result.variance.confidenceScores) {
    console.log(`- ${equipmentIdLabel(result, item.equipmentId)}: ${formatScore(item.legacyScore)} -> ${formatScore(item.candidateScore)} (${formatDelta(item.delta)})`);
  }
  console.log("");
  console.log("Reasons:");
  console.log(result.variance.reasons.added.length === 0 && result.variance.reasons.removed.length === 0 ? "- primary reason sets unchanged" : `- added ${result.variance.reasons.added.length}, removed ${result.variance.reasons.removed.length}`);
  console.log("Tradeoffs:");
  console.log(result.variance.tradeoffs.added.length === 0 && result.variance.tradeoffs.removed.length === 0 ? "- tradeoff sets unchanged" : `- added ${result.variance.tradeoffs.added.length}, removed ${result.variance.tradeoffs.removed.length}`);
  console.log("Alternatives:");
  console.log(result.variance.alternatives.added.length === 0 && result.variance.alternatives.removed.length === 0 ? "- alternative set unchanged" : `- added ${result.variance.alternatives.added.length}, removed ${result.variance.alternatives.removed.length}`);
  console.log("Trace:");
  console.log(result.variance.trace.comparable ? "- comparable; expected provenance difference only" : `- not comparable: ${result.variance.trace.differences.join(", ")}`);
  console.log("");
  console.log("Mapping warnings:");
  if (result.mappingSummary.warnings.length === 0) console.log("- none");
  else result.mappingSummary.warnings.forEach((warning) => console.log(`- ${warning}`));
  console.log("");
  console.log("Live result source:");
  console.log(result.liveRecommendationSource);
  console.log("");
  console.log("Candidate affects live result:");
  console.log(result.candidateAffectsLiveResult ? "yes" : "no");
}

function orderedLabels(result: CanonicalCandidateDualRunResult["legacyAuthoritative"]) {
  return [
    ...(result.primaryRecommendation ? [result.primaryRecommendation] : []),
    ...result.alternatives,
    ...result.nonRecommended
  ].map((item) => equipmentLabel(item.equipment));
}

function equipmentIdLabel(result: CanonicalCandidateDualRunResult, equipmentId: string): string {
  const item = [
    ...(result.legacyAuthoritative.primaryRecommendation ? [result.legacyAuthoritative.primaryRecommendation] : []),
    ...result.legacyAuthoritative.alternatives,
    ...result.legacyAuthoritative.nonRecommended,
    ...(result.canonicalCandidate?.primaryRecommendation ? [result.canonicalCandidate.primaryRecommendation] : []),
    ...(result.canonicalCandidate?.alternatives ?? []),
    ...(result.canonicalCandidate?.nonRecommended ?? [])
  ].find((candidate) => candidate.equipment.equipmentId === equipmentId);
  return item ? equipmentLabel(item.equipment) : equipmentId;
}

function equipmentLabel(equipment: { manufacturer: string; model: string; modelYear?: number }) {
  return `${equipment.manufacturer} ${equipment.model}${equipment.modelYear ? ` ${equipment.modelYear}` : ""}`;
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

function formatScore(value: number | undefined): string {
  return value === undefined ? "missing" : value.toFixed(2);
}

function formatDelta(value: number | undefined): string {
  if (value === undefined) return "n/a";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

main().finally(async () => prisma.$disconnect());
