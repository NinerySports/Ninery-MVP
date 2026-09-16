-- CreateEnum
CREATE TYPE "CurrentEquipmentFamiliarityLevel" AS ENUM ('new_or_unfamiliar', 'limited_familiarity', 'developing_familiarity', 'established_familiarity', 'highly_established_familiarity', 'unknown');

-- CreateEnum
CREATE TYPE "CurrentEquipmentFamiliarityConfidence" AS ENUM ('estimated', 'moderate', 'high');

-- CreateEnum
CREATE TYPE "CurrentEquipmentFamiliaritySource" AS ENUM ('player', 'parent_or_guardian', 'coach', 'internal_staff', 'system_history', 'combined');

-- CreateEnum
CREATE TYPE "TransitionShadowStudyStatus" AS ENUM ('draft', 'prediction_captured', 'observation_active', 'observation_complete', 'cancelled', 'invalidated');

-- CreateEnum
CREATE TYPE "TransitionObservationCheckpoint" AS ENUM ('first_use', 'early_sessions', 'acclimation_period', 'custom');

-- CreateEnum
CREATE TYPE "TransitionObservationSource" AS ENUM ('player', 'parent_or_guardian', 'coach', 'internal_staff', 'combined');

-- CreateEnum
CREATE TYPE "TransitionObservationConfidence" AS ENUM ('low', 'moderate', 'high');

