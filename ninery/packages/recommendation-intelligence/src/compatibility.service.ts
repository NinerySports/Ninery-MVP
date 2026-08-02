import type { PrismaClient } from "@prisma/client";
import type { CompatibilityRequestContext, CompatibilityRunResult } from "./compatibility.types.js";
import { CompatibilityInputLoader } from "./compatibility-input-loader.js";
import { CompatibilityScoringEngine } from "./scoring/compatibility-scoring-engine.js";
import { RecommendationCompatibilityRepository } from "./compatibility.repository.js";

export class RecommendationCompatibilityService {
  constructor(private readonly prisma: PrismaClient) {}

  async generateRecommendations(input: CompatibilityRequestContext): Promise<CompatibilityRunResult> {
    const loaded = await new CompatibilityInputLoader(this.prisma).load(input);
    const result = new CompatibilityScoringEngine().score(loaded);
    const repository = new RecommendationCompatibilityRepository(this.prisma);

    if (!input.forceRegenerate) {
      const existing = await repository.findExistingByInputHash(result.traceSummary.inputHash);
      if (existing?.recommendationTrace) {
        return {
          ...(existing.recommendationTrace as unknown as CompatibilityRunResult),
          recommendationId: existing.id
        };
      }
    }

    return this.prisma.$transaction(async (tx) =>
      new RecommendationCompatibilityRepository(tx).saveRecommendationRun(result)
    );
  }

  getRecommendation(recommendationId: string) {
    return new RecommendationCompatibilityRepository(this.prisma).getRecommendation(recommendationId);
  }

  getLatestRecommendationForPlayer(playerId: string) {
    return new RecommendationCompatibilityRepository(this.prisma).getLatestRecommendationForPlayer(playerId);
  }

  getRecommendationHistory(playerId: string) {
    return new RecommendationCompatibilityRepository(this.prisma).getRecommendationHistory(playerId);
  }

  async explainRecommendationItem(recommendationItemId: string) {
    const item = await new RecommendationCompatibilityRepository(this.prisma).getRecommendationItem(recommendationItemId);
    return item?.recommendationTrace ?? item?.scoreBreakdown ?? null;
  }

  async compareRecommendationItems(sourceItemId: string, targetItemId: string) {
    const repository = new RecommendationCompatibilityRepository(this.prisma);
    const [source, target] = await Promise.all([
      repository.getRecommendationItem(sourceItemId),
      repository.getRecommendationItem(targetItemId)
    ]);
    return { sourceItemId, targetItemId, sourceTrace: source?.recommendationTrace, targetTrace: target?.recommendationTrace };
  }
}
