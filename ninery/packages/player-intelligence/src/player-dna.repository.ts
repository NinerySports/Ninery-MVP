import type { PlayerDNAAttribute, PlayerDNAProfileResult } from "./player-dna.types.js";

export type PlayerDNARepository = {
  createProfile(profile: PlayerDNAProfileResult): Promise<PlayerDNAProfileResult>;
  save(profile: PlayerDNAProfileResult): Promise<PlayerDNAProfileResult>;
  getLatestByPlayerId(playerId: string): Promise<PlayerDNAProfileResult | null>;
  getHistoryByPlayerId(playerId: string): Promise<PlayerDNAProfileResult[]>;
  listProfilesByPlayerId(playerId: string): Promise<PlayerDNAProfileResult[]>;
  getById(profileId: string): Promise<PlayerDNAProfileResult | null>;
  getProfileBySessionId(batMatchSessionId: string): Promise<PlayerDNAProfileResult | null>;
  archiveProfile(profileId: string): Promise<PlayerDNAProfileResult | null>;
  profileExistsForInputVersion(params: {
    playerId: string;
    batMatchSessionId?: string;
    scoringRuleVersion: string;
    inputHash: string;
  }): Promise<PlayerDNAProfileResult | null>;
};

export class InMemoryPlayerDNARepository implements PlayerDNARepository {
  private readonly profiles: PlayerDNAProfileResult[] = [];

  async createProfile(profile: PlayerDNAProfileResult): Promise<PlayerDNAProfileResult> {
    this.profiles.push(profile);
    return profile;
  }

  async save(profile: PlayerDNAProfileResult): Promise<PlayerDNAProfileResult> {
    return this.createProfile(profile);
  }

  async getLatestByPlayerId(playerId: string): Promise<PlayerDNAProfileResult | null> {
    return (
      this.profiles
        .filter((profile) => profile.playerId === playerId)
        .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())[0] ?? null
    );
  }

  async getHistoryByPlayerId(playerId: string): Promise<PlayerDNAProfileResult[]> {
    return this.profiles
      .filter((profile) => profile.playerId === playerId)
      .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
  }

  async listProfilesByPlayerId(playerId: string): Promise<PlayerDNAProfileResult[]> {
    return this.getHistoryByPlayerId(playerId);
  }

  async getById(profileId: string): Promise<PlayerDNAProfileResult | null> {
    return this.profiles.find((profile) => profile.profileId === profileId) ?? null;
  }

  async getProfileBySessionId(batMatchSessionId: string): Promise<PlayerDNAProfileResult | null> {
    return this.profiles.find((profile) => profile.batMatchSessionId === batMatchSessionId) ?? null;
  }

  async archiveProfile(profileId: string): Promise<PlayerDNAProfileResult | null> {
    const profile = await this.getById(profileId);

    if (!profile) {
      return null;
    }

    profile.status = "archived";
    return profile;
  }

  async profileExistsForInputVersion(params: {
    playerId: string;
    batMatchSessionId?: string;
    scoringRuleVersion: string;
    inputHash: string;
  }): Promise<PlayerDNAProfileResult | null> {
    return (
      this.profiles.find(
        (profile) =>
          profile.playerId === params.playerId &&
          profile.batMatchSessionId === params.batMatchSessionId &&
          profile.scoringRuleVersion === params.scoringRuleVersion &&
          profile.inputHash === params.inputHash
      ) ?? null
    );
  }
}

export type PlayerDNAAttributeExplanationRequest = {
  profileId: string;
  attribute: PlayerDNAAttribute;
};
