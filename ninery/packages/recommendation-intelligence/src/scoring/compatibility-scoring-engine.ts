import type { CompatibilityBand, CompatibilityInput, CompatibilityResultItem, CompatibilityRunResult } from "../compatibility.types.js";
import { buildCompatibilityExplanation } from "../explainability/compatibility-explanation-builder.js";
import { stableTraceId } from "../explainability/recommendation-trace-builder.js";
import { evaluateHardFilters } from "../eligibility/hard-filter-engine.js";
import { calculateRecommendationConfidence } from "./confidence-calculator.js";
import { getScoringConfig } from "./scoring-config.registry.js";
import { clampScore } from "./score-normalization.js";
import { scoreDimensions } from "./dimension-mappers.js";
import { adjustedWeightsForGoal } from "./weighted-score.js";
import { rankRecommendations } from "../ranking/recommendation-ranker.js";
import { createCompatibilityInputHash } from "../input-hash.js";

export class CompatibilityScoringEngine {
  score(input: CompatibilityInput): CompatibilityRunResult {
    const generatedAt = "2026-01-01T00:00:00.000Z";
    const config = getScoringConfig(input.context.scoringConfigVersion);
    const { weights, adjustments } = adjustedWeightsForGoal(config, input.playerDNA.categories.primaryHittingGoal);
    const filteredEquipment = [];
    const scoredItems: CompatibilityResultItem[] = [];

    for (const equipment of input.equipment) {
      const eligibility = evaluateHardFilters({ equipment, context: input.context, config });
      if (!eligibility.eligible) {
        filteredEquipment.push(eligibility);
        continue;
      }

      const dimensions = scoreDimensions({
        playerDNA: input.playerDNA,
        equipment,
        weights,
        budgetMaximum: input.context.budget?.maximum
      });
      const finalScore = clampScore(dimensions.reduce((sum, dimension) => sum + dimension.weightedContribution, 0));
      const confidence = calculateRecommendationConfidence({ playerDNA: input.playerDNA, equipment, dimensions, config });
      const trace = {
        traceId: stableTraceId({
          playerDNAProfileId: input.playerDNA.profileId,
          equipmentDNAProfileId: equipment.sourceProfileId,
          equipmentId: equipment.equipmentId,
          variantId: equipment.variantId,
          scoringConfigVersion: config.version,
          dimensions: dimensions.map((dimension) => [dimension.code, dimension.rawScore, dimension.weight]),
          finalScore
        }),
        playerDNAProfileId: input.playerDNA.profileId,
        playerDNAProfileVersion: input.playerDNA.version,
        equipmentDNAProfileId: equipment.sourceProfileId,
        equipmentDNAProfileVersion: equipment.profileVersion,
        equipmentId: equipment.equipmentId,
        variantId: equipment.variantId,
        scoringConfigVersion: config.version,
        eligibilityChecks: [eligibility],
        dimensions,
        initialWeights: config.weights,
        adjustedWeights: weights,
        dynamicWeightAdjustments: adjustments,
        penalties: [],
        bonuses: [],
        finalScore,
        confidence,
        tieBreakRulesUsed: [],
        generatedAt
      };

      if (input.context.minimumMatchScore === undefined || finalScore >= input.context.minimumMatchScore) {
        scoredItems.push({
          equipment,
          overallMatchScore: finalScore,
          matchBand: matchBand(finalScore),
          confidence,
          dimensions,
          explanation: buildCompatibilityExplanation({
            manufacturer: equipment.manufacturer,
            model: equipment.model,
            dimensions
          }),
          trace
        });
      }
    }

    const ranked = rankRecommendations(scoredItems);
    const resultLimit = input.context.resultLimit ?? 3;
    const recommendations = ranked.slice(0, resultLimit);
    const nonRecommended = ranked.slice(resultLimit);
    const confidence = aggregateRunConfidence(recommendations);

    return {
      playerId: input.playerDNA.playerId,
      playerDNAProfileId: input.playerDNA.profileId,
      scoringConfigVersion: config.version,
      primaryRecommendation: recommendations[0],
      alternatives: recommendations.slice(1),
      filteredEquipment,
      nonRecommended,
      confidence,
      traceSummary: {
        inputHash: createCompatibilityInputHash(input),
        generatedAt,
        eligibleCount: ranked.length,
        filteredCount: filteredEquipment.length
      },
      generatedAt
    };
  }
}

export function matchBand(score: number): CompatibilityBand {
  if (score >= 98) return "Exceptional Match";
  if (score >= 92) return "Excellent Match";
  if (score >= 85) return "Very Good Match";
  if (score >= 75) return "Good Match";
  if (score >= 65) return "Conditional Match";
  return "Not Recommended";
}

function aggregateRunConfidence(items: CompatibilityResultItem[]) {
  if (items.length === 0) {
    return { score: 0, band: "low" as const, reasons: ["No eligible equipment was scored."], missingInformation: [] };
  }

  const score = Math.round(items.reduce((sum, item) => sum + item.confidence.score, 0) / items.length);
  return {
    score,
    band: score >= 80 ? "high" as const : score >= 55 ? "medium" as const : "low" as const,
    reasons: ["Aggregated from returned recommendation item confidence."],
    missingInformation: [...new Set(items.flatMap((item) => item.confidence.missingInformation))]
  };
}
