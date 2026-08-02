/*
  Warnings:

  - You are about to alter the column `confidence` on the `player_opportunity_profiles` table. The data in that column could be lost. The data in that column will be cast from `Decimal(8,4)` to `Decimal(5,4)`.

*/
-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('manufacturer_specs', 'internal_review', 'third_party_review', 'field_testing', 'user_feedback', 'performance_data', 'validated_outcomes');

-- CreateEnum
CREATE TYPE "EvidenceReliability" AS ENUM ('low', 'medium', 'high', 'verified');

-- CreateEnum
CREATE TYPE "EvidenceStatus" AS ENUM ('collected', 'in_review', 'approved', 'rejected', 'archived');

-- CreateEnum
CREATE TYPE "EquipmentFitType" AS ENUM ('player_stage', 'swing_profile', 'opportunity_profile', 'preference', 'transition');

-- CreateEnum
CREATE TYPE "ComparisonConfidence" AS ENUM ('low', 'medium', 'high', 'validated');

-- DropIndex
DROP INDEX "bat_match_sessions_playerId_startedAt_idx";

-- AlterTable
ALTER TABLE "bat_match_answers" RENAME CONSTRAINT "answers_pkey" TO "bat_match_answers_pkey",
ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "bat_match_questions" RENAME CONSTRAINT "questions_pkey" TO "bat_match_questions_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "section" DROP DEFAULT;

-- AlterTable
ALTER TABLE "bat_match_sessions" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "decision_book_sections" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "decision_books" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "decision_signals" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "equipment" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "equipment_characteristics" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "category" DROP DEFAULT;

-- AlterTable
ALTER TABLE "equipment_dna_profiles" RENAME CONSTRAINT "equipment_dna_pkey" TO "equipment_dna_profiles_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "certificationLevel" DROP DEFAULT;

-- AlterTable
ALTER TABLE "equipment_dna_scores" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "evidenceLevel" DROP DEFAULT;

-- AlterTable
ALTER TABLE "equipment_variants" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "families" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "family_members" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "growth_measurements" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "opportunity_profiles" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "platform_events" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "player_opportunity_profiles" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "confidence" SET DATA TYPE DECIMAL(5,4);

-- AlterTable
ALTER TABLE "player_profiles" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "player_timeline_events" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "players" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "sport" DROP DEFAULT;

-- AlterTable
ALTER TABLE "recommendation_items" ADD COLUMN     "equipmentVariantId" UUID,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "recommendationConfidence" DROP DEFAULT;

-- AlterTable
ALTER TABLE "recommendations" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "decisionMatrixVersion" DROP DEFAULT,
ALTER COLUMN "equipmentDnaVersion" DROP DEFAULT,
ALTER COLUMN "knowledgeGraphVersion" DROP DEFAULT;

