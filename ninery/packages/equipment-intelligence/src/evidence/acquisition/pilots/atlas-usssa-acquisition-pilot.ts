import { equipmentDNAConstructEvidenceMap } from "../../equipment-multi-source-strategy.js";
import { analyzeEquipmentClaimProvenance } from "../equipment-claim-provenance.js";
import type {
  EquipmentClaimDependency,
  EquipmentClaimIdentityAssertion,
  EquipmentClaimProvenanceGraph,
  EquipmentClaimReviewState,
  EquipmentClaimType,
  EquipmentNormalizedClaim,
  EquipmentSourceClaim,
  EquipmentSourceType
} from "../equipment-claim-provenance.types.js";
import { qualifyEquipmentClaim } from "../../qualification/equipment-claim-qualification.js";
import type { EquipmentClaimQualificationState } from "../../qualification/equipment-claim-qualification.types.js";

export const ATLAS_USSSA_ACQUISITION_PILOT_VERSION = "1.0";
export const ATLAS_USSSA_PILOT_EQUIPMENT_ID = "748ae67e-0b10-40d6-8ef6-28d6953d1d40";
export const ATLAS_USSSA_PILOT_VARIANT_ID = "0844a8e0-8b9a-42ba-9b6f-50f288832e58";
export const ATLAS_USSSA_PILOT_EXCLUDED_EQUIPMENT_ID = "66f59356-029f-4df7-9177-0d0f36ef3e9c";
export const ATLAS_USSSA_PILOT_EXCLUDED_VARIANT_ID = "a485a596-ea15-4622-ac2e-452b7fd9c934";

const retrievedAt = "2026-09-10T00:00:00.000Z";
const targetIdentity: EquipmentClaimIdentityAssertion = {
  id: "atlas-usssa-2026-30-20",
  certainty: "exact_variant_match",
  manufacturer: "Louisville Slugger",
  model: "Atlas",
  modelYear: 2026,
  certification: "USSSA",
  lengthInches: 30,
  weightOunces: 20,
  drop: -10,
  sku: "LS-ATLAS-USSSA-30-20",
  manufacturerProductId: "WBL4121010",
  equipmentId: ATLAS_USSSA_PILOT_EQUIPMENT_ID,
  equipmentVariantId: ATLAS_USSSA_PILOT_VARIANT_ID,
  limitations: ["The size-specific external identifier WBL41210102030 is audit metadata and is not stored in the catalog schema."]
};

type PilotClaim = {
  id: string; source: "slugger" | "direct" | "academy" | "batdigest" | "batreviews";
  key: string; value: unknown; unit?: string; type: EquipmentClaimType;
  scope: "equipment" | "variant"; text: string; authority: EquipmentSourceClaim["authority"];
  verification?: EquipmentSourceClaim["verificationState"]; review?: EquipmentClaimReviewState;
  evidenceClass?: EquipmentNormalizedClaim["evidenceClass"]; construct?: string;
};

