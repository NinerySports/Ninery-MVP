import {
  EquipmentAttributeConfidence as PrismaEquipmentAttributeConfidence,
  EquipmentDNAAttributeEvaluationStatus as PrismaEquipmentDNAAttributeEvaluationStatus,
  EquipmentDNAEvaluatorType as PrismaEquipmentDNAEvaluatorType,
  EquipmentDNAEvidenceRecordStatus as PrismaEquipmentDNAEvidenceRecordStatus,
  EquipmentDNAEvidenceSourceType as PrismaEquipmentDNAEvidenceSourceType,
  EquipmentDNATargetLevel as PrismaEquipmentDNATargetLevel,
  EquipmentEvaluationMethod as PrismaEquipmentEvaluationMethod,
  Prisma
} from "@prisma/client";
import type { PrismaLike } from "../equipment-dna.repository.js";
import type {
  EquipmentDNAAttributeNormalizedValue
} from "../attributes/index.js";
import type {
  EquipmentAttributeConfidence,
  EquipmentDNAAttributeEvaluation,
  EquipmentDNAEvaluationStatus,
  EquipmentDNAEvidenceRecord,
  EquipmentDNAEvaluatorType,
  EquipmentDNATargetLevel,
  EquipmentEvaluationMethod,
  EquipmentEvidenceSourceType,
  EquipmentEvidenceStatus,
  EquipmentJsonValue
} from "./equipment-evidence.types.js";

export type CreateEquipmentDNAEvidenceRecordInput = Omit<EquipmentDNAEvidenceRecord, "id" | "createdAt" | "updatedAt">;

export type CreateEquipmentDNAAttributeEvaluationInput = Omit<
  EquipmentDNAAttributeEvaluation,
  "id" | "createdAt" | "updatedAt" | "evidenceRecords"
>;

export interface EquipmentDNAEvaluationRepositoryPort {
  createEvidence(input: CreateEquipmentDNAEvidenceRecordInput): Promise<EquipmentDNAEvidenceRecord>;
  listEvidenceForEquipment(equipmentId: string): Promise<EquipmentDNAEvidenceRecord[]>;
  listEvidenceForVariant(equipmentVariantId: string): Promise<EquipmentDNAEvidenceRecord[]>;
  listEvidenceByIds(evidenceRecordIds: readonly string[]): Promise<EquipmentDNAEvidenceRecord[]>;
  createDraftEvaluation(input: CreateEquipmentDNAAttributeEvaluationInput): Promise<EquipmentDNAAttributeEvaluation>;
  updateEvaluationStatus(input: {
    evaluationId: string;
    status: EquipmentDNAEvaluationStatus;
    confidence?: EquipmentAttributeConfidence;
    rationale?: string;
    evaluatedAt?: Date;
  }): Promise<EquipmentDNAAttributeEvaluation>;
  linkEvidenceToEvaluation(evaluationId: string, evidenceRecordIds: readonly string[]): Promise<void>;
  findEvaluationById(evaluationId: string): Promise<EquipmentDNAAttributeEvaluation | undefined>;
  findCurrentActiveEvaluation(input: {
    equipmentId?: string;
    equipmentVariantId?: string;
    attributeKey: string;
    attributeDefinitionVersion: string;
  }): Promise<EquipmentDNAAttributeEvaluation | undefined>;
  listCurrentEvaluationsForEquipment(equipmentId: string): Promise<EquipmentDNAAttributeEvaluation[]>;
  listCurrentEvaluationsForVariant(equipmentVariantId: string): Promise<EquipmentDNAAttributeEvaluation[]>;
}

export class PrismaEquipmentDNAEvaluationRepository implements EquipmentDNAEvaluationRepositoryPort {
  constructor(private readonly prisma: PrismaLike) {}

