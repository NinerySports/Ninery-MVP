-- CreateEnum
CREATE TYPE "BatMatchSessionType" AS ENUM ('first_batmatch', 'follow_up', 'growth_review', 'annual_review');

-- CreateEnum
CREATE TYPE "BatMatchSection" AS ENUM ('player_goals', 'current_equipment', 'swing_feel', 'performance_confidence', 'development_growth', 'preferences');

-- CreateEnum
CREATE TYPE "AnswerType" AS ENUM ('single_select', 'multi_select', 'text', 'number', 'boolean', 'scale');

-- DropForeignKey
ALTER TABLE "answers" DROP CONSTRAINT IF EXISTS "answers_batMatchSessionId_fkey";

-- DropForeignKey
ALTER TABLE "answers" DROP CONSTRAINT IF EXISTS "answers_questionId_fkey";

-- DropForeignKey
ALTER TABLE "decision_signals" DROP CONSTRAINT IF EXISTS "decision_signals_batMatchSessionId_fkey";

-- DropForeignKey
ALTER TABLE "decision_signals" DROP CONSTRAINT IF EXISTS "decision_signals_equipmentId_fkey";

-- DropForeignKey
ALTER TABLE "decision_signals" DROP CONSTRAINT IF EXISTS "decision_signals_equipmentVariantId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "answers_batMatchSessionId_questionId_key";

-- DropIndex
DROP INDEX IF EXISTS "answers_batMatchSessionId_idx";

-- DropIndex
DROP INDEX IF EXISTS "answers_questionId_idx";

-- DropIndex
DROP INDEX IF EXISTS "questions_key_key";

-- DropIndex
DROP INDEX IF EXISTS "questions_isActive_sortOrder_idx";

-- DropIndex
DROP INDEX IF EXISTS "decision_signals_batMatchSessionId_idx";

-- DropIndex
DROP INDEX IF EXISTS "decision_signals_equipmentId_idx";

-- DropIndex
DROP INDEX IF EXISTS "decision_signals_equipmentVariantId_idx";

-- DropIndex
DROP INDEX IF EXISTS "decision_signals_key_idx";

-- RenameTable
ALTER TABLE "questions" RENAME TO "bat_match_questions";

-- RenameTable
ALTER TABLE "answers" RENAME TO "bat_match_answers";

-- AlterEnum
ALTER TYPE "BatMatchSessionStatus" RENAME VALUE 'STARTED' TO 'started';
ALTER TYPE "BatMatchSessionStatus" RENAME VALUE 'COMPLETED' TO 'completed';
ALTER TYPE "BatMatchSessionStatus" RENAME VALUE 'ABANDONED' TO 'abandoned';

-- AlterTable
ALTER TABLE "bat_match_sessions" ADD COLUMN "type" "BatMatchSessionType" NOT NULL DEFAULT 'first_batmatch';
ALTER TABLE "bat_match_sessions" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "bat_match_sessions" ADD COLUMN "confidenceScore" DECIMAL(5,4);
ALTER TABLE "bat_match_sessions" DROP COLUMN "metadata";

-- AlterTable
ALTER TABLE "bat_match_questions" RENAME COLUMN "key" TO "code";
ALTER TABLE "bat_match_questions" RENAME COLUMN "text" TO "questionText";
ALTER TABLE "bat_match_questions" RENAME COLUMN "type" TO "answerType";
ALTER TABLE "bat_match_questions" RENAME COLUMN "isActive" TO "active";
ALTER TABLE "bat_match_questions" ADD COLUMN "section" "BatMatchSection" NOT NULL DEFAULT 'player_goals';
ALTER TABLE "bat_match_questions" ADD COLUMN "helperText" TEXT;
ALTER TABLE "bat_match_questions" ADD COLUMN "required" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "bat_match_questions" ADD COLUMN "confidenceWeight" DECIMAL(5,4) NOT NULL DEFAULT 1.0;
ALTER TABLE "bat_match_questions" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "bat_match_questions" ALTER COLUMN "answerType" TYPE "AnswerType" USING (
  CASE "answerType"::text
    WHEN 'SINGLE_SELECT' THEN 'single_select'::"AnswerType"
    WHEN 'MULTI_SELECT' THEN 'multi_select'::"AnswerType"
    WHEN 'TEXT' THEN 'text'::"AnswerType"
    WHEN 'NUMBER' THEN 'number'::"AnswerType"
    WHEN 'BOOLEAN' THEN 'boolean'::"AnswerType"
    ELSE 'text'::"AnswerType"
  END
);
ALTER TABLE "bat_match_questions" DROP COLUMN "sortOrder";

-- AlterTable
ALTER TABLE "bat_match_answers" RENAME COLUMN "batMatchSessionId" TO "sessionId";
ALTER TABLE "bat_match_answers" RENAME COLUMN "value" TO "answer";

