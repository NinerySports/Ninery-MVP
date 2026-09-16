-- CreateTable
CREATE TABLE "growth_measurements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "playerId" UUID NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "heightInches" DECIMAL(5,2),
    "weightPounds" DECIMAL(6,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "growth_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "growth_measurements_playerId_idx" ON "growth_measurements"("playerId");

-- CreateIndex
CREATE INDEX "growth_measurements_playerId_measuredAt_idx" ON "growth_measurements"("playerId", "measuredAt");

-- AddForeignKey
ALTER TABLE "growth_measurements" ADD CONSTRAINT "growth_measurements_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
