import type { PrismaClient } from "@prisma/client";
import type { PlayerDNAInput } from "./player-dna.types.js";
import { PlayerDNANotFoundError, PlayerDNAValidationError } from "./player-dna.errors.js";

type PrismaTransaction = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

type PrismaLike = PrismaClient | PrismaTransaction;

type LoadedPlayer = {
  id: string;
  dateOfBirth: Date | null;
  sport: string;
  status: string;
  profile: {
    throwingHand: string | null;
    battingSide: string | null;
    primaryPosition: string | null;
    secondaryPosition: string | null;
    competitionLevel: string;
    practiceFrequency: string | null;
    experienceYears: number | null;
  } | null;
  growthMeasurements: Array<{
    heightCm: unknown;
    weightKg: unknown;
    measuredAt: Date;
    source: string | null;
    confidence: unknown;
  }>;
};

type LoadedSession = {
  id: string;
  playerId: string;
  status: string;
  type: string;
  version: number;
  confidenceScore: unknown;
  completedAt: Date | null;
  answers: Array<{
    answer: unknown;
    question: {
      code: string;
    };
  }>;
  decisionSignals: Array<{
    signalCode: string;
    signalName: string;
    confidence: unknown;
  }>;
};

export type LoadPlayerDNAInputOptions = {
  playerId: string;
  batMatchSessionId?: string;
};

export type LoadedPlayerDNAInput = {
  input: PlayerDNAInput;
  missingRequiredInformation: string[];
};

export class PlayerDNAInputLoader {
  constructor(private readonly prisma: PrismaLike) {}

  async load(options: LoadPlayerDNAInputOptions): Promise<LoadedPlayerDNAInput> {
    const player = (await this.prisma.player.findUnique({
      where: { id: options.playerId },
      include: {
        profile: true,
        growthMeasurements: {
          orderBy: { measuredAt: "desc" },
          take: 5
        }
      }
    })) as LoadedPlayer | null;

    if (!player) {
      throw new PlayerDNANotFoundError("Player was not found.");
    }

    const session = await this.loadSession(options.playerId, options.batMatchSessionId);
    const missingRequiredInformation = collectMissingInformation(player, session);

    return {
      input: {
        player: {
          id: player.id,
          dateOfBirth: player.dateOfBirth?.toISOString(),
          sport: player.sport,
          status: player.status
        },
        playerProfile: player.profile
          ? {
              bats: player.profile.battingSide ?? undefined,
              throws: player.profile.throwingHand ?? undefined,
              throwingHand: player.profile.throwingHand ?? undefined,
              battingSide: player.profile.battingSide ?? undefined,
              primaryPosition: player.profile.primaryPosition ?? undefined,
              secondaryPosition: player.profile.secondaryPosition ?? undefined,
              competitionLevel: player.profile.competitionLevel,
              practiceFrequency: player.profile.practiceFrequency ?? undefined,
              experienceYears: player.profile.experienceYears ?? undefined
            }
          : undefined,
        growthMeasurements: player.growthMeasurements.map((measurement) => ({
          heightCm: decimalToNumberOrUndefined(measurement.heightCm),
          weightKg: decimalToNumberOrUndefined(measurement.weightKg),
          measuredAt: measurement.measuredAt.toISOString(),
          source: measurement.source ?? undefined,
          confidence: decimalToNumberOrUndefined(measurement.confidence)
        })),
        batMatchSession: session
          ? {
              id: session.id,
              status: session.status,
              type: session.type,
              version: session.version,
              confidenceScore: decimalToNumberOrUndefined(session.confidenceScore),
              completedAt: session.completedAt?.toISOString()
            }
          : undefined,
        answers: session?.answers.map((answer) => ({
          questionCode: answer.question.code,
          answer: answer.answer
        })),
        decisionSignals: session?.decisionSignals.map((signal) => ({
          signalCode: signal.signalCode,
          signalName: signal.signalName,
          confidence: decimalToNumberOrUndefined(signal.confidence) ?? 0
        }))
      },
      missingRequiredInformation
    };
  }

  private async loadSession(playerId: string, batMatchSessionId?: string): Promise<LoadedSession | null> {
    if (batMatchSessionId) {
      const session = await this.findSessionById(batMatchSessionId);

      if (!session) {
        throw new PlayerDNANotFoundError("BatMatch session was not found.");
      }

      if (session.playerId !== playerId) {
        throw new PlayerDNAValidationError("BatMatch session does not belong to the requested player.");
      }

      return session;
    }

    return this.findLatestCompletedSession(playerId);
  }

  private async findSessionById(sessionId: string): Promise<LoadedSession | null> {
    return (await this.prisma.batMatchSession.findUnique({
      where: { id: sessionId },
      include: {
        answers: {
          include: {
            question: {
              select: { code: true }
            }
          }
        },
        decisionSignals: true
      }
    })) as LoadedSession | null;
  }

  private async findLatestCompletedSession(playerId: string): Promise<LoadedSession | null> {
    return (await this.prisma.batMatchSession.findFirst({
      where: {
        playerId,
        status: "completed"
      },
      orderBy: { completedAt: "desc" },
      include: {
        answers: {
          include: {
            question: {
              select: { code: true }
            }
          }
        },
        decisionSignals: true
      }
    })) as LoadedSession | null;
  }
}

function collectMissingInformation(player: LoadedPlayer, session: LoadedSession | null): string[] {
  const missing = [];

  if (!player.profile) missing.push("Player profile");
  if (!player.dateOfBirth) missing.push("Player birth date");
  if (player.growthMeasurements.length === 0) missing.push("Growth measurements");
  if (!session) missing.push("Completed BatMatch session");
  if (session && session.answers.length === 0) missing.push("BatMatch answers");

  return missing;
}

function decimalToNumberOrUndefined(value: unknown): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  if (value && typeof value === "object" && "toNumber" in value) {
    return (value as { toNumber: () => number }).toNumber();
  }

  return Number(value);
}
