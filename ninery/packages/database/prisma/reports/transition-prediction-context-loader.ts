import type { PrismaClient } from "@prisma/client";
import { PrismaPlayerDNARepository } from "../../../player-intelligence/src/prisma-player-dna.repository.ts";
import {
  CanonicalEquipmentDNAProfileLoader,
  scalarCanonicalValue,
  type CanonicalEquipmentDNAProfileLoaderRepository
} from "../../../equipment-intelligence/src/index.ts";
import type { TransitionPredictionContextLoaderRepository } from "../../../recommendation-intelligence/src/index.ts";
import type { FirstGenuineStudyReadinessRepository } from "../../../recommendation-intelligence/src/index.ts";
import type { PrismaTransitionShadowAdminRepository } from "./transition-shadow-admin-workflow-fixtures.ts";

export function createPrismaTransitionPredictionContextLoaderRepository(
  prisma: PrismaClient,
  adminRepository: PrismaTransitionShadowAdminRepository
): TransitionPredictionContextLoaderRepository {
  const playerDNARepository = new PrismaPlayerDNARepository(prisma);
  const canonicalLoader = new CanonicalEquipmentDNAProfileLoader(createCanonicalRepository(prisma));
  return {
    getStudy: (studyId) => adminRepository.getStudy(studyId),
    getPlayer: (playerId) => adminRepository.getPlayer(playerId),
    getEquipment: (equipmentId) => adminRepository.getEquipment(equipmentId),
    getEquipmentVariant: (variantId) => adminRepository.getEquipmentVariant(variantId),
    listAuditEvents: (studyId) => adminRepository.listAuditEvents(studyId),
    listPlayerDNAProfiles: (playerId) => playerDNARepository.listProfilesByPlayerId(playerId),
    async loadCanonicalEquipmentDNAProfile(input) {
      return canonicalLoader.loadCanonicalEquipmentDNAProfile(input);
    }
  };
}

export function createPrismaFirstGenuineStudyReadinessRepository(
  prisma: PrismaClient,
  adminRepository: PrismaTransitionShadowAdminRepository
): FirstGenuineStudyReadinessRepository {
  const base = createPrismaTransitionPredictionContextLoaderRepository(prisma, adminRepository);
  return {
    ...base,
    async hasActiveStudyForTransition(input) {
      const row = await prisma.transitionExtendedShadowStudy.findFirst({
        where: {
          playerId: input.playerId,
          currentEquipmentId: input.currentEquipmentId,
          currentEquipmentVariantId: input.currentVariantId,
          proposedEquipmentId: input.proposedEquipmentId,
          proposedEquipmentVariantId: input.proposedVariantId,
          status: { in: ["draft", "prediction_captured", "observation_active"] }
        },
        select: { id: true }
      });
      return !!row;
    },
    async getVariantSpecification(variantId) {
      const row = await prisma.equipmentVariant.findUnique({
        where: { id: variantId },
        select: { id: true, equipmentId: true, lengthInches: true, weightOunces: true, dropWeight: true }
      });
      return row ? {
        id: row.id,
        equipmentId: row.equipmentId,
        length: decimalToNumber(row.lengthInches),
        weight: decimalToNumber(row.weightOunces),
        drop: row.dropWeight ?? undefined
      } : undefined;
    },
    async hasAcknowledgement(studyId) {
      const rows = await adminRepository.listAuditEvents(studyId);
      return rows.some((event) => event.metadata?.genuineIntakeVersion === "1.0" || event.metadata?.acknowledgementVersion === "1.0");
    }
  };
}

function createCanonicalRepository(prisma: PrismaClient): CanonicalEquipmentDNAProfileLoaderRepository {
  return {
    async getEquipmentForCanonicalProfile(equipmentId: string) {
      return prisma.equipment.findUnique({ where: { id: equipmentId } });
    },
    async getVariantForCanonicalProfile(equipmentVariantId: string) {
      return prisma.equipmentVariant.findUnique({ where: { id: equipmentVariantId } });
    },
    async listActiveCanonicalEvaluations(input: { equipmentId: string; equipmentVariantId?: string }) {
      const rows = await prisma.equipmentDNAAttributeEvaluation.findMany({
        where: { OR: [{ equipmentId: input.equipmentId }, ...(input.equipmentVariantId ? [{ equipmentVariantId: input.equipmentVariantId }] : [])], status: "active" },
        include: { evidenceLinks: { include: { evidenceRecord: true } } },
        orderBy: [{ targetLevel: "asc" }, { attributeKey: "asc" }, { evaluationVersion: "desc" }]
      });
      return rows.map((row) => ({
        id: row.id,
        equipmentId: row.equipmentId ?? undefined,
        equipmentVariantId: row.equipmentVariantId ?? undefined,
        targetLevel: row.targetLevel,
        attributeKey: row.attributeKey,
        attributeDefinitionVersion: row.attributeDefinitionVersion,
        value: scalarCanonicalValue(row.value),
        confidence: row.confidence,
        evaluationMethod: row.evaluationMethod,
        evaluationVersion: row.evaluationVersion,
        status: row.status,
        rationale: row.rationale ?? undefined,
        evaluatedAt: row.evaluatedAt ?? undefined,
        evidenceRecords: row.evidenceLinks.map((link) => ({
          id: link.evidenceRecord.id,
          equipmentId: link.evidenceRecord.equipmentId ?? undefined,
          equipmentVariantId: link.evidenceRecord.equipmentVariantId ?? undefined,
          targetLevel: link.evidenceRecord.targetLevel,
          attributeKey: link.evidenceRecord.attributeKey,
          attributeDefinitionVersion: link.evidenceRecord.attributeDefinitionVersion,
          sourceType: link.evidenceRecord.sourceType,
          sourceName: link.evidenceRecord.sourceName,
          sourceReference: link.evidenceRecord.sourceReference ?? undefined,
          method: link.evidenceRecord.method,
          rawValue: link.evidenceRecord.rawValue ?? undefined,
          normalizedValue: link.evidenceRecord.normalizedValue ?? undefined,
          unit: link.evidenceRecord.unit ?? undefined,
          notes: link.evidenceRecord.notes ?? undefined,
          status: link.evidenceRecord.status,
          evaluatorType: link.evidenceRecord.evaluatorType ?? undefined,
          evaluatorReference: link.evidenceRecord.evaluatorReference ?? undefined
        }))
      }));
    }
  };
}

function decimalToNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") return value.toNumber();
  return Number(value);
}