const claims: readonly PilotClaim[] = [
  { id: "model", source: "slugger", key: "model", value: "Atlas", type: "identity_claim", scope: "equipment", text: "The page identifies the product as Atlas.", authority: "authoritative" },
  { id: "year", source: "slugger", key: "model_year", value: 2026, type: "identity_claim", scope: "equipment", text: "The product page identifies model year 2026.", authority: "authoritative" },
  { id: "cert", source: "slugger", key: "certification", value: "USSSA", type: "certification_claim", scope: "equipment", text: "The product is identified as USSSA.", authority: "authoritative" },
  { id: "drop", source: "slugger", key: "drop", value: -10, type: "factual_specification", scope: "equipment", text: "The product family is the drop-ten Atlas USSSA line.", authority: "authoritative" },
  { id: "barrel", source: "slugger", key: "barrel_diameter", value: 2.75, unit: "in", type: "factual_specification", scope: "equipment", text: "Nominal barrel diameter is two and three-quarter inches.", authority: "authoritative" },
  { id: "construction", source: "slugger", key: "construction", value: "one-piece", type: "factual_specification", scope: "equipment", text: "The Atlas uses a one-piece construction.", authority: "authoritative" },
  { id: "material", source: "slugger", key: "material", value: "alloy", type: "factual_specification", scope: "equipment", text: "The barrel is identified as SL Hyper alloy.", authority: "authoritative" },
  { id: "length", source: "slugger", key: "nominal_length", value: 30, unit: "in", type: "factual_specification", scope: "variant", text: "A 30-inch size is offered.", authority: "authoritative" },
  { id: "weight", source: "slugger", key: "nominal_weight", value: 20, unit: "oz", type: "factual_specification", scope: "variant", text: "The 30-inch drop-ten size has nominal weight 20 ounces.", authority: "authoritative" },
  { id: "tmd", source: "slugger", key: "component", value: "tuned_mass_damper", type: "factual_specification", scope: "equipment", text: "A Tuned Mass Damper is listed as a handle component.", authority: "authoritative" },
  { id: "xpnd", source: "slugger", key: "component", value: "xpnd_end_cap", type: "factual_specification", scope: "equipment", text: "An XPND performance end cap is listed.", authority: "authoritative" },
  { id: "easy-marketing", source: "slugger", key: "marketing_descriptor", value: "easy_swinging", type: "marketing_claim", scope: "equipment", text: "The manufacturer describes the design as easy-swinging.", authority: "not_authoritative_for_claim", construct: "startup_demand" },
  { id: "sweet-marketing", source: "slugger", key: "marketing_descriptor", value: "enormous_sweet_spot", type: "marketing_claim", scope: "equipment", text: "The manufacturer uses an enormous-sweet-spot descriptor.", authority: "not_authoritative_for_claim", construct: "usable_contact_region_breadth" },
  { id: "direct-cert", source: "direct", key: "certification", value: "USSSA", type: "certification_claim", scope: "equipment", text: "Retail listing repeats USSSA identity.", authority: "secondary" },
  { id: "direct-barrel", source: "direct", key: "barrel_diameter", value: 2.75, unit: "in", type: "factual_specification", scope: "equipment", text: "Retail listing repeats the 2.75-inch barrel.", authority: "secondary" },
  { id: "direct-construction", source: "direct", key: "construction", value: "one-piece", type: "factual_specification", scope: "equipment", text: "Retail listing repeats one-piece alloy construction.", authority: "secondary" },
  { id: "direct-sweet", source: "direct", key: "marketing_descriptor", value: "enormous_sweet_spot", type: "marketing_claim", scope: "equipment", text: "Retail copy repeats the manufacturer's sweet-spot language.", authority: "not_authoritative_for_claim", construct: "usable_contact_region_breadth" },
  { id: "academy-cert", source: "academy", key: "certification", value: "USSSA", type: "certification_claim", scope: "equipment", text: "Retail specifications list USSSA approval.", authority: "secondary" },
  { id: "academy-barrel", source: "academy", key: "barrel_diameter", value: 2.75, unit: "in", type: "factual_specification", scope: "equipment", text: "Retail specifications list a 2.75-inch barrel.", authority: "secondary" },
  { id: "academy-construction", source: "academy", key: "construction", value: "one-piece", type: "factual_specification", scope: "equipment", text: "Retail specifications list one-piece construction.", authority: "secondary" },
  { id: "academy-vibration", source: "academy", key: "marketing_descriptor", value: "absorbs_vibration", type: "marketing_claim", scope: "equipment", text: "Retail copy repeats a broad vibration-absorption benefit.", authority: "not_authoritative_for_claim", construct: "vibration_and_feedback_response" },
  { id: "digest-balance", source: "batdigest", key: "review_observation", value: "balanced_with_substance", type: "subjective_observation", scope: "equipment", text: "Editorial testing describes balanced swing feel with some substance.", authority: "observational", evidenceClass: "structured_human_evaluation", construct: "barrel_path_repeatability" },
  { id: "digest-light", source: "batdigest", key: "review_observation", value: "light_swing", type: "subjective_observation", scope: "equipment", text: "The USSSA drop-ten family is categorized as light swinging.", authority: "observational", evidenceClass: "structured_human_evaluation", construct: "startup_demand" },
  { id: "digest-contact", source: "batdigest", key: "review_observation", value: "positive_contact_assessment", type: "subjective_observation", scope: "equipment", text: "Editorial scoring reports a positive contact-oriented assessment.", authority: "observational", evidenceClass: "structured_human_evaluation", construct: "center_response_baseline" },
  { id: "reviews-light", source: "batreviews", key: "review_observation", value: "light_swing", type: "subjective_observation", scope: "equipment", text: "The review characterizes the drop-ten swing as light and balanced.", authority: "observational", verification: "unverified_extracted", review: "review_pending", evidenceClass: "structured_human_evaluation", construct: "startup_demand" },
  { id: "reviews-forgiving", source: "batreviews", key: "review_observation", value: "forgiving", type: "subjective_observation", scope: "equipment", text: "The review characterizes the bat as forgiving.", authority: "observational", verification: "unverified_extracted", review: "review_pending", evidenceClass: "structured_human_evaluation", construct: "response_degradation" },
  { id: "reviews-pop", source: "batreviews", key: "review_observation", value: "positive_contact_assessment", type: "subjective_observation", scope: "equipment", text: "The review reports strong pop as an observation.", authority: "observational", verification: "unverified_extracted", review: "review_pending", evidenceClass: "structured_human_evaluation", construct: "center_response_baseline" }
];

export function buildAtlasUsssaAcquisitionPilotGraph(): EquipmentClaimProvenanceGraph {
  const sources = [
    source("slugger", "Louisville Slugger", "manufacturer_primary"),
    source("direct", "Direct Sports", "retailer"),
    source("academy", "Academy Sports + Outdoors", "retailer"),
    source("batdigest", "BatDigest", "independent_expert_review"),
    source("batreviews", "BatReviews", "independent_expert_review")
  ];
  const documents = [
    document("slugger", "2026 Atlas (-10) USSSA product page", "https://www.slugger.com/en-us/product/atlas-usssa-10-2026-wbl4121", "product_page"),
    document("direct", "2026 Atlas (-10) USSSA listing", "https://www.directsports.com/products/2026-louisville-slugger-atlas-10-2-usssa-baseball-bat-wbl4121010", "retailer_page", "doc-slugger"),
    document("academy", "Louisville Slugger Atlas 2026 USSSA -10 listing", "https://www.academy.com/p/louisville-slugger-atlas-2026-usssa-baseball-bat-10", "retailer_page", "doc-slugger"),
    document("batdigest", "2026 Louisville Slugger Atlas Review", "https://batdigest.com/reviews/2026-louisville-slugger-atlas-review/", "review_article"),
    document("batreviews", "2026 Louisville Slugger Atlas USSSA Bat Review", "https://batreviews.com/reviews/2026-louisville-slugger-atlas-usssa/", "review_article")
  ];
  const identities = [targetIdentity, equipmentIdentity()];
  const rawClaims = claims.map(rawClaim);
  const normalizedClaims = claims.map(normalizedClaim);
  const dependencies = claims.map(dependency);
  const constructRelationships = claims.filter((claim) => claim.construct).map((claim) => ({
    id: `relationship-${claim.id}`, normalizedClaimId: `normalized-${claim.id}`, construct: claim.construct!,
    role: claim.type === "marketing_claim" ? "not_applicable" as const : "candidate_only" as const,
    mappingMethod: "keyword_candidate" as const, mappingVersion: "1.0", reviewState: claim.review ?? "review_not_required" as const,
    rationale: claim.type === "marketing_claim" ? "Marketing language cannot establish a behavioral construct." : "Unstructured editorial prose is a candidate relationship only.",
    limitations: ["No canonical or ordinal construct value is created."], constructValueCreated: false as const
  }));
  return {
    version: "1.0", sources, documents,
    extractionRuns: [
      { id: "extract-ai-source-confirmed", method: "ai_assisted", extractorType: "ai_model", extractorId: "openai-codex", extractorVersion: "2026-09", executedAt: retrievedAt, schemaVersion: "1.0", reviewState: "review_not_required" },
      { id: "extract-ai-pending", method: "ai_assisted", extractorType: "ai_model", extractorId: "openai-codex", extractorVersion: "2026-09", executedAt: retrievedAt, schemaVersion: "1.0", reviewState: "review_pending" }
    ],
    identities, rawClaims, normalizedClaims, dependencies, constructRelationships, modeledLineages: []
  };
}

