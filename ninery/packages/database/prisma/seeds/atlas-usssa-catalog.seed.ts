import { atlasUsssaCatalogIdentity } from "../../../equipment-intelligence/src/catalog-integrity/index.ts";
import { prisma } from "./client.ts";

const identity = atlasUsssaCatalogIdentity;

export async function seed() {
  const existing = await prisma.equipment.findFirst({
    where: {
      manufacturer: identity.manufacturer,
      model: identity.model,
      modelYear: identity.modelYear,
      certification: identity.certification
    },
    include: { variants: true }
  });

  if (existing) {
    const matchingVariant = existing.variants.find((variant) => variant.sku === identity.sku);
    if (!matchingVariant) {
      throw new Error("Atlas USSSA equipment exists without the expected internal SKU; run the catalog repair audit.");
    }
    return;
  }

  const skuOwner = await prisma.equipmentVariant.findUnique({ where: { sku: identity.sku } });
  if (skuOwner) throw new Error("Atlas USSSA internal SKU is already attached to another equipment record.");

  await prisma.$transaction(async (tx) => {
    const equipment = await tx.equipment.create({
      data: {
        manufacturer: identity.manufacturer,
        model: identity.model,
        modelYear: identity.modelYear,
        category: "bat",
        certification: identity.certification,
        material: identity.material,
        construction: identity.construction,
        barrelDiameter: identity.barrelDiameter,
        status: "active"
      }
    });
    await tx.equipmentVariant.create({
      data: {
        equipmentId: equipment.id,
        lengthInches: identity.lengthInches,
        weightOunces: identity.weightOunces,
        dropWeight: identity.dropWeight,
        sku: identity.sku
      }
    });
    await tx.equipmentSpecification.createMany({
      data: [
        { equipmentId: equipment.id, specificationCode: "certification", valueText: identity.certification, source: "ticket-071b-catalog-identity-repair" },
        { equipmentId: equipment.id, specificationCode: "material", valueText: identity.material, source: "ticket-071b-catalog-identity-repair" },
        { equipmentId: equipment.id, specificationCode: "construction", valueText: identity.construction, source: "ticket-071b-catalog-identity-repair" },
        { equipmentId: equipment.id, specificationCode: "barrel_diameter", valueNumber: identity.barrelDiameter, unit: "in", source: "ticket-071b-catalog-identity-repair" }
      ]
    });
  });
}

export async function clear() {
  const equipment = await prisma.equipment.findFirst({
    where: {
      manufacturer: identity.manufacturer,
      model: identity.model,
      modelYear: identity.modelYear,
      certification: identity.certification
    }
  });
  if (equipment) await prisma.equipment.delete({ where: { id: equipment.id } });
}
