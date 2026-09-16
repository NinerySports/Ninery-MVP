export const EXTERNAL_EXPERT_CALIBRATION_VERSION = "1.0";
export const DEMARINI_CALIBRATION_EQUIPMENT_ID = "6cf0f7fa-c8c2-4ce7-a36e-6ad1c52cc56c";
export const DEMARINI_CALIBRATION_VARIANT_ID = "af5ff27c-aedd-4f56-88c3-c1ec4b70affa";

export type CalibrationAlignment = "directionally_aligned" | "partially_aligned" | "directionally_conflicting" | "indeterminate" | "not_comparable";
export type MappingConfidence = "high" | "medium" | "low";
export type SourceDirection = "lower" | "moderate_or_neutral" | "higher" | "comparative_only" | "unspecified";

type Source = { readonly id: string; readonly publisher: string; readonly author: string | null; readonly url: string; readonly retrievedAt: string; readonly independence: "known_independent" | "known_dependent_or_syndicated" | "unknown_dependency"; readonly independenceGroup: string; readonly role: "editorial" | "negative_control"; readonly limitations: readonly string[] };
type Observation = { readonly id: string; readonly sourceId: string; readonly faithfulParaphrase: string; readonly identityScope: "exact_variant" | "drop_family" | "certification_family" | "equipment_family"; readonly construct: string | null; readonly mappingConfidence: MappingConfidence | null; readonly direction: SourceDirection; readonly comparisonTarget?: string; readonly classification: "observation" | "comparison" | "ambiguous" | "marketing_repetition"; readonly canonicalValueCreated: false; readonly numericValueCreated: false };

export const demariniExternalSources: readonly Source[] = [
  { id: "batdigest", publisher: "BatDigest", author: "Bat Digest editorial staff", url: "https://batdigest.com/reviews/2023-demarini-the-goods-review/", retrievedAt: "2026-09-11", independence: "known_independent", independenceGroup: "batdigest-editorial", role: "editorial", limitations: ["USA drop-family review; methodology is summarized but raw trials are unavailable."] },
  { id: "small-fries", publisher: "Small Fries Baseball", author: "Small Fries Baseball", url: "https://www.youtube.com/watch?v=XqXeTbuQunE", retrievedAt: "2026-09-11", independence: "known_independent", independenceGroup: "small-fries-video", role: "editorial", limitations: ["Observed size is 29/19, not the persisted 30/20 variant."] },
  { id: "shoppers-verdict", publisher: "The Shopper's Verdict", author: null, url: "https://theshoppersverdict.com/sports-fitness/demarini-2023-the-goods-10-usa-baseball-bat-28-29-30-and-b0c53z-review/", retrievedAt: "2026-09-11", independence: "known_dependent_or_syndicated", independenceGroup: "amazon-review-synthesis", role: "negative_control", limitations: ["Aggregates customer reviews, contains affiliate content, and incorrectly describes construction in one section."] },
  { id: "jockular", publisher: "Jockular", author: null, url: "https://jockular.com/best-youth-usa-bats/", retrievedAt: "2026-09-11", independence: "unknown_dependency", independenceGroup: "unknown-jockular", role: "negative_control", limitations: ["General roundup with limited method transparency and possible manufacturer-language reuse."] }
] as const;

