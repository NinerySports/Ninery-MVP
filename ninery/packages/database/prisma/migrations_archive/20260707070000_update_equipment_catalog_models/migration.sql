-- CreateEnum
CREATE TYPE "EquipmentCategory" AS ENUM ('bat', 'glove', 'cleat', 'helmet', 'catcher_gear');

-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('active', 'coming_soon', 'legacy', 'archived');

-- CreateEnum
CREATE TYPE "EquipmentCertification" AS ENUM ('USA', 'USSSA', 'BBCOR', 'none', 'unknown');

-- CreateEnum
CREATE TYPE "CertificationLevel" AS ENUM ('bronze', 'silver', 'gold', 'platinum');

-- CreateEnum
CREATE TYPE "DNAProfileStatus" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "EvidenceLevel" AS ENUM ('internal_review', 'manufacturer_specs', 'field_testing', 'validated_outcomes');

-- CreateEnum
CREATE TYPE "ConfidenceLevel" AS ENUM ('low', 'medium', 'high', 'validated');

-- DropForeignKey
ALTER TABLE "equipment_dna_scores" DROP CONSTRAINT IF EXISTS "equipment_dna_scores_equipmentDNAId_fkey";

-- DropForeignKey
ALTER TABLE "equipment_dna" DROP CONSTRAINT IF EXISTS "equipment_dna_equipmentId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "equipment_brand_idx";

-- DropIndex
DROP INDEX IF EXISTS "equipment_brand_name_idx";

-- DropIndex
DROP INDEX IF EXISTS "equipment_category_idx";

-- DropIndex
DROP INDEX IF EXISTS "equipment_dna_equipmentId_key";

-- DropIndex
DROP INDEX IF EXISTS "equipment_characteristics_key_key";

-- DropIndex
DROP INDEX IF EXISTS "equipment_characteristics_sortOrder_idx";

-- DropIndex
DROP INDEX IF EXISTS "equipment_dna_scores_equipmentDNAId_characteristicId_key";

-- DropIndex
DROP INDEX IF EXISTS "equipment_dna_scores_equipmentDNAId_idx";

-- RenameTable
ALTER TABLE "equipment_dna" RENAME TO "equipment_dna_profiles";

-- AlterTable
ALTER TABLE "equipment" RENAME COLUMN "brand" TO "manufacturer";
ALTER TABLE "equipment" RENAME COLUMN "name" TO "model";
ALTER TABLE "equipment" ADD COLUMN "modelYear" INTEGER;
ALTER TABLE "equipment" ADD COLUMN "certification" "EquipmentCertification" NOT NULL DEFAULT 'unknown';
ALTER TABLE "equipment" ADD COLUMN "material" TEXT;
ALTER TABLE "equipment" ADD COLUMN "construction" TEXT;
ALTER TABLE "equipment" ADD COLUMN "barrelDiameter" DECIMAL(4,2);
ALTER TABLE "equipment" ADD COLUMN "status" "EquipmentStatus" NOT NULL DEFAULT 'active';
ALTER TABLE "equipment" ALTER COLUMN "category" TYPE "EquipmentCategory" USING (
  CASE lower("category")
    WHEN 'bat' THEN 'bat'::"EquipmentCategory"
    WHEN 'glove' THEN 'glove'::"EquipmentCategory"
    WHEN 'cleat' THEN 'cleat'::"EquipmentCategory"
    WHEN 'helmet' THEN 'helmet'::"EquipmentCategory"
    WHEN 'catcher_gear' THEN 'catcher_gear'::"EquipmentCategory"
    WHEN 'catcher gear' THEN 'catcher_gear'::"EquipmentCategory"
    ELSE 'bat'::"EquipmentCategory"
  END
);
ALTER TABLE "equipment" DROP COLUMN "description";

-- AlterTable
ALTER TABLE "equipment_variants" ADD COLUMN "lengthInches" DECIMAL(4,1);
ALTER TABLE "equipment_variants" ADD COLUMN "weightOunces" DECIMAL(4,1);
ALTER TABLE "equipment_variants" ADD COLUMN "dropWeight" INTEGER;
ALTER TABLE "equipment_variants" ADD COLUMN "msrp" DECIMAL(8,2);
ALTER TABLE "equipment_variants" DROP COLUMN "name";
ALTER TABLE "equipment_variants" DROP COLUMN "size";
ALTER TABLE "equipment_variants" DROP COLUMN "color";
ALTER TABLE "equipment_variants" DROP COLUMN "attributes";
ALTER TABLE "equipment_variants" DROP COLUMN "updatedAt";

-- AlterTable
ALTER TABLE "equipment_characteristics" RENAME COLUMN "key" TO "code";
ALTER TABLE "equipment_characteristics" RENAME COLUMN "label" TO "name";
ALTER TABLE "equipment_characteristics" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'bat';
ALTER TABLE "equipment_characteristics" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "equipment_characteristics" DROP COLUMN "sortOrder";
ALTER TABLE "equipment_characteristics" DROP COLUMN "updatedAt";

