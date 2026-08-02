import type { PrismaClient } from "@prisma/client";
import { createStableInputHash } from "./input-hash.js";
import {
  type GeneratePlayerDNAFromDatabaseOptions,
  type PlayerDNAAttribute,
  type PlayerDNAProfileResult
} from "./player-dna.types.js";
import { PlayerDNAInputLoader } from "./player-dna-input.loader.js";
import { PrismaPlayerDNARepository } from "./prisma-player-dna.repository.js";
import type { PlayerDNARepository } from "./player-dna.repository.js";
import { PlayerDNAService } from "./player-dna.service.js";
import { PLAYER_DNA_RULE_VERSION } from "./scoring/scoring-rule-registry.js";

type PrismaTransaction = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

type PrismaLike = PrismaClient | PrismaTransaction;

export type PlayerDNAAuthorizationContext = {
  userId?: string;
  familyId?: string;
  developmentBypass?: boolean;
};

export type PlayerDNAAuthorizer = {
  assertCanAccessPlayer(playerId: string, context?: PlayerDNAAuthorizationContext): Promise<void>;
};

export class DevelopmentPlayerDNAAuthorizer implements PlayerDNAAuthorizer {
  async assertCanAccessPlayer(): Promise<void> {
    return;
  }
}

export class PlayerDNAApplicationService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly authorizer: PlayerDNAAuthorizer = new DevelopmentPlayerDNAAuthorizer()
  ) {}

  async generatePlayerDNA(
    playerId: string,
    options: GeneratePlayerDNAFromDatabaseOptions = {},
    authorizationContext?: PlayerDNAAuthorizationContext
  ): Promise<PlayerDNAProfileResult> {
    await this.authorizer.assertCanAccessPlayer(playerId, authorizationContext);
    const loaded = await new PlayerDNAInputLoader(this.prisma).load({
      playerId,
      batMatchSessionId: options.batMatchSessionId
    });
    const scoringRuleVersion = options.scoringRuleVersion ?? PLAYER_DNA_RULE_VERSION;
    const inputHash = createStableInputHash(loaded.input, scoringRuleVersion);
    const repository = new PrismaPlayerDNARepository(this.prisma);

    if (!options.forceRegenerate) {
      const existing = await repository.profileExistsForInputVersion({
        playerId,
        batMatchSessionId: loaded.input.batMatchSession?.id,
        scoringRuleVersion,
        inputHash
      });

      if (existing) {
        return existing;
      }
    }

    const generated = await new PlayerDNAService().generatePlayerDNA(loaded.input, {
      scoringRuleVersion,
      regenerationReason: options.regenerationReason
    });

    return this.createProfileWithEvents(generated);
  }

  async regeneratePlayerDNA(
    playerId: string,
    options: GeneratePlayerDNAFromDatabaseOptions = {},
    authorizationContext?: PlayerDNAAuthorizationContext
  ): Promise<PlayerDNAProfileResult> {
    return this.generatePlayerDNA(
      playerId,
      {
        ...options,
        forceRegenerate: true,
        regenerationReason: options.regenerationReason ?? "manual_regeneration"
      },
      authorizationContext
    );
  }

  async getLatestPlayerDNA(playerId: string, authorizationContext?: PlayerDNAAuthorizationContext) {
    await this.authorizer.assertCanAccessPlayer(playerId, authorizationContext);
    return new PrismaPlayerDNARepository(this.prisma).getLatestByPlayerId(playerId);
  }

  async getPlayerDNAHistory(playerId: string, authorizationContext?: PlayerDNAAuthorizationContext) {
    await this.authorizer.assertCanAccessPlayer(playerId, authorizationContext);
    return new PrismaPlayerDNARepository(this.prisma).getHistoryByPlayerId(playerId);
  }

  async getPlayerDNA(profileId: string) {
    return new PrismaPlayerDNARepository(this.prisma).getById(profileId);
  }

  async explainPlayerDNAAttribute(profileId: string, attribute: PlayerDNAAttribute) {
    const profile = await this.getPlayerDNA(profileId);
    return profile?.explanations.find((explanation) => explanation.attribute === attribute) ?? null;
  }

  private async createProfileWithEvents(profile: PlayerDNAProfileResult): Promise<PlayerDNAProfileResult> {
    return this.prisma.$transaction(async (tx: PrismaTransaction) => {
      const repository: PlayerDNARepository = new PrismaPlayerDNARepository(tx as PrismaLike);
      const saved = await repository.createProfile(profile);

      await tx.playerTimelineEvent.create({
        data: {
          playerId: saved.playerId,
          eventType: "player_dna_generated",
          title: "Player DNA generated",
          description: "A new Player DNA profile was generated.",
          eventDate: new Date(saved.generatedAt),
          relatedEntityType: "PlayerDNAProfile",
          relatedEntityId: saved.profileId
        }
      });

      await tx.platformEvent.create({
        data: {
          eventType: "player_dna_generated",
          entityType: "PlayerDNAProfile",
          entityId: saved.profileId,
          payload: {
            playerId: saved.playerId,
            batMatchSessionId: saved.batMatchSessionId,
            scoringRuleVersion: saved.scoringRuleVersion,
            inputHash: saved.inputHash
          }
        }
      });

      return saved;
    });
  }
}