  async createEvidence(input: CreateEquipmentDNAEvidenceRecordInput): Promise<EquipmentDNAEvidenceRecord> {
    const record = await this.prisma.equipmentDNAEvidenceRecord.create({
      data: {
        equipmentId: input.equipmentId,
        equipmentVariantId: input.equipmentVariantId,
        targetLevel: toPrismaTargetLevel(input.targetLevel),
        attributeKey: input.attributeKey,
        attributeDefinitionVersion: input.attributeDefinitionVersion,
        sourceType: toPrismaSourceType(input.sourceType),
        sourceName: input.sourceName,
        sourceReference: input.sourceReference,
        sourceDate: input.sourceDate,
        retrievedAt: input.retrievedAt,
        method: toPrismaEvaluationMethod(input.method),
        ...(input.rawValue !== undefined ? { rawValue: toPrismaJson(input.rawValue) } : {}),
        ...(input.normalizedValue !== undefined ? { normalizedValue: toPrismaJson(input.normalizedValue) } : {}),
        unit: input.unit,
        notes: input.notes,
        status: toPrismaEvidenceStatus(input.status),
        evaluatorType: input.evaluatorType ? toPrismaEvaluatorType(input.evaluatorType) : undefined,
        evaluatorReference: input.evaluatorReference
      }
    });
    return fromEvidenceRecordRow(record);
  }

  async listEvidenceForEquipment(equipmentId: string): Promise<EquipmentDNAEvidenceRecord[]> {
    const rows = await this.prisma.equipmentDNAEvidenceRecord.findMany({
      where: { equipmentId },
      orderBy: [{ attributeKey: "asc" }, { createdAt: "desc" }]
    });
    return rows.map(fromEvidenceRecordRow);
  }

  async listEvidenceForVariant(equipmentVariantId: string): Promise<EquipmentDNAEvidenceRecord[]> {
    const rows = await this.prisma.equipmentDNAEvidenceRecord.findMany({
      where: { equipmentVariantId },
      orderBy: [{ attributeKey: "asc" }, { createdAt: "desc" }]
    });
    return rows.map(fromEvidenceRecordRow);
  }

  async listEvidenceByIds(evidenceRecordIds: readonly string[]): Promise<EquipmentDNAEvidenceRecord[]> {
    const rows = await this.prisma.equipmentDNAEvidenceRecord.findMany({
      where: { id: { in: [...evidenceRecordIds] } },
      orderBy: { createdAt: "asc" }
    });
    return rows.map(fromEvidenceRecordRow);
  }

  async createDraftEvaluation(
    input: CreateEquipmentDNAAttributeEvaluationInput
  ): Promise<EquipmentDNAAttributeEvaluation> {
    const record = await this.prisma.equipmentDNAAttributeEvaluation.create({
      data: {
        equipmentId: input.equipmentId,
        equipmentVariantId: input.equipmentVariantId,
        targetLevel: toPrismaTargetLevel(input.targetLevel),
        attributeKey: input.attributeKey,
        attributeDefinitionVersion: input.attributeDefinitionVersion,
        value: toPrismaRequiredJson(input.value),
        confidence: toPrismaConfidence(input.confidence),
        evaluationMethod: toPrismaEvaluationMethod(input.evaluationMethod),
        evaluationVersion: input.evaluationVersion,
        status: toPrismaEvaluationStatus(input.status),
        rationale: input.rationale,
        evaluatedAt: input.evaluatedAt,
        reviewDueAt: input.reviewDueAt,
        supersedesEvaluationId: input.supersedesEvaluationId
      }
    });
    return fromEvaluationRow(record);
  }

  async updateEvaluationStatus(input: {
    evaluationId: string;
    status: EquipmentDNAEvaluationStatus;
    confidence?: EquipmentAttributeConfidence;
    rationale?: string;
    evaluatedAt?: Date;
  }): Promise<EquipmentDNAAttributeEvaluation> {
    const record = await this.prisma.equipmentDNAAttributeEvaluation.update({
      where: { id: input.evaluationId },
      data: {
        status: toPrismaEvaluationStatus(input.status),
        confidence: input.confidence ? toPrismaConfidence(input.confidence) : undefined,
        rationale: input.rationale,
        evaluatedAt: input.evaluatedAt
      }
    });
    return fromEvaluationRow(record);
  }

