import { Module } from "@nestjs/common";
import { EquipmentModule } from "./equipment/equipment.module.js";
import { PlayerDNAModule } from "./player-dna/player-dna.module.js";
import { RecommendationsModule } from "./recommendations/recommendations.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { SystemModule } from "./system/system.module.js";

@Module({
  imports: [PrismaModule, SystemModule, PlayerDNAModule, EquipmentModule, RecommendationsModule]
})
export class AppModule {}
