import test from "node:test";
import assert from "node:assert/strict";
import { PrismaPlayerDNARepository } from "../prisma-player-dna.repository.js";
import { createDemoPlayerDNAInput } from "../demo-fixture.js";
import { PlayerDNAService } from "../player-dna.service.js";

class DecimalMock {
  constructor(private readonly value: number) {}
  toNumber() {
    return this.value;
  }
}

test("Prisma repository creates and maps Decimal values to numbers", async () => {
  const generated = await new PlayerDNAService().generatePlayerDNA(createDemoPlayerDNAInput(), {
    profileId: "11111111-1111-4111-8111-111111111111",
    generatedAt: "2026-07-01T00:00:00.000Z"
  });
  const prisma = {
    playerDNAProfile: {
      create: async () => ({
        id: generated.profileId,
        playerId: generated.playerId,
        batMatchSessionId: generated.batMatchSessionId ?? null,
        version: generated.version,
        status: "generated",
        batControl: new DecimalMock(generated.scores.batControl),
        swingSpeed: new DecimalMock(generated.scores.swingSpeed),
        powerPotential: new DecimalMock(generated.scores.powerPotential),
        contactConsistency: new DecimalMock(generated.scores.contactConsistency),
        physicalStrength: new DecimalMock(generated.scores.physicalStrength),
        confidence: new DecimalMock(generated.scores.confidence),
        transitionReadiness: new DecimalMock(generated.scores.transitionReadiness),
        growthStability: new DecimalMock(generated.scores.growthStability),
        equipmentAwareness: new DecimalMock(generated.scores.equipmentAwareness),
        profileCompleteness: new DecimalMock(generated.scores.profileCompleteness),
        preferredSwingFeel: generated.categories.preferredSwingFeel,
        developmentStage: generated.categories.developmentStage,
        primaryHittingGoal: generated.categories.primaryHittingGoal,
        currentEquipmentAssessment: generated.categories.currentEquipmentAssessment ?? null,
        growthStatus: generated.categories.growthStatus,
        profileConfidenceLevel: generated.categories.profileConfidenceLevel,
        scoringRuleVersion: generated.scoringRuleVersion,
        inputHash: generated.inputHash,
        regenerationReason: generated.regenerationReason ?? null,
        inputSnapshot: generated.inputSnapshot,
        scoreBreakdown: generated.scoreBreakdown,
        generatedAt: new Date(generated.generatedAt)
      })
    }
  };

  const saved = await new PrismaPlayerDNARepository(prisma as never).createProfile(generated);

  assert.equal(typeof saved.scores.batControl, "number");
  assert.equal(saved.profileId, generated.profileId);
});

test("Prisma repository returns newest profiles first", async () => {
  const base = await new PlayerDNAService().generatePlayerDNA(createDemoPlayerDNAInput());
  const records = ["2026-07-02T00:00:00.000Z", "2026-07-01T00:00:00.000Z"].map((generatedAt, index) => ({
    id: `history-${index}`,
    playerId: base.playerId,
    batMatchSessionId: null,
    version: base.version,
    status: "generated",
    batControl: base.scores.batControl,
    swingSpeed: base.scores.swingSpeed,
    powerPotential: base.scores.powerPotential,
    contactConsistency: base.scores.contactConsistency,
    physicalStrength: base.scores.physicalStrength,
    confidence: base.scores.confidence,
    transitionReadiness: base.scores.transitionReadiness,
    growthStability: base.scores.growthStability,
    equipmentAwareness: base.scores.equipmentAwareness,
    profileCompleteness: base.scores.profileCompleteness,
    preferredSwingFeel: base.categories.preferredSwingFeel,
    developmentStage: base.categories.developmentStage,
    primaryHittingGoal: base.categories.primaryHittingGoal,
    currentEquipmentAssessment: null,
    growthStatus: base.categories.growthStatus,
    profileConfidenceLevel: base.categories.profileConfidenceLevel,
    scoringRuleVersion: base.scoringRuleVersion,
    inputHash: base.inputHash,
    regenerationReason: null,
    inputSnapshot: base.inputSnapshot,
    scoreBreakdown: base.scoreBreakdown,
    generatedAt: new Date(generatedAt)
  }));
  const prisma = {
    playerDNAProfile: {
      findMany: async () => records
    }
  };

  const history = await new PrismaPlayerDNARepository(prisma as never).listProfilesByPlayerId(base.playerId);

  assert.equal(history[0]?.profileId, "history-0");
  assert.equal(history[1]?.profileId, "history-1");
});