export const demariniExternalObservations: readonly Observation[] = [
  o("bd-light", "batdigest", "The USA drop-ten is characterized as light swinging.", "drop_family", "startup_demand", "high", "lower"),
  o("bd-balanced", "batdigest", "Swing feel is characterized as balanced.", "drop_family", "rotational_demand", "medium", "moderate_or_neutral"),
  o("bd-control", "batdigest", "The USA drop-ten receives a strong control assessment.", "drop_family", "directional_adjustment_control", "medium", "higher"),
  o("bd-clean", "batdigest", "The review describes clean swing feedback.", "drop_family", null, null, "unspecified", "ambiguous"),
  o("bd-squared", "batdigest", "Squared contact is described as producing strong feedback.", "drop_family", "center_response_baseline", "medium", "higher"),
  o("bd-small-barrel", "batdigest", "The barrel profile is described as compact for a USA bat.", "equipment_family", "usable_contact_region_breadth", "low", "lower"),
  o("bd-balance-compare", "batdigest", "Relative to named USA hybrids, the bat is described as leaning toward balance rather than end-loaded mass.", "drop_family", "rotational_demand", "high", "comparative_only", "Louisville Slugger Select PWR USA and Marucci CAT X Connect USA", "comparison"),
  o("bd-feel", "batdigest", "The product is described as feel-driven rather than a power model.", "drop_family", null, null, "comparative_only", "power-oriented Goods models", "comparison"),
  o("sf-balanced", "small-fries", "The tested 29/19 specimen is described as having a pretty balanced swing weight.", "exact_variant", "rotational_demand", "high", "moderate_or_neutral"),
  o("sf-pop", "small-fries", "Centered contact is described as having good pop.", "exact_variant", "center_response_baseline", "medium", "higher"),
  o("sf-sweet", "small-fries", "The reviewer reports a good sweet spot while also noting a small barrel profile.", "exact_variant", "usable_contact_region_breadth", "low", "unspecified", undefined, "ambiguous"),
  o("sf-miss", "small-fries", "Testers reported no hand sting complaints on mishits.", "exact_variant", null, null, "lower"),
  o("sf-barrel-compare", "small-fries", "The barrel profile is described as small compared with other leading bats.", "exact_variant", "usable_contact_region_breadth", "medium", "lower", "other top bats", "comparison"),
  o("sv-balanced", "shoppers-verdict", "The aggregated review describes the bat as balanced and controllable.", "drop_family", "directional_adjustment_control", "low", "higher"),
  o("sv-vibration", "shoppers-verdict", "The synthesis reports reduced vibration sting on off-center contact.", "drop_family", null, null, "lower"),
  o("sv-forgiving", "shoppers-verdict", "The synthesis calls the drop-ten forgiving for developing hitters.", "drop_family", "response_degradation", "low", "lower", undefined, "ambiguous"),
  o("j-balanced", "jockular", "The roundup labels the product balanced.", "equipment_family", "rotational_demand", "low", "moderate_or_neutral", undefined, "marketing_repetition"),
  o("j-performance", "jockular", "The roundup calls it one of the year's best-performing USA hybrids.", "equipment_family", null, null, "unspecified", undefined, "ambiguous")
] as const;

export const demariniStructuredReference = [
  ref("startup_demand", "emerging_evidence", "moderate", "v1.0 varied from moderate through very_demanding"),
  ref("rotational_demand", "emerging_evidence", "high"), ref("barrel_redirect_demand", "emerging_evidence", "moderate"),
  ref("directional_adjustment_control", "emerging_evidence", "moderate"), ref("barrel_path_repeatability", "emerging_evidence", "moderate"),
  ref("start_stop_redirect_control", "emerging_evidence", "high"), ref("center_response_baseline", "insufficient_evidence", "high"),
  ref("handle_side_miss_tolerance", "insufficient_evidence", "moderate"), ref("end_side_miss_tolerance", "insufficient_evidence", "moderate"),
  ref("response_degradation", "insufficient_evidence", "high", "inverse semantics: higher degradation means less forgiveness; v1.0 forgiveness was highly disputed"),
  ref("usable_contact_region_breadth", "insufficient_evidence", "low"), ref("centered_response_consistency", "insufficient_evidence", "moderate"),
  ref("near_center_response_consistency", "insufficient_evidence", "moderate")
] as const;

