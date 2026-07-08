import { prisma } from "./client.ts";
import { demoFamilyName, demoUserEmail, seed as seedDemoFamily } from "./demo-family.seed.ts";

export async function seed() {
  const { family } = await seedDemoFamily();

  let player = await prisma.player.findFirst({
    where: {
      familyId: family.id,
      firstName: "Jackson",
      lastName: "Sanders",
      graduationYear: 2033
    }
  });

  player = player
    ? await prisma.player.update({
        where: { id: player.id },
        data: {
          nickname: "Jack",
          sport: "baseball",
          status: "active"
        }
      })
    : await prisma.player.create({
        data: {
          familyId: family.id,
          firstName: "Jackson",
          lastName: "Sanders",
          nickname: "Jack",
          graduationYear: 2033,
          sport: "baseball",
          status: "active"
        }
      });

  await prisma.playerProfile.upsert({
    where: { playerId: player.id },
    update: {
      throwingHand: "right",
      battingSide: "right",
      primaryPosition: "SS",
      secondaryPosition: "2B",
      competitionLevel: "travel",
      teamName: "Ninery Demo Travel",
      practiceFrequency: "multiple_weekly",
      experienceYears: 5
    },
    create: {
      playerId: player.id,
      throwingHand: "right",
      battingSide: "right",
      primaryPosition: "SS",
      secondaryPosition: "2B",
      competitionLevel: "travel",
      teamName: "Ninery Demo Travel",
      practiceFrequency: "multiple_weekly",
      experienceYears: 5
    }
  });

  const measurements = [
    { measuredAt: new Date("2026-01-15T12:00:00.000Z"), heightCm: "137.16", weightKg: "31.75" },
    { measuredAt: new Date("2026-04-15T12:00:00.000Z"), heightCm: "139.70", weightKg: "33.11" },
    { measuredAt: new Date("2026-07-01T12:00:00.000Z"), heightCm: "142.24", weightKg: "34.47" }
  ];

  for (const measurement of measurements) {
    const existing = await prisma.growthMeasurement.findFirst({
      where: {
        playerId: player.id,
        measuredAt: measurement.measuredAt,
        source: "demo_seed"
      }
    });

    if (!existing) {
      await prisma.growthMeasurement.create({
        data: {
          playerId: player.id,
          ...measurement,
          source: "demo_seed",
          confidence: "1.0000"
        }
      });
    }
  }

  const profileCodes = [
    ["improve-bat-control", "0.8600"],
    ["build-swing-confidence", "0.8000"],
    ["growth-spurt-equipment-review", "0.7400"]
  ];

  for (const [code, priorityScore] of profileCodes) {
    const opportunityProfile = await prisma.opportunityProfile.findUnique({ where: { code } });
    if (opportunityProfile) {
      const existing = await prisma.playerOpportunityProfile.findFirst({
        where: {
          playerId: player.id,
          opportunityProfileId: opportunityProfile.id,
          recommendationId: null
        }
      });

      if (existing) {
        await prisma.playerOpportunityProfile.update({
          where: { id: existing.id },
          data: { priorityScore, confidence: "0.8500" }
        });
      } else {
        await prisma.playerOpportunityProfile.create({
          data: {
            playerId: player.id,
            opportunityProfileId: opportunityProfile.id,
            priorityScore,
            confidence: "0.8500"
          }
        });
      }
    }
  }

  const timelineEvent = await prisma.playerTimelineEvent.findFirst({
    where: {
      playerId: player.id,
      eventType: "milestone_added",
      title: "Demo PlayerHQ timeline ready",
      relatedEntityType: "Player",
      relatedEntityId: player.id
    }
  });

  if (!timelineEvent) {
    await prisma.playerTimelineEvent.create({
      data: {
        playerId: player.id,
        eventType: "milestone_added",
        title: "Demo PlayerHQ timeline ready",
        description: "Seeded demo profile, growth measurements, and opportunity profiles.",
        eventDate: new Date("2026-07-01T12:00:00.000Z"),
        relatedEntityType: "Player",
        relatedEntityId: player.id
      }
    });
  }

  return player;
}

export async function clear() {
  const user = await prisma.user.findUnique({ where: { email: demoUserEmail } });
  if (!user) {
    return;
  }

  const family = await prisma.family.findFirst({
    where: {
      name: demoFamilyName,
      createdByUserId: user.id
    }
  });

  if (!family) {
    return;
  }

  await prisma.player.deleteMany({
    where: {
      familyId: family.id,
      firstName: "Jackson",
      lastName: "Sanders",
      graduationYear: 2033
    }
  });
}