  async linkEvidenceToEvaluation(evaluationId: string, evidenceRecordIds: readonly string[]): Promise<void> {
    await Promise.all(
      evidenceRecordIds.map((evidenceRecordId) =>
        this.prisma.equipmentDNAAttributeEvaluationEvidence.upsert({
          where: {
            evaluationId_evidenceRecordId: {
              evaluationId,
              evidenceRecordId
            }
          },
          update: {},
          create: {
            evaluationId,
            evidenceRecordId
          }
        })
      )
    );
  }

  async findEvaluationById(evaluationId: string): Promise<EquipmentDNAAttributeEvaluation | undefined> {
    const row = await this.prisma.equipmentDNAAttributeEvaluation.findUnique({
      where: { id: evaluationId },
      include: { evidenceLinks: { include: { evidenceRecord: true } } }
    });
    return row ? fromEvaluationRow(row) : undefined;
  }

  async findCurrentActiveEvaluation(input: {
    equipmentId?: string;
    equipmentVariantId?: string;
    attributeKey: string;
    attributeDefinitionVersion: string;
  }): Promise<EquipmentDNAAttributeEvaluation | undefined> {
    const row = await this.prisma.equipmentDNAAttributeEvaluation.findFirst({
      where: {
        equipmentId: input.equipmentId,
        equipmentVariantId: input.equipmentVariantId,
        attributeKey: input.attributeKey,
        attributeDefinitionVersion: input.attributeDefinitionVersion,
        status: PrismaEquipmentDNAAttributeEvaluationStatus.active
      },
      include: { evidenceLinks: { include: { evidenceRecord: true } } },
      orderBy: { evaluationVersion: "desc" }
    });
    return row ? fromEvaluationRow(row) : undefined;
  }

  async listCurrentEvaluationsForEquipment(equipmentId: string): Promise<EquipmentDNAAttributeEvaluation[]> {
    return this.listCurrentEvaluations({ equipmentId });
  }

  async listCurrentEvaluationsForVariant(equipmentVariantId: string): Promise<EquipmentDNAAttributeEvaluation[]> {
    return this.listCurrentEvaluations({ equipmentVariantId });
  }

  private async listCurrentEvaluations(input: {
    equipmentId?: string;
    equipmentVariantId?: string;
  }): Promise<EquipmentDNAAttributeEvaluation[]> {
    const rows = await this.prisma.equipmentDNAAttributeEvaluation.findMany({
      where: {
        equipmentId: input.equipmentId,
        equipmentVariantId: input.equipmentVariantId,
        status: PrismaEquipmentDNAAttributeEvaluationStatus.active
      },
      include: { evidenceLinks: { include: { evidenceRecord: true } } },
      orderBy: [{ attributeKey: "asc" }, { evaluationVersion: "desc" }]
    });
    return rows.map(fromEvaluationRow);
  }
}

