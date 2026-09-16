import assert from "node:assert/strict";
import test from "node:test";
import {
  ATLAS_USSSA_INTERNAL_SKU,
  HISTORICAL_ATLAS_USA_EQUIPMENT_ID,
  HISTORICAL_ATLAS_USA_VARIANT_ID,
  atlasUsssaCatalogIdentity,
  planAtlasUsssaCatalogRepair
} from "../catalog-integrity/index.js";

const inventory = {
  historicalEquipmentExists: true,
  historicalVariantExists: true,
  matchingEquipment: []
} as const;

test("plans a distinct additive USSSA identity without authorizing writes", () => {
  const plan = planAtlasUsssaCatalogRepair(inventory);
  assert.equal(plan.status, "ready_to_create");
  assert.equal(plan.writesAllowed, false);
  assert.equal(plan.historicalRecordAction, "unchanged");
  assert.equal(plan.proposedIdentity.certification, "USSSA");
  assert.equal(plan.proposedIdentity.sku, ATLAS_USSSA_INTERNAL_SKU);
});

test("preserves exact factual identity and does not carry behavioral fields", () => {
  assert.deepEqual(atlasUsssaCatalogIdentity, {
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
    sku: "LS-ATLAS-USSSA-30-20"
  });
  assert.equal("scores" in atlasUsssaCatalogIdentity, false);
  assert.equal("evidence" in atlasUsssaCatalogIdentity, false);
});

test("historical UUIDs remain separate from the proposed identity", () => {
  assert.notEqual(atlasUsssaCatalogIdentity.equipmentId, HISTORICAL_ATLAS_USA_EQUIPMENT_ID);
  assert.notEqual(atlasUsssaCatalogIdentity.variantId, HISTORICAL_ATLAS_USA_VARIANT_ID);
});

test("exact replay is idempotent", () => {
  const existing = { ...atlasUsssaCatalogIdentity, equipmentId: "new-equipment", variantId: "new-variant" };
  const plan = planAtlasUsssaCatalogRepair({ ...inventory, matchingEquipment: [existing], skuOwner: { equipmentId: "new-equipment", variantId: "new-variant" } });
  assert.equal(plan.status, "no_changes_required");
  assert.deepEqual(plan.blockers, []);
});

test("duplicate corrected equipment blocks creation", () => {
  const existing = { ...atlasUsssaCatalogIdentity, equipmentId: "one", variantId: "variant-one" };
  const plan = planAtlasUsssaCatalogRepair({ ...inventory, matchingEquipment: [existing, { ...existing, equipmentId: "two", variantId: "variant-two" }] });
  assert.equal(plan.status, "blocked");
  assert.ok(plan.blockers.includes("duplicate_corrected_equipment"));
});

test("conflicting internal SKU blocks creation", () => {
  const plan = planAtlasUsssaCatalogRepair({ ...inventory, skuOwner: { equipmentId: "other", variantId: "other-variant" } });
  assert.equal(plan.status, "blocked");
  assert.ok(plan.blockers.includes("internal_sku_conflict"));
});

test("a partial or mismatched corrected identity blocks mutation", () => {
  const mismatched = { ...atlasUsssaCatalogIdentity, equipmentId: "existing", variantId: "variant", barrelDiameter: 2.63 };
  const plan = planAtlasUsssaCatalogRepair({ ...inventory, matchingEquipment: [mismatched] });
  assert.equal(plan.status, "blocked");
  assert.ok(plan.blockers.includes("existing_corrected_identity_mismatch"));
});

test("missing historical anchors fail closed", () => {
  const plan = planAtlasUsssaCatalogRepair({ historicalEquipmentExists: false, historicalVariantExists: false, matchingEquipment: [] });
  assert.deepEqual(plan.blockers, ["historical_equipment_missing", "historical_variant_missing"]);
});
