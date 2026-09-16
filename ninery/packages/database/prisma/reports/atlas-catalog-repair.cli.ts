import {
  ATLAS_USSSA_INTERNAL_SKU,
  ATLAS_USSSA_MANUFACTURER_FAMILY_ID,
  ATLAS_USSSA_SIZE_IDENTIFIER,
  HISTORICAL_ATLAS_USA_EQUIPMENT_ID,
  HISTORICAL_ATLAS_USA_VARIANT_ID,
  atlasUsssaCatalogIdentity,
  planAtlasUsssaCatalogRepair,
  type AtlasCatalogIdentity
} from "../../../equipment-intelligence/src/catalog-integrity/index.ts";
import { prisma } from "../seeds/client.ts";

const confirmed = process.argv.slice(2).includes("--confirm");

try {
  const inventory = await loadInventory();
  const plan = planAtlasUsssaCatalogRepair(inventory);
  printPlan(plan, confirmed);

  if (!confirmed || plan.status !== "ready_to_create") {
    if (confirmed && plan.status === "blocked") process.exitCode = 1;
  } else {
    const created = await prisma.$transaction(async (tx) => {
      const equipment = await tx.equipment.create({
        data: {
          manufacturer: atlasUsssaCatalogIdentity.manufacturer,
          model: atlasUsssaCatalogIdentity.model,
          modelYear: atlasUsssaCatalogIdentity.modelYear,
          category: "bat",
          certification: atlasUsssaCatalogIdentity.certification,
          material: atlasUsssaCatalogIdentity.material,
          construction: atlasUsssaCatalogIdentity.construction,
          barrelDiameter: atlasUsssaCatalogIdentity.barrelDiameter,
          status: "active"
        }
      });
      const variant = await tx.equipmentVariant.create({
        data: {
          equipmentId: equipment.id,
          lengthInches: atlasUsssaCatalogIdentity.lengthInches,
          weightOunces: atlasUsssaCatalogIdentity.weightOunces,
          dropWeight: atlasUsssaCatalogIdentity.dropWeight,
          sku: atlasUsssaCatalogIdentity.sku
        }
      });
      await tx.equipmentSpecification.createMany({
        data: [
          { equipmentId: equipment.id, specificationCode: "certification", valueText: "USSSA", source: "ticket-071b-catalog-identity-repair" },
          { equipmentId: equipment.id, specificationCode: "material", valueText: "alloy", source: "ticket-071b-catalog-identity-repair" },
          { equipmentId: equipment.id, specificationCode: "construction", valueText: "one-piece", source: "ticket-071b-catalog-identity-repair" },
          { equipmentId: equipment.id, specificationCode: "barrel_diameter", valueNumber: 2.75, unit: "in", source: "ticket-071b-catalog-identity-repair" }
        ]
      });
      return { equipment, variant };
    });
    console.log(`Created Equipment ID: ${created.equipment.id}`);
    console.log(`Created Variant ID: ${created.variant.id}`);
    console.log("Transaction result: committed");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

async function loadInventory() {
  const [historicalEquipment, historicalVariant, matchingRows, skuOwner] = await Promise.all([
    prisma.equipment.findUnique({ where: { id: HISTORICAL_ATLAS_USA_EQUIPMENT_ID } }),
    prisma.equipmentVariant.findUnique({ where: { id: HISTORICAL_ATLAS_USA_VARIANT_ID } }),
    prisma.equipment.findMany({
      where: { manufacturer: "Louisville Slugger", model: "Atlas", modelYear: 2026, certification: "USSSA" },
      include: { variants: true }
    }),
    prisma.equipmentVariant.findUnique({ where: { sku: ATLAS_USSSA_INTERNAL_SKU } })
  ]);
  const matchingEquipment: AtlasCatalogIdentity[] = matchingRows.map((equipment) => {
    const variant = equipment.variants.find((candidate) =>
      Number(candidate.lengthInches) === 30 && Number(candidate.weightOunces) === 20 && candidate.dropWeight === -10
    );
    return {
      equipmentId: equipment.id,
      variantId: variant?.id,
      manufacturer: equipment.manufacturer,
      model: equipment.model,
      modelYear: 2026,
      certification: equipment.certification,
      material: equipment.material ?? "",
      construction: equipment.construction ?? "",
      barrelDiameter: Number(equipment.barrelDiameter),
      lengthInches: Number(variant?.lengthInches),
      weightOunces: Number(variant?.weightOunces),
      dropWeight: variant?.dropWeight ?? Number.NaN,
      sku: variant?.sku ?? ""
    };
  });
  return {
    historicalEquipmentExists: Boolean(historicalEquipment),
    historicalVariantExists: Boolean(historicalVariant),
    matchingEquipment,
    skuOwner: skuOwner ? { equipmentId: skuOwner.equipmentId, variantId: skuOwner.id } : undefined
  };
}

function printPlan(plan: ReturnType<typeof planAtlasUsssaCatalogRepair>, isConfirmed: boolean) {
  console.log("Atlas Catalog Identity Repair v1.0");
  console.log(`Mode: ${isConfirmed ? "confirmed" : "dry-run"}`);
  console.log(`Status: ${plan.status}`);
  console.log(`Historical Equipment ${HISTORICAL_ATLAS_USA_EQUIPMENT_ID}: unchanged`);
  console.log(`Historical Variant ${HISTORICAL_ATLAS_USA_VARIANT_ID}: unchanged`);
  console.log("New identity:");
  console.log("- Louisville Slugger Atlas 2026 USSSA");
  console.log("- 30 in / 20 oz / -10");
  console.log("- 2.75 in barrel / alloy / one-piece");
  console.log(`- Internal SKU: ${ATLAS_USSSA_INTERNAL_SKU}`);
  console.log(`External family ID (not persisted): ${ATLAS_USSSA_MANUFACTURER_FAMILY_ID}`);
  console.log(`External size ID (not persisted): ${ATLAS_USSSA_SIZE_IDENTIFIER}`);
  console.log(
    plan.status === "ready_to_create"
      ? "Catalog specifications to create: certification, material, construction, barrel_diameter"
      : "Catalog specifications already present: certification, material, construction, barrel_diameter"
  );
  console.log("Behavioral, evidence, canonical, recommendation, fit, personality, and study records to create: 0");
  if (plan.blockers.length) console.log(`Blockers: ${plan.blockers.join(", ")}`);
  if (plan.status === "no_changes_required") console.log("Writes performed: no changes required");
  else if (!isConfirmed) console.log("Writes performed: no (pass --confirm to create atomically)");
}
