import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

@Controller()
export class SystemController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("health")
  async health() {
    const response: {
      status: "ok";
      service: string;
      timestamp: string;
      environment: string;
      database?: "connected" | "unavailable";
    } = {
      status: "ok",
      service: "ninery-api",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV ?? "development"
    };

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      response.database = "connected";
    } catch {
      response.database = "unavailable";
    }

    return response;
  }

  @Get("version")
  version() {
    return {
      service: "ninery-api",
      version: "0.1.0",
      commit: shortCommit(process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA),
      buildTime: process.env.BUILD_TIME
    };
  }
}

function shortCommit(value: string | undefined): string | undefined {
  return value ? value.slice(0, 7) : undefined;
}
