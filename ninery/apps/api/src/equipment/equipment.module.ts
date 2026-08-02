import { Module } from "@nestjs/common";
import { EquipmentDNAService } from "@ninery/equipment-intelligence";
import { PrismaModule } from "../prisma/prisma.module.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { EquipmentController } from "./equipment.controller.js";

@Module({
  imports: [PrismaModule],
  controllers: [EquipmentController],
  providers: [
    {
      provide: EquipmentDNAService,
      useFactory: (prisma: PrismaService) => EquipmentDNAService.fromPrisma(prisma),
      inject: [PrismaService]
    }
  ]
})
export class EquipmentModule {}
