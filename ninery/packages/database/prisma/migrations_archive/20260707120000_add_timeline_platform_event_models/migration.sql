-- CreateEnum
CREATE TYPE "PlayerTimelineEventType" AS ENUM (
  'player_created',
  'profile_updated',
  'growth_measurement_added',
  'equipment_added',
  'batmatch_started',
  'batmatch_completed',
  'recommendation_generated',
  'decision_book_created',
  'outcome_recorded',
  'milestone_added'
);

-- CreateEnum
CREATE TYPE "PlatformEventType" AS ENUM (
  'user_registered',
  'family_created',
  'player_created',
  'player_profile_updated',
  'growth_measurement_added',
  'equipment_created',
  'equipment_dna_published',
  'batmatch_started',
  'batmatch_answer_submitted',
  'batmatch_completed',
  'recommendation_generated',
  'decision_book_created',
  'decision_book_shared',
  'ai_response_generated',
  'outcome_recorded'
);

-- DropForeignKey
ALTER TABLE "recommendation_items" DROP CONSTRAINT IF EXISTS "recommendation_items_equipmentVariantId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "recommendation_items_equipmentVariantId_idx";

-- AlterTable
ALTER TABLE "recommendation_items" DROP COLUMN IF EXISTS "equipmentVariantId";

-- CreateTable
CREATE TABLE "player_timeline_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "playerId" UUID NOT NULL,
    "eventType" "PlayerTimelineEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "relatedEntityType" TEXT,
    "relatedEntityId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_timeline_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "eventType" "PlatformEventType" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "player_timeline_events_playerId_idx" ON "player_timeline_events"("playerId");

-- CreateIndex
CREATE INDEX "player_timeline_events_eventType_idx" ON "player_timeline_events"("eventType");

-- CreateIndex
CREATE INDEX "player_timeline_events_eventDate_idx" ON "player_timeline_events"("eventDate");

-- CreateIndex
CREATE INDEX "player_timeline_events_relatedEntityType_idx" ON "player_timeline_events"("relatedEntityType");

-- CreateIndex
CREATE INDEX "platform_events_eventType_idx" ON "platform_events"("eventType");

-- CreateIndex
CREATE INDEX "platform_events_entityType_idx" ON "platform_events"("entityType");

-- CreateIndex
CREATE INDEX "platform_events_entityId_idx" ON "platform_events"("entityId");

-- CreateIndex
CREATE INDEX "platform_events_createdAt_idx" ON "platform_events"("createdAt");

-- AddForeignKey
ALTER TABLE "player_timeline_events" ADD CONSTRAINT "player_timeline_events_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