export function buildAtlasUsssaAcquisitionPilotReport() {
  const graph = buildAtlasUsssaAcquisitionPilotGraph();
  const analysis = analyzeEquipmentClaimProvenance(graph);
  const assessments = graph.normalizedClaims.map((claim) => qualifyEquipmentClaim({ graph, normalizedClaimId: claim.id, targetIdentity }));
  const states = Object.fromEntries((["qualified", "context_only", "review_required", "not_eligible"] as const).map((state) => [state, assessments.filter((item) => item.state === state).length])) as Record<EquipmentClaimQualificationState, number>;
  const proposed = assessments.filter((item) => item.proposedEvidenceInput);
  const coverage = equipmentDNAConstructEvidenceMap.filter((item) => !item.canonicalAttribute && item.lifecycle !== "supported").map((item) => {
    const related = graph.constructRelationships.filter((relationship) => relationship.construct === item.construct);
    return { construct: item.construct, qualifiedDirect: 0, qualifiedSupporting: 0, contextOnly: related.filter((relationship) => assessments.find((assessment) => assessment.normalizedClaimId === relationship.normalizedClaimId)?.state === "context_only").length, noUsefulInformation: related.length === 0 };
  });
  return {
    version: ATLAS_USSSA_ACQUISITION_PILOT_VERSION,
    classification: "REAL SOURCE RESEARCH / NON-PERSISTED PILOT / NOT QUALIFIED PRODUCTION EQUIPMENT DNA",
    target: targetIdentity,
    sourceCount: graph.sources.length,
    sourceTypeCounts: count(graph.sources.map((item) => item.sourceType)),
    documentCount: analysis.documentCount,
    rawClaimCount: analysis.rawClaimCount,
    normalizedClaimCount: analysis.normalizedClaimCount,
    independentClaimGroupCount: analysis.independentClaimGroupCount,
    qualification: states,
    percentages: Object.fromEntries(Object.entries(states).map(([state, value]) => [state, Number(((value / assessments.length) * 100).toFixed(1))])),
    bySourceType: groupAssessments(graph, assessments, (claim) => graph.sources.find((sourceItem) => sourceItem.id === claim.sourceId)!.sourceType),
    byClaimType: groupAssessments(graph, assessments, (claim) => claim.claimType),
    byDependency: groupAssessments(graph, assessments, (claim) => graph.dependencies.find((item) => item.claimId === claim.id)?.dependencyType ?? "unknown_dependency"),
    proposedEvidenceCount: proposed.length,
    proposedEvidenceClasses: [...new Set(proposed.map((item) => item.proposedEvidenceClass).filter(Boolean))].sort(),
    catalogComparison: ["model: agreement", "model_year: agreement", "certification: agreement", "length: agreement", "nominal_weight: agreement", "drop: agreement", "barrel_diameter: agreement", "material: agreement", "construction: agreement"],
    conflicts: analysis.conflicts,
    constructCoverage: coverage,
    taxonomyConclusion: "SIX_CLASSES_SUFFICIENT_POLICY_NEEDS_EXPANSION" as const,
    qualificationPolicyConclusion: "QUALIFICATION_POLICY_REQUIRES_TARGETED_REFINEMENT" as const,
    schemaGaps: ["durable source and publisher identity", "document revisions and fingerprints", "raw and normalized claims", "identity assertions", "claim dependencies and independence groups", "review decisions", "AI extraction runs", "construct relationships"],
    automation: {
      READY_FOR_AUTOMATION: ["qualification", "conflict_detection", "proposed_evidence_generation"],
      AI_ASSISTED_REVIEW_REQUIRED: ["source_discovery", "document_capture", "identity_extraction", "claim_extraction", "claim_normalization", "marketing_classification", "dependency_detection", "identity_binding", "construct_relationship_mapping"],
      HUMAN_REVIEW_REQUIRED: ["source_authority_assessment"],
      NOT_READY: []
    },
    firewalls: { ...analysis.firewalls, databasePersistence: false, canonicalEvaluationsCreated: 0, recommendationChanges: 0, physicalEvidenceCreated: 0, modeledEvidenceCreated: 0 }
  };
}

