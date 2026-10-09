import { Prisma, type PrismaClient } from "@prisma/client";
import { assessStrongerConstructEvidence, type StrongerEvidenceCandidate } from "@ninery/equipment-intelligence";
import { GovernedSupportingContextProjectionService, type GovernedSupportingContextProjection } from "./governed-supporting-context-projection.js";
import { PrismaGovernedSupportingContextProjectionRepository } from "./prisma-governed-supporting-context-projection-repository.js";
import type { GovernedConstructEvidenceRepository, GovernedConstructEvidenceRequest, GovernedConstructEvidenceSnapshot, GovernedStrongerEvidence } from "./governed-construct-evidence-projection.js";

export class PrismaGovernedConstructEvidenceProjectionRepository implements GovernedConstructEvidenceRepository {
  constructor(private readonly client: PrismaClient | Prisma.TransactionClient, private readonly inSnapshot = false) {}

  readSnapshot(request: GovernedConstructEvidenceRequest): Promise<GovernedConstructEvidenceSnapshot> {
    if (this.inSnapshot) return this.loadInSnapshot(request, this.client);
    return (this.client as PrismaClient).$transaction(async tx => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      return this.loadInSnapshot(request, tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, maxWait: 30000, timeout: 30000 });
  }

  private async loadInSnapshot(request: GovernedConstructEvidenceRequest, tx: Prisma.TransactionClient): Promise<GovernedConstructEvidenceSnapshot> {
      const equipment = await tx.equipment.findUnique({ where: { id: request.equipmentId }, select: { id: true, manufacturer: true, model: true, modelYear: true, certification: true } });
      if (!equipment) throw new Error("Equipment not found.");
      const variant = request.equipmentVariantId
        ? await tx.equipmentVariant.findUnique({ where: { id: request.equipmentVariantId }, select: { id: true, equipmentId: true, sku: true } })
        : null;
      if (request.equipmentVariantId && (!variant || variant.equipmentId !== equipment.id)) throw new Error("Variant does not belong to equipment.");
      const variants = await tx.equipmentVariant.findMany({ where: { equipmentId: equipment.id }, select: { id: true, equipmentId: true } });
      // Retain other variant/session records as dependence context and expose relevant scope exclusions.
      const rows = await tx.equipmentDNAEvidenceRecord.findMany({
        where: { equipmentId: equipment.id },
        orderBy: [{ id: "asc" }]
      });
      const inputs: StrongerEvidenceCandidate[] = rows.map(row => ({
        id: row.id, equipmentId: row.equipmentId ?? undefined, equipmentVariantId: row.equipmentVariantId ?? undefined,
        targetLevel: row.targetLevel, attributeKey: row.attributeKey, attributeDefinitionVersion: row.attributeDefinitionVersion, sourceType: row.sourceType,
        sourceName: row.sourceName, sourceReference: row.sourceReference ?? undefined,
        sourceDate: row.sourceDate ?? undefined, method: row.method, rawValue: row.rawValue ?? undefined,
        normalizedValue: row.normalizedValue ?? undefined, unit: row.unit ?? undefined, notes: row.notes ?? undefined,
        status: row.status, evaluatorType: row.evaluatorType ?? undefined, evaluatorReference: row.evaluatorReference ?? undefined
      }));
      const admissibility = assessStrongerConstructEvidence({ request, records: inputs, variants });
      const stronger: GovernedStrongerEvidence[] = admissibility.flatMap(result => {
        if (!result.evidence || result.constructRole === "unknown" || result.constructRole === "not_applicable") return [];
        return [{ ...result.evidence, attributeDefinitionVersion: result.attributeDefinitionVersion,
          sourceType: result.sourceType, constructRole: result.constructRole, admissibility: result }];
      });
      const supporting: Pick<GovernedSupportingContextProjection, "current" | "historical" | "semantics"> = request.construct === "startup_demand" || request.construct === "rotational_demand"
        ? await new GovernedSupportingContextProjectionService(new PrismaGovernedSupportingContextProjectionRepository(tx, true))
          .loadGovernedSupportingContext({ ...request, construct: request.construct })
        : { current: [], historical: [],
          semantics: "snapshot_at_read_time_not_historical_as_of" };
      return { stronger, supporting, admissibility };
  }
}