-- CreateTable
CREATE TABLE "current_equipment_familiarity_records" (
    "id" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "equipmentId" UUID NOT NULL,
    "equipmentVariantId" UUID,
    "level" "CurrentEquipmentFamiliarityLevel" NOT NULL,
    "numericReference" DECIMAL(5,2),
    "confidence" "CurrentEquipmentFamiliarityConfidence" NOT NULL,
    "source" "CurrentEquipmentFamiliaritySource" NOT NULL,
    "inputSnapshot" JSONB NOT NULL,
    "evaluationReasons" JSONB NOT NULL,
    "evaluationWarnings" JSONB NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "current_equipment_familiarity_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transition_extended_shadow_studies" (
    "id" UUID NOT NULL,
    "studyKey" TEXT NOT NULL,
    "playerId" UUID NOT NULL,
    "currentEquipmentId" UUID NOT NULL,
    "currentEquipmentVariantId" UUID,
    "proposedEquipmentId" UUID NOT NULL,
    "proposedEquipmentVariantId" UUID,
    "status" "TransitionShadowStudyStatus" NOT NULL DEFAULT 'draft',
    "studyVersion" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "familiarityRecordId" UUID,
    "predictionSnapshot" JSONB,
    "predictionInputHash" TEXT,
    "predictionHash" TEXT,
    "transitionModelVersion" TEXT,
    "transitionPolicyVersion" TEXT,
    "interpolationVersion" TEXT,
    "predictedAt" TIMESTAMP(3),
    "observationWindowStartedAt" TIMESTAMP(3),
    "observationWindowCompletedAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "invalidationReason" TEXT,
    "fixtureKind" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transition_extended_shadow_studies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transition_extended_shadow_observations" (
    "id" UUID NOT NULL,
    "studyId" UUID NOT NULL,
    "checkpoint" "TransitionObservationCheckpoint" NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "source" "TransitionObservationSource" NOT NULL,
    "directlyWitnessed" BOOLEAN NOT NULL,
    "observationConfidence" "TransitionObservationConfidence" NOT NULL,
    "equipmentActuallyUsed" BOOLEAN NOT NULL,
    "meaningfulUseOccurred" BOOLEAN NOT NULL,
    "adjustmentObservation" JSONB NOT NULL,
    "sessionContext" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transition_extended_shadow_observations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "current_equipment_familiarity_records_playerId_idx" ON "current_equipment_familiarity_records"("playerId");

-- CreateIndex
CREATE INDEX "current_equipment_familiarity_records_equipmentId_idx" ON "current_equipment_familiarity_records"("equipmentId");

-- CreateIndex
CREATE INDEX "current_equipment_familiarity_records_equipmentVariantId_idx" ON "current_equipment_familiarity_records"("equipmentVariantId");

-- CreateIndex
CREATE INDEX "current_equipment_familiarity_records_capturedAt_idx" ON "current_equipment_familiarity_records"("capturedAt");

-- CreateIndex
CREATE INDEX "current_equipment_familiarity_records_modelVersion_idx" ON "current_equipment_familiarity_records"("modelVersion");

-- CreateIndex
CREATE UNIQUE INDEX "transition_extended_shadow_studies_studyKey_key" ON "transition_extended_shadow_studies"("studyKey");

-- CreateIndex
CREATE INDEX "transition_extended_shadow_studies_playerId_idx" ON "transition_extended_shadow_studies"("playerId");

-- CreateIndex
CREATE INDEX "transition_extended_shadow_studies_status_idx" ON "transition_extended_shadow_studies"("status");

-- CreateIndex
CREATE INDEX "transition_extended_shadow_studies_currentEquipmentId_idx" ON "transition_extended_shadow_studies"("currentEquipmentId");

-- CreateIndex
CREATE INDEX "transition_extended_shadow_studies_proposedEquipmentId_idx" ON "transition_extended_shadow_studies"("proposedEquipmentId");

-- CreateIndex
CREATE INDEX "transition_extended_shadow_studies_createdAt_idx" ON "transition_extended_shadow_studies"("createdAt");

-- CreateIndex
CREATE INDEX "transition_extended_shadow_studies_predictedAt_idx" ON "transition_extended_shadow_studies"("predictedAt");

-- CreateIndex
CREATE INDEX "transition_extended_shadow_studies_transitionModelVersion_idx" ON "transition_extended_shadow_studies"("transitionModelVersion");

-- CreateIndex
CREATE INDEX "transition_extended_shadow_studies_familiarityRecordId_idx" ON "transition_extended_shadow_studies"("familiarityRecordId");

-- CreateIndex
CREATE INDEX "transition_extended_shadow_observations_studyId_idx" ON "transition_extended_shadow_observations"("studyId");

-- CreateIndex
CREATE INDEX "transition_extended_shadow_observations_checkpoint_idx" ON "transition_extended_shadow_observations"("checkpoint");

-- CreateIndex
CREATE INDEX "transition_extended_shadow_observations_observedAt_idx" ON "transition_extended_shadow_observations"("observedAt");

-- CreateIndex
CREATE INDEX "transition_extended_shadow_observations_source_idx" ON "transition_extended_shadow_observations"("source");

-- AddForeignKey
ALTER TABLE "current_equipment_familiarity_records" ADD CONSTRAINT "current_equipment_familiarity_records_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "current_equipment_familiarity_records" ADD CONSTRAINT "current_equipment_familiarity_records_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "current_equipment_familiarity_records" ADD CONSTRAINT "current_equipment_familiarity_records_equipmentVariantId_fkey" FOREIGN KEY ("equipmentVariantId") REFERENCES "equipment_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transition_extended_shadow_studies" ADD CONSTRAINT "transition_extended_shadow_studies_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transition_extended_shadow_studies" ADD CONSTRAINT "transition_extended_shadow_studies_currentEquipmentId_fkey" FOREIGN KEY ("currentEquipmentId") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transition_extended_shadow_studies" ADD CONSTRAINT "transition_extended_shadow_studies_currentEquipmentVariant_fkey" FOREIGN KEY ("currentEquipmentVariantId") REFERENCES "equipment_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transition_extended_shadow_studies" ADD CONSTRAINT "transition_extended_shadow_studies_proposedEquipmentId_fkey" FOREIGN KEY ("proposedEquipmentId") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transition_extended_shadow_studies" ADD CONSTRAINT "transition_extended_shadow_studies_proposedEquipmentVarian_fkey" FOREIGN KEY ("proposedEquipmentVariantId") REFERENCES "equipment_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transition_extended_shadow_studies" ADD CONSTRAINT "transition_extended_shadow_studies_familiarityRecordId_fkey" FOREIGN KEY ("familiarityRecordId") REFERENCES "current_equipment_familiarity_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transition_extended_shadow_observations" ADD CONSTRAINT "transition_extended_shadow_observations_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "transition_extended_shadow_studies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