function fromEvidenceRecordRow(row: {
  id: string;
  equipmentId: string | null;
  equipmentVariantId: string | null;
  targetLevel: EquipmentDNATargetLevel;
  attributeKey: string;
  attributeDefinitionVersion: string;
  sourceType: EquipmentEvidenceSourceType;
  sourceName: string;
  sourceReference: string | null;
  sourceDate: Date | null;
  retrievedAt: Date | null;
  method: EquipmentEvaluationMethod;
  rawValue: Prisma.JsonValue | null;
  normalizedValue: Prisma.JsonValue | null;
  unit: string | null;
  notes: string | null;
  status: EquipmentEvidenceStatus;
  evaluatorType: EquipmentDNAEvaluatorType | null;
  evaluatorReference: string | null;
  createdAt: Date;
  updatedAt: Date;
}): EquipmentDNAEvidenceRecord {
  return {
    id: row.id,
    equipmentId: row.equipmentId ?? undefined,
    equipmentVariantId: row.equipmentVariantId ?? undefined,
    targetLevel: row.targetLevel,
    attributeKey: row.attributeKey,
    attributeDefinitionVersion: row.attributeDefinitionVersion,
    sourceType: row.sourceType,
    sourceName: row.sourceName,
    sourceReference: row.sourceReference ?? undefined,
    sourceDate: row.sourceDate ?? undefined,
    retrievedAt: row.retrievedAt ?? undefined,
    method: row.method,
    rawValue: fromPrismaJson(row.rawValue),
    normalizedValue: fromPrismaJson(row.normalizedValue),
    unit: row.unit ?? undefined,
    notes: row.notes ?? undefined,
    status: row.status,
    evaluatorType: row.evaluatorType ?? undefined,
    evaluatorReference: row.evaluatorReference ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function fromEvaluationRow(row: {
  id: string;
  equipmentId: string | null;
  equipmentVariantId: string | null;
  targetLevel: EquipmentDNATargetLevel;
  attributeKey: string;
  attributeDefinitionVersion: string;
  value: Prisma.JsonValue;
  confidence: EquipmentAttributeConfidence;
  evaluationMethod: EquipmentEvaluationMethod;
  evaluationVersion: number;
  status: EquipmentDNAEvaluationStatus;
  rationale: string | null;
  evaluatedAt: Date | null;
  reviewDueAt: Date | null;
  supersedesEvaluationId: string | null;
  createdAt: Date;
  updatedAt: Date;
  evidenceLinks?: Array<{ evidenceRecord: Parameters<typeof fromEvidenceRecordRow>[0] }>;
}): EquipmentDNAAttributeEvaluation {
  return {
    id: row.id,
    equipmentId: row.equipmentId ?? undefined,
    equipmentVariantId: row.equipmentVariantId ?? undefined,
    targetLevel: row.targetLevel,
    attributeKey: row.attributeKey,
    attributeDefinitionVersion: row.attributeDefinitionVersion,
    value: fromPrismaNormalizedValue(row.value),
    confidence: row.confidence,
    evaluationMethod: row.evaluationMethod,
    evaluationVersion: row.evaluationVersion,
    status: row.status,
    rationale: row.rationale ?? undefined,
    evaluatedAt: row.evaluatedAt ?? undefined,
    reviewDueAt: row.reviewDueAt ?? undefined,
    supersedesEvaluationId: row.supersedesEvaluationId ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    evidenceRecords: row.evidenceLinks?.map((link) => fromEvidenceRecordRow(link.evidenceRecord))
  };
}

function toPrismaJson(value: EquipmentJsonValue): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === null) return Prisma.JsonNull;
  return value;
}

function toPrismaRequiredJson(value: EquipmentDNAAttributeNormalizedValue): Prisma.InputJsonValue {
  return value;
}

function fromPrismaJson(value: Prisma.JsonValue | null): EquipmentJsonValue | undefined {
  return value === null ? undefined : value;
}

function fromPrismaNormalizedValue(value: Prisma.JsonValue): string | number | boolean {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  throw new Error("Equipment DNA attribute evaluations must contain scalar normalized values.");
}

const targetLevelToPrisma: Record<EquipmentDNATargetLevel, PrismaEquipmentDNATargetLevel> = {
  equipment: PrismaEquipmentDNATargetLevel.equipment,
  variant: PrismaEquipmentDNATargetLevel.variant
};

const sourceTypeToPrisma: Record<EquipmentEvidenceSourceType, PrismaEquipmentDNAEvidenceSourceType> = {
  manufacturer_specification: PrismaEquipmentDNAEvidenceSourceType.manufacturer_specification,
  objective_measurement: PrismaEquipmentDNAEvidenceSourceType.objective_measurement,
  structured_expert_evaluation: PrismaEquipmentDNAEvidenceSourceType.structured_expert_evaluation,
  player_feedback: PrismaEquipmentDNAEvidenceSourceType.player_feedback,
  parent_feedback: PrismaEquipmentDNAEvidenceSourceType.parent_feedback,
  coach_feedback: PrismaEquipmentDNAEvidenceSourceType.coach_feedback,
  field_observation: PrismaEquipmentDNAEvidenceSourceType.field_observation,
  historical_outcome: PrismaEquipmentDNAEvidenceSourceType.historical_outcome,
  internal_derived: PrismaEquipmentDNAEvidenceSourceType.internal_derived,
  other: PrismaEquipmentDNAEvidenceSourceType.other
};

