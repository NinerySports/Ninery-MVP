import { buildAtlasUsssaAcquisitionPilotGraph, buildAtlasUsssaAcquisitionPilotReport, ATLAS_USSSA_PILOT_EQUIPMENT_ID, ATLAS_USSSA_PILOT_EXCLUDED_EQUIPMENT_ID, ATLAS_USSSA_PILOT_EXCLUDED_VARIANT_ID, ATLAS_USSSA_PILOT_VARIANT_ID } from "../../acquisition/pilots/index.js";
import { buildDemariniExternalExpertCalibrationReport, demariniExternalObservations } from "./demarini-external-expert-calibration.js";

export const ATLAS_EXTERNAL_EXPERT_CALIBRATION_VERSION = "1.0";
export const CROSS_PRODUCT_SUPPORTING_ROLE_VALIDATION_VERSION = "1.0";

const constructs = ["startup_demand", "rotational_demand", "barrel_redirect_demand", "directional_adjustment_control", "barrel_path_repeatability", "start_stop_redirect_control", "center_response_baseline", "handle_side_miss_tolerance", "end_side_miss_tolerance", "response_degradation", "usable_contact_region_breadth", "centered_response_consistency", "near_center_response_consistency"] as const;
type Construct = typeof constructs[number];
type Confidence = "high" | "medium" | "low";
type Direction = "lower" | "moderate_or_neutral" | "higher" | "comparative_only" | "unspecified";
type Observation = { readonly id: string; readonly provenance: "reused_071" | "new_073"; readonly sourceId: string; readonly originalClaimId?: string; readonly paraphrase: string; readonly scope: "exact_variant" | "drop_family" | "certification_family" | "equipment_family"; readonly certification: "USSSA"; readonly modelYear: 2026; readonly construct: Construct | null; readonly confidence: Confidence | null; readonly direction: Direction; readonly classification: "external_observation" | "comparative_observation" | "marketing" | "ambiguous" | "useful_unmapped"; readonly comparisonTarget?: string; readonly canonicalValueCreated: false; readonly numericValueCreated: false };

export const atlasExternalSources = [
  { id: "batdigest", publisher: "BatDigest", url: "https://batdigest.com/reviews/2026-louisville-slugger-atlas-review/", independence: "known_independent", independenceGroup: "batdigest-editorial", method: "expert-tested editorial; raw trials unavailable", role: "editorial" },
  { id: "batreviews", publisher: "BatReviews", url: "https://batreviews.com/reviews/2026-louisville-slugger-atlas-usssa/", independence: "unknown_dependency", independenceGroup: "unknown-batreviews", method: "editorial page citing manufacturer and another review", role: "editorial_under_review" },
  { id: "national-pastime", publisher: "The National Pastime Museum", url: "https://thenationalpastimemuseum.com/baseball/2026-louisville-slugger-atlas-review/", independence: "unknown_dependency", independenceGroup: "aggregated-review-lineage-unknown", method: "attributed editorial synthesis of multiple reviews", role: "dependency_control" }
] as const;

const reused: readonly Observation[] = [
  obs("071-digest-balance", "reused_071", "batdigest", "claim-digest-balance", "Editorial testing describes balanced swing feel with some substance.", "equipment_family", "barrel_path_repeatability", "medium", "moderate_or_neutral"),
  obs("071-digest-light", "reused_071", "batdigest", "claim-digest-light", "The USSSA drop-ten family is categorized as light swinging.", "drop_family", "startup_demand", "high", "lower"),
  obs("071-digest-contact", "reused_071", "batdigest", "claim-digest-contact", "Editorial scoring reports a positive contact-oriented assessment.", "equipment_family", "center_response_baseline", "medium", "higher"),
  obs("071-reviews-light", "reused_071", "batreviews", "claim-reviews-light", "The review characterizes the drop-ten swing as light and balanced.", "drop_family", "startup_demand", "medium", "lower"),
  obs("071-reviews-forgiving", "reused_071", "batreviews", "claim-reviews-forgiving", "The review characterizes the bat as forgiving without separating miss-response constructs.", "equipment_family", null, null, "unspecified", "ambiguous"),
  obs("071-reviews-pop", "reused_071", "batreviews", "claim-reviews-pop", "The review reports strong pop as an observation.", "equipment_family", "center_response_baseline", "low", "higher")
] as const;

