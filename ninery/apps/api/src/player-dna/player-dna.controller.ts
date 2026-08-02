import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards
} from "@nestjs/common";
import {
  PlayerDNAApplicationService,
  PlayerDNANotFoundError,
  PlayerDNAValidationError,
  playerDNAAttributes,
  type GeneratePlayerDNAFromDatabaseOptions,
  type PlayerDNAAttribute
} from "@ninery/player-intelligence";
import { PlayerDNAAuthorizationGuard } from "./player-dna.guard.js";

type GeneratePlayerDNABody = {
  batMatchSessionId?: string;
  forceRegenerate?: boolean;
  regenerationReason?: string;
};

@Controller()
@UseGuards(PlayerDNAAuthorizationGuard)
export class PlayerDNAController {
  constructor(private readonly playerDNAService: PlayerDNAApplicationService) {}

  @Post("players/:playerId/player-dna/generate")
  async generatePlayerDNA(
    @Param("playerId", new ParseUUIDPipe()) playerId: string,
    @Body() body: GeneratePlayerDNABody = {}
  ) {
    validateGenerateBody(body);
    return this.handle(() =>
      this.playerDNAService.generatePlayerDNA(playerId, toGenerateOptions(body), { developmentBypass: true })
    );
  }

  @Get("players/:playerId/player-dna")
  async getLatestPlayerDNA(@Param("playerId", new ParseUUIDPipe()) playerId: string) {
    const profile = await this.playerDNAService.getLatestPlayerDNA(playerId, { developmentBypass: true });

    if (!profile) {
      throw new NotFoundException("Player DNA profile was not found.");
    }

    return profile;
  }

  @Get("players/:playerId/player-dna/history")
  async getPlayerDNAHistory(@Param("playerId", new ParseUUIDPipe()) playerId: string) {
    return this.playerDNAService.getPlayerDNAHistory(playerId, { developmentBypass: true });
  }

  @Get("player-dna/:profileId")
  async getPlayerDNA(@Param("profileId", new ParseUUIDPipe()) profileId: string) {
    const profile = await this.playerDNAService.getPlayerDNA(profileId);

    if (!profile) {
      throw new NotFoundException("Player DNA profile was not found.");
    }

    return profile;
  }

  @Get("player-dna/:profileId/explanations/:attribute")
  async explainPlayerDNAAttribute(
    @Param("profileId", new ParseUUIDPipe()) profileId: string,
    @Param("attribute") attribute: string
  ) {
    if (!playerDNAAttributes.includes(attribute as PlayerDNAAttribute)) {
      throw new BadRequestException("Unknown Player DNA attribute.");
    }

    const explanation = await this.playerDNAService.explainPlayerDNAAttribute(profileId, attribute as PlayerDNAAttribute);

    if (!explanation) {
      throw new NotFoundException("Player DNA explanation was not found.");
    }

    return explanation;
  }

  private async handle<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof PlayerDNANotFoundError) {
        throw new NotFoundException(error.message);
      }

      if (error instanceof PlayerDNAValidationError) {
        throw new BadRequestException(error.message);
      }

      throw error;
    }
  }
}

function toGenerateOptions(body: GeneratePlayerDNABody): GeneratePlayerDNAFromDatabaseOptions {
  return {
    batMatchSessionId: body.batMatchSessionId,
    forceRegenerate: body.forceRegenerate ?? false,
    regenerationReason: body.regenerationReason
  };
}

function validateGenerateBody(body: GeneratePlayerDNABody): void {
  if (body.forceRegenerate !== undefined && typeof body.forceRegenerate !== "boolean") {
    throw new BadRequestException("forceRegenerate must be a boolean.");
  }

  if (body.batMatchSessionId !== undefined && typeof body.batMatchSessionId !== "string") {
    throw new BadRequestException("batMatchSessionId must be a UUID string.");
  }
}
