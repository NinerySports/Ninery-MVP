import { readAcquisitionProvenanceInSnapshot } from "./acquisition-provenance-projection.js";
import { Prisma, type PrismaClient } from "@prisma/client";
import { assessStrongerConstructEvidence, equipmentDNAConstructEvidenceMap, type EquipmentDNACatalogFactInput, type StrongerEvidenceCandidate } from "@ninery/equipment-intelligence";
import { GovernedSupportingContextProjectionService, type GovernedSupportingContextProjection } from "./governed-supporting-context-projection.js";
import { PrismaGovernedSupportingContextProjectionRepository } from "./prisma-governed-supporting-context-projection-repository.js";
import type { GovernedConstructEvidenceRepository, GovernedConstructEvidenceRequest, GovernedConstructEvidenceSnapshot, GovernedStrongerEvidence } from "./governed-construct-evidence-projection.js";

import type { GovernedOperationalEvidenceRepository, GovernedOperationalEvidenceRequest, GovernedOperationalEvidenceSnapshot } from "./governed-operational-evidence-report.js";

export class PrismaGovernedConstructEvidenceProjectionRepository implements GovernedConstructEvidenceRepository, GovernedOperationalEvidenceRepository {
  constructor(private readonly client: PrismaClient | Prisma.TransactionClient, private readonly inSnapshot = false) {
    if (inSnapshot && "$transaction" in client) throw new Error("PROTECTED_SNAPSHOT_ROOT_CLIENT_REJECTED");
    if (!inSnapshot && !("$transaction" in client)) throw new Error("PROTECTED_SNAPSHOT_TRANSACTION_REQUIRED");
  }

  readSnapshot(request: GovernedConstructEvidenceRequest): Promise<GovernedConstructEvidenceSnapshot> {
    return this.withSnapshot(tx => this.loadInSnapshot(request, tx));
  }

  readOperationalSnapshot(request: GovernedOperationalEvidenceRequest): Promise<GovernedOperationalEvidenceSnapshot> {
    if (!request.equipmentId.trim() || (request.equipmentVariantId !== undefined && !request.equipmentVariantId.trim())) throw new Error("Equipment/variant identity is required.");
    const constructs = request.construct === undefined ? equipmentDNAConstructEvidenceMap.map(item => item.construct) : [request.construct];
    if (constructs.some(construct => !equipmentDNAConstructEvidenceMap.some(item => item.construct === construct))) throw new Error("Unsupported operational construct; no legacy fallback is permitted.");
    return this.withSnapshot(async tx => {
      // Verify even inventory-only/unsupported observation paths through the #084 factory.
      await PrismaGovernedSupportingContextProjectionRepository.fromProtectedTransaction(tx);
      const captured = await captureEvidence({ ...request, construct: constructs[0]! }, tx);
      const snapshots: GovernedOperationalEvidenceSnapshot["constructs"][number][] = [];
      for (const construct of constructs) {
        const scoped = { ...request, construct };
        snapshots.push({ request: scoped, snapshot: await this.loadInSnapshot(scoped, tx, captured) });
      }
      const { equipment, variant } = captured;
      return {
        identity: { equipmentId: equipment.id, manufacturer: equipment.manufacturer, model: equipment.model,
          modelYear: equipment.modelYear ?? undefined, certification: equipment.certification,
          variant: variant ? { id: variant.id, sku: variant.sku ?? undefined, lengthInches: numeric(variant.lengthInches),
            weightOunces: numeric(variant.weightOunces), dropWeight: variant.dropWeight ?? undefined } : undefined },
        catalogFacts: catalogInventory(captured), inventory: captured.inputs, constructs: snapshots,
        provenance: await readAcquisitionProvenanceInSnapshot(tx,captured.rows)
      };
    });
  }