const added: readonly Observation[] = [
  obs("073-digest-usssa-light", "new_073", "batdigest", undefined, "The 2026 USSSA drop-ten row is specifically categorized as light swinging.", "drop_family", "startup_demand", "high", "lower"),
  obs("073-digest-heavier-comparison", "new_073", "batdigest", undefined, "The Atlas is described as feeling heavier than ultra-light one-piece alternatives.", "equipment_family", "rotational_demand", "high", "comparative_only", "ultra-light one-piece bats", "comparative_observation"),
  obs("073-digest-control", "new_073", "batdigest", undefined, "The USSSA drop-ten receives a strong control assessment, but the wording does not isolate a single control construct.", "drop_family", "directional_adjustment_control", "medium", "higher"),
  obs("073-digest-repeatable", "new_073", "batdigest", undefined, "The product family is described as producing steady, repeatable performance.", "equipment_family", "centered_response_consistency", "low", "higher", undefined, "ambiguous"),
  obs("073-digest-sweet", "new_073", "batdigest", undefined, "The review uses large usable sweet-spot language without separating region breadth from response consistency or miss tolerance.", "equipment_family", null, null, "unspecified", undefined, "ambiguous"),
  obs("073-digest-vibration", "new_073", "batdigest", undefined, "The review describes minimal sting and vibration control.", "equipment_family", null, null, "lower", undefined, "useful_unmapped"),
  obs("073-national-light", "new_073", "national-pastime", undefined, "The USSSA line is described as light swinging and balanced.", "drop_family", "startup_demand", "medium", "lower"),
  obs("073-national-control", "new_073", "national-pastime", undefined, "The synthesis describes barrel control over end-load carry.", "certification_family", "directional_adjustment_control", "low", "higher"),
  obs("073-national-liners", "new_073", "national-pastime", undefined, "A laser-beam-liners phrase is attributed to multiple reviews but cannot be traced to independent raw observations.", "certification_family", null, null, "unspecified", undefined, "ambiguous"),
  obs("073-national-forgiving", "new_073", "national-pastime", undefined, "A mishit-forgiveness rating is reported without separate handle-side, end-side, degradation, or breadth observations.", "certification_family", null, null, "unspecified", undefined, "ambiguous"),
  obs("073-batreviews-accessible", "new_073", "batreviews", undefined, "The drop-ten is described as the most accessible drop in the product line.", "drop_family", "startup_demand", "medium", "comparative_only", "Atlas USSSA -8 and -5", "comparative_observation"),
  obs("073-batreviews-tmd", "new_073", "batreviews", undefined, "Vibration-control language is tied to the Tuned Mass Damper but is not a current Protocol v1.1 construct.", "equipment_family", null, null, "lower", undefined, "useful_unmapped")
] as const;

export const atlasExternalObservations = [...reused, ...added] as const;

