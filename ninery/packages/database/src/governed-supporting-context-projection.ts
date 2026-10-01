export const GOVERNED_SUPPORTING_CONTEXT_PROJECTION_VERSION = "1.0" as const;

export type GovernedSupportingContextRequest = {
  readonly equipmentId: string;
  readonly equipmentVariantId?: string;
  readonly construct: "startup_demand" | "rotational_demand";
};

export type GovernedSupportingContextExclusion =
  | "ingestion_lineage_unavailable" | "source_or_document_not_current" | "claim_not_current"
  | "identity_not_current" | "conflict_unresolved" | "dependency_not_current"
  | "construct_not_current" | "qualification_not_current" | "review_not_current"
  | "interpretation_not_current" | "policy_ineligible" | "governance_not_current"
  | "durable_lineage_invalid";

export type GovernedSupportingContextEntry = {
  readonly decisionId: string;
  readonly status: "current" | "historical";
  readonly exclusions: readonly GovernedSupportingContextExclusion[];
  readonly decidedAt: string;
  readonly construct: string;
  readonly direction: string;
  readonly comparisonTarget?: string;
  readonly identityScope: string;
  readonly provenance: {
    readonly sourceId: string;
    readonly documentId: string;
    readonly extractionRunId: string;
    readonly rawClaimId: string;
    readonly normalizedClaimId: string;
    readonly identityAssertionId: string;
    readonly dependencyAssessmentId: string;
    readonly dependencyType: string;
    readonly upstreamClaimId?: string;
    readonly independenceGroupId?: string;
    readonly independence: "reviewed_independent" | "dependent" | "unestablished";
    readonly constructRelationshipId: string;
    readonly qualificationDecisionId: string;
    readonly reviewDecisionId: string;
    readonly equipmentId: string;
    readonly equipmentVariantId?: string;
  };
  readonly authority: {
    readonly role: "supporting_context";
    readonly directEvidenceContribution: 0;
    readonly canonicalValueCreated: false;
    readonly numericValueCreated: false;
    readonly synthesisEligibilityGranted: false;
    readonly recommendationAuthorityGranted: false;
  };
};

export type GovernedSupportingContextProjection = {
  readonly version: typeof GOVERNED_SUPPORTING_CONTEXT_PROJECTION_VERSION;
  readonly policy: "external_expert_supporting_role";
  readonly policyVersion: "1.0-provisional";
  readonly request: GovernedSupportingContextRequest;
  readonly current: readonly GovernedSupportingContextEntry[];
  readonly historical: readonly GovernedSupportingContextEntry[];
  readonly exclusions: readonly { readonly decisionId: string; readonly reasons: readonly GovernedSupportingContextExclusion[] }[];
  readonly semantics: "snapshot_at_read_time_not_historical_as_of";
};

export interface GovernedSupportingContextProjectionRepository {
  readSnapshot<T>(operation: (repository: GovernedSupportingContextProjectionRepository) => Promise<T>): Promise<T>;
  load(request: GovernedSupportingContextRequest): Promise<readonly GovernedSupportingContextEntry[]>;
}

export class GovernedSupportingContextProjectionService {
  constructor(private readonly repository: GovernedSupportingContextProjectionRepository) {}

  loadGovernedSupportingContext(request: GovernedSupportingContextRequest): Promise<GovernedSupportingContextProjection> {
    return this.repository.readSnapshot(async repository => {
      const entries = [...await repository.load(request)].sort((a, b) =>
        a.decidedAt.localeCompare(b.decidedAt) || a.decisionId.localeCompare(b.decisionId));
      return {
        version: GOVERNED_SUPPORTING_CONTEXT_PROJECTION_VERSION,
        policy: "external_expert_supporting_role",
        policyVersion: "1.0-provisional",
        request,
        current: entries.filter(entry => entry.status === "current"),
        historical: entries.filter(entry => entry.status === "historical"),
        exclusions: entries.filter(entry => entry.exclusions.length > 0).map(entry => ({ decisionId: entry.decisionId, reasons: entry.exclusions })),
        semantics: "snapshot_at_read_time_not_historical_as_of"
      };
    });
  }
}

export type GovernedSupportingContextOverlay = {
  readonly version: "1.0";
  readonly role: "supporting_context";
  readonly entries: readonly GovernedSupportingContextEntry[];
  readonly directEvidenceCountContribution: 0;
  readonly canonicalValueCreated: false;
  readonly numericValueCreated: false;
  readonly synthesisEligibilityGranted: false;
  readonly recommendationAuthorityGranted: false;
};

export function toGovernedSupportingContextOverlay(projection: GovernedSupportingContextProjection): GovernedSupportingContextOverlay {
  return { version: "1.0", role: "supporting_context", entries: [...projection.current, ...projection.historical],
    directEvidenceCountContribution: 0, canonicalValueCreated: false, numericValueCreated: false,
    synthesisEligibilityGranted: false, recommendationAuthorityGranted: false };
}
