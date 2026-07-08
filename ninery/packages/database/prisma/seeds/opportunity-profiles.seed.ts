import { prisma } from "./client.ts";

export const opportunityProfiles = [
  ["improve-bat-control", "Improve Bat Control™", "Player would benefit from better barrel control and contact consistency.", 90],
  ["build-swing-confidence", "Build Swing Confidence™", "Player needs equipment that supports confidence, timing, and comfort.", 85],
  ["increase-barrel-contact", "Increase Barrel Contact™", "Player would benefit from a larger or more forgiving contact window.", 88],
  ["growth-spurt-equipment-review", "Growth Spurt Equipment Review™", "Recent growth may have changed the player's equipment fit.", 80],
  ["prepare-for-bbcor", "Prepare for BBCOR™", "Player is approaching a BBCOR transition and needs readiness guidance.", 82],
  ["increase-swing-speed", "Increase Swing Speed™", "Player would benefit from a fit that improves usable swing speed.", 84],
  ["current-equipment-still-fits", "Current Equipment Still Fits™", "Current equipment appears to remain suitable for the player's needs.", 60],
  ["power-development", "Power Development™", "Player is ready to emphasize impact quality and power development.", 78],
  ["consistency-development", "Consistency Development™", "Player would benefit from more repeatable swing outcomes.", 86],
  ["transition-readiness", "Transition Readiness™", "Player may be ready for a new size, drop, material, or certification.", 76]
].map(([code, name, description, defaultPriority]) => ({
  code,
  name,
  description,
  version: 1,
  active: true,
  defaultPriority
}));

export async function seed() {
  for (const profile of opportunityProfiles) {
    await prisma.opportunityProfile.upsert({
      where: { code: profile.code },
      update: profile,
      create: profile
    });
  }
}

export async function clear() {
  await prisma.playerOpportunityProfile.deleteMany({
    where: {
      opportunityProfile: {
        code: { in: opportunityProfiles.map((profile) => profile.code) }
      }
    }
  });
  await prisma.opportunityProfile.deleteMany({
    where: { code: { in: opportunityProfiles.map((profile) => profile.code) } }
  });
}