export function buildAtlasExternalExpertCalibrationReport() {
  const pilotGraph = buildAtlasUsssaAcquisitionPilotGraph();
  const pilot = buildAtlasUsssaAcquisitionPilotReport();
  const reusedIds = new Set(pilotGraph.rawClaims.filter((claim) => claim.claimType === "subjective_observation").map((claim) => claim.id));
  if (!reused.every((item) => item.originalClaimId && reusedIds.has(item.originalClaimId))) throw new Error("Ticket #071 editorial provenance mismatch");
  const constructCoverage = constructs.map((construct) => {
    const rows = atlasExternalObservations.filter((item) => item.construct === construct);
    return { construct, observations: rows.length, high: rows.filter((item) => item.confidence === "high").length, medium: rows.filter((item) => item.confidence === "medium").length, low: rows.filter((item) => item.confidence === "low").length, independentLineages: new Set(rows.filter((item) => source(item.sourceId).independence === "known_independent").map((item) => source(item.sourceId).independenceGroup)).size, eligibility: eligibility(construct, rows) };
  });
  return {
    version: ATLAS_EXTERNAL_EXPERT_CALIBRATION_VERSION,
    classification: "REAL EXTERNAL SOURCE RESEARCH / SECOND-PRODUCT CALIBRATION / NON-PERSISTED / NOT PRODUCTION EQUIPMENT DNA",
    calibrationKind: "cross-product supporting-role validation; not external-to-Ninery behavioral calibration",
    target: { equipmentId: ATLAS_USSSA_PILOT_EQUIPMENT_ID, variantId: ATLAS_USSSA_PILOT_VARIANT_ID, sku: "LS-ATLAS-USSSA-30-20", identity: "2026 Louisville Slugger Atlas USSSA 30/20/-10", certification: "USSSA", modelYear: 2026, length: 30, nominalWeight: 20, drop: -10, manufacturerProductId: "WBL4121010", sizeSpecificId: "WBL41210102030" },
    excludedHistoricalIdentity: { equipmentId: ATLAS_USSSA_PILOT_EXCLUDED_EQUIPMENT_ID, variantId: ATLAS_USSSA_PILOT_EXCLUDED_VARIANT_ID, used: false },
    catalogOnlyExpectation: { legacyDNAProfiles: 0, dnaScores: 0, behavioralEvidence: 0, canonicalEvaluations: 0, fitProfiles: 0, personalities: 0, recommendations: 0, transitionStudies: 0, physicalMeasurements: 0, structuredHumanEvaluations: 0, fieldObservations: 0, modeledEstimates: 0, databaseAuditStatus: "blocked_by_windows_tls_credential_provider" },
    ticket071: { sourceCount: pilot.sourceCount, rawClaims: pilot.rawClaimCount, normalizedClaims: pilot.normalizedClaimCount, qualification: pilot.qualification, reusedObservationCount: reused.length, originalQualification: "context_only" },
    sources: atlasExternalSources, observations: atlasExternalObservations, constructCoverage,
    counts: { sources: atlasExternalSources.length, knownIndependentLineages: new Set(atlasExternalSources.filter((item) => item.independence === "known_independent").map((item) => item.independenceGroup)).size, unknownDependencySources: atlasExternalSources.filter((item) => item.independence === "unknown_dependency").length, observations: atlasExternalObservations.length, reused: reused.length, added: added.length, marketing: atlasExternalObservations.filter((item) => item.classification === "marketing").length, ambiguous: atlasExternalObservations.filter((item) => item.classification === "ambiguous").length, usefulUnmapped: atlasExternalObservations.filter((item) => item.classification === "useful_unmapped").length },
    externalAgreement: "Light/easy startup language repeats across sources, but only BatDigest has known-independent lineage status. Response, forgiveness, and sweet-spot language remains semantically collapsed.",
    current070Baseline: { state: "context_only", observations: atlasExternalObservations.length, runtimeChanged: false },
    policies: policySimulations(constructCoverage),
    firewalls: { atlasBehavioralEvidenceCreated: 0, externalEvidencePersisted: 0, canonicalEvaluationsCreated: 0, numericReferencesCreated: 0, modeledBehaviorCreated: 0, physicalEvidenceCreated: 0, humanEvaluationsCreated: 0, recommendationInputsCreated: 0, seventhEvidenceClassIntroduced: false, qualificationRuntimeChanged: false, sufficiencyRuntimeChanged: false }
  } as const;
}

export function buildCrossProductSupportingRoleValidationReport() {
  const atlas = buildAtlasExternalExpertCalibrationReport();
  const demarini = buildDemariniExternalExpertCalibrationReport();
  const comparison = constructs.map((construct) => {
    const a = atlas.constructCoverage.find((item) => item.construct === construct)!;
    const drows = demariniExternalObservations.filter((item) => item.construct === construct && item.classification !== "marketing_repetition");
    const d = { observations: drows.length, high: drows.filter((item) => item.mappingConfidence === "high").length, medium: drows.filter((item) => item.mappingConfidence === "medium").length, low: drows.filter((item) => item.mappingConfidence === "low").length };
    return { construct, demarini: d, atlas: a, pattern: pattern(construct, d, a), eligibility: a.eligibility };
  });
  return {
    version: CROSS_PRODUCT_SUPPORTING_ROLE_VALIDATION_VERSION,
    classification: "CROSS-PRODUCT EVIDENCE-SYSTEM ANALYSIS / NOT A PRODUCT PERFORMANCE COMPARISON",
    products: [demarini.target.identity, atlas.target.identity], comparison,
    similarities: ["Demand language maps more specifically than response/miss language.", "Sweet-spot and forgiveness prose collapses distinct constructs.", "Known independence is rarer than distinct domains suggest.", "Vibration is useful but unmapped."],
    differences: ["DeMarini permits external-to-structured directional calibration.", "Atlas has no Ninery behavioral reference and supports semantic/policy validation only.", "Atlas exact-size editorial observation coverage is absent."],
    decisions: { taxonomy: "SIX_CLASSES_SUFFICIENT_WITH_ROLE_POLICY", qualification: "PROVISIONAL_SUPPORTING_ROLE_READY_FOR_IMPLEMENTATION", sufficiency: "ENOUGH_FOR_PROVISIONAL_SUPPORTING_POLICY", globalPolicy: "CONSTRUCT_SPECIFIC_POLICY_SUPPORTED" },
    proposedPolicy: { version: "external-expert-supporting-role/1.0-proposal", implemented: false, eligibleSourceType: "independent_expert_review", identity: "same model year, certification, and applicable family/drop scope; never promote scope", dependency: "known-independent lineage required; unknown dependency requires human review and cannot satisfy independence", mapping: "high-confidence only", eligibleConstructs: ["startup_demand", "rotational_demand"], review: "human approval required before supporting designation", role: "supporting_context", directEvidence: false, canonicalAuthority: false, numericAuthority: false, recommendationAuthority: false, conflict: "preserve and flag; never override direct or structured evidence", supersession: "append a versioned replacement and retain history", explainability: "Say reviewers describe; never say Ninery measured or proved.", readiness: "may add breadth/source context only; cannot establish direct evidence or synthesis eligibility" },
    capabilities: { evidenceBreadth: "potentially_yes", sourceDiversity: "potentially_yes", contextualSupport: "potentially_yes", corroboration: "only among proven-independent lineages", readinessProgression: "breadth_only", synthesisEligibility: "no", canonicalFormation: "no", recommendationCalculations: "no" },
    nextTicket: "Implement External Expert Supporting-Evidence Role v1.0 as a provisional, construct-specific, non-authoritative policy behind unchanged direct/canonical/numeric/recommendation firewalls."
  } as const;
}

