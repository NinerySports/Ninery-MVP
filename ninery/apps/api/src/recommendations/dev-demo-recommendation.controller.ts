import { Controller, Get, Inject, NotFoundException } from "@nestjs/common";
import { PlayerDNAApplicationService } from "@ninery/player-intelligence";
import {
  formatDemoRecommendationConsole,
  RecommendationCompatibilityService
} from "@ninery/recommendation-intelligence";
import { PrismaService } from "../prisma/prisma.service.js";

@Controller()
export class DevDemoRecommendationController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RecommendationCompatibilityService)
    private readonly recommendationService: RecommendationCompatibilityService
  ) {
    if (!prisma) {
      throw new Error("PrismaService injection failed for DevDemoRecommendationController.");
    }
    if (!recommendationService) {
      throw new Error("RecommendationCompatibilityService injection failed for DevDemoRecommendationController.");
    }
  }

  @Get("dev/demo/recommendation")
  async generateDemoRecommendation() {
    const player = await this.prisma.player.findFirst({
      where: {
        firstName: "Jackson",
        lastName: "Sanders",
        graduationYear: 2033,
        family: { name: "Sanders Family" }
      },
      include: {
        profile: true,
        family: true
      }
    });

    if (!player) {
      throw new NotFoundException("Demo player was not found. Run pnpm seed first.");
    }

    const playerDNA = await new PlayerDNAApplicationService(this.prisma).generatePlayerDNA(
      player.id,
      { forceRegenerate: false },
      { developmentBypass: true }
    );
    const recommendations = await this.recommendationService.generateRecommendations({
      playerId: player.id,
      playerDNAProfileId: playerDNA.profileId,
      certification: "USA",
      category: "bat",
      variantPreferences: { length: 30, drop: -8 },
      budget: { maximum: 400 },
      resultLimit: 3,
      forceRegenerate: false
    });
    const consoleOutput = formatDemoRecommendationConsole({
      player: { firstName: player.firstName, lastName: player.lastName },
      playerDNA,
      recommendations
    });

    console.log(consoleOutput);

    return {
      developmentOnly: true,
      player: {
        id: player.id,
        name: `${player.firstName} ${player.lastName}`,
        age: 11,
        competitionLevel: player.profile?.competitionLevel,
        currentBat: "2026 Rawlings ICON USA 30 inch drop 8"
      },
      playerDNA,
      recommendations: {
        primaryRecommendation: recommendations.primaryRecommendation,
        alternatives: recommendations.alternatives,
        filteredEquipment: recommendations.filteredEquipment
      },
      traceSummary: recommendations.traceSummary,
      consoleOutput
    };
  }
}