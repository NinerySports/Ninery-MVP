import {
  EquipmentCategory as PrismaEquipmentCategory,
  EquipmentCertification as PrismaEquipmentCertification,
  EquipmentStatus as PrismaEquipmentStatus,
  type PrismaClient
} from "@prisma/client";
import type { EquipmentCategoryFilter, EquipmentCertificationFilter, EquipmentStatusFilter } from "./equipment-dna.types.js";

type PrismaTransaction = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;
export type PrismaLike = PrismaClient | PrismaTransaction;

export type EquipmentRepositoryOptions = {
  includeDraft?: boolean;
};

export type EquipmentRepositoryFilters = {
  certification?: EquipmentCertificationFilter;
  category?: EquipmentCategoryFilter;
  status?: EquipmentStatusFilter;
  modelYear?: number;
};

export class EquipmentDNARepository {
  constructor(private readonly prisma: PrismaLike) {}

  getEquipmentById(equipmentId: string) {
    return this.prisma.equipment.findUnique({ where: { id: equipmentId } });
  }

  getVariantById(variantId: string) {
    return this.prisma.equipmentVariant.findUnique({
      where: { id: variantId },
      include: { equipment: true }
    });
  }

  getActiveDNAProfile(equipmentId: string, options: EquipmentRepositoryOptions = {}) {
    return this.prisma.equipmentDNAProfile.findFirst({
      where: {
        equipmentId,
        status: options.includeDraft ? undefined : "active"
      },
      orderBy: [{ publishedAt: "desc" }, { version: "desc" }]
    });
  }

  getDNAProfileByVersion(equipmentId: string, version: number) {
    return this.prisma.equipmentDNAProfile.findFirst({
      where: { equipmentId, version }
    });
  }

  getDNAScores(dnaProfileId: string) {
    return this.prisma.equipmentDNAScore.findMany({
      where: { dnaProfileId },
      include: {
        characteristic: true,
        evidence: true
      }
    });
  }

  getSpecifications(equipmentId: string) {
    return this.prisma.equipmentSpecification.findMany({ where: { equipmentId } });
  }

  getEvidence(equipmentId: string, dnaProfileId?: string) {
    return this.prisma.equipmentEvidence.findMany({
      where: { equipmentId, dnaProfileId },
      orderBy: { createdAt: "desc" }
    });
  }

  getFitProfiles(equipmentId: string, dnaProfileId?: string) {
    return this.prisma.equipmentFitProfile.findMany({
      where: { equipmentId, dnaProfileId },
      orderBy: [{ fitType: "asc" }, { fitCode: "asc" }]
    });
  }

  getPersonalities(equipmentId: string, dnaProfileId?: string) {
    return this.prisma.equipmentPersonality.findMany({
      where: { equipmentId, dnaProfileId },
      orderBy: [{ isPrimary: "desc" }, { confidence: "desc" }]
    });
  }

  getAvailableVariants(equipmentId: string) {
    return this.prisma.equipmentVariant.findMany({
      where: { equipmentId },
      orderBy: [{ lengthInches: "asc" }, { weightOunces: "asc" }]
    });
  }

  listEligibleEquipment(filters: EquipmentRepositoryFilters = {}) {
    return this.prisma.equipment.findMany({
      where: {
        certification: filters.certification ? toPrismaEquipmentCertification(filters.certification) : undefined,
        category: filters.category ? toPrismaEquipmentCategory(filters.category) : undefined,
        status: filters.status ? toPrismaEquipmentStatus(filters.status) : PrismaEquipmentStatus.active,
        modelYear: filters.modelYear
      },
      include: {
        variants: true,
        dnaProfiles: {
          where: { status: "active" },
          orderBy: [{ publishedAt: "desc" }, { version: "desc" }],
          take: 1
        }
      }
    });
  }

  listEquipmentByCertification(certification: EquipmentCertificationFilter) {
    return this.prisma.equipment.findMany({
      where: { certification: toPrismaEquipmentCertification(certification) }
    });
  }

  listComparableEquipment(equipmentId: string) {
    return this.prisma.equipmentComparison.findMany({
      where: {
        OR: [{ sourceEquipmentId: equipmentId }, { targetEquipmentId: equipmentId }]
      },
      orderBy: { similarityScore: "desc" }
    });
  }
}

const equipmentCertificationToPrisma: Record<EquipmentCertificationFilter, PrismaEquipmentCertification> = {
  USA: PrismaEquipmentCertification.USA,
  USSSA: PrismaEquipmentCertification.USSSA,
  BBCOR: PrismaEquipmentCertification.BBCOR,
  none: PrismaEquipmentCertification.none,
  unknown: PrismaEquipmentCertification.unknown
};

const equipmentCategoryToPrisma: Record<EquipmentCategoryFilter, PrismaEquipmentCategory> = {
  bat: PrismaEquipmentCategory.bat,
  glove: PrismaEquipmentCategory.glove,
  cleat: PrismaEquipmentCategory.cleat,
  helmet: PrismaEquipmentCategory.helmet,
  catcher_gear: PrismaEquipmentCategory.catcher_gear
};

const equipmentStatusToPrisma: Record<EquipmentStatusFilter, PrismaEquipmentStatus> = {
  active: PrismaEquipmentStatus.active,
  coming_soon: PrismaEquipmentStatus.coming_soon,
  legacy: PrismaEquipmentStatus.legacy,
  archived: PrismaEquipmentStatus.archived
};

function toPrismaEquipmentCertification(certification: EquipmentCertificationFilter): PrismaEquipmentCertification {
  return equipmentCertificationToPrisma[certification];
}

function toPrismaEquipmentCategory(category: EquipmentCategoryFilter): PrismaEquipmentCategory {
  return equipmentCategoryToPrisma[category];
}

function toPrismaEquipmentStatus(status: EquipmentStatusFilter): PrismaEquipmentStatus {
  return equipmentStatusToPrisma[status];
}
