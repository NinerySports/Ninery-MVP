import type { ExternalClaimIngestionInput } from "./external-claim-ingestion.js";

export const ATLAS_USSSA_PRODUCTION_EQUIPMENT_ID = "748ae67e-0b10-40d6-8ef6-28d6953d1d40";
export const ATLAS_USSSA_PRODUCTION_VARIANT_ID = "0844a8e0-8b9a-42ba-9b6f-50f288832e58";
export const ATLAS_USSSA_CAPTURE_DATE = new Date("2026-09-10T00:00:00.000Z");

const target = { id: "atlas-usssa-production-target", certainty: "exact_variant_match" as const, manufacturer: "Louisville Slugger", model: "Atlas", modelYear: 2026, certification: "USSSA", lengthInches: 30, weightOunces: 20, drop: -10, sku: "LS-ATLAS-USSSA-30-20", manufacturerProductId: "WBL41210102030", equipmentId: ATLAS_USSSA_PRODUCTION_EQUIPMENT_ID, equipmentVariantId: ATLAS_USSSA_PRODUCTION_VARIANT_ID, limitations: ["Clean Ticket #071B catalog identity."] };

/** Captured real-source inputs are bounded paraphrases with provenance, not retained page copies. */
export function buildAtlasUsssaProductionCaptureInputs(): readonly ExternalClaimIngestionInput[] {
  return [
    captured("slugger", "Louisville Slugger", "manufacturer_primary", "https://www.slugger.com/en-us/product/atlas-usssa-10-2026-wbl4121", "2026 Atlas (-10) USSSA product page", "Manufacturer specifications identify the Atlas USSSA -10 family and a 30-inch size.", {
      externalClaimKey: "manufacturer-length-30", rawText: "A 30-inch size is offered.", claimType: "factual_specification", authority: "authoritative", authorityRationale: "Primary manufacturer product specification.", identity: target,
      normalization: { claimKey: "nominal_length", value: 30, unit: "in", originalValue: "30-inch", method: "unit_conversion", version: "1.0", vocabularyKnown: true, evidenceClass: "verified_catalog_fact" }, dependency: { type: "original", rationale: "Primary publisher source." }
    }),
    captured("direct-sports", "Direct Sports", "retailer", "https://www.directsports.com/products/2026-louisville-slugger-atlas-10-2-usssa-baseball-bat-wbl4121010", "2026 Atlas USSSA retailer listing", "Retail listing repeats the Atlas USSSA certification and product-family facts.", {
      externalClaimKey: "direct-certification", rawText: "Retail listing identifies USSSA.", claimType: "certification_claim", authority: "secondary", authorityRationale: "Retailer listing; manufacturer lineage requires review.", identity: { ...target, certainty: "equipment_model_match", equipmentVariantId: undefined },
      normalization: { claimKey: "certification", value: "USSSA", method: "controlled_vocabulary", version: "1.0", vocabularyKnown: true, evidenceClass: "verified_catalog_fact" }, dependency: { type: "suspected_dependency", rationale: "Retail copy appears to reproduce manufacturer catalog facts." }
    }),
    captured("academy", "Academy Sports + Outdoors", "retailer", "https://www.academy.com/p/louisville-slugger-atlas-2026-usssa-baseball-bat-10", "2026 Atlas USSSA retailer listing", "Retail specifications identify a 2.75-inch barrel.", {
      externalClaimKey: "academy-barrel", rawText: "Retail specifications list a 2.75-inch barrel.", claimType: "factual_specification", authority: "secondary", authorityRationale: "Retailer specification; source lineage remains unresolved.", identity: { ...target, certainty: "equipment_model_match", equipmentVariantId: undefined },
      normalization: { claimKey: "barrel_diameter", value: 2.75, unit: "in", method: "unit_conversion", version: "1.0", vocabularyKnown: true, evidenceClass: "verified_catalog_fact" }, dependency: { type: "suspected_dependency", rationale: "Possible manufacturer syndication is not independently proven." }
    }),
    captured("batdigest", "BatDigest", "independent_expert_review", "https://batdigest.com/reviews/2026-louisville-slugger-atlas-review/", "2026 Louisville Slugger Atlas Review", "Editorial testing characterizes the USSSA drop-ten family as light swinging.", {
      externalClaimKey: "batdigest-light-swing", rawText: "The USSSA drop-ten family is characterized as light swinging.", claimType: "subjective_observation", authority: "observational", authorityRationale: "Unstructured editorial observation, not measurement authority.", identity: { ...target, certainty: "equipment_model_match", equipmentVariantId: undefined },
      normalization: { claimKey: "review_startup_demand", value: "light_swing", method: "controlled_vocabulary", version: "1.0", vocabularyKnown: true, evidenceClass: "verified_catalog_fact" }, dependency: { type: "unknown_dependency", rationale: "Publisher independence has not received a human assessment." },
      construct: { proposedConstruct: "startup_demand", method: "keyword_candidate", confidence: "medium", version: "1.0", rationale: "Candidate semantic relationship only." }
    }),
    captured("batreviews", "BatReviews", "independent_expert_review", "https://batreviews.com/reviews/2026-louisville-slugger-atlas-usssa/", "2026 Atlas USSSA Bat Review", "Editorial prose characterizes the bat as forgiving.", {
      externalClaimKey: "batreviews-forgiving", rawText: "The review characterizes the bat as forgiving.", claimType: "subjective_observation", authority: "observational", authorityRationale: "Unstructured editorial observation, not structured evaluation.", identity: { ...target, certainty: "equipment_model_match", equipmentVariantId: undefined },
      normalization: { claimKey: "review_response_degradation", value: "forgiving", method: "manual_interpretation", version: "1.0", vocabularyKnown: false, evidenceClass: "verified_catalog_fact" }, dependency: { type: "unknown_dependency", rationale: "Independence is unresolved." },
      construct: { proposedConstruct: "response_degradation", method: "keyword_candidate", confidence: "low", version: "1.0", rationale: "Novel editorial terminology requires construct review." }
    })
  ];
}

function captured(key: string, displayName: string, sourceType: ExternalClaimIngestionInput["source"]["sourceType"], reference: string, title: string, boundedContent: string, claim: ExternalClaimIngestionInput["claims"][number]): ExternalClaimIngestionInput {
  return {
    source: { stableKey: `atlas-usssa:${key}`, displayName, sourceType, publisherIdentity: displayName, sourceVersion: "captured-2026-09-10" },
    document: { sourceReference: reference, documentType: sourceType === "retailer" ? "retailer_page" : sourceType === "manufacturer_primary" ? "product_page" : "review_article", title, capturedAt: ATLAS_USSSA_CAPTURE_DATE, modelYear: 2026, availability: "available", boundedContent },
    extraction: { method: "ai_assisted", extractorType: "ai_model", extractorId: "ninery-claim-extractor", extractorVersion: "1.0", schemaVersion: "1.0", providerModelId: "captured-run-model-unspecified", executedAt: new Date("2026-09-16T00:00:00.000Z") },
    targetIdentity: target,
    claims: [claim]
  };
}
