-- CreateEnum
CREATE TYPE "DecisionBookStatus" AS ENUM ('draft', 'generated', 'shared', 'archived');

-- ReplaceEnum
ALTER TYPE "RecommendationStatus" RENAME TO "RecommendationStatus_old";
CREATE TYPE "RecommendationStatus" AS ENUM ('draft', 'generated', 'accepted', 'dismissed', 'archived');
ALTER TABLE "recommendations" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "recommendations" ALTER COLUMN "status" TYPE "RecommendationStatus" USING (
  CASE "status"::text
    WHEN 'DRAFT' THEN 'draft'::"RecommendationStatus"
    WHEN 'ACTIVE' THEN 'generated'::"RecommendationStatus"
    WHEN 'ARCHIVED' THEN 'archived'::"RecommendationStatus"
    ELSE 'draft'::"RecommendationStatus"
  END
);
ALTER TABLE "recommendations" ALTER COLUMN "status" SET DEFAULT 'draft';
DROP TYPE "RecommendationStatus_old";

-- ReplaceEnum
ALTER TYPE "DecisionBookSectionType" RENAME TO "DecisionBookSectionType_old";
CREATE TYPE "DecisionBookSectionType" AS ENUM (
  'cover',
  'executive_summary',
  'about_player',
  'what_we_learned',
  'opportunity_profiles',
  'equipment_readiness',
  'recommended_equipment',
  'why_this_recommendation',
  'equipment_dna',
  'tradeoffs',
  'alternatives',
  'development_roadmap',
  'next_steps',
  'ai_assistant'
);
ALTER TABLE "decision_book_sections" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "decision_book_sections" ALTER COLUMN "type" TYPE "DecisionBookSectionType" USING (
  CASE "type"::text
    WHEN 'SUMMARY' THEN 'executive_summary'::"DecisionBookSectionType"
    WHEN 'FIT_REASONING' THEN 'why_this_recommendation'::"DecisionBookSectionType"
    WHEN 'TRADEOFFS' THEN 'tradeoffs'::"DecisionBookSectionType"
    WHEN 'CARE_GUIDANCE' THEN 'development_roadmap'::"DecisionBookSectionType"
    WHEN 'NEXT_STEPS' THEN 'next_steps'::"DecisionBookSectionType"
    ELSE 'ai_assistant'::"DecisionBookSectionType"
  END
);
DROP TYPE "DecisionBookSectionType_old";

-- DropForeignKey
ALTER TABLE "recommendation_items" DROP CONSTRAINT IF EXISTS "recommendation_items_equipmentVariantId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "recommendations_playerId_generatedAt_idx";

-- DropIndex
DROP INDEX IF EXISTS "recommendation_items_equipmentVariantId_idx";

-- DropIndex
DROP INDEX IF EXISTS "player_opportunity_profiles_playerId_opportunityProfileId_key";

-- DropIndex
DROP INDEX IF EXISTS "decision_book_sections_decisionBookId_sortOrder_idx";

-- AlterTable
ALTER TABLE "recommendations" ADD COLUMN "overallConfidence" DECIMAL(5,4);
ALTER TABLE "recommendations" ADD COLUMN "decisionMatrixVersion" TEXT NOT NULL DEFAULT '1';
ALTER TABLE "recommendations" ADD COLUMN "equipmentDnaVersion" TEXT NOT NULL DEFAULT '1';
ALTER TABLE "recommendations" ADD COLUMN "knowledgeGraphVersion" TEXT NOT NULL DEFAULT '1';
ALTER TABLE "recommendations" DROP COLUMN "title";
ALTER TABLE "recommendations" DROP COLUMN "summary";
ALTER TABLE "recommendations" DROP COLUMN "metadata";

-- AlterTable
ALTER TABLE "recommendation_items" RENAME COLUMN "score" TO "matchScore";
ALTER TABLE "recommendation_items" RENAME COLUMN "rationale" TO "reasonSummary";
ALTER TABLE "recommendation_items" RENAME COLUMN "metadata" TO "tradeoffs";
ALTER TABLE "recommendation_items" ADD COLUMN "equipmentReadinessScore" DECIMAL(8,4);
ALTER TABLE "recommendation_items" ADD COLUMN "recommendationConfidence" DECIMAL(5,4) NOT NULL DEFAULT 0.5000;
ALTER TABLE "recommendation_items" DROP COLUMN "equipmentVariantId";
ALTER TABLE "recommendation_items" DROP COLUMN "type";
ALTER TABLE "recommendation_items" DROP COLUMN "updatedAt";
DROP TYPE IF EXISTS "RecommendationItemType";

