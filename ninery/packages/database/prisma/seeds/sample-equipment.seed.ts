import { prisma } from "./client.ts";

const bats = [
  ["Louisville Slugger", "Meta", 2026, "USA", "composite", "two-piece", "2.63", "LS-META-29-19", "29.0", "19.0", -10, "399.99"],
  ["Marucci", "CATX2", 2026, "USSSA", "alloy", "one-piece", "2.75", "MAR-CATX2-30-20", "30.0", "20.0", -10, "279.99"],
  ["Warstic", "Bonesaber", 2026, "USA", "alloy", "one-piece", "2.63", "WAR-BONE-30-20", "30.0", "20.0", -10, "249.99"],
  ["Easton", "Hype Fire", 2026, "USSSA", "composite", "two-piece", "2.75", "EAS-HF-29-19", "29.0", "19.0", -10, "349.99"],
  ["DeMarini", "The Goods", 2026, "BBCOR", "alloy", "hybrid", "2.63", "DEM-GOODS-32-29", "32.0", "29.0", -3, "399.99"]
].map(([manufacturer, model, modelYear, certification, material, construction, barrelDiameter, sku, lengthInches, weightOunces, dropWeight, msrp]) => ({
  manufacturer,
  model,
  modelYear,
  certification,
  material,
  construction,
  barrelDiameter,
  sku,
  lengthInches,
  weightOunces,
  dropWeight,
  msrp
}));

const scoreCodes = [
  "bat-control",
  "swing-balance",
  "swing-weight",
  "sweet-spot-size",
  "barrel-forgiveness",
  "power-potential",
  "confidence-building",
  "transition-friendliness"
];

async function upsertEquipment(bat) {
  let equipment = await prisma.equipment.findFirst({
    where: {
      manufacturer: bat.manufacturer,
      model: bat.model,
      modelYear: bat.modelYear
    }
  });

  const equipmentData = {
    manufacturer: bat.manufacturer,
    model: bat.model,
    modelYear: bat.modelYear,
    category: "bat",
    certification: bat.certification,
    material: bat.material,
    construction: bat.construction,
    barrelDiameter: bat.barrelDiameter,
    status: "active"
  };

  equipment = equipment
    ? await prisma.equipment.update({ where: { id: equipment.id }, data: equipmentData })
    : await prisma.equipment.create({ data: equipmentData });

  await prisma.equipmentVariant.upsert({
    where: { sku: bat.sku },
    update: {
      equipmentId: equipment.id,
      lengthInches: bat.lengthInches,
      weightOunces: bat.weightOunces,
      dropWeight: bat.dropWeight,
      msrp: bat.msrp
    },
    create: {
      equipmentId: equipment.id,
      lengthInches: bat.lengthInches,
      weightOunces: bat.weightOunces,
      dropWeight: bat.dropWeight,
      msrp: bat.msrp,
      sku: bat.sku
    }
  });

  let dnaProfile = await prisma.equipmentDNAProfile.findFirst({
    where: {
      equipmentId: equipment.id,
      version: 1
    }
  });

  dnaProfile = dnaProfile
    ? await prisma.equipmentDNAProfile.update({
        where: { id: dnaProfile.id },
        data: {
          certificationLevel: "gold",
          confidenceScore: "high",
          status: "active",
          publishedAt: new Date("2026-07-01T12:00:00.000Z")
        }
      })
    : await prisma.equipmentDNAProfile.create({
        data: {
          equipmentId: equipment.id,
          version: 1,
          certificationLevel: "gold",
          confidenceScore: "high",
          status: "active",
          publishedAt: new Date("2026-07-01T12:00:00.000Z")
        }
      });

  for (let index = 0; index < scoreCodes.length; index++) {
    const characteristic = await prisma.equipmentCharacteristic.findUnique({ where: { code: scoreCodes[index] } });
    if (characteristic) {
      await prisma.equipmentDNAScore.upsert({
        where: {
          dnaProfileId_characteristicId: {
            dnaProfileId: dnaProfile.id,
            characteristicId: characteristic.id
          }
        },
        update: {
          score: String(7.2 + index * 0.2),
          confidence: "high",
          evidenceLevel: "internal_review",
          rationale: "Demo MVP equipment DNA score."
        },
        create: {
          dnaProfileId: dnaProfile.id,
          characteristicId: characteristic.id,
          score: String(7.2 + index * 0.2),
          confidence: "high",
          evidenceLevel: "internal_review",
          rationale: "Demo MVP equipment DNA score."
        }
      });
    }
  }
}

export async function seed() {
  for (const bat of bats) {
    await upsertEquipment(bat);
  }
}

export async function clear() {
  for (const bat of bats) {
    const equipment = await prisma.equipment.findFirst({
      where: {
        manufacturer: bat.manufacturer,
        model: bat.model,
        modelYear: bat.modelYear
      }
    });

    if (equipment) {
      await prisma.equipment.delete({ where: { id: equipment.id } });
    }
  }
}
