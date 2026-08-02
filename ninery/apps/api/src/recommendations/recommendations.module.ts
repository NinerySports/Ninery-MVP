import { Module } from "@nestjs/common";
import { RecommendationCompatibilityService } from "@ninery/recommendation-intelligence";
import { isProduction } from "../config/environment.js";
import { PrismaModule } from "../prisma/prisma.module.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { DevDemoRecommendationController } from "./dev-demo-recommendation.controller.js";
import { RecommendationsController } from "./recommendations.controller.js";

export function getRecommendationControllers(env: NodeJS.ProcessEnv = process.env) {
  return isProduction(env) ? [RecommendationsController] : [RecommendationsController, DevDemoRecommendationController];
}

@Module({
  imports: [PrismaModule],
  controllers: getRecommendationControllers(),
  providers: [
    {
      provide: RecommendationCompatibilityService,
      useFactory: (prisma: PrismaService) => new RecommendationCompatibilityService(prisma),
      inject: [PrismaService]
    }
  ]
})
export class RecommendationsModule {}
