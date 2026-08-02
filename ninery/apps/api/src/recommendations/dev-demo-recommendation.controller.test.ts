import assert from "node:assert/strict";
import test from "node:test";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { RecommendationCompatibilityService } from "@ninery/recommendation-intelligence";
import { PrismaService } from "../prisma/prisma.service.js";
import { DevDemoRecommendationController } from "./dev-demo-recommendation.controller.js";

const demoAnswers: Array<{ questionCode: string; answer: unknown }> = [
  { questionCode: "biggest_goal_this_season", answer: "improve_contact" },
  { questionCode: "current_bat_feel", answer: "balanced" },
  { questionCode: "confidence_in_box", answer: 4 }
];

const demoPlayer = {
  id: "demo-player-jackson-sanders",
  firstName: "Jackson",
  lastName: "Sanders",
  graduationYear: 2033,
  dateOfBirth: new Date("2015-06-01"),
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
  family: { name: "Sanders Family" },
  growthMeasurements: [
    { heightCm: "145.00", weightKg: "41.00", measuredAt: new Date("2026-01-01"), source: "parent", confidence: "0.8000" },
    { heightCm: "147.00", weightKg: "43.00", measuredAt: new Date("2026-06-01"), source: "parent", confidence: "0.8500" }
  ]
};
const demoSession = {
  id: "demo-batmatch-session",
  playerId: demoPlayer.id,
  status: "completed",
  type: "first_batmatch",
  version: 1,
  confidenceScore: "0.8600",
  completedAt: new Date("2026-06-10"),
  answers: demoAnswers.map((answer) => ({ answer: answer.answer, question: { code: answer.questionCode } })),
  decisionSignals: []
};
const demoRecommendationPayload = {
  playerId: demoPlayer.id,
  playerDNAProfileId: "demo-player-dna-profile",
  scoringConfigVersion: "compatibility-mvp-v1",
  primaryRecommendation: {
    equipment: { equipmentId: "demo-bat-meta", manufacturer: "Louisville Slugger", model: "Meta" },
    overallMatchScore: 94,
    matchBand: "Exceptional Match",
    confidence: { score: 91, band: "high", reasons: [], missingInformation: [] },
    dimensions: [],
    explanation: { summary: "Strong demo match", topReasons: [], tradeoffs: [], uncertainties: [], whatCouldChange: [] },
    trace: { traceId: "demo-trace" }
  },
  alternatives: [],
  filteredEquipment: [],
  nonRecommended: [],
  confidence: { score: 91, band: "high", reasons: [], missingInformation: [] },
  traceSummary: {
    inputHash: "demo-input-hash",
    generatedAt: "2026-07-17T00:00:00.000Z",
    eligibleCount: 1,
    filteredCount: 0
  },
  generatedAt: "2026-07-17T00:00:00.000Z"
};

function createPrismaDouble() {
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
    playerTimelineEvent: { create: async () => ({}) },
    platformEvent: { create: async () => ({}) }
  };

  return {
    ...tx,
    player: {
      findFirst: async () => demoPlayer,
      findUnique: async () => demoPlayer
    },
    batMatchSession: {
      findFirst: async () => demoSession,
      findUnique: async () => demoSession
    },
    $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)
  };
}

function createRecommendationServiceDouble() {
  return {
    generateRecommendations: async () => demoRecommendationPayload
  };
}

test("demo recommendation controller fails fast when PrismaService injection is missing", () => {
  assert.throws(
    () => new DevDemoRecommendationController(undefined as never, createRecommendationServiceDouble() as never),
    /PrismaService injection failed/
  );
});

test("demo recommendation controller fails fast when recommendation service injection is missing", () => {
  assert.throws(
    () => new DevDemoRecommendationController(createPrismaDouble() as never, undefined as never),
    /RecommendationCompatibilityService injection failed/
  );
});

test("demo recommendation controller receives both constructor dependencies", () => {
  const controller = new DevDemoRecommendationController(
    createPrismaDouble() as never,
    createRecommendationServiceDouble() as never
  );

  assert.ok(controller);
});

test("Nest module wiring defines the demo recommendation dependency", async () => {
  @Module({
    controllers: [DevDemoRecommendationController],
    providers: [
      { provide: PrismaService, useValue: createPrismaDouble() },
      { provide: RecommendationCompatibilityService, useValue: createRecommendationServiceDouble() }
    ]
  })
  class TestRecommendationModule {}

  const app = await NestFactory.createApplicationContext(TestRecommendationModule, { logger: false });
  try {
    const controller = app.get(DevDemoRecommendationController);
    assert.ok(controller);
  } finally {
    await app.close();
  }
});

test("GET /dev/demo/recommendation returns a valid demo recommendation payload", async () => {
  @Module({
    controllers: [DevDemoRecommendationController],
    providers: [
      { provide: PrismaService, useValue: createPrismaDouble() },
      { provide: RecommendationCompatibilityService, useValue: createRecommendationServiceDouble() }
    ]
  })
  class TestRecommendationHttpModule {}

  const app = await NestFactory.create(TestRecommendationHttpModule, { logger: false });
  await app.listen(0, "127.0.0.1");

  try {
    const address = app.getHttpServer().address();
    const response = await fetch(`http://127.0.0.1:${address.port}/dev/demo/recommendation`);
    assert.equal(response.status, 200);

    const payload = await response.json();
    assert.equal(payload.developmentOnly, true);
    assert.equal(payload.player.name, "Jackson Sanders");
    assert.equal(payload.recommendations.primaryRecommendation.overallMatchScore, 94);
    assert.equal(payload.traceSummary.eligibleCount, 1);
  } finally {
    await app.close();
  }
});