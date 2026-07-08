import { createHash } from "node:crypto";
import { prisma } from "./client.ts";

export const demoUserEmail = "demo@ninerysports.com";
export const demoFamilyName = "Sanders Family";

function demoPasswordHash() {
  return `sha256:${createHash("sha256").update("ChangeMe123!").digest("hex")}`;
}

export async function seed() {
  const user = await prisma.user.upsert({
    where: { email: demoUserEmail },
    update: {
      passwordHash: demoPasswordHash(),
      emailVerified: true
    },
    create: {
      email: demoUserEmail,
      passwordHash: demoPasswordHash(),
      emailVerified: true
    }
  });

  let family = await prisma.family.findFirst({
    where: {
      name: demoFamilyName,
      createdByUserId: user.id
    }
  });

  family = family
    ? await prisma.family.update({
        where: { id: family.id },
        data: { name: demoFamilyName, createdByUserId: user.id }
      })
    : await prisma.family.create({
        data: {
          name: demoFamilyName,
          createdByUserId: user.id
        }
      });

  await prisma.familyMember.upsert({
    where: {
      familyId_userId: {
        familyId: family.id,
        userId: user.id
      }
    },
    update: { role: "owner" },
    create: {
      familyId: family.id,
      userId: user.id,
      role: "owner"
    }
  });

  return { user, family };
}

export async function clear() {
  const user = await prisma.user.findUnique({ where: { email: demoUserEmail } });
  if (user) {
    await prisma.user.delete({ where: { id: user.id } });
  }
}