-- AlterTable
ALTER TABLE "reference_data" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "equipment_specifications" (
    "id" UUID NOT NULL,
    "equipmentId" UUID NOT NULL,
    "specificationCode" TEXT NOT NULL,
    "valueText" TEXT,
    "valueNumber" DECIMAL(12,4),
    "unit" TEXT,
    "source" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_specifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_evidence" (
    "id" UUID NOT NULL,
    "equipmentId" UUID NOT NULL,
    "dnaProfileId" UUID,
    "dnaScoreId" UUID,
    "evidenceType" "EvidenceType" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "sourceReference" TEXT,
    "reliability" "EvidenceReliability" NOT NULL,
    "status" "EvidenceStatus" NOT NULL DEFAULT 'collected',
    "collectedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_fit_profiles" (
    "id" UUID NOT NULL,
    "equipmentId" UUID NOT NULL,
    "dnaProfileId" UUID NOT NULL,
    "fitType" "EquipmentFitType" NOT NULL,
    "fitCode" TEXT NOT NULL,
    "strength" INTEGER NOT NULL,
    "confidence" "ConfidenceLevel" NOT NULL,
    "rationale" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_fit_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_personalities" (
    "id" UUID NOT NULL,
    "equipmentId" UUID NOT NULL,
    "dnaProfileId" UUID NOT NULL,
    "personalityCode" TEXT NOT NULL,
    "personalityName" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "confidence" "ConfidenceLevel" NOT NULL,
    "derivationVersion" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_personalities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_comparisons" (
    "id" UUID NOT NULL,
    "sourceEquipmentId" UUID NOT NULL,
    "targetEquipmentId" UUID NOT NULL,
    "similarityScore" DECIMAL(5,4) NOT NULL,
    "sharedStrengths" JSONB NOT NULL,
    "primaryDifferences" JSONB NOT NULL,
    "sourceBestFor" TEXT,
    "targetBestFor" TEXT,
    "confidence" "ComparisonConfidence" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_comparisons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "equipment_specifications_equipmentId_idx" ON "equipment_specifications"("equipmentId");

-- CreateIndex
CREATE INDEX "equipment_specifications_specificationCode_idx" ON "equipment_specifications"("specificationCode");

-- CreateIndex
CREATE INDEX "equipment_specifications_verifiedAt_idx" ON "equipment_specifications"("verifiedAt");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_specifications_equipmentId_specificationCode_key" ON "equipment_specifications"("equipmentId", "specificationCode");

-- CreateIndex
CREATE INDEX "equipment_evidence_equipmentId_idx" ON "equipment_evidence"("equipmentId");

-- CreateIndex
CREATE INDEX "equipment_evidence_dnaProfileId_idx" ON "equipment_evidence"("dnaProfileId");

-- CreateIndex
CREATE INDEX "equipment_evidence_dnaScoreId_idx" ON "equipment_evidence"("dnaScoreId");

-- CreateIndex
CREATE INDEX "equipment_evidence_evidenceType_idx" ON "equipment_evidence"("evidenceType");

-- CreateIndex
CREATE INDEX "equipment_evidence_reliability_idx" ON "equipment_evidence"("reliability");

-- CreateIndex
CREATE INDEX "equipment_evidence_status_idx" ON "equipment_evidence"("status");

-- CreateIndex
CREATE INDEX "equipment_evidence_collectedAt_idx" ON "equipment_evidence"("collectedAt");

-- CreateIndex
CREATE INDEX "equipment_fit_profiles_equipmentId_idx" ON "equipment_fit_profiles"("equipmentId");

-- CreateIndex
CREATE INDEX "equipment_fit_profiles_dnaProfileId_idx" ON "equipment_fit_profiles"("dnaProfileId");

-- CreateIndex
CREATE INDEX "equipment_fit_profiles_fitType_idx" ON "equipment_fit_profiles"("fitType");

-- CreateIndex
CREATE INDEX "equipment_fit_profiles_fitCode_idx" ON "equipment_fit_profiles"("fitCode");

-- CreateIndex
CREATE INDEX "equipment_fit_profiles_confidence_idx" ON "equipment_fit_profiles"("confidence");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_fit_profiles_dnaProfileId_fitType_fitCode_version_key" ON "equipment_fit_profiles"("dnaProfileId", "fitType", "fitCode", "version");

-- CreateIndex
CREATE INDEX "equipment_personalities_equipmentId_idx" ON "equipment_personalities"("equipmentId");

-- CreateIndex
CREATE INDEX "equipment_personalities_dnaProfileId_idx" ON "equipment_personalities"("dnaProfileId");

-- CreateIndex
CREATE INDEX "equipment_personalities_personalityCode_idx" ON "equipment_personalities"("personalityCode");

-- CreateIndex
CREATE INDEX "equipment_personalities_isPrimary_idx" ON "equipment_personalities"("isPrimary");

-- CreateIndex
CREATE INDEX "equipment_personalities_confidence_idx" ON "equipment_personalities"("confidence");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_personalities_dnaProfileId_personalityCode_deriva_key" ON "equipment_personalities"("dnaProfileId", "personalityCode", "derivationVersion");

-- CreateIndex
CREATE INDEX "equipment_comparisons_sourceEquipmentId_idx" ON "equipment_comparisons"("sourceEquipmentId");

-- CreateIndex
CREATE INDEX "equipment_comparisons_targetEquipmentId_idx" ON "equipment_comparisons"("targetEquipmentId");

-- CreateIndex
CREATE INDEX "equipment_comparisons_similarityScore_idx" ON "equipment_comparisons"("similarityScore");

-- CreateIndex
CREATE INDEX "equipment_comparisons_confidence_idx" ON "equipment_comparisons"("confidence");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_comparisons_sourceEquipmentId_targetEquipmentId_v_key" ON "equipment_comparisons"("sourceEquipmentId", "targetEquipmentId", "version");

-- AddForeignKey
ALTER TABLE "equipment_specifications" ADD CONSTRAINT "equipment_specifications_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_evidence" ADD CONSTRAINT "equipment_evidence_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_evidence" ADD CONSTRAINT "equipment_evidence_dnaProfileId_fkey" FOREIGN KEY ("dnaProfileId") REFERENCES "equipment_dna_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_evidence" ADD CONSTRAINT "equipment_evidence_dnaScoreId_fkey" FOREIGN KEY ("dnaScoreId") REFERENCES "equipment_dna_scores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_fit_profiles" ADD CONSTRAINT "equipment_fit_profiles_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_fit_profiles" ADD CONSTRAINT "equipment_fit_profiles_dnaProfileId_fkey" FOREIGN KEY ("dnaProfileId") REFERENCES "equipment_dna_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_personalities" ADD CONSTRAINT "equipment_personalities_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_personalities" ADD CONSTRAINT "equipment_personalities_dnaProfileId_fkey" FOREIGN KEY ("dnaProfileId") REFERENCES "equipment_dna_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_comparisons" ADD CONSTRAINT "equipment_comparisons_sourceEquipmentId_fkey" FOREIGN KEY ("sourceEquipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_comparisons" ADD CONSTRAINT "equipment_comparisons_targetEquipmentId_fkey" FOREIGN KEY ("targetEquipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_items" ADD CONSTRAINT "recommendation_items_equipmentVariantId_fkey" FOREIGN KEY ("equipmentVariantId") REFERENCES "equipment_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "opportunity_profiles_key_key" RENAME TO "opportunity_profiles_code_key";
