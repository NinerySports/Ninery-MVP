import { BadRequestException, Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import {
  RecommendationCompatibilityService,
  equipmentCategoryValues,
  equipmentCertificationValues,
  type BudgetPreferences,
  type CompatibilityRequestContext,
  type EquipmentCategoryFilter,
  type EquipmentCertificationFilter,
  type VariantPreferences
} from "@ninery/recommendation-intelligence";
import { PlayerDNAAuthorizationGuard } from "../player-dna/player-dna.guard.js";

type GenerateRecommendationsBody = {
  playerDNAProfileId?: string;
  certification?: string;
  category?: string;
  variantPreferences?: VariantPreferences;
  budget?: BudgetPreferences;
  resultLimit?: number;
  scoringConfigVersion?: string;
  forceRegenerate?: boolean;
  includeInternalDraftProfiles?: boolean;
  minimumMatchScore?: number;
  minimumEvidenceConfidence?: number;
};

@Controller()
@UseGuards(PlayerDNAAuthorizationGuard)
export class RecommendationsController {
  constructor(private readonly recommendationService: RecommendationCompatibilityService) {}

  @Post("players/:playerId/recommendations/generate")
  generateRecommendations(
    @Param("playerId", new ParseUUIDPipe()) playerId: string,
    @Body() body: GenerateRecommendationsBody = {}
  ) {
    return this.recommendationService.generateRecommendations(toRequestContext(playerId, body));
  }

  @Get("players/:playerId/recommendations/latest")
  async getLatestRecommendation(@Param("playerId", new ParseUUIDPipe()) playerId: string) {
    const recommendation = await this.recommendationService.getLatestRecommendationForPlayer(playerId);
    if (!recommendation) throw new NotFoundException("Recommendation was not found.");
    return recommendation;
  }

  @Get("players/:playerId/recommendations/history")
  getRecommendationHistory(@Param("playerId", new ParseUUIDPipe()) playerId: string) {
    return this.recommendationService.getRecommendationHistory(playerId);
  }

  @Get("recommendations/:recommendationId")
  async getRecommendation(@Param("recommendationId", new ParseUUIDPipe()) recommendationId: string) {
    const recommendation = await this.recommendationService.getRecommendation(recommendationId);
    if (!recommendation) throw new NotFoundException("Recommendation was not found.");
    return recommendation;
  }

  @Get("recommendation-items/:itemId/explanation")
  async explainRecommendationItem(@Param("itemId", new ParseUUIDPipe()) itemId: string) {
    const explanation = await this.recommendationService.explainRecommendationItem(itemId);
    if (!explanation) throw new NotFoundException("Recommendation item explanation was not found.");
    return explanation;
  }

  @Get("recommendation-items/:sourceItemId/compare/:targetItemId")
  compareRecommendationItems(
    @Param("sourceItemId", new ParseUUIDPipe()) sourceItemId: string,
    @Param("targetItemId", new ParseUUIDPipe()) targetItemId: string
  ) {
    return this.recommendationService.compareRecommendationItems(sourceItemId, targetItemId);
  }
}

function toRequestContext(playerId: string, body: GenerateRecommendationsBody): CompatibilityRequestContext {
  return {
    playerId,
    playerDNAProfileId: body.playerDNAProfileId,
    certification: parseEnum(body.certification ?? "USA", equipmentCertificationValues, "certification"),
    category: parseEnum(body.category ?? "bat", equipmentCategoryValues, "category"),
    variantPreferences: validateVariantPreferences(body.variantPreferences),
    budget: validateBudget(body.budget),
    resultLimit: validateNumber(body.resultLimit, "resultLimit", 1, 10) ?? 3,
    scoringConfigVersion: body.scoringConfigVersion,
    forceRegenerate: body.forceRegenerate ?? false,
    includeInternalDraftProfiles: body.includeInternalDraftProfiles ?? false,
    minimumMatchScore: validateNumber(body.minimumMatchScore, "minimumMatchScore", 0, 100),
    minimumEvidenceConfidence: validateNumber(body.minimumEvidenceConfidence, "minimumEvidenceConfidence", 0, 100)
  };
}

function parseEnum(value: string, values: readonly EquipmentCertificationFilter[], name: string): EquipmentCertificationFilter;
function parseEnum(value: string, values: readonly EquipmentCategoryFilter[], name: string): EquipmentCategoryFilter;
function parseEnum<T extends string>(value: string, values: readonly T[], name: string): T {
  if (!isOneOf(value, values)) {
    throw new BadRequestException(`${name} must be one of: ${values.join(", ")}.`);
  }
  return value;
}

function isOneOf<T extends string>(value: string, values: readonly T[]): value is T {
  return values.some((item) => item === value);
}

function validateNumber(value: number | undefined, name: string, min: number, max: number): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || Number.isNaN(value) || value < min || value > max) {
    throw new BadRequestException(`${name} must be a number between ${min} and ${max}.`);
  }
  return value;
}

function validateVariantPreferences(value: VariantPreferences | undefined): VariantPreferences | undefined {
  if (!value) return undefined;
  return {
    length: validateNumber(value.length, "variantPreferences.length", 0, 40),
    drop: validateNumber(value.drop, "variantPreferences.drop", -20, 5)
  };
}

function validateBudget(value: BudgetPreferences | undefined): BudgetPreferences | undefined {
  if (!value) return undefined;
  return {
    minimum: validateNumber(value.minimum, "budget.minimum", 0, 2000),
    maximum: validateNumber(value.maximum, "budget.maximum", 0, 2000)
  };
}