-- AlterTable
ALTER TABLE "opportunity_profiles" RENAME COLUMN "key" TO "code";
ALTER TABLE "opportunity_profiles" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "opportunity_profiles" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "opportunity_profiles" DROP COLUMN "criteria";

-- AlterTable
ALTER TABLE "player_opportunity_profiles" ADD COLUMN "recommendationId" UUID;
ALTER TABLE "player_opportunity_profiles" RENAME COLUMN "score" TO "priorityScore";
ALTER TABLE "player_opportunity_profiles" ALTER COLUMN "confidence" SET DEFAULT 0.5000;
UPDATE "player_opportunity_profiles" SET "confidence" = 0.5000 WHERE "confidence" IS NULL;
ALTER TABLE "player_opportunity_profiles" ALTER COLUMN "confidence" SET NOT NULL;
ALTER TABLE "player_opportunity_profiles" ALTER COLUMN "confidence" DROP DEFAULT;
ALTER TABLE "player_opportunity_profiles" DROP COLUMN "rationale";
ALTER TABLE "player_opportunity_profiles" DROP COLUMN "metadata";
ALTER TABLE "player_opportunity_profiles" DROP COLUMN "updatedAt";

-- AlterTable
ALTER TABLE "decision_books" ADD COLUMN "playerId" UUID;
UPDATE "decision_books"
SET "playerId" = "recommendations"."playerId"
FROM "recommendations"
WHERE "decision_books"."recommendationId" = "recommendations"."id";
ALTER TABLE "decision_books" ALTER COLUMN "playerId" SET NOT NULL;
ALTER TABLE "decision_books" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "decision_books" ADD COLUMN "status" "DecisionBookStatus" NOT NULL DEFAULT 'draft';
ALTER TABLE "decision_books" ADD COLUMN "webUrl" TEXT;
ALTER TABLE "decision_books" ADD COLUMN "pdfUrl" TEXT;
ALTER TABLE "decision_books" DROP COLUMN "summary";
ALTER TABLE "decision_books" DROP COLUMN "metadata";

-- AlterTable
ALTER TABLE "decision_book_sections" RENAME COLUMN "type" TO "sectionType";
ALTER TABLE "decision_book_sections" ALTER COLUMN "content" TYPE JSONB USING jsonb_build_object('text', "content");
ALTER TABLE "decision_book_sections" DROP COLUMN "metadata";

-- CreateIndex
CREATE INDEX "opportunity_profiles_active_idx" ON "opportunity_profiles"("active");

-- CreateIndex
CREATE INDEX "player_opportunity_profiles_recommendationId_idx" ON "player_opportunity_profiles"("recommendationId");

-- CreateIndex
CREATE INDEX "recommendations_generatedAt_idx" ON "recommendations"("generatedAt");

-- CreateIndex
CREATE INDEX "recommendation_items_rank_idx" ON "recommendation_items"("rank");

-- CreateIndex
CREATE INDEX "decision_books_recommendationId_idx" ON "decision_books"("recommendationId");

-- CreateIndex
CREATE INDEX "decision_books_playerId_idx" ON "decision_books"("playerId");

-- CreateIndex
CREATE INDEX "decision_books_status_idx" ON "decision_books"("status");

-- CreateIndex
CREATE INDEX "decision_book_sections_sortOrder_idx" ON "decision_book_sections"("sortOrder");

-- AddForeignKey
ALTER TABLE "player_opportunity_profiles" ADD CONSTRAINT "player_opportunity_profiles_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "recommendations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_books" ADD CONSTRAINT "decision_books_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SeedData
INSERT INTO "opportunity_profiles" ("id", "code", "name", "description", "version", "active", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'improve-bat-control', 'Improve Bat Control™', 'Player would benefit from equipment that improves barrel control and contact consistency.', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'build-swing-confidence', 'Build Swing Confidence™', 'Player needs a setup that supports comfort, timing, and confidence in the box.', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'first-bbcor-transition', 'First BBCOR Transition™', 'Player is preparing for or entering the first BBCOR bat transition.', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'growth-spurt-equipment-review', 'Growth Spurt Equipment Review™', 'Recent growth may have changed the player''s equipment fit or readiness.', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'increase-barrel-impact', 'Increase Barrel Impact™', 'Player would benefit from equipment that improves quality of contact and barrel impact.', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'increase-swing-speed', 'Increase Swing Speed™', 'Player would benefit from a fit that helps increase usable swing speed.', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'current-equipment-still-fits', 'Current Equipment Still Fits™', 'Current equipment appears to remain suitable for the player''s present needs.', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "version" = EXCLUDED."version",
  "active" = EXCLUDED."active",
  "updatedAt" = CURRENT_TIMESTAMP;
