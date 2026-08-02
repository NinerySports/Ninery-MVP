import type { Prisma, PrismaClient } from "@prisma/client";
import type { CompatibilityRunResult, CompatibilityResultItem } from "./compatibility.types.js";

type PrismaTransaction = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;
export type PrismaLike = PrismaClient | PrismaTransaction;

export class RecommendationCompatibilityRepository {
  constructor(private readonly prisma: PrismaLike) {}

  getRecommendation(recommendationId: string) {
    return this.prisma.recommendation.findUnique({
      where: { id: recommendationId },
      include: { items: { orderBy: { rank: "asc" } } }
    });
  }

  getLatestRecommendationForPlayer(playerId: string) {
    return this.prisma.recommendation.findFirst({
      where: { playerId, status: "generated" },
      orderBy: { generatedAt: "desc" },
      include: { items: { orderBy: { rank: "asc" } } }
    });
  }

  getRecommendationHistory(playerId: string) {
    return this.prisma.recommendation.findMany({
      where: { playerId },
      orderBy: { generatedAt: "desc" },
      include: { items: { orderBy: { rank: "asc" } } }
    });
  }

  getRecommendationItem(itemId: string) {
    return this.prisma.recommendationItem.findUnique({ where: { id: itemId } });
  }

  findExistingByInputHash(inputHash: string) {
    return this.prisma.recommendation.findFirst({
      where: { inputHash, status: "generated" },
      orderBy: { generatedAt: "desc" },
      include: { items: { orderBy: { rank: "asc" } } }
    });
  }

  async saveRecommendationRun(result: CompatibilityRunResult): Promise<CompatibilityRunResult> {
    const items = [
      ...(result.primaryRecommendation ? [result.primaryRecommendation] : []),
      ...result.alternatives,
      ...result.nonRecommended
    ];
    const saved = await this.prisma.recommendation.create({
      data: {
        playerId: result.playerId,
        playerDNAProfileId: result.playerDNAProfileId,
        status: "generated",
        overallConfidence: result.confidence.score / 100,
        recommendationConfidence: result.confidence.score,
        generatedAt: new Date(result.generatedAt),
        decisionMatrixVersion: result.scoringConfigVersion,
        equipmentDnaVersion: "equipment-dna-profile-versioned",
        knowledgeGraphVersion: "none",
        inputHash: result.traceSummary.inputHash,
        inputSnapshot: result.traceSummary as unknown as Prisma.InputJsonValue,
        scoreBreakdown: summarizeItems(items) as unknown as Prisma.InputJsonValue,
        recommendationTrace: result as unknown as Prisma.InputJsonValue,
        items: {
          create: items.map((item) => toItemCreateInput(item))
        }
      },
      include: { items: { orderBy: { rank: "asc" } } }
    });

    await this.prisma.playerTimelineEvent.create({
      data: {
        playerId: result.playerId,
        eventType: "recommendation_generated",
        title: "Recommendation generated",
        description: "A new equipment recommendation was generated.",
        eventDate: new Date(result.generatedAt),
        relatedEntityType: "Recommendation",
        relatedEntityId: saved.id
      }
    });

    await this.prisma.platformEvent.create({
      data: {
        eventType: "recommendation_generated",
        entityType: "Recommendation",
        entityId: saved.id,
        payload: {
          playerId: result.playerId,
          playerDNAProfileId: result.playerDNAProfileId,
          inputHash: result.traceSummary.inputHash,
          scoringConfigVersion: result.scoringConfigVersion
        }
      }
    });

    return { ...result, recommendationId: saved.id };
  }
}

function toItemCreateInput(item: CompatibilityResultItem) {
  return {
    equipmentId: item.equipment.equipmentId,
    equipmentVariantId: item.equipment.variantId,
    rank: item.trace.rank ?? 999,
    matchScore: item.overallMatchScore,
    equipmentReadinessScore: item.equipment.profileCompleteness,
    recommendationConfidence: item.confidence.score / 100,
    matchBand: item.matchBand,
    confidenceBand: item.confidence.band,
    reasonSummary: item.explanation.summary,
    explanationSummary: item.explanation.summary,
    scoreBreakdown: item.dimensions as unknown as Prisma.InputJsonValue,
    recommendationTrace: item.trace as unknown as Prisma.InputJsonValue,
    eligibilityStatus: item.trace.eligibilityChecks as unknown as Prisma.InputJsonValue,
    tradeoffs: item.explanation.tradeoffs as unknown as Prisma.InputJsonValue
  };
}

function summarizeItems(items: CompatibilityResultItem[]) {
  return items.map((item) => ({
    equipmentId: item.equipment.equipmentId,
    rank: item.trace.rank,
    matchScore: item.overallMatchScore,
    confidence: item.confidence.score
  }));
}
