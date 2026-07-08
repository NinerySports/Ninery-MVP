-- CreateEnum
CREATE TYPE "BatMatchSessionStatus" AS ENUM ('STARTED', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('SINGLE_SELECT', 'MULTI_SELECT', 'NUMBER', 'TEXT', 'BOOLEAN');

-- CreateTable
CREATE TABLE "bat_match_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "playerId" UUID NOT NULL,
    "status" "BatMatchSessionStatus" NOT NULL DEFAULT 'STARTED',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bat_match_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "options" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "batMatchSessionId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_signals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "batMatchSessionId" UUID NOT NULL,
    "equipmentId" UUID,
    "equipmentVariantId" UUID,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" DECIMAL(8,4) NOT NULL,
    "weight" DECIMAL(8,4),
    "rationale" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "decision_signals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bat_match_sessions_playerId_idx" ON "bat_match_sessions"("playerId");

-- CreateIndex
CREATE INDEX "bat_match_sessions_status_idx" ON "bat_match_sessions"("status");

-- CreateIndex
CREATE INDEX "bat_match_sessions_playerId_startedAt_idx" ON "bat_match_sessions"("playerId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "questions_key_key" ON "questions"("key");

-- CreateIndex
CREATE INDEX "questions_isActive_sortOrder_idx" ON "questions"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "answers_batMatchSessionId_questionId_key" ON "answers"("batMatchSessionId", "questionId");

-- CreateIndex
CREATE INDEX "answers_batMatchSessionId_idx" ON "answers"("batMatchSessionId");

-- CreateIndex
CREATE INDEX "answers_questionId_idx" ON "answers"("questionId");

-- CreateIndex
CREATE INDEX "decision_signals_batMatchSessionId_idx" ON "decision_signals"("batMatchSessionId");

-- CreateIndex
CREATE INDEX "decision_signals_equipmentId_idx" ON "decision_signals"("equipmentId");

-- CreateIndex
CREATE INDEX "decision_signals_equipmentVariantId_idx" ON "decision_signals"("equipmentVariantId");

-- CreateIndex
CREATE INDEX "decision_signals_key_idx" ON "decision_signals"("key");

-- AddForeignKey
ALTER TABLE "bat_match_sessions" ADD CONSTRAINT "bat_match_sessions_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_batMatchSessionId_fkey" FOREIGN KEY ("batMatchSessionId") REFERENCES "bat_match_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_signals" ADD CONSTRAINT "decision_signals_batMatchSessionId_fkey" FOREIGN KEY ("batMatchSessionId") REFERENCES "bat_match_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_signals" ADD CONSTRAINT "decision_signals_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_signals" ADD CONSTRAINT "decision_signals_equipmentVariantId_fkey" FOREIGN KEY ("equipmentVariantId") REFERENCES "equipment_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