const evidenceStatusToPrisma: Record<EquipmentEvidenceStatus, PrismaEquipmentDNAEvidenceRecordStatus> = {
  active: PrismaEquipmentDNAEvidenceRecordStatus.active,
  superseded: PrismaEquipmentDNAEvidenceRecordStatus.superseded,
  disputed: PrismaEquipmentDNAEvidenceRecordStatus.disputed,
  withdrawn: PrismaEquipmentDNAEvidenceRecordStatus.withdrawn
};

const evaluationMethodToPrisma: Record<EquipmentEvaluationMethod, PrismaEquipmentEvaluationMethod> = {
  direct_specification: PrismaEquipmentEvaluationMethod.direct_specification,
  instrument_measurement: PrismaEquipmentEvaluationMethod.instrument_measurement,
  standardized_rubric: PrismaEquipmentEvaluationMethod.standardized_rubric,
  multi_evaluator_consensus: PrismaEquipmentEvaluationMethod.multi_evaluator_consensus,
  structured_feedback: PrismaEquipmentEvaluationMethod.structured_feedback,
  derived_mapping: PrismaEquipmentEvaluationMethod.derived_mapping,
  manual_review: PrismaEquipmentEvaluationMethod.manual_review
};

const confidenceToPrisma: Record<EquipmentAttributeConfidence, PrismaEquipmentAttributeConfidence> = {
  validated: PrismaEquipmentAttributeConfidence.validated,
  high: PrismaEquipmentAttributeConfidence.high,
  moderate: PrismaEquipmentAttributeConfidence.moderate,
  estimated: PrismaEquipmentAttributeConfidence.estimated
};

const evaluationStatusToPrisma: Record<EquipmentDNAEvaluationStatus, PrismaEquipmentDNAAttributeEvaluationStatus> = {
  draft: PrismaEquipmentDNAAttributeEvaluationStatus.draft,
  active: PrismaEquipmentDNAAttributeEvaluationStatus.active,
  superseded: PrismaEquipmentDNAAttributeEvaluationStatus.superseded,
  rejected: PrismaEquipmentDNAAttributeEvaluationStatus.rejected
};

const evaluatorTypeToPrisma: Record<EquipmentDNAEvaluatorType, PrismaEquipmentDNAEvaluatorType> = {
  system: PrismaEquipmentDNAEvaluatorType.system,
  staff: PrismaEquipmentDNAEvaluatorType.staff,
  expert: PrismaEquipmentDNAEvaluatorType.expert,
  external: PrismaEquipmentDNAEvaluatorType.external
};

function toPrismaTargetLevel(value: EquipmentDNATargetLevel): PrismaEquipmentDNATargetLevel {
  return targetLevelToPrisma[value];
}

function toPrismaSourceType(value: EquipmentEvidenceSourceType): PrismaEquipmentDNAEvidenceSourceType {
  return sourceTypeToPrisma[value];
}

function toPrismaEvidenceStatus(value: EquipmentEvidenceStatus): PrismaEquipmentDNAEvidenceRecordStatus {
  return evidenceStatusToPrisma[value];
}

function toPrismaEvaluationMethod(value: EquipmentEvaluationMethod): PrismaEquipmentEvaluationMethod {
  return evaluationMethodToPrisma[value];
}

function toPrismaConfidence(value: EquipmentAttributeConfidence): PrismaEquipmentAttributeConfidence {
  return confidenceToPrisma[value];
}

function toPrismaEvaluationStatus(value: EquipmentDNAEvaluationStatus): PrismaEquipmentDNAAttributeEvaluationStatus {
  return evaluationStatusToPrisma[value];
}

function toPrismaEvaluatorType(value: EquipmentDNAEvaluatorType): PrismaEquipmentDNAEvaluatorType {
  return evaluatorTypeToPrisma[value];
}
