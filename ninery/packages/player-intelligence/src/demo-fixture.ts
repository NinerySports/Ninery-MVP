import type { PlayerDNAInput } from "./player-dna.types.js";

type DemoPlayerDNAInputOverrides = Partial<Omit<PlayerDNAInput, "player" | "playerProfile" | "batMatchSession">> & {
  player?: Partial<PlayerDNAInput["player"]>;
  playerProfile?: Partial<NonNullable<PlayerDNAInput["playerProfile"]>>;
  batMatchSession?: Partial<NonNullable<PlayerDNAInput["batMatchSession"]>>;
};

export function createDemoPlayerDNAInput(overrides: DemoPlayerDNAInputOverrides = {}): PlayerDNAInput {
  const base: PlayerDNAInput = {
    player: {
      id: "demo-player-jackson-sanders",
      dateOfBirth: "2015-06-01",
      sport: "baseball",
      status: "active"
    },
    playerProfile: {
      bats: "right",
      throws: "right",
      battingSide: "right",
      throwingHand: "right",
      primaryPosition: "SS",
      secondaryPosition: "2B",
      competitionLevel: "travel",
      practiceFrequency: "3x_week",
      experienceYears: 5
    },
    growthMeasurements: [
      {
        heightCm: 145,
        weightKg: 41,
        measuredAt: "2026-01-01",
        source: "parent_entry",
        confidence: 0.8
      },
      {
        heightCm: 147,
        weightKg: 43,
        measuredAt: "2026-06-01",
        source: "parent_entry",
        confidence: 0.85
      }
    ],
    batMatchSession: {
      id: "demo-batmatch-session",
      status: "completed",
      type: "first_batmatch",
      version: 1,
      confidenceScore: 0.86,
      completedAt: "2026-06-10T12:00:00.000Z"
    },
    answers: [
      { questionCode: "PRIMARY_GOAL", answer: { value: "improve_contact" } },
      { questionCode: "CURRENT_EQUIPMENT", answer: { value: "2026 Rawlings ICON USA 30 inch drop 8" } },
      { questionCode: "CURRENT_BAT_FEEL", answer: { value: "likes light swing good pop large sweet spot" } },
      { questionCode: "HARDEST_AT_PLATE", answer: { value: "none" } },
      { questionCode: "PLATE_CONFIDENCE", answer: { value: 5 } },
      { questionCode: "PREFERRED_SWING_FEEL", answer: { value: "light" } },
      { questionCode: "GROWTH_CHANGE", answer: { value: "stable" } },
      { questionCode: "BUDGET", answer: { value: "mid" } }
    ],
    decisionSignals: []
  };

  return {
    ...base,
    ...overrides,
    player: { ...base.player, ...overrides.player },
    playerProfile: { ...base.playerProfile, ...overrides.playerProfile },
    growthMeasurements: overrides.growthMeasurements ?? base.growthMeasurements,
    batMatchSession: { ...base.batMatchSession, ...overrides.batMatchSession } as NonNullable<
      PlayerDNAInput["batMatchSession"]
    >,
    answers: overrides.answers ?? base.answers,
    decisionSignals: overrides.decisionSignals ?? base.decisionSignals
  };
}