  private withSnapshot<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    if (this.inSnapshot) return operation(this.client);
    return (this.client as PrismaClient).$transaction(async tx => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      return operation(tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, maxWait: 30000, timeout: 30000 });
  }

  private async loadInSnapshot(request: GovernedConstructEvidenceRequest, tx: Prisma.TransactionClient, captured?: Awaited<ReturnType<typeof captureEvidence>>): Promise<GovernedConstructEvidenceSnapshot> {
    const { variants, inputs } = captured ?? await captureEvidence(request, tx);
    const admissibility = assessStrongerConstructEvidence({ request, records: inputs, variants });
    const stronger: GovernedStrongerEvidence[] = admissibility.flatMap(result => {
      if (!result.evidence || result.constructRole === "unknown" || result.constructRole === "not_applicable") return [];
      return [{ ...result.evidence, attributeDefinitionVersion: result.attributeDefinitionVersion,
        sourceType: result.sourceType, constructRole: result.constructRole, admissibility: result }];
    });
    const supporting: Pick<GovernedSupportingContextProjection, "current" | "historical" | "semantics"> = request.construct === "startup_demand" || request.construct === "rotational_demand"
      ? await new GovernedSupportingContextProjectionService(await PrismaGovernedSupportingContextProjectionRepository.fromProtectedTransaction(tx))
        .loadGovernedSupportingContext({ ...request, construct: request.construct })
      : { current: [], historical: [],
        semantics: "snapshot_at_read_time_not_historical_as_of" };
    return { stronger, supporting, admissibility, dependenceContext: inputs };
  }
}

async function captureEvidence(request: GovernedConstructEvidenceRequest, tx: Prisma.TransactionClient) {
  const settings = await tx.$queryRaw<{ isolation: string; readOnly: string }[]>`SELECT current_setting('transaction_isolation') AS isolation, current_setting('transaction_read_only') AS "readOnly"`;
  if (settings.length !== 1 || settings[0]?.isolation !== "repeatable read" || settings[0]?.readOnly !== "on") throw new Error("PROTECTED_SNAPSHOT_SETTINGS_REQUIRED");
  const equipment = await tx.equipment.findUnique({ where: { id: request.equipmentId }, include: { specifications: { orderBy: [{ specificationCode: "asc" }, { id: "asc" }] } } });
  if (!equipment) throw new Error("Equipment not found.");
  const variant = request.equipmentVariantId
    ? await tx.equipmentVariant.findUnique({ where: { id: request.equipmentVariantId } })
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
  return { equipment, variant, variants, inputs, rows };
}

function numeric(value: unknown): number | undefined { if (value === null || value === undefined) return undefined; const number = Number(value); return Number.isFinite(number) ? number : undefined; }
function catalogInventory({ equipment, variant }: Awaited<ReturnType<typeof captureEvidence>>): EquipmentDNACatalogFactInput[] {
  const fact = (key: string, value: unknown, level: "equipment" | "variant", unit?: string): EquipmentDNACatalogFactInput => ({ key, value, level, unit, sourceName: "Ninery equipment catalog", sourceReference: "catalog:" + key });
  const facts = [fact("certification", equipment.certification, "equipment"), fact("construction", equipment.construction, "equipment"),
    fact("material", equipment.material, "equipment"), fact("barrel_diameter", numeric(equipment.barrelDiameter), "equipment", "inches")];
  if (variant) facts.push(fact("length", numeric(variant.lengthInches), "variant", "inches"), fact("weight", numeric(variant.weightOunces), "variant", "ounces"), fact("drop", variant.dropWeight, "variant"));
  for (const spec of equipment.specifications) facts.push({ key: spec.specificationCode, value: spec.valueText ?? numeric(spec.valueNumber), unit: spec.unit ?? undefined, level: "equipment", sourceName: spec.source ?? "Ninery equipment specifications", verifiedAt: spec.verifiedAt ?? undefined });
  return facts.filter(fact => fact.value !== null && fact.value !== undefined);
}
