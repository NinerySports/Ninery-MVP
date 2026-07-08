import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const opportunityProfiles = [
  {
    code: "improve-bat-control",
    name: "Improve Bat Control™",
    description: "Player would benefit from equipment that improves barrel control and contact consistency.",
    version: 1,
    active: true
  },
  {
    code: "build-swing-confidence",
    name: "Build Swing Confidence™",
    description: "Player needs a setup that supports comfort, timing, and confidence in the box.",
    version: 1,
    active: true
  },
  {
    code: "first-bbcor-transition",
    name: "First BBCOR Transition™",
    description: "Player is preparing for or entering the first BBCOR bat transition.",
    version: 1,
    active: true
  },
  {
    code: "growth-spurt-equipment-review",
    name: "Growth Spurt Equipment Review™",
    description: "Recent growth may have changed the player's equipment fit or readiness.",
    version: 1,
    active: true
  },
  {
    code: "increase-barrel-impact",
    name: "Increase Barrel Impact™",
    description: "Player would benefit from equipment that improves quality of contact and barrel impact.",
    version: 1,
    active: true
  },
  {
    code: "increase-swing-speed",
    name: "Increase Swing Speed™",
    description: "Player would benefit from a fit that helps increase usable swing speed.",
    version: 1,
    active: true
  },
  {
    code: "current-equipment-still-fits",
    name: "Current Equipment Still Fits™",
    description: "Current equipment appears to remain suitable for the player's present needs.",
    version: 1,
    active: true
  }
];

try {
  for (const opportunityProfile of opportunityProfiles) {
    await prisma.opportunityProfile.upsert({
      where: { code: opportunityProfile.code },
      update: opportunityProfile,
      create: opportunityProfile
    });
  }

  console.log(`Seeded ${opportunityProfiles.length} opportunity profiles.`);
} finally {
  await prisma.$disconnect();
}
