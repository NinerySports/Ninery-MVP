import type { Prisma, PrismaClient } from "@prisma/client";
import type { PlayerDNAProfileResult, PlayerDNACategories, PlayerDNAScores } from "./player-dna.types.js";
import type { PlayerDNARepository } from "./player-dna.repository.js";

type PrismaTransaction = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

type PrismaLike = PrismaClient | PrismaTransaction;

type PlayerDNARecord = {
  id: string;
  playerId: string;
  batMatchSessionId: string | null;
  version: string;
  status: string;
  batControl: unknown;
  swingSpeed: unknown;
  powerPotential: unknown;
  contactConsistency: unknown;
  physicalStrength: unknown;
  confidence: unknown;
  transitionReadiness: unknown;
  growthStability: unknown;
  equipmentAwareness: unknown;
  profileCompleteness: unknown;
  preferredSwingFeel: string;
  developmentStage: string;
  primaryHittingGoal: string;
  currentEquipmentAssessment: string | null;
  growthStatus: string;
  profileConfidenceLevel: string;
  scoringRuleVersion: string;
  inputHash: string;
  regenerationReason: string | null;
  inputSnapshot: unknown;
  scoreBreakdown: unknown;
  generatedAt: Date;
};

export class PrismaPlayerDNARepository implements PlayerDNARepository {
  constructor(private readonly prisma: PrismaLike) {}

  async createProfile(profile: PlayerDNAProfileResult): Promise<PlayerDNAProfileResult> {
    const record = await this.prisma.playerDNAProfile.create({
      data: {
        id: profile.profileId,
        playerId: profile.playerId,
        batMatchSessionId: profile.batMatchSessionId,
        version: profile.version,
        status: profile.status ?? "generated",
        batControl: profile.scores.batControl,
        swingSpeed: profile.scores.swingSpeed,
        powerPotential: profile.scores.powerPotential,
        contactConsistency: profile.scores.contactConsistency,
        physicalStrength: profile.scores.physicalStrength,
        confidence: profile.scores.confidence,
        transitionReadiness: profile.scores.transitionReadiness,
        growthStability: profile.scores.growthStability,
        equipmentAwareness: profile.scores.equipmentAwareness,
        profileCompleteness: profile.scores.profileCompleteness,
        preferredSwingFeel: profile.categories.preferredSwingFeel,
        developmentStage: profile.categories.developmentStage,
        primaryHittingGoal: profile.categories.primaryHittingGoal,
        currentEquipmentAssessment: profile.categories.currentEquipmentAssessment,
        growthStatus: profile.categories.growthStatus,
        profileConfidenceLevel: profile.categories.profileConfidenceLevel,
        scoringRuleVersion: profile.scoringRuleVersion,
        inputHash: profile.inputHash,
        regenerationReason: profile.regenerationReason,
        inputSnapshot: profile.inputSnapshot as unknown as Prisma.InputJsonValue,
        scoreBreakdown: profile.scoreBreakdown as unknown as Prisma.InputJsonValue,
        generatedAt: new Date(profile.generatedAt)
      }
    });

    return mapRecord(record as PlayerDNARecord);
  }

  async save(profile: PlayerDNAProfileResult): Promise<PlayerDNAProfileResult> {
    return this.createProfile(profile);
  }

  async getById(profileId: string): Promise<PlayerDNAProfileResult | null> {
    const record = await this.prisma.playerDNAProfile.findUnique({ where: { id: profileId } });
    return record ? mapRecord(record as PlayerDNARecord) : null;
  }

  async getLatestByPlayerId(playerId: string): Promise<PlayerDNAProfileResult | null> {
    const record = await this.prisma.playerDNAProfile.findFirst({
      where: { playerId, status: "generated" },
      orderBy: { generatedAt: "desc" }
    });
    return record ? mapRecord(record as PlayerDNARecord) : null;
  }

  async getHistoryByPlayerId(playerId: string): Promise<PlayerDNAProfileResult[]> {
    return this.listProfilesByPlayerId(playerId);
  }

