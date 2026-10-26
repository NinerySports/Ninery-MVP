import type { Prisma, EquipmentDNAEvidenceRecord } from "@prisma/client";
import { auditAcquisitionProvenance } from "./acquisition-provenance-integrity.js";
import { PrismaGovernedSupportingContextProjectionRepository } from "./prisma-governed-supporting-context-projection-repository.js";
/** Reports retain the #084 verified read-only RepeatableRead boundary. */
export async function readAcquisitionProvenanceInSnapshot(tx: Prisma.TransactionClient, inventory: readonly EquipmentDNAEvidenceRecord[]) {
    await PrismaGovernedSupportingContextProjectionRepository.fromProtectedTransaction(tx);
    return auditAcquisitionProvenance(tx, inventory);
}
