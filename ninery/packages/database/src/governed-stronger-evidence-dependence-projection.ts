import { assessStrongerEvidenceDependence, equipmentDNAConstructEvidenceMap } from "@ninery/equipment-intelligence";
import { composeGovernedConstructEvidenceProjection, type GovernedConstructEvidenceRepository, type GovernedConstructEvidenceRequest } from "./governed-construct-evidence-projection.js";

export class GovernedStrongerEvidenceDependenceProjectionService {
  constructor(private readonly repository: GovernedConstructEvidenceRepository) {}
  async load(request: GovernedConstructEvidenceRequest) {
    if (!request.equipmentId || !equipmentDNAConstructEvidenceMap.some(item => item.construct === request.construct)) throw new Error("Unsupported equipment identity or construct.");
    const snapshot = await this.repository.readSnapshot(request);
    return { constructEvidence: composeGovernedConstructEvidenceProjection(request, snapshot), dependence: assessStrongerEvidenceDependence({ request, assessments: snapshot.admissibility, contextRecords: snapshot.dependenceContext ?? [] }) };
  }
}