  async listProfilesByPlayerId(playerId: string): Promise<PlayerDNAProfileResult[]> {
    const records = (await this.prisma.playerDNAProfile.findMany({
      where: { playerId },
      orderBy: { generatedAt: "desc" }
    })) as PlayerDNARecord[];
    return records.map((record) => mapRecord(record as PlayerDNARecord));
  }

  async getProfileBySessionId(batMatchSessionId: string): Promise<PlayerDNAProfileResult | null> {
    const record = await this.prisma.playerDNAProfile.findFirst({
      where: { batMatchSessionId, status: "generated" },
      orderBy: { generatedAt: "desc" }
    });
    return record ? mapRecord(record as PlayerDNARecord) : null;
  }

  async archiveProfile(profileId: string): Promise<PlayerDNAProfileResult | null> {
    const record = await this.prisma.playerDNAProfile.update({
      where: { id: profileId },
      data: { status: "archived" }
    });
    return mapRecord(record as PlayerDNARecord);
  }

  async profileExistsForInputVersion(params: {
    playerId: string;
    batMatchSessionId?: string;
    scoringRuleVersion: string;
    inputHash: string;
  }): Promise<PlayerDNAProfileResult | null> {
    const record = await this.prisma.playerDNAProfile.findFirst({
      where: {
        playerId: params.playerId,
        batMatchSessionId: params.batMatchSessionId,
        scoringRuleVersion: params.scoringRuleVersion,
        inputHash: params.inputHash,
        status: "generated"
      },
      orderBy: { generatedAt: "desc" }
    });
    return record ? mapRecord(record as PlayerDNARecord) : null;
  }
}

export function mapRecord(record: PlayerDNARecord): PlayerDNAProfileResult {
  const scoreBreakdown = record.scoreBreakdown as {
    explanations?: PlayerDNAProfileResult["explanations"];
    confidence?: PlayerDNAProfileResult["confidence"];
    missingInformation?: string[];
  };

  const scores: PlayerDNAScores = {
    batControl: decimalToNumber(record.batControl),
    swingSpeed: decimalToNumber(record.swingSpeed),
    powerPotential: decimalToNumber(record.powerPotential),
    contactConsistency: decimalToNumber(record.contactConsistency),
    physicalStrength: decimalToNumber(record.physicalStrength),
    confidence: decimalToNumber(record.confidence),
    transitionReadiness: decimalToNumber(record.transitionReadiness),
    growthStability: decimalToNumber(record.growthStability),
    equipmentAwareness: decimalToNumber(record.equipmentAwareness),
    profileCompleteness: decimalToNumber(record.profileCompleteness)
  };
  const categories: PlayerDNACategories = {
    preferredSwingFeel: record.preferredSwingFeel as PlayerDNACategories["preferredSwingFeel"],
    developmentStage: record.developmentStage as PlayerDNACategories["developmentStage"],
    primaryHittingGoal: record.primaryHittingGoal as PlayerDNACategories["primaryHittingGoal"],
    currentEquipmentAssessment: record.currentEquipmentAssessment ?? undefined,
    growthStatus: record.growthStatus as PlayerDNACategories["growthStatus"],
    profileConfidenceLevel: record.profileConfidenceLevel as PlayerDNACategories["profileConfidenceLevel"]
  };

  return {
    profileId: record.id,
    playerId: record.playerId,
    batMatchSessionId: record.batMatchSessionId ?? undefined,
    version: record.version,
    status: record.status as PlayerDNAProfileResult["status"],
    scoringRuleVersion: record.scoringRuleVersion,
    inputHash: record.inputHash,
    regenerationReason: record.regenerationReason ?? undefined,
    scores,
    categories,
    confidence:
      scoreBreakdown.confidence ?? {
        score: scores.profileCompleteness,
        level: categories.profileConfidenceLevel,
        factors: {},
        missingInformation: []
      },
    explanations: scoreBreakdown.explanations ?? [],
    missingInformation: scoreBreakdown.missingInformation ?? [],
    inputSnapshot: record.inputSnapshot as PlayerDNAProfileResult["inputSnapshot"],
    scoreBreakdown: record.scoreBreakdown,
    generatedAt: record.generatedAt.toISOString()
  };
}

function decimalToNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  if (value && typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") {
    return value.toNumber();
  }

  return Number(value);
}
