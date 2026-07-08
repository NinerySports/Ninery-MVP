import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const characteristics = [
  {
    code: "bat-control",
    name: "Bat Control™",
    category: "bat",
    description: "How easily a player can control the barrel through the hitting zone."
  },
  {
    code: "balance",
    name: "Balance™",
    category: "bat",
    description: "How evenly the bat's weight is distributed during the swing."
  },
  {
    code: "swing-weight",
    name: "Swing Weight™",
    category: "bat",
    description: "How heavy the bat feels in motion, independent of scale weight."
  },
  {
    code: "barrel-forgiveness",
    name: "Barrel Forgiveness™",
    category: "bat",
    description: "How well the barrel performs on less-than-perfect contact."
  },
  {
    code: "sweet-spot-size",
    name: "Sweet Spot Size™",
    category: "bat",
    description: "The usable hitting area where contact is most productive."
  },
  {
    code: "power-potential",
    name: "Power Potential™",
    category: "bat",
    description: "The bat's ability to help convert swing speed into exit velocity."
  },
  {
    code: "confidence-building",
    name: "Confidence Building™",
    category: "bat",
    description: "How well the bat supports comfort, timing, and trust for the player."
  },
  {
    code: "transition-friendliness",
    name: "Transition Friendliness™",
    category: "bat",
    description: "How approachable the bat is when moving from another size, drop, or certification."
  }
];

try {
  for (const characteristic of characteristics) {
    await prisma.equipmentCharacteristic.upsert({
      where: { code: characteristic.code },
      update: characteristic,
      create: characteristic
    });
  }

  console.log(`Seeded ${characteristics.length} equipment characteristics.`);
} finally {
  await prisma.$disconnect();
}
