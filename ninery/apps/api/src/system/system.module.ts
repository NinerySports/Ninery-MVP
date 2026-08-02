import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module.js";
import { SystemController } from "./system.controller.js";

@Module({
  imports: [PrismaModule],
  controllers: [SystemController],
  providers: []
})
export class SystemModule {}
