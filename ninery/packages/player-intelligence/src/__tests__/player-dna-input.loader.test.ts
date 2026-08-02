import test from "node:test";
import assert from "node:assert/strict";
import { PlayerDNAInputLoader } from "../player-dna-input.loader.js";
import { PlayerDNANotFoundError, PlayerDNAValidationError } from "../player-dna.errors.js";

const player = {
  id: "player-1",
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
  growthMeasurements: [
    {
      heightCm: "147.00",
      weightKg: "43.00",
      measuredAt: new Date("2026-06-01"),
      source: "parent",
      confidence: "0.8500"
    }
  ]
};

test("input loader uses latest completed BatMatch session when none is provided", async () => {
  const prisma = {
    player: { findUnique: async () => player },
    batMatchSession: {
      findFirst: async () => ({
        id: "session-1",
        playerId: "player-1",
        status: "completed",
        type: "first_batmatch",
        version: 1,
        confidenceScore: "0.8500",
        completedAt: new Date("2026-06-02"),
        answers: [{ answer: { value: "light" }, question: { code: "PREFERRED_SWING_FEEL" } }],
        decisionSignals: [{ signalCode: "CONTROL", signalName: "Control", confidence: "0.8000" }]
      })
    }
  };

  const loaded = await new PlayerDNAInputLoader(prisma as never).load({ playerId: "player-1" });

  assert.equal(loaded.input.batMatchSession?.id, "session-1");
  assert.equal(loaded.input.answers?.[0]?.questionCode, "PREFERRED_SWING_FEEL");
});

test("input loader rejects a BatMatch session belonging to another player", async () => {
  const prisma = {
    player: { findUnique: async () => player },
    batMatchSession: {
      findUnique: async () => ({
        id: "session-2",
        playerId: "other-player",
        status: "completed",
        type: "first_batmatch",
        version: 1,
        confidenceScore: null,
        completedAt: null,
        answers: [],
        decisionSignals: []
      })
    }
  };

  await assert.rejects(
    () => new PlayerDNAInputLoader(prisma as never).load({ playerId: "player-1", batMatchSessionId: "session-2" }),
    PlayerDNAValidationError
  );
});

test("input loader returns not found for a missing player", async () => {
  const prisma = {
    player: { findUnique: async () => null }
  };

  await assert.rejects(() => new PlayerDNAInputLoader(prisma as never).load({ playerId: "missing" }), PlayerDNANotFoundError);
});
