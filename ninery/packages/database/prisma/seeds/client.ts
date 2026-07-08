import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export async function upsertReferenceData(type, items) {
  for (const item of items) {
    await prisma.referenceData.upsert({
      where: {
        type_code: {
          type,
          code: item.code
        }
      },
      update: {
        name: item.name,
        description: item.description ?? null,
        sortOrder: item.sortOrder ?? 0,
        active: item.active ?? true
      },
      create: {
        type,
        code: item.code,
        name: item.name,
        description: item.description ?? null,
        sortOrder: item.sortOrder ?? 0,
        active: item.active ?? true
      }
    });
  }
}

export async function clearReferenceData(type) {
  await prisma.referenceData.deleteMany({ where: { type } });
}
