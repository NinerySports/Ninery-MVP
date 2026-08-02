import test from "node:test";
import assert from "node:assert/strict";
import { PlayerDNAApplicationService } from "../player-dna.application-service.js";
import { createDemoPlayerDNAInput } from "../demo-fixture.js";

function createMockPrisma(options: { failPlatformEvent?: boolean } = {}) {
  const input = createDemoPlayerDNAInput();
  const player = {
    id: input.player.id,
    dateOfBirth: new Date(input.player.dateOfBirth ?? "2015-06-01"),
    sport: "baseball",
    status: "active",
    profile: {
      throwingHand: "right",
      battingSide: "right",
      primaryPosition: "SS",
      secondaryPosition: "2B",
      competitionLevel: "travel",
      practiceFrequency: "3x_week",
      experienceYears: 5
    },
    growthMeasurements: [
      { heightCm: "145.00", weightKg: "41.00", measuredAt: new Date("2026-01-01"), source: "parent", confidence: "0.8000" },
      { heightCm: "147.00", weightKg: "43.00", measuredAt: new Date("2026-06-01"), source: "parent", confidence: "0.8500" }
    ]
  };
  const session = {
    id: input.batMatchSession?.id ?? "session-1",
    playerId: input.player.id,
    status: "completed",
    type: "first_batmatch",
    version: 1,
    confidenceScore: "0.8600",
    completedAt: new Date("2026-06-10"),
    answers: input.answers?.map((answer) => ({ answer: answer.answer, question: { code: answer.questionCode } })) ?? [],
    decisionSignals: []
  };
  const profiles: unknown[] = [];
  const tx = {
    playerDNAProfile: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const record = { ...data, id: data.id, generatedAt: data.generatedAt as Date };
        profiles.push(record);
        return record;
      },
      findFirst: async () => null,
      findMany: async () => profiles,
      findUnique: async ({ where }: { where: { id: string } }) =>
        profiles.find((profile) => (profile as { id: string }).id === where.id) ?? null
    },
    playerTimelineEvent: {
      create: async () => ({})
    },
    platformEvent: {
      create: async () => {
        if (options.failPlatformEvent) {
          throw new Error("event write failed");
        }
        return {};
      }
    }
  };
  const prisma = {
    ...tx,
    player: { findUnique: async () => player },
    batMatchSession: {
      findFirst: async () => session,
      findUnique: async () => session
    },
    $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => {
      const before = profiles.length;
      try {
        return await callback(tx);
      } catch (error) {
        profiles.length = before;
        throw error;
      }
    },
    profiles
  };

  return prisma;
}

test("application service generates and persists a Player DNA profile", async () => {
  const prisma = createMockPrisma();
  const profile = await new PlayerDNAApplicationService(prisma as never).generatePlayerDNA("demo-player-jackson-sanders", {
    forceRegenerate: true
  });

  assert.equal(profile.playerId, "demo-player-jackson-sanders");
  assert.equal(prisma.profiles.length, 1);
});

test("forceRegenerate creates a new historical profile", async () => {
  const prisma = createMockPrisma();
  const service = new PlayerDNAApplicationService(prisma as never);

  await service.generatePlayerDNA("demo-player-jackson-sanders", { forceRegenerate: true });
  await service.regeneratePlayerDNA("demo-player-jackson-sanders");

  assert.equal(prisma.profiles.length, 2);
});

test("database transaction rolls back on event-write failure", async () => {
  const prisma = createMockPrisma({ failPlatformEvent: true });

  await assert.rejects(
    () => new PlayerDNAApplicationService(prisma as never).generatePlayerDNA("demo-player-jackson-sanders", { forceRegenerate: true }),
    /event write failed/
  );
  assert.equal(prisma.profiles.length, 0);
});
