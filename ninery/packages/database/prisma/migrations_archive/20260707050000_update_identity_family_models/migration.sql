-- DropForeignKey
ALTER TABLE "families" DROP CONSTRAINT "families_ownerId_fkey";

-- AlterEnum
ALTER TABLE "family_members" ALTER COLUMN "role" DROP DEFAULT;
ALTER TYPE "FamilyMemberRole" RENAME VALUE 'OWNER' TO 'owner';
ALTER TYPE "FamilyMemberRole" RENAME VALUE 'ADMIN' TO 'guardian';
ALTER TYPE "FamilyMemberRole" RENAME VALUE 'MEMBER' TO 'viewer';

-- AlterTable
ALTER TABLE "users" ADD COLUMN "passwordHash" TEXT NOT NULL DEFAULT '';
ALTER TABLE "users" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" DROP COLUMN "name";
ALTER TABLE "users" ALTER COLUMN "passwordHash" DROP DEFAULT;

-- AlterTable
ALTER TABLE "families" RENAME COLUMN "ownerId" TO "createdByUserId";

-- AlterTable
ALTER TABLE "family_members" DROP COLUMN "updatedAt";

-- CreateIndex
CREATE INDEX "families_createdByUserId_idx" ON "families"("createdByUserId");

-- CreateIndex
CREATE INDEX "family_members_familyId_idx" ON "family_members"("familyId");

-- CreateIndex
CREATE INDEX "family_members_userId_idx" ON "family_members"("userId");

-- AddForeignKey
ALTER TABLE "families" ADD CONSTRAINT "families_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