export function buildDemariniExternalExpertCalibrationReport() {
  const comparisons = demariniStructuredReference.map((reference) => {
    const observations = demariniExternalObservations.filter((item) => item.construct === reference.construct && item.classification !== "marketing_repetition");
    const outcomes = observations.map((item) => calibrate(item, reference.v11Direction));
    return { construct: reference.construct, readiness: reference.readiness, structured: reference, observationCount: observations.length, independentLineageCount: new Set(observations.map((item) => demariniExternalSources.find((source) => source.id === item.sourceId)!.independenceGroup)).size, mappingConfidence: count(observations.map((item) => item.mappingConfidence!)), outcomes: count(outcomes), suitability: suitability(reference.construct, observations) };
  });
  const allOutcomes = comparisons.flatMap((item) => Object.entries(item.outcomes).flatMap(([key, value]) => Array(value).fill(key)));
  return {
    version: EXTERNAL_EXPERT_CALIBRATION_VERSION,
    classification: "REAL EXTERNAL SOURCE RESEARCH / CALIBRATION ONLY / NON-PERSISTED / NOT PRODUCTION EQUIPMENT DNA",
    target: { equipmentId: DEMARINI_CALIBRATION_EQUIPMENT_ID, variantId: DEMARINI_CALIBRATION_VARIANT_ID, identity: "2023 DeMarini The Goods USA 30/20/-10", sku: "DEM-THE-GOODS-USA-30-20" },
    persistedReference: { directPhysicalMeasurements: 5, structuredHumanRecords: 41, sessions: 8, evaluatorGroups: 7, protocolVersions: ["1.0", "1.1"], snapshotSource: "Ticket #072 read-only database audit" },
    sources: demariniExternalSources,
    observations: demariniExternalObservations,
    excluded: { marketingRepetition: demariniExternalObservations.filter((item) => item.classification === "marketing_repetition").length, ambiguousOrUnmapped: demariniExternalObservations.filter((item) => !item.construct).length, identityMismatch: 0 },
    constructCalibration: comparisons,
    alignmentTotals: count(allOutcomes),
    externalExternalAgreement: "Demand/balance observations broadly converge; sweet-spot and forgiveness wording does not cleanly separate Protocol v1.1 response constructs.",
    policies: [
      { id: "A", rule: "all context_only", supportingObservations: 0, risk: "lowest", readinessEffect: "none" },
      { id: "B", rule: "high-confidence, identity-bound, known-independent observation", supportingObservations: eligible("B"), risk: "moderate; one-source false corroboration remains", readinessEffect: "breadth only; never synthesis eligibility" },
      { id: "C", rule: "two distinct known-independent lineages per construct", supportingObservations: eligible("C"), risk: "lower, but source scarcity limits coverage", readinessEffect: "breadth only; no direct-evidence credit" },
      { id: "D", rule: "construct-specific: demand/control only, high-confidence and known-independent", supportingObservations: eligible("D"), risk: "bounded", readinessEffect: "supporting context only; response/miss constructs unchanged" }
    ],
    atlasSimulation: [
      ["BatDigest startup_demand", "would_support"], ["BatDigest barrel_path_repeatability", "would_remain_context"], ["BatDigest center_response_baseline", "would_remain_context"],
      ["BatReviews startup_demand", "would_require_review"], ["BatReviews response_degradation", "would_require_review"], ["BatReviews center_response_baseline", "would_require_review"]
    ],
    automation: { READY_FOR_AUTOMATION: ["duplicate detection", "baseline qualification", "deterministic calibration comparison"], AI_ASSISTED_REVIEW_REQUIRED: ["source discovery", "claim extraction", "candidate mapping", "direction extraction", "dependency detection"], HUMAN_REVIEW_REQUIRED: ["identity binding", "observation-versus-marketing decision", "supporting-role decision"], NOT_READY: ["declaring independence", "declaring reviewer truth", "canonical conversion"] },
    decisions: { taxonomy: "SIX_CLASSES_SUFFICIENT_WITH_ROLE_POLICY", qualification: "SECOND_CALIBRATION_REQUIRED_BEFORE_POLICY_CHANGE", sufficiency: "SECOND_PRODUCT_CALIBRATION_REQUIRED" },
    recommendation: "Run a second-product external-expert calibration before changing #070 or #067; keep any future role separate from evidence class and direct-evidence authority.",
    firewalls: { databaseWrites: 0, externalEvidencePersisted: 0, canonicalEvaluationsCreated: 0, numericReferencesCreated: 0, modeledEvidenceCreated: 0, recommendationInputsCreated: 0, seventhEvidenceClassIntroduced: false, qualificationRuntimeChanged: false, sufficiencyRuntimeChanged: false }
  } as const;
}

