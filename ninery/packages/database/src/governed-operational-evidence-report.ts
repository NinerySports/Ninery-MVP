import { assessStrongerEvidenceDependence, composeGovernedOperationalEvidenceReport, type EquipmentDNACatalogFactInput, type EquipmentDNAEvidenceIdentity, type StrongerEvidenceCandidate } from "@ninery/equipment-intelligence";
import { composeGovernedConstructEvidenceProjection, type GovernedConstructEvidenceRequest, type GovernedConstructEvidenceSnapshot } from "./governed-construct-evidence-projection.js";

export type GovernedOperationalEvidenceRequest = {
  readonly equipmentId: string;
  readonly equipmentVariantId?: string;
  readonly construct?: string;
};
export type GovernedOperationalEvidenceSnapshot = {
  readonly identity: EquipmentDNAEvidenceIdentity;
  readonly catalogFacts: readonly EquipmentDNACatalogFactInput[];
  readonly inventory: readonly StrongerEvidenceCandidate[];
  readonly constructs: readonly { readonly request: GovernedConstructEvidenceRequest; readonly snapshot: GovernedConstructEvidenceSnapshot }[];
};
export interface GovernedOperationalEvidenceRepository {
  readOperationalSnapshot(request: GovernedOperationalEvidenceRequest): Promise<GovernedOperationalEvidenceSnapshot>;
}
export class GovernedOperationalEvidenceReportService {
  constructor(private readonly repository: GovernedOperationalEvidenceRepository) {}
  async load(request: GovernedOperationalEvidenceRequest) {
    const captured = await this.repository.readOperationalSnapshot(request);
    return composeGovernedOperationalEvidenceReport({ ...captured,
      constructs: captured.constructs.map(({ request, snapshot }) => ({
        request, projection: composeGovernedConstructEvidenceProjection(request, snapshot),
        admissibility: snapshot.admissibility,
        dependence: assessStrongerEvidenceDependence({ request, assessments: snapshot.admissibility, contextRecords: captured.inventory })
      }))
    });
  }
}