function source(id: string, displayName: string, sourceType: EquipmentSourceType) { return { id: `source-${id}`, displayName, sourceType, publisherIdentity: displayName, state: "active" as const, version: "1.0" }; }
function document(id: string, title: string, sourceReference: string, documentType: "product_page" | "retailer_page" | "review_article", upstreamDocumentId?: string) { return { id: `doc-${id}`, sourceId: `source-${id}`, documentType, sourceReference, title, retrievedAt, modelYear: 2026, revision: "retrieved-2026-09-10", contentFingerprint: `ticket-071-${id}-v1`, upstreamDocumentId, availability: "available" as const }; }
function equipmentIdentity(): EquipmentClaimIdentityAssertion { return { ...targetIdentity, id: "atlas-usssa-2026-family", certainty: "equipment_model_match", equipmentVariantId: undefined, lengthInches: undefined, weightOunces: undefined, sku: undefined, limitations: ["Product-family or drop-family scope; not represented as exact-variant evidence."] }; }
function rawClaim(claim: PilotClaim): EquipmentSourceClaim { const pending = claim.review === "review_pending"; return { id: `claim-${claim.id}`, sourceId: `source-${claim.source}`, documentId: `doc-${claim.source}`, sourceLocation: "product or review body", rawText: claim.text, claimType: claim.type, identityAssertionId: claim.scope === "variant" ? targetIdentity.id : "atlas-usssa-2026-family", extractionRunId: pending ? "extract-ai-pending" : "extract-ai-source-confirmed", verificationState: claim.verification ?? "source_confirmed", reviewState: claim.review ?? "review_not_required", independenceGroupId: claim.source === "slugger" || claim.source === "direct" || claim.source === "academy" ? "lineage-slugger-product-copy" : `lineage-${claim.source}`, authority: claim.authority, authorityRationale: claim.source === "slugger" ? "Primary only for identity, component, and factual product specifications." : claim.source === "direct" || claim.source === "academy" ? "Retailer authority is secondary and dependency-sensitive." : "Editorial observation is observational, not measurement authority.", limitations: ["Real-source pilot fixture; paraphrased and non-persisted."] }; }
function normalizedClaim(claim: PilotClaim): EquipmentNormalizedClaim { return { id: `normalized-${claim.id}`, rawClaimId: `claim-${claim.id}`, claimKey: claim.type === "subjective_observation" && claim.construct ? `review_${claim.construct}` : claim.key, normalizedValue: claim.value, normalizedUnit: claim.unit, originalValue: claim.text, normalizationMethod: typeof claim.value === "string" ? "controlled_vocabulary" : "identity", normalizationVersion: "1.0", evidenceClass: claim.evidenceClass ?? "verified_catalog_fact", verificationState: claim.verification ?? "source_confirmed", reviewState: claim.review ?? "review_not_required", identityAssertionId: claim.scope === "variant" ? targetIdentity.id : "atlas-usssa-2026-family", limitations: ["Normalization creates no behavioral score, ordinal, or canonical value."] }; }
function dependency(claim: PilotClaim): EquipmentClaimDependency { const retailer = claim.source === "direct" || claim.source === "academy"; return { id: `dependency-${claim.id}`, claimId: `claim-${claim.id}`, upstreamClaimId: retailer ? upstreamFor(claim) : undefined, dependencyType: retailer ? "shared_upstream" : claim.source === "slugger" ? "original" : claim.source === "batdigest" ? "independent_observation" : "unknown_dependency", dependencyRationale: retailer ? "Wording and fact selection substantially track manufacturer product copy; treated as one lineage." : claim.source === "slugger" ? "Original manufacturer page." : claim.source === "batdigest" ? "Editorial methodology and observation are presented independently, without proving laboratory rigor." : "Editorial independence was not sufficiently established during the bounded pilot.", reviewedState: claim.review ?? "review_not_required" }; }
function upstreamFor(claim: PilotClaim) { if (claim.key === "certification") return "claim-cert"; if (claim.key === "barrel_diameter") return "claim-barrel"; if (claim.key === "construction") return "claim-construction"; if (claim.construct === "usable_contact_region_breadth") return "claim-sweet-marketing"; return "claim-tmd"; }
function count(values: readonly string[]) { return Object.fromEntries([...new Set(values)].sort().map((key) => [key, values.filter((value) => value === key).length])); }
function groupAssessments(graph: EquipmentClaimProvenanceGraph, assessments: readonly ReturnType<typeof qualifyEquipmentClaim>[], key: (claim: EquipmentSourceClaim) => string) { const rows = graph.rawClaims.map((claim) => ({ key: key(claim), state: assessments.find((item) => item.rawClaimId === claim.id)!.state })); return Object.fromEntries([...new Set(rows.map((row) => row.key))].sort().map((group) => [group, count(rows.filter((row) => row.key === group).map((row) => row.state))])); }
