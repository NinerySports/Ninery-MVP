import { randomUUID } from "node:crypto";
import {
  type GeneratePlayerDNAOptions,
  type PlayerDNAAttribute,
  type PlayerDNAInput,
  type PlayerDNAProfileResult
} from "./player-dna.types.js";
import { calculateProfileConfidence } from "./scoring/confidence-calculator.js";
import { PLAYER_DNA_RULE_VERSION, getPlayerDNAScoringRules } from "./scoring/scoring-rule-registry.js";
import { runScoringEngine } from "./scoring/scoring-engine.js";
import { InMemoryPlayerDNARepository, type PlayerDNARepository } from "./player-dna.repository.js";
import { createStableInputHash } from "./input-hash.js";

export class PlayerDNAService {
  constructor(private readonly repository: PlayerDNARepository = new InMemoryPlayerDNARepository()) {}

  async generatePlayerDNA(input: PlayerDNAInput, options: GeneratePlayerDNAOptions = {}): Promise<PlayerDNAProfileResult> {
    const scoringRuleVersion = options.scoringRuleVersion ?? PLAYER_DNA_RULE_VERSION;
    const engineOutput = runScoringEngine(input, getPlayerDNAScoringRules());
    const confidence = calculateProfileConfidence(input);
    const generatedAt = options.generatedAt ?? new Date().toISOString();
    const inputHash = createStableInputHash(input, scoringRuleVersion);
    const profile: PlayerDNAProfileResult = {
      profileId: options.profileId ?? randomUUID(),
      playerId: input.player.id,
      batMatchSessionId: input.batMatchSession?.id,
      version: "1.0.0",
      status: "generated",
      scoringRuleVersion,
      inputHash,
      regenerationReason: options.regenerationReason,
      scores: {
        ...engineOutput.scores,
        profileCompleteness: confidence.score
      },
      categories: {
        ...engineOutput.categories,
        profileConfidenceLevel: confidence.level
      },
      confidence,
      explanations: engineOutput.explanations.map((explanation) =>
        explanation.attribute === "profileCompleteness"
          ? {
              ...explanation,
              score: confidence.score,
              finalNormalizedScore: confidence.score,
              summary: "Profile completeness reflects available profile, BatMatch, growth, and equipment context.",
              missingInformation: confidence.missingInformation
            }
          : explanation
      ),
      missingInformation: [...new Set([...engineOutput.missingInformation, ...confidence.missingInformation])],
      inputSnapshot: input,
      scoreBreakdown: {
        breakdown: engineOutput.breakdown,
        explanations: engineOutput.explanations,
        confidence,
        missingInformation: [...new Set([...engineOutput.missingInformation, ...confidence.missingInformation])]
      },
      generatedAt
    };

    return this.repository.save(profile);
  }

  async regeneratePlayerDNA(playerId: string, input: PlayerDNAInput, options: GeneratePlayerDNAOptions = {}) {
    return this.generatePlayerDNA({ ...input, player: { ...input.player, id: playerId } }, options);
  }

  async getLatestPlayerDNA(playerId: string) {
    return this.repository.getLatestByPlayerId(playerId);
  }

  async getPlayerDNAHistory(playerId: string) {
    return this.repository.getHistoryByPlayerId(playerId);
  }

  async explainPlayerDNAAttribute(profileId: string, attribute: PlayerDNAAttribute) {
    const profile = await this.repository.getById(profileId);

    if (!profile) {
      return null;
    }

    return profile.explanations.find((explanation) => explanation.attribute === attribute) ?? null;
  }
}
