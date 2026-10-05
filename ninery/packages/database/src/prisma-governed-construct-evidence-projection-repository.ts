import { Prisma, type PrismaClient } from "@prisma/client";
import { buildEquipmentDNAEvidenceReadModel, equipmentDNAConstructEvidenceMap, type EquipmentDNAEvidenceRecordInput } from "@ninery/equipment-intelligence";
import { GovernedSupportingContextProjectionService, type GovernedSupportingContextProjection } from "./governed-supporting-context-projection.js";
import { PrismaGovernedSupportingContextProjectionRepository } from "./prisma-governed-supporting-context-projection-repository.js";
import type { GovernedConstructEvidenceRepository, GovernedConstructEvidenceRequest, GovernedConstructEvidenceSnapshot, GovernedStrongerEvidence } from "./governed-construct-evidence-projection.js";

const classifiedSourceTypes = new Set(["manufacturer_specification", "objective_measurement", "structured_expert_evaluation",
  "player_feedback", "parent_feedback", "coach_feedback", "field_observation", "internal_derived"]);

export class PrismaGovernedConstructEvidenceProjectionRepository implements GovernedConstructEvidenceRepository {
  constructor(private readonly client: PrismaClient) {}

  readSnapshot(request: GovernedConstructEvidenceRequest): Promise<GovernedConstructEvidenceSnapshot> {
    return this.client.$transaction(async tx => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      const equipment = await tx.equipment.findUnique({ where: { id: request.equipmentId }, select: { id: true, manufacturer: true, model: true, modelYear: true, certification: true } });
      if (!equipment) throw new Error("Equipment not found.");
      const variant = request.equipmentVariantId
        ? await tx.equipmentVariant.findUnique({ where: { id: request.equipmentVariantId }, select: { id: true, equipmentId: true, sku: true } })
        : null;
      if (request.equipmentVariantId && (!variant || variant.equipmentId !== equipment.id)) throw new Error("Variant does not belong to equipment.");
      const scopedRows = await tx.equipmentDNAEvidenceRecord.findMany({
        where: { equipmentId: equipment.id, OR: [{ targetLevel: "equipment" }, ...(variant ? [{ targetLevel: "variant" as const, equipmentVariantId: variant.id }] : [])] },
        orderBy: [{ id: "asc" }]
      });
      const rows = scopedRows.filter(row => row.attributeKey === request.construct || dimensionKey(row.rawValue) === request.construct);
      for (const row of rows) {
        if ((row.targetLevel === "equipment" && row.equipmentVariantId !== null) ||
          (row.targetLevel === "variant" && row.equipmentVariantId !== variant?.id) ||
          !classifiedSourceTypes.has(row.sourceType) ||
          !row.attributeDefinitionVersion || !row.sourceName.trim()) {
          throw new Error(`Unclassifiable Equipment DNA evidence: ${row.id}`);
        }
      }
      const inputs: EquipmentDNAEvidenceRecordInput[] = rows.map(row => ({
        id: row.id, equipmentId: row.equipmentId ?? undefined, equipmentVariantId: row.equipmentVariantId ?? undefined,
        targetLevel: row.targetLevel, attributeKey: row.attributeKey, sourceType: row.sourceType,
        sourceName: row.sourceName, sourceReference: row.sourceReference ?? undefined,
        sourceDate: row.sourceDate ?? undefined, method: row.method, rawValue: row.rawValue ?? undefined,
        normalizedValue: row.normalizedValue ?? undefined, unit: row.unit ?? undefined, notes: row.notes ?? undefined,
        status: row.status, evaluatorType: row.evaluatorType ?? undefined, evaluatorReference: row.evaluatorReference ?? undefined
      }));
      const readModel = buildEquipmentDNAEvidenceReadModel({
        identity: { equipmentId: equipment.id, manufacturer: equipment.manufacturer, model: equipment.model,
          modelYear: equipment.modelYear ?? undefined, certification: equipment.certification,
          variant: variant ? { id: variant.id, sku: variant.sku ?? undefined } : undefined },
        catalogFacts: [], records: inputs
      });
      const byId = new Map(rows.map(row => [row.id, row]));
      const strategy = equipmentDNAConstructEvidenceMap.find(item => item.construct === request.construct);
      if (!strategy) throw new Error("Unsupported construct.");
      const stronger: GovernedStrongerEvidence[] = readModel.evidence
        .filter(item => item.claimKey === request.construct && !["unknown", "not_applicable"].includes(strategy.sourceRoles[item.evidenceClass]))
        .map(item => {
          const row = byId.get(item.id);
          if (!row) throw new Error("Evidence provenance missing.");
          const constructRole = strategy.sourceRoles[item.evidenceClass];
          if (constructRole === "unknown" || constructRole === "not_applicable") throw new Error("Evidence construct role is unsupported.");
          return { ...item, attributeDefinitionVersion: row.attributeDefinitionVersion, sourceType: row.sourceType,
            constructRole };
        });
      const supporting: Pick<GovernedSupportingContextProjection, "current" | "historical" | "semantics"> = request.construct === "startup_demand" || request.construct === "rotational_demand"
        ? await new GovernedSupportingContextProjectionService(new PrismaGovernedSupportingContextProjectionRepository(tx, true))
          .loadGovernedSupportingContext({ ...request, construct: request.construct })
        : { current: [], historical: [],
          semantics: "snapshot_at_read_time_not_historical_as_of" };
      return { stronger, supporting };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, maxWait: 30000, timeout: 30000 });
  }
}

function dimensionKey(value: Prisma.JsonValue | null): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return typeof value.dimensionKey === "string" ? value.dimensionKey : undefined;
}
