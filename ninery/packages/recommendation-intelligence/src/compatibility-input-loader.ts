import { EquipmentCategory as PrismaEquipmentCategory, type PrismaClient } from "@prisma/client";
import { EquipmentDNAService } from "@ninery/equipment-intelligence";
import { PrismaPlayerDNARepository } from "@ninery/player-intelligence";
import type { CompatibilityInput, CompatibilityRequestContext } from "./compatibility.types.js";

export class CompatibilityInputLoader {
  constructor(private readonly prisma: PrismaClient) {}

  async load(context: CompatibilityRequestContext): Promise<CompatibilityInput> {
    const playerRepository = new PrismaPlayerDNARepository(this.prisma);
    const playerDNA = context.playerDNAProfileId
      ? await playerRepository.getById(context.playerDNAProfileId)
      : await playerRepository.getLatestByPlayerId(context.playerId);

    if (!playerDNA) {
      throw new Error("Player DNA profile was not found.");
    }

    const equipmentRows = await this.prisma.equipment.findMany({
      where: { category: toPrismaEquipmentCategory(context.category) },
      select: { id: true },
      orderBy: [{ manufacturer: "asc" }, { model: "asc" }]
    });
    const equipmentService = EquipmentDNAService.fromPrisma(this.prisma);
    const equipment = await Promise.all(
      equipmentRows.map((row) => equipmentService.getEquipmentDNA(row.id, { includeDraft: context.includeInternalDraftProfiles }))
    );

    return { playerDNA, equipment, context };
  }
}

function toPrismaEquipmentCategory(category: CompatibilityRequestContext["category"]): PrismaEquipmentCategory {
  const values: Record<CompatibilityRequestContext["category"], PrismaEquipmentCategory> = {
    bat: PrismaEquipmentCategory.bat,
    glove: PrismaEquipmentCategory.glove,
    cleat: PrismaEquipmentCategory.cleat,
    helmet: PrismaEquipmentCategory.helmet,
    catcher_gear: PrismaEquipmentCategory.catcher_gear
  };
  return values[category];
}