-- AlterTable
ALTER TABLE "decision_signals" RENAME COLUMN "batMatchSessionId" TO "sessionId";
ALTER TABLE "decision_signals" RENAME COLUMN "key" TO "signalCode";
ALTER TABLE "decision_signals" RENAME COLUMN "label" TO "signalName";
ALTER TABLE "decision_signals" ADD COLUMN "playerId" UUID;
ALTER TABLE "decision_signals" ADD COLUMN "sourceAnswerId" UUID;
UPDATE "decision_signals"
SET "playerId" = "bat_match_sessions"."playerId"
FROM "bat_match_sessions"
WHERE "decision_signals"."sessionId" = "bat_match_sessions"."id";
ALTER TABLE "decision_signals" ALTER COLUMN "playerId" SET NOT NULL;
ALTER TABLE "decision_signals" RENAME COLUMN "value" TO "confidence";
ALTER TABLE "decision_signals" ALTER COLUMN "confidence" TYPE DECIMAL(5,4);
ALTER TABLE "decision_signals" DROP COLUMN "equipmentId";
ALTER TABLE "decision_signals" DROP COLUMN "equipmentVariantId";
ALTER TABLE "decision_signals" DROP COLUMN "weight";
ALTER TABLE "decision_signals" DROP COLUMN "rationale";
ALTER TABLE "decision_signals" DROP COLUMN "metadata";
ALTER TABLE "decision_signals" DROP COLUMN "updatedAt";

-- DropEnum
DROP TYPE "QuestionType";

-- CreateIndex
CREATE INDEX "bat_match_sessions_type_idx" ON "bat_match_sessions"("type");

-- CreateIndex
CREATE UNIQUE INDEX "bat_match_questions_code_key" ON "bat_match_questions"("code");

-- CreateIndex
CREATE INDEX "bat_match_questions_section_idx" ON "bat_match_questions"("section");

-- CreateIndex
CREATE INDEX "bat_match_questions_active_idx" ON "bat_match_questions"("active");

-- CreateIndex
CREATE UNIQUE INDEX "bat_match_answers_sessionId_questionId_key" ON "bat_match_answers"("sessionId", "questionId");

-- CreateIndex
CREATE INDEX "bat_match_answers_sessionId_idx" ON "bat_match_answers"("sessionId");

-- CreateIndex
CREATE INDEX "bat_match_answers_questionId_idx" ON "bat_match_answers"("questionId");

-- CreateIndex
CREATE INDEX "decision_signals_sessionId_idx" ON "decision_signals"("sessionId");

-- CreateIndex
CREATE INDEX "decision_signals_playerId_idx" ON "decision_signals"("playerId");

-- CreateIndex
CREATE INDEX "decision_signals_signalCode_idx" ON "decision_signals"("signalCode");

-- AddForeignKey
ALTER TABLE "bat_match_answers" ADD CONSTRAINT "bat_match_answers_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "bat_match_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bat_match_answers" ADD CONSTRAINT "bat_match_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "bat_match_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_signals" ADD CONSTRAINT "decision_signals_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "bat_match_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_signals" ADD CONSTRAINT "decision_signals_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_signals" ADD CONSTRAINT "decision_signals_sourceAnswerId_fkey" FOREIGN KEY ("sourceAnswerId") REFERENCES "bat_match_answers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- SeedData
INSERT INTO "bat_match_questions" (
  "id",
  "code",
  "section",
  "questionText",
  "helperText",
  "answerType",
  "options",
  "required",
  "confidenceWeight",
  "version",
  "active",
  "createdAt",
  "updatedAt"
)
VALUES
  (gen_random_uuid(), 'biggest-goal-this-season', 'player_goals', 'Biggest goal this season', 'Choose the outcome that matters most for this player right now.', 'single_select', '["more_contact","more_power","more_confidence","better_fit","prepare_for_next_level"]'::jsonb, true, 1.0000, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'current-bat-feel', 'current_equipment', 'Current bat feel', 'How does the current bat feel during normal swings?', 'single_select', '["too_heavy","too_light","balanced","end_loaded","not_sure"]'::jsonb, true, 1.0000, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'hardest-at-plate', 'swing_feel', 'What feels hardest at the plate', 'Pick the challenge that shows up most often.', 'single_select', '["catching_up","making_contact","driving_ball","controlling_barrel","confidence"]'::jsonb, true, 1.0000, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'box-confidence', 'performance_confidence', 'Confidence in the batter''s box', 'Use a 1 to 5 scale where 5 means very confident.', 'scale', '{"min":1,"max":5}'::jsonb, true, 0.9000, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'competition-level-confirmation', 'development_growth', 'Current competition level confirmation', 'Confirm the level this player is currently facing.', 'single_select', '["recreational","school","travel","elite","unknown"]'::jsonb, true, 0.8000, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'recent-growth-change', 'development_growth', 'Recent growth change', 'Has the player had a noticeable growth change recently?', 'single_select', '["none","small","moderate","major","not_sure"]'::jsonb, true, 0.8000, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'preferred-swing-feel', 'preferences', 'Preferred swing feel', 'What swing feel does the player prefer or respond to best?', 'single_select', '["light_and_quick","balanced","power_loaded","not_sure"]'::jsonb, true, 0.9000, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'budget-comfort-level', 'preferences', 'Budget comfort level', 'Select the price range that feels comfortable for this recommendation.', 'single_select', '["value","mid_range","premium","no_preference"]'::jsonb, true, 0.7000, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "section" = EXCLUDED."section",
  "questionText" = EXCLUDED."questionText",
  "helperText" = EXCLUDED."helperText",
  "answerType" = EXCLUDED."answerType",
  "options" = EXCLUDED."options",
  "required" = EXCLUDED."required",
  "confidenceWeight" = EXCLUDED."confidenceWeight",
  "version" = EXCLUDED."version",
  "active" = EXCLUDED."active",
  "updatedAt" = CURRENT_TIMESTAMP;