-- AlterTable
ALTER TABLE "equipment_dna_profiles" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "equipment_dna_profiles" ADD COLUMN "certificationLevel" "CertificationLevel" NOT NULL DEFAULT 'bronze';
ALTER TABLE "equipment_dna_profiles" ADD COLUMN "confidenceScore" "ConfidenceLevel" NOT NULL DEFAULT 'medium';
ALTER TABLE "equipment_dna_profiles" ADD COLUMN "status" "DNAProfileStatus" NOT NULL DEFAULT 'draft';
ALTER TABLE "equipment_dna_profiles" ADD COLUMN "publishedAt" TIMESTAMP(3);
ALTER TABLE "equipment_dna_profiles" DROP COLUMN "summary";
ALTER TABLE "equipment_dna_profiles" DROP COLUMN "updatedAt";

-- AlterTable
ALTER TABLE "equipment_dna_scores" RENAME COLUMN "equipmentDNAId" TO "dnaProfileId";
ALTER TABLE "equipment_dna_scores" ADD COLUMN "evidenceLevel" "EvidenceLevel" NOT NULL DEFAULT 'internal_review';
ALTER TABLE "equipment_dna_scores" ADD COLUMN "confidenceLevel" "ConfidenceLevel";
UPDATE "equipment_dna_scores"
SET "confidenceLevel" = CASE
  WHEN "confidence" IS NULL THEN 'medium'::"ConfidenceLevel"
  WHEN "confidence" >= 0.85 THEN 'validated'::"ConfidenceLevel"
  WHEN "confidence" >= 0.7 THEN 'high'::"ConfidenceLevel"
  WHEN "confidence" >= 0.4 THEN 'medium'::"ConfidenceLevel"
  ELSE 'low'::"ConfidenceLevel"
END;
ALTER TABLE "equipment_dna_scores" DROP COLUMN "confidence";
ALTER TABLE "equipment_dna_scores" RENAME COLUMN "confidenceLevel" TO "confidence";
ALTER TABLE "equipment_dna_scores" ALTER COLUMN "confidence" SET NOT NULL;
ALTER TABLE "equipment_dna_scores" DROP COLUMN "updatedAt";

-- CreateIndex
CREATE INDEX "equipment_manufacturer_idx" ON "equipment"("manufacturer");

-- CreateIndex
CREATE INDEX "equipment_model_idx" ON "equipment"("model");

-- CreateIndex
CREATE INDEX "equipment_modelYear_idx" ON "equipment"("modelYear");

-- CreateIndex
CREATE INDEX "equipment_category_idx" ON "equipment"("category");

-- CreateIndex
CREATE INDEX "equipment_certification_idx" ON "equipment"("certification");

-- CreateIndex
CREATE INDEX "equipment_status_idx" ON "equipment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_characteristics_code_key" ON "equipment_characteristics"("code");

-- CreateIndex
CREATE INDEX "equipment_dna_profiles_equipmentId_idx" ON "equipment_dna_profiles"("equipmentId");

-- CreateIndex
CREATE INDEX "equipment_dna_profiles_status_idx" ON "equipment_dna_profiles"("status");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_dna_scores_dnaProfileId_characteristicId_key" ON "equipment_dna_scores"("dnaProfileId", "characteristicId");

-- CreateIndex
CREATE INDEX "equipment_dna_scores_dnaProfileId_idx" ON "equipment_dna_scores"("dnaProfileId");

-- AddForeignKey
ALTER TABLE "equipment_dna_profiles" ADD CONSTRAINT "equipment_dna_profiles_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_dna_scores" ADD CONSTRAINT "equipment_dna_scores_dnaProfileId_fkey" FOREIGN KEY ("dnaProfileId") REFERENCES "equipment_dna_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SeedData
INSERT INTO "equipment_characteristics" ("id", "code", "name", "category", "description", "version", "createdAt")
VALUES
  (gen_random_uuid(), 'bat-control', 'Bat Control™', 'bat', 'How easily a player can control the barrel through the hitting zone.', 1, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'balance', 'Balance™', 'bat', 'How evenly the bat''s weight is distributed during the swing.', 1, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'swing-weight', 'Swing Weight™', 'bat', 'How heavy the bat feels in motion, independent of scale weight.', 1, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'barrel-forgiveness', 'Barrel Forgiveness™', 'bat', 'How well the barrel performs on less-than-perfect contact.', 1, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'sweet-spot-size', 'Sweet Spot Size™', 'bat', 'The usable hitting area where contact is most productive.', 1, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'power-potential', 'Power Potential™', 'bat', 'The bat''s ability to help convert swing speed into exit velocity.', 1, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'confidence-building', 'Confidence Building™', 'bat', 'How well the bat supports comfort, timing, and trust for the player.', 1, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'transition-friendliness', 'Transition Friendliness™', 'bat', 'How approachable the bat is when moving from another size, drop, or certification.', 1, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "category" = EXCLUDED."category",
  "description" = EXCLUDED."description",
  "version" = EXCLUDED."version";
