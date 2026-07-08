-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RecommendationItemType" AS ENUM ('BEST_MATCH', 'ALTERNATIVE', 'BUDGET_PICK', 'PREMIUM_PICK');

-- CreateEnum
CREATE TYPE "DecisionBookSectionType" AS ENUM ('SUMMARY', 'FIT_REASONING', 'TRADEOFFS', 'CARE_GUIDANCE', 'NEXT_STEPS', 'CUSTOM');

-- CreateTable
CREATE TABLE "recommendations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "playerId" UUID NOT NULL,
    "batMatchSessionId" UUID,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'DRAFT',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "recommendationId" UUID NOT NULL,
    "equipmentId" UUID NOT NULL,
    "equipmentVariantId" UUID,
    "type" "RecommendationItemType" NOT NULL DEFAULT 'ALTERNATIVE',
    "rank" INTEGER NOT NULL,
    "score" DECIMAL(8,4) NOT NULL,
    "rationale" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recommendation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "criteria" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunity_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_opportunity_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "playerId" UUID NOT NULL,
    "opportunityProfileId" UUID NOT NULL,
    "score" DECIMAL(8,4) NOT NULL,
    "confidence" DECIMAL(8,4),
    "rationale" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_opportunity_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_books" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "recommendationId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "decision_books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_book_sections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "decisionBookId" UUID NOT NULL,
    "type" "DecisionBookSectionType" NOT NULL DEFAULT 'CUSTOM',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "decision_book_sections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recommendations_playerId_idx" ON "recommendations"("playerId");

-- CreateIndex
CREATE INDEX "recommendations_batMatchSessionId_idx" ON "recommendations"("batMatchSessionId");

-- CreateIndex
CREATE INDEX "recommendations_status_idx" ON "recommendations"("status");

-- CreateIndex
CREATE INDEX "recommendations_playerId_generatedAt_idx" ON "recommendations"("playerId", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "recommendation_items_recommendationId_rank_key" ON "recommendation_items"("recommendationId", "rank");

-- CreateIndex
CREATE INDEX "recommendation_items_recommendationId_idx" ON "recommendation_items"("recommendationId");

-- CreateIndex
CREATE INDEX "recommendation_items_equipmentId_idx" ON "recommendation_items"("equipmentId");

-- CreateIndex
CREATE INDEX "recommendation_items_equipmentVariantId_idx" ON "recommendation_items"("equipmentVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "opportunity_profiles_key_key" ON "opportunity_profiles"("key");

-- CreateIndex
CREATE UNIQUE INDEX "player_opportunity_profiles_playerId_opportunityProfileId_key" ON "player_opportunity_profiles"("playerId", "opportunityProfileId");

-- CreateIndex
CREATE INDEX "player_opportunity_profiles_playerId_idx" ON "player_opportunity_profiles"("playerId");

-- CreateIndex
CREATE INDEX "player_opportunity_profiles_opportunityProfileId_idx" ON "player_opportunity_profiles"("opportunityProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "decision_books_recommendationId_key" ON "decision_books"("recommendationId");

-- CreateIndex
CREATE INDEX "decision_book_sections_decisionBookId_idx" ON "decision_book_sections"("decisionBookId");

-- CreateIndex
CREATE INDEX "decision_book_sections_decisionBookId_sortOrder_idx" ON "decision_book_sections"("decisionBookId", "sortOrder");

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_batMatchSessionId_fkey" FOREIGN KEY ("batMatchSessionId") REFERENCES "bat_match_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_items" ADD CONSTRAINT "recommendation_items_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "recommendations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_items" ADD CONSTRAINT "recommendation_items_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_items" ADD CONSTRAINT "recommendation_items_equipmentVariantId_fkey" FOREIGN KEY ("equipmentVariantId") REFERENCES "equipment_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_opportunity_profiles" ADD CONSTRAINT "player_opportunity_profiles_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_opportunity_profiles" ADD CONSTRAINT "player_opportunity_profiles_opportunityProfileId_fkey" FOREIGN KEY ("opportunityProfileId") REFERENCES "opportunity_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_books" ADD CONSTRAINT "decision_books_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "recommendations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_book_sections" ADD CONSTRAINT "decision_book_sections_decisionBookId_fkey" FOREIGN KEY ("decisionBookId") REFERENCES "decision_books"("id") ON DELETE CASCADE ON UPDATE CASCADE;
