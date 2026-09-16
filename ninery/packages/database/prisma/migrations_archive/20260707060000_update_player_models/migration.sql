-- CreateEnum
CREATE TYPE "Sport" AS ENUM ('baseball', 'softball');

-- CreateEnum
CREATE TYPE "PlayerStatus" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "Handedness" AS ENUM ('left', 'right');

-- CreateEnum
CREATE TYPE "BattingSide" AS ENUM ('left', 'right', 'switch');

-- CreateEnum
CREATE TYPE "CompetitionLevel" AS ENUM ('recreational', 'school', 'travel', 'elite', 'unknown');

-- DropForeignKey
ALTER TABLE "players" DROP CONSTRAINT IF EXISTS "players_familyMemberId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "growth_measurements_playerId_measuredAt_idx";

-- AlterTable
ALTER TABLE "players" ADD COLUMN "firstName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "players" ADD COLUMN "lastName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "players" ADD COLUMN "nickname" TEXT;
ALTER TABLE "players" ADD COLUMN "dateOfBirth" TIMESTAMP(3);
ALTER TABLE "players" ADD COLUMN "graduationYear" INTEGER;
ALTER TABLE "players" ADD COLUMN "sport" "Sport" NOT NULL DEFAULT 'baseball';
ALTER TABLE "players" ADD COLUMN "photoUrl" TEXT;
ALTER TABLE "players" ADD COLUMN "status" "PlayerStatus" NOT NULL DEFAULT 'active';
UPDATE "players" SET "firstName" = COALESCE(NULLIF("displayName", ''), 'Unknown');
ALTER TABLE "players" DROP COLUMN "familyMemberId";
ALTER TABLE "players" DROP COLUMN "displayName";
ALTER TABLE "players" ALTER COLUMN "firstName" DROP DEFAULT;
ALTER TABLE "players" ALTER COLUMN "lastName" DROP DEFAULT;

-- AlterTable
ALTER TABLE "growth_measurements" ADD COLUMN "heightCm" DECIMAL(5,2);
ALTER TABLE "growth_measurements" ADD COLUMN "weightKg" DECIMAL(5,2);
ALTER TABLE "growth_measurements" ADD COLUMN "source" TEXT;
ALTER TABLE "growth_measurements" ADD COLUMN "confidence" DECIMAL(5,4);
UPDATE "growth_measurements" SET "heightCm" = "heightInches" * 2.54 WHERE "heightInches" IS NOT NULL;
UPDATE "growth_measurements" SET "weightKg" = "weightPounds" * 0.45359237 WHERE "weightPounds" IS NOT NULL;
ALTER TABLE "growth_measurements" DROP COLUMN "heightInches";
ALTER TABLE "growth_measurements" DROP COLUMN "weightPounds";
ALTER TABLE "growth_measurements" DROP COLUMN "notes";
ALTER TABLE "growth_measurements" DROP COLUMN "updatedAt";

-- CreateTable
CREATE TABLE "player_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "playerId" UUID NOT NULL,
    "throwingHand" "Handedness",
    "battingSide" "BattingSide",
    "primaryPosition" TEXT,
    "secondaryPosition" TEXT,
    "competitionLevel" "CompetitionLevel" NOT NULL DEFAULT 'unknown',
    "teamName" TEXT,
    "practiceFrequency" TEXT,
    "experienceYears" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "players_familyId_idx" ON "players"("familyId");

-- CreateIndex
CREATE INDEX "players_graduationYear_idx" ON "players"("graduationYear");

-- CreateIndex
CREATE INDEX "players_status_idx" ON "players"("status");

-- CreateIndex
CREATE UNIQUE INDEX "player_profiles_playerId_key" ON "player_profiles"("playerId");

-- CreateIndex
CREATE INDEX "player_profiles_playerId_idx" ON "player_profiles"("playerId");

-- CreateIndex
CREATE INDEX "growth_measurements_measuredAt_idx" ON "growth_measurements"("measuredAt");

-- AddForeignKey
ALTER TABLE "player_profiles" ADD CONSTRAINT "player_profiles_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
