export const ATLAS_USSSA_CATALOG_REPAIR_VERSION = "1.0";
export const HISTORICAL_ATLAS_USA_EQUIPMENT_ID = "66f59356-029f-4df7-9177-0d0f36ef3e9c";
export const HISTORICAL_ATLAS_USA_VARIANT_ID = "a485a596-ea15-4622-ac2e-452b7fd9c934";
export const ATLAS_USSSA_INTERNAL_SKU = "LS-ATLAS-USSSA-30-20";
export const ATLAS_USSSA_MANUFACTURER_FAMILY_ID = "WBL4121010";
export const ATLAS_USSSA_SIZE_IDENTIFIER = "WBL41210102030";

export type AtlasCatalogIdentity = {
  readonly equipmentId?: string;
  readonly variantId?: string;
  readonly manufacturer: string;
  readonly model: string;
  readonly modelYear: number;
  readonly certification: string;
  readonly material: string;
  readonly construction: string;
  readonly barrelDiameter: number;
  readonly lengthInches: number;
  readonly weightOunces: number;
  readonly dropWeight: number;
  readonly sku: string;
};

export const atlasUsssaCatalogIdentity: AtlasCatalogIdentity = {
  manufacturer: "Louisville Slugger",
  model: "Atlas",
  modelYear: 2026,
  certification: "USSSA",
  material: "alloy",
  construction: "one-piece",
  barrelDiameter: 2.75,
  lengthInches: 30,
  weightOunces: 20,
  dropWeight: -10,
  sku: ATLAS_USSSA_INTERNAL_SKU
};

export type AtlasCatalogRepairInventory = {
  readonly historicalEquipmentExists: boolean;
  readonly historicalVariantExists: boolean;
  readonly matchingEquipment: readonly AtlasCatalogIdentity[];
  readonly skuOwner?: { readonly equipmentId: string; readonly variantId: string };
};

export type AtlasCatalogRepairPlan = {
  readonly version: typeof ATLAS_USSSA_CATALOG_REPAIR_VERSION;
  readonly status: "ready_to_create" | "no_changes_required" | "blocked";
  readonly writesAllowed: false;
  readonly historicalRecordAction: "unchanged";
  readonly proposedIdentity: AtlasCatalogIdentity;
  readonly blockers: readonly string[];
  readonly reasons: readonly string[];
};

export function planAtlasUsssaCatalogRepair(inventory: AtlasCatalogRepairInventory): AtlasCatalogRepairPlan {
  const blockers: string[] = [];
  if (!inventory.historicalEquipmentExists) blockers.push("historical_equipment_missing");
  if (!inventory.historicalVariantExists) blockers.push("historical_variant_missing");
  if (inventory.matchingEquipment.length > 1) blockers.push("duplicate_corrected_equipment");
  if (inventory.skuOwner && !inventory.matchingEquipment.some((item) => item.variantId === inventory.skuOwner?.variantId)) {
    blockers.push("internal_sku_conflict");
  }

  const existing = inventory.matchingEquipment[0];
  const completeMatch = existing ? identitiesMatch(existing, atlasUsssaCatalogIdentity) : false;
  if (existing && !completeMatch) blockers.push("existing_corrected_identity_mismatch");

  return {
    version: ATLAS_USSSA_CATALOG_REPAIR_VERSION,
    status: blockers.length ? "blocked" : completeMatch ? "no_changes_required" : "ready_to_create",
    writesAllowed: false,
    historicalRecordAction: "unchanged",
    proposedIdentity: existing ?? atlasUsssaCatalogIdentity,
    blockers: [...blockers].sort(),
    reasons: [
      "The corrected USSSA catalog identity is additive.",
      "Historical Atlas USA equipment, variants, evidence, evaluations, recommendations, and studies remain attached to their original UUIDs.",
      "Manufacturer identifiers remain audit metadata because the current schema has no dedicated identifier fields.",
      "No behavioral or canonical intelligence is created or copied."
    ]
  };
}

export function identitiesMatch(actual: AtlasCatalogIdentity, expected: AtlasCatalogIdentity): boolean {
  return actual.manufacturer === expected.manufacturer
    && actual.model === expected.model
    && actual.modelYear === expected.modelYear
    && actual.certification === expected.certification
    && actual.material === expected.material
    && actual.construction === expected.construction
    && actual.barrelDiameter === expected.barrelDiameter
    && actual.lengthInches === expected.lengthInches
    && actual.weightOunces === expected.weightOunces
    && actual.dropWeight === expected.dropWeight
    && actual.sku === expected.sku;
}
