import type { RealWorldEquipmentOnboardingPacket } from "./real-world-equipment-onboarding.types.js";
import type { EquipmentDNAAttributeKey } from "../attributes/index.js";

export const DEMARINI_THE_GOODS_2023_USA_30_20_SKU = "DEM-THE-GOODS-USA-30-20";

export const demariniTheGoods2023UsaOnboardingPacket = {
  version: "1.0",
  productKey: "demarini-the-goods-2023-usa-wbd2359010",
  manufacturer: "DeMarini",
  model: "The Goods",
  displayName: "2023 DeMarini The Goods (-10) USA",
  modelYear: 2023,
  category: "bat",
  certification: "USA",
  status: "coming_soon",
  barrelDiameter: 2.625,
  construction: "two-piece hybrid",
  material: "hybrid",
  productIdentifier: "WBD2359010",
  constructionFamily: "Half + Half",
  barrel: "X14 Alloy",
  handle: "Paraflex Plus Composite",
  connection: "Type V Connection",
  endCap: "Tracer End Cap",
  variants: [
    {
      sku: DEMARINI_THE_GOODS_2023_USA_30_20_SKU,
      lengthInches: 30,
      weightOunces: 20,
      dropWeight: -10,
      modelIdentifier: "WBD2359010"
    }
  ],
  evidence: [
    {
      evidenceKey: "product_identity",
      classification: "manufacturer_specification",
      nature: "objective",
      sourceName: "Ticket #045 implementation packet",
      sourceReference: "ticket-045:demarini-the-goods-2023-usa:product_identity",
      method: "direct_specification",
      rawValue: "WBD2359010",
      normalizedValue: "WBD2359010",
      notes: "Internal onboarding packet supplied for Ticket #045."
    },
    objective("certification", "certification", "USA", "USA Baseball / USABat approval recorded in the Ticket #045 implementation packet."),
    objective("barrel_diameter", "barrel_diameter", 2.625, "2 5/8 inch barrel diameter recorded in the Ticket #045 implementation packet.", "inches"),
    objective("construction", "construction", "hybrid", "Two-piece hybrid / Half + Half construction recorded in the Ticket #045 implementation packet."),
    objective("material", "material", "hybrid", "X14 Alloy barrel and Paraflex Plus Composite handle support a hybrid material classification."),
    objective("length", "length", 30, "30 inch variant recorded in the Ticket #045 implementation packet.", "inches", DEMARINI_THE_GOODS_2023_USA_30_20_SKU),
    objective("weight", "weight", 20, "20 ounce listed weight recorded in the Ticket #045 implementation packet.", "ounces", DEMARINI_THE_GOODS_2023_USA_30_20_SKU),
    objective("drop", "drop", -10, "Signed -10 drop recorded in the Ticket #045 implementation packet.", "drop", DEMARINI_THE_GOODS_2023_USA_30_20_SKU)
  ]
} as const satisfies RealWorldEquipmentOnboardingPacket;

function objective(
  evidenceKey: string,
  attributeKey: EquipmentDNAAttributeKey,
  normalizedValue: string | number,
  notes: string,
  unit?: string,
  variantSku?: string
) {
  return {
    evidenceKey,
    classification: "manufacturer_specification",
    nature: "objective",
    sourceName: "Ticket #045 implementation packet",
    sourceReference: `ticket-045:demarini-the-goods-2023-usa:${evidenceKey}`,
    method: "direct_specification",
    attributeKey,
    targetLevel: variantSku ? "variant" : "equipment",
    variantSku,
    rawValue: normalizedValue,
    normalizedValue,
    unit,
    confidence: "high",
    notes
  } as const;
}
