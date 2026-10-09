import { equipmentDNAConstructEvidenceMap, type EquipmentDNAEvidenceItem, type StrongerEvidenceAdmissibility } from "@ninery/equipment-intelligence";
import type { GovernedSupportingContextEntry, GovernedSupportingContextProjection } from "./governed-supporting-context-projection.js";

export const GOVERNED_CONSTRUCT_EVIDENCE_PROJECTION_VERSION = "1.0" as const;

export type GovernedConstructEvidenceRequest = {
  readonly equipmentId: string;
  readonly equipmentVariantId?: string;
  readonly construct: string;
};

export type GovernedConstructEvidenceSnapshot = {
  readonly stronger: readonly GovernedStrongerEvidence[];
  readonly supporting: Pick<GovernedSupportingContextProjection, "current" | "historical" | "semantics">;
  readonly admissibility: readonly StrongerEvidenceAdmissibility[];
};

export type GovernedStrongerEvidence = EquipmentDNAEvidenceItem & {
  readonly attributeDefinitionVersion: string;
  readonly sourceType: string;
  readonly constructRole: "primary_candidate" | "supporting_candidate" | "validation_candidate" | "future_validation_candidate";
  readonly admissibility: StrongerEvidenceAdmissibility;
};

export interface GovernedConstructEvidenceRepository {
  readSnapshot(request: GovernedConstructEvidenceRequest): Promise<GovernedConstructEvidenceSnapshot>;
}

export type GovernedConstructEvidenceProjection = {
  readonly version: typeof GOVERNED_CONSTRUCT_EVIDENCE_PROJECTION_VERSION;
  readonly request: GovernedConstructEvidenceRequest;
  readonly strongerEvidence: readonly GovernedStrongerEvidence[];
  readonly strongerEvidenceAdmissibility: readonly StrongerEvidenceAdmissibility[];
  readonly excludedStrongerEvidence: readonly GovernedStrongerEvidence[];
  readonly currentSupportingContext: readonly GovernedSupportingContextEntry[];
  readonly historicalSupportingContext: readonly GovernedSupportingContextEntry[];
  readonly directEvidenceRecordCount: number;
  readonly knownIndependentStrongerGroups: readonly string[];
  readonly currentSupportingGroups: readonly string[];
  readonly descriptiveState: "no_direct_evidence" | "direct_evidence_present" | "review_required";
  readonly gaps: readonly string[];
  readonly blockers: readonly string[];
  readonly contextualDirections: readonly string[];
  readonly semantics: "snapshot_at_read_time_not_historical_as_of";
  readonly authority: {
    readonly directEvidenceContributionFromSupport: 0;
    readonly canonicalValueCreated: false;
    readonly numericValueCreated: false;
    readonly synthesisEligibilityGranted: false;
    readonly compatibilityAuthorityGranted: false;
    readonly recommendationAuthorityGranted: false;
    readonly decisionBookAuthorityGranted: false;
  };
};

export class GovernedConstructEvidenceProjectionService {
  constructor(private readonly repository: GovernedConstructEvidenceRepository) {}

  async load(request: GovernedConstructEvidenceRequest): Promise<GovernedConstructEvidenceProjection> {
    if (!request.equipmentId || !request.construct || !equipmentDNAConstructEvidenceMap.some(item => item.construct === request.construct)) {
      throw new Error("Unsupported equipment identity or construct.");
    }
    const snapshot = await this.repository.readSnapshot(request);
    const sortEvidence = (a: GovernedStrongerEvidence, b: GovernedStrongerEvidence) =>
      a.evidenceClass.localeCompare(b.evidenceClass) || a.id.localeCompare(b.id);
    const admitted = (item: GovernedStrongerEvidence) => item.admissibility.disposition === "admissible" || item.admissibility.disposition === "admissible_with_restrictions";
    const strongerEvidence = snapshot.stronger.filter(admitted).sort(sortEvidence);
    const excludedStrongerEvidence = snapshot.stronger.filter(item => !admitted(item)).sort(sortEvidence);
    const directEvidence = strongerEvidence.filter(item => item.constructRole === "primary_candidate" && item.admissibility.permittedAssessment === "construct_evidence");
    const currentSupportingContext = [...snapshot.supporting.current].sort((a, b) => a.decidedAt.localeCompare(b.decidedAt) || a.decisionId.localeCompare(b.decisionId));
    const historicalSupportingContext = [...snapshot.supporting.historical].sort((a, b) => a.decidedAt.localeCompare(b.decidedAt) || a.decisionId.localeCompare(b.decisionId));
    // Evaluator relationships do not establish evidence-source independence.
    const knownIndependentStrongerGroups: readonly string[] = [];
    const currentSupportingGroups = [...new Set(currentSupportingContext.map(item => item.provenance.independence === "reviewed_independent" ? item.provenance.independenceGroupId : undefined).filter(isString))].sort();
    const contextualDirections = [...new Set(currentSupportingContext.map(item => item.direction))].sort();
    const blockers = ["synthesis_policy_not_established", "synthesis_not_permitted"];
    if (excludedStrongerEvidence.some(item => item.status === "disputed" || item.status === "withdrawn")) blockers.push("stronger_evidence_requires_review");
    const gaps = directEvidence.length ? [] : ["no_current_primary_construct_evidence"];
    if (currentSupportingContext.length && !directEvidence.length) gaps.push("supporting_context_cannot_replace_primary_evidence");
    return {
      version: GOVERNED_CONSTRUCT_EVIDENCE_PROJECTION_VERSION, request,
      strongerEvidence, excludedStrongerEvidence, currentSupportingContext, historicalSupportingContext,
      strongerEvidenceAdmissibility: [...snapshot.admissibility].sort((a, b) => a.evidenceRecordId.localeCompare(b.evidenceRecordId)),
      directEvidenceRecordCount: directEvidence.length, knownIndependentStrongerGroups, currentSupportingGroups,
      descriptiveState: blockers.includes("stronger_evidence_requires_review") ? "review_required" : directEvidence.length ? "direct_evidence_present" : "no_direct_evidence",
      gaps, blockers, contextualDirections, semantics: snapshot.supporting.semantics,
      authority: { directEvidenceContributionFromSupport: 0, canonicalValueCreated: false, numericValueCreated: false,
        synthesisEligibilityGranted: false, compatibilityAuthorityGranted: false, recommendationAuthorityGranted: false,
        decisionBookAuthorityGranted: false }
    };
  }
}

function isString(value: string | undefined): value is string { return typeof value === "string" && value.length > 0; }
