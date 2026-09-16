import { prisma } from "./client.ts";

const demoBats = [
  {
    manufacturer: "Rawlings",
    model: "ICON",
    modelYear: 2026,
    certification: "USA",
    material: "composite",
    construction: "two-piece",
    barrelDiameter: "2.63",
    personality: ["balanced-control", "Balanced Control", "Balanced, quick, confidence-oriented USA bat."],
    scores: {
      "bat-control": 9.1,
      "swing-balance": 8.9,
      "swing-weight": 4.2,
      "sweet-spot-size": 8.8,
      "barrel-forgiveness": 8.6,
      "power-potential": 8.4,
      "confidence-building": 9.0,
      "transition-friendliness": 8.2
    },
    variants: [
      ["RAW-ICON-USA-29-19", "29.0", "19.0", -10, "349.99"],
      ["RAW-ICON-USA-30-20", "30.0", "20.0", -10, "349.99"],
      ["RAW-ICON-USA-30-22", "30.0", "22.0", -8, "349.99"],
      ["RAW-ICON-USA-31-23", "31.0", "23.0", -8, "349.99"]
    ]
  },
  {
    manufacturer: "Easton",
    model: "Hype Fire",
    modelYear: 2026,
    certification: "USA",
    material: "composite",
    construction: "two-piece",
    barrelDiameter: "2.63",
    personality: ["explosive-barrel", "Explosive Barrel", "Power-forward profile with strong barrel performance."],
    scores: {
      "bat-control": 7.8,
      "swing-balance": 7.4,
      "swing-weight": 5.6,
      "sweet-spot-size": 9.1,
      "barrel-forgiveness": 8.8,
      "power-potential": 9.5,
      "confidence-building": 8.2,
      "transition-friendliness": 7.5
    },
    variants: [
      ["EAS-HYPE-USA-29-19", "29.0", "19.0", -10, "349.99"],
      ["EAS-HYPE-USA-30-20", "30.0", "20.0", -10, "349.99"],
      ["EAS-HYPE-USA-30-22", "30.0", "22.0", -8, "349.99"],
      ["EAS-HYPE-USA-31-23", "31.0", "23.0", -8, "349.99"]
    ]
  },
];

export async function seed() {
  for (const bat of demoBats) {
    await upsertDemoBat(bat);
  }
}