function o(id: string, sourceId: string, faithfulParaphrase: string, identityScope: Observation["identityScope"], construct: string | null, mappingConfidence: MappingConfidence | null, direction: SourceDirection, comparisonTarget?: string, classification: Observation["classification"] = "observation"): Observation { return { id, sourceId, faithfulParaphrase, identityScope, construct, mappingConfidence, direction, comparisonTarget, classification, canonicalValueCreated: false, numericValueCreated: false }; }
function ref(construct: string, readiness: string, v11Direction: string, disagreement = "single v1.1 direct observation; no consensus claimed") {
  const v10Context = ["startup_demand", "rotational_demand", "barrel_redirect_demand"].includes(construct) ? "swing_effort" :
    ["directional_adjustment_control", "barrel_path_repeatability", "start_stop_redirect_control"].includes(construct) ? "bat_control" :
    ["handle_side_miss_tolerance", "end_side_miss_tolerance", "response_degradation"].includes(construct) ? "forgiveness" : "sweet_spot_support";
  return { construct, readiness, v11Direction, totalRelatedStructuredRecords: 8, totalSessionsRepresented: 8, totalEvaluatorGroupsRepresented: 7, v11StructuredRecords: 1, v11Sessions: 1, v11EvaluatorGroups: 1, v10ContextRecords: 7, v10Context, protocolVersions: ["1.0", "1.1"], disagreement };
}
function calibrate(observation: Observation, structured: string): CalibrationAlignment { if (!observation.construct || observation.direction === "unspecified" || observation.direction === "comparative_only") return "indeterminate"; if (observation.mappingConfidence === "low") return "indeterminate"; const expected = structured === "high" ? "higher" : structured === "low" ? "lower" : "moderate_or_neutral"; return observation.direction === expected ? "directionally_aligned" : observation.direction === "moderate_or_neutral" || expected === "moderate_or_neutral" ? "partially_aligned" : "directionally_conflicting"; }
function suitability(construct: string, observations: readonly Observation[]) { const highRisk = ["handle_side_miss_tolerance", "end_side_miss_tolerance", "response_degradation", "usable_contact_region_breadth", "centered_response_consistency", "near_center_response_consistency"].includes(construct); return observations.length === 0 ? "insufficient_data" : highRisk ? "unsuitable_without_stronger_calibration" : observations.some((item) => item.mappingConfidence === "high") ? "potentially_supporting" : "insufficient_data"; }
function eligible(policy: "B" | "C" | "D") { const candidates = demariniExternalObservations.filter((item) => item.construct && item.mappingConfidence === "high" && item.classification !== "marketing_repetition" && demariniExternalSources.find((source) => source.id === item.sourceId)?.independence === "known_independent"); if (policy === "B") return candidates.length; if (policy === "D") return candidates.filter((item) => ["startup_demand", "rotational_demand", "barrel_redirect_demand", "directional_adjustment_control", "barrel_path_repeatability", "start_stop_redirect_control"].includes(item.construct!)).length; return [...new Set(candidates.map((item) => item.construct))].filter((construct) => new Set(candidates.filter((item) => item.construct === construct).map((item) => demariniExternalSources.find((source) => source.id === item.sourceId)!.independenceGroup)).size >= 2).length; }
function count(values: readonly string[]) { return Object.fromEntries([...new Set(values)].sort().map((key) => [key, values.filter((value) => value === key).length])); }
