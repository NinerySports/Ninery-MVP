import { prisma } from "./client.ts";
import * as manufacturers from "./manufacturers.seed.ts";
import * as equipmentCharacteristics from "./equipment-characteristics.seed.ts";
import * as opportunityProfiles from "./opportunity-profiles.seed.ts";
import * as batmatchQuestions from "./batmatch-questions.seed.ts";
import * as positions from "./positions.seed.ts";
import * as certifications from "./certifications.seed.ts";
import * as equipmentCategories from "./equipment-categories.seed.ts";
import * as developmentStages from "./development-stages.seed.ts";
import * as demoFamily from "./demo-family.seed.ts";
import * as demoPlayer from "./demo-player.seed.ts";
import * as sampleEquipment from "./sample-equipment.seed.ts";

const referenceSeeds = [
  ["manufacturers", manufacturers],
  ["positions", positions],
  ["certifications", certifications],
  ["equipment categories", equipmentCategories],
  ["development stages", developmentStages],
  ["equipment characteristics", equipmentCharacteristics],
  ["opportunity profiles", opportunityProfiles],
  ["BatMatch questions", batmatchQuestions]
];

const equipmentSeeds = [["sample equipment", sampleEquipment]];
const demoSeeds = [
  ["demo family", demoFamily],
  ["demo player", demoPlayer]
];

async function runSeedGroup(seeds) {
  for (const [name, seedModule] of seeds) {
    await seedModule.seed();
    console.log(`Seeded ${name}.`);
  }
}

async function clearSeedGroup(seeds) {
  for (const [name, seedModule] of [...seeds].reverse()) {
    await seedModule.clear();
    console.log(`Cleared ${name}.`);
  }
}

async function seedAll() {
  await runSeedGroup(referenceSeeds);
  await runSeedGroup(equipmentSeeds);
  await runSeedGroup(demoSeeds);
}

async function clearAll() {
  await clearSeedGroup(demoSeeds);
  await clearSeedGroup(equipmentSeeds);
  await clearSeedGroup(referenceSeeds);
}

const mode = process.argv[2] ?? "all";

try {
  switch (mode) {
    case "all":
      await seedAll();
      break;
    case "clear":
      await clearAll();
      break;
    case "demo":
      await runSeedGroup(referenceSeeds);
      await runSeedGroup(demoSeeds);
      break;
    case "reference":
      await runSeedGroup(referenceSeeds);
      break;
    case "equipment":
      await runSeedGroup([["equipment characteristics", equipmentCharacteristics]]);
      await runSeedGroup(equipmentSeeds);
      break;
    default:
      throw new Error(`Unknown seed mode "${mode}". Use all, clear, demo, reference, or equipment.`);
  }
} finally {
  await prisma.$disconnect();
}