export async function clear() {
  for (const bat of demoBats) {
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

async function upsertDemoBat(bat: (typeof demoBats)[number]) {
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

  for (const [sku, lengthInches, weightOunces, dropWeight, msrp] of bat.variants) {
    await prisma.equipmentVariant.upsert({
      where: { sku },
      update: {
        equipmentId: equipment.id,
        lengthInches,
        weightOunces,
        dropWeight,
        msrp
      },
      create: {
        equipmentId: equipment.id,
        lengthInches,
        weightOunces,
        dropWeight,
        msrp,
        sku
      }
    });
  }

  const dnaProfile = await upsertDNAProfile(equipment.id);
  await upsertScores(dnaProfile.id, bat.scores);
  await upsertSpecifications(equipment.id, bat);
  await upsertPersonality(equipment.id, dnaProfile.id, bat.personality);
  await upsertFitProfiles(equipment.id, dnaProfile.id, bat);
  await upsertEvidence(equipment.id, dnaProfile.id, bat);
}

async function upsertDNAProfile(equipmentId: string) {
  const existing = await prisma.equipmentDNAProfile.findFirst({ where: { equipmentId, version: 1 } });
  const data = {
    certificationLevel: "gold",
    confidenceScore: "high",
    status: "active",
    publishedAt: new Date("2026-07-01T12:00:00.000Z")
  };

  return existing
    ? prisma.equipmentDNAProfile.update({ where: { id: existing.id }, data })
    : prisma.equipmentDNAProfile.create({ data: { equipmentId, version: 1, ...data } });
}

async function upsertScores(dnaProfileId: string, scores: Record<string, number>) {
  for (const [code, score] of Object.entries(scores)) {
    const characteristic = await prisma.equipmentCharacteristic.findUnique({ where: { code } });
    if (!characteristic) continue;

    await prisma.equipmentDNAScore.upsert({
      where: {
        dnaProfileId_characteristicId: {
          dnaProfileId,
          characteristicId: characteristic.id
        }
      },
      update: {
        score: String(score),
        confidence: "high",
        evidenceLevel: "internal_review",
        rationale: `Development Equipment DNA score for ${characteristic.name}.`
      },
      create: {
        dnaProfileId,
        characteristicId: characteristic.id,
        score: String(score),
        confidence: "high",
        evidenceLevel: "internal_review",
        rationale: `Development Equipment DNA score for ${characteristic.name}.`
      }
    });
  }
}

async function upsertSpecifications(equipmentId: string, bat: (typeof demoBats)[number]) {
  const specs = [
    ["certification", bat.certification, undefined, undefined],
    ["material", bat.material, undefined, undefined],
    ["construction", bat.construction, undefined, undefined],
    ["barrel_diameter", undefined, bat.barrelDiameter, "in"]
  ];

  for (const [specificationCode, valueText, valueNumber, unit] of specs) {
    await prisma.equipmentSpecification.upsert({
      where: {
        equipmentId_specificationCode: {
          equipmentId,
          specificationCode
        }
      },
      update: {
        valueText,
        valueNumber,
        unit,
        source: "development_seed",
        verifiedAt: new Date("2026-07-01T12:00:00.000Z")
      },
      create: {
        equipmentId,
        specificationCode,
        valueText,
        valueNumber,
        unit,
        source: "development_seed",
        verifiedAt: new Date("2026-07-01T12:00:00.000Z")
      }
    });
  }
}

async function upsertPersonality(equipmentId: string, dnaProfileId: string, personality: string[]) {
  const [personalityCode, personalityName, rationale] = personality;
  await prisma.equipmentPersonality.upsert({
    where: {
      dnaProfileId_personalityCode_derivationVersion: {
        dnaProfileId,
        personalityCode,
        derivationVersion: "demo-v1"
      }
    },
    update: {
      equipmentId,
      personalityName,
      isPrimary: true,
      confidence: "high",
      rationale
    },
    create: {
      equipmentId,
      dnaProfileId,
      personalityCode,
      personalityName,
      isPrimary: true,
      confidence: "high",
      derivationVersion: "demo-v1",
      rationale
    }
  });
}

async function upsertFitProfiles(equipmentId: string, dnaProfileId: string, bat: (typeof demoBats)[number]) {
  const fits = [
    ["player_stage", "11u_travel", 4, "Strong fit for a travel player building repeatable barrel control."],
    ["opportunity_profile", "improve-bat-control", bat.model === "Hype Fire" ? 3 : 5, "Supports the demo player's bat-control opportunity profile."],
    ["preference", "light_swing_good_pop_large_sweet_spot", 4, "Matches the demo player's stated swing feel and impact preferences."],
    ["transition", "usa_drop_8_transition", bat.model === "Atlas" ? 5 : 4, "Supports movement into heavier USA variants without a severe jump."]
  ];

  for (const [fitType, fitCode, strength, rationale] of fits) {
    await prisma.equipmentFitProfile.upsert({
      where: {
        dnaProfileId_fitType_fitCode_version: {
          dnaProfileId,
          fitType,
          fitCode,
          version: 1
        }
      },
      update: {
        equipmentId,
        strength,
        confidence: "high",
        rationale
      },
      create: {
        equipmentId,
        dnaProfileId,
        fitType,
        fitCode,
        strength,
        confidence: "high",
        rationale,
        version: 1
      }
    });
  }
}

async function upsertEvidence(equipmentId: string, dnaProfileId: string, bat: (typeof demoBats)[number]) {
  const title = `${bat.manufacturer} ${bat.model} development review`;
  const existing = await prisma.equipmentEvidence.findFirst({
    where: {
      equipmentId,
      dnaProfileId,
      title
    }
  });
  const data = {
    evidenceType: "internal_review",
    title,
    summary: `Structured development review for ${bat.manufacturer} ${bat.model} comparison testing.`,
    sourceReference: "ninery-demo-seed-v1",
    reliability: "high",
    status: "approved",
    collectedAt: new Date("2026-07-01T12:00:00.000Z"),
    reviewedAt: new Date("2026-07-01T12:00:00.000Z")
  };

  if (existing) {
    await prisma.equipmentEvidence.update({ where: { id: existing.id }, data });
  } else {
    await prisma.equipmentEvidence.create({ data: { equipmentId, dnaProfileId, ...data } });
  }
}