function obs(id: string, provenance: Observation["provenance"], sourceId: string, originalClaimId: string | undefined, paraphrase: string, scope: Observation["scope"], construct: Construct | null, confidence: Confidence | null, direction: Direction, comparisonTarget?: string, classification: Observation["classification"] = "external_observation"): Observation { return { id, provenance, sourceId, originalClaimId, paraphrase, scope, certification: "USSSA", modelYear: 2026, construct, confidence, direction, classification, comparisonTarget, canonicalValueCreated: false, numericValueCreated: false }; }
function source(id: string) { return atlasExternalSources.find((item) => item.id === id)!; }
function eligibility(construct: Construct, rows: readonly Observation[]) { if (["handle_side_miss_tolerance", "end_side_miss_tolerance", "response_degradation", "usable_contact_region_breadth", "centered_response_consistency", "near_center_response_consistency"].includes(construct)) return "CONTROLLED_EVIDENCE_PREFERRED"; if (rows.some((item) => item.confidence === "high" && source(item.sourceId).independence === "known_independent") && ["startup_demand", "rotational_demand"].includes(construct)) return "SUPPORTING_ROLE_CANDIDATE"; return rows.length ? "CONTEXT_ONLY_RECOMMENDED" : "INSUFFICIENT_CALIBRATION"; }
function pattern(construct: Construct, d: { observations: number; high: number }, a: { observations: number; high: number }) { if (!d.observations && !a.observations) return "insufficient_second_product_data"; const demand = ["startup_demand", "rotational_demand", "directional_adjustment_control"].includes(construct); const response = ["response_degradation", "usable_contact_region_breadth", "centered_response_consistency", "near_center_response_consistency", "handle_side_miss_tolerance", "end_side_miss_tolerance"].includes(construct); if ((demand && d.observations && a.observations) || (response && (d.observations || a.observations))) return d.high && a.high ? "pattern_repeated" : "pattern_partially_repeated"; return "insufficient_second_product_data"; }
function policySimulations(coverage: readonly { construct: Construct; observations: number; high: number; independentLineages: number }[]) { return [
  { id: "A", rule: "all remain context_only", supportCount: 0, consistentAcrossProducts: true, risk: "lowest" },
  { id: "B", rule: "high-confidence identity-bound known-independent", supportCount: coverage.filter((item) => item.high && item.independentLineages).length, consistentAcrossProducts: true, risk: "one-lineage false confidence" },
  { id: "C", rule: "two known-independent lineages per construct", supportCount: coverage.filter((item) => item.independentLineages >= 2).length, consistentAcrossProducts: true, risk: "low coverage; Atlas has no qualifying construct" },
  { id: "D", rule: "construct-specific high-confidence known-independent demand only", supportCount: coverage.filter((item) => ["startup_demand", "rotational_demand"].includes(item.construct) && item.high && item.independentLineages).length, consistentAcrossProducts: true, risk: "bounded and explainable" }
] as const; }
