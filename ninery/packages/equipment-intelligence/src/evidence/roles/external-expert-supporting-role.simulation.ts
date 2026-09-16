import { atlasExternalObservations, atlasExternalSources } from "../calibration/external-expert/atlas-external-expert-calibration.js";
import { demariniExternalObservations, demariniExternalSources } from "../calibration/external-expert/demarini-external-expert-calibration.js";
import { evaluateExternalExpertSupportingRole } from "./external-expert-supporting-role.js";
import type { ExternalExpertIdentityScope, ExternalExpertMappingConfidence, ExternalExpertSupportingRoleDecision } from "./external-expert-supporting-role.types.js";

export function buildExternalExpertSupportingRoleSimulation() {
  const atlas = simulate(atlasExternalObservations, atlasExternalSources);
  const demarini = simulate(demariniExternalObservations, demariniExternalSources);
  return {
    policyVersion: "1.0-provisional", policyStatus: "PROVISIONAL_CONSTRUCT_SPECIFIC_POLICY",
    approvalMode: "HYPOTHETICAL_HUMAN_APPROVAL_FOR_SIMULATION_ONLY",
    atlas, demarini,
    firewalls: { persisted: false, realApprovalCreated: false, canonicalValueCreated: false, numericValueCreated: false, synthesisEligibilityGranted: false, recommendationInputCreated: false }
  } as const;
}

type Observation = { readonly id: string; readonly sourceId: string; readonly construct: string | null; readonly direction: string; readonly comparisonTarget?: string; readonly classification: string; readonly mappingConfidence?: string | null; readonly confidence?: string | null; readonly identityScope?: string; readonly scope?: string };
type Source = { readonly id: string; readonly independence: string; readonly independenceGroup: string };

function simulate(observations: readonly Observation[], sources: readonly Source[]) {
  const pending = observations.map((observation) => decide(observation, sources, false));
  const hypothetical = observations.map((observation) => decide(observation, sources, true));
  return {
    totalExternalObservations: observations.length,
    startupDemandCandidates: observations.filter((item) => item.construct === "startup_demand").length,
    rotationalDemandCandidates: observations.filter((item) => item.construct === "rotational_demand").length,
    highConfidenceCandidates: observations.filter((item) => confidence(item) === "high").length,
    knownIndependentCandidates: observations.filter((item) => source(item, sources)?.independence === "known_independent").length,
    eligibleBeforeHumanApproval: pending.filter((item) => item.blockers.length === 1 && item.blockers[0] === "HUMAN_REVIEW_REQUIRED").length,
    pendingApproval: pending.filter((item) => item.blockers.length === 1 && item.blockers[0] === "HUMAN_REVIEW_REQUIRED").length,
    wouldSupportIfApproved: hypothetical.filter((item) => item.eligible).length,
    blockedByDependency: hypothetical.filter((item) => item.blockers.some((code) => code === "SOURCE_DEPENDENCY_UNKNOWN" || code === "SOURCE_DEPENDENT")).length,
    blockedByMappingConfidence: hypothetical.filter((item) => item.blockers.includes("MAPPING_NOT_HIGH_CONFIDENCE")).length,
    blockedByConstruct: hypothetical.filter((item) => item.blockers.includes("CONSTRUCT_NOT_ELIGIBLE")).length,
    blockedByIdentity: hypothetical.filter((item) => item.blockers.some((code) => code === "IDENTITY_UNRESOLVED" || code === "IDENTITY_SCOPE_INSUFFICIENT")).length,
    blockedByMarketing: hypothetical.filter((item) => item.blockers.includes("MARKETING_CONTENT")).length,
    pendingDecisions: pending,
    hypotheticalApprovalDecisions: hypothetical
  };
}

function decide(observation: Observation, sources: readonly Source[], approved: boolean): ExternalExpertSupportingRoleDecision {
  const sourceRecord = source(observation, sources)!;
  const marketing = observation.classification === "marketing" || observation.classification === "marketing_repetition";
  return evaluateExternalExpertSupportingRole({ observationId: observation.id, sourceType: "independent_expert_review",
    claimType: marketing ? "marketing_claim" : observation.classification.includes("compar") ? "comparative_observation" : "subjective_observation",
    dependencyType: sourceRecord.independence === "known_independent" ? "independent_observation" : sourceRecord.independence === "unknown_dependency" ? "unknown_dependency" : "shared_upstream",
    independenceGroupId: sourceRecord.independenceGroup, identityCertainty: "equipment_model_match", identityScope: scope(observation), identityApplicable: true,
    identityChecks: { manufacturer: true, model: true, modelYear: true, certification: true, productFamily: true },
    construct: observation.construct, mappingConfidence: confidence(observation), qualificationState: "context_only", verificationState: "active",
    reviewState: approved ? "reviewed_accepted" : "review_pending", approvalActor: approved ? "human" : undefined,
    direction: direction(observation.direction), comparisonTarget: observation.comparisonTarget });
}

function source(observation: Observation, sources: readonly Source[]) { return sources.find((item) => item.id === observation.sourceId); }
function confidence(item: Observation): ExternalExpertMappingConfidence { const value = item.mappingConfidence ?? item.confidence; return value === "high" || value === "medium" || value === "low" ? value : "unmapped"; }
function scope(item: Observation): ExternalExpertIdentityScope { const value = item.identityScope ?? item.scope; return ["equipment_family", "certification_family", "drop_family", "size_family", "exact_variant"].includes(value ?? "") ? value as ExternalExpertIdentityScope : "equipment_family"; }
function direction(value: string) { return ["lower", "moderate_or_neutral", "higher", "comparative_only", "unspecified"].includes(value) ? value as ExternalExpertSupportingRoleDecision["direction"] : "unspecified"; }
