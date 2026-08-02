import { Module } from "@nestjs/common";
import {
  DevelopmentPlayerDNAAuthorizer,
  PlayerDNAApplicationService,
  type PlayerDNAAuthorizer
} from "@ninery/player-intelligence";
import { PrismaModule } from "../prisma/prisma.module.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { PlayerDNAController } from "./player-dna.controller.js";

export const PLAYER_DNA_AUTHORIZER = Symbol("PLAYER_DNA_AUTHORIZER");

@Module({
  imports: [PrismaModule],
  controllers: [PlayerDNAController],
  providers: [
    {
      provide: PLAYER_DNA_AUTHORIZER,
      useClass: DevelopmentPlayerDNAAuthorizer
    },
    {
      provide: PlayerDNAApplicationService,
      useFactory: (prisma: PrismaService, authorizer: PlayerDNAAuthorizer) =>
        new PlayerDNAApplicationService(prisma, authorizer),
      inject: [PrismaService, PLAYER_DNA_AUTHORIZER]
    }
  ]
})
export class PlayerDNAModule {}
