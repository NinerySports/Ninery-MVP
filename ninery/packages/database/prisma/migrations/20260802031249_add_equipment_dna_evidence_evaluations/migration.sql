-- CreateEnum
CREATE TYPE "EquipmentDNATargetLevel" AS ENUM ('equipment', 'variant');

-- CreateEnum
CREATE TYPE "EquipmentDNAEvidenceSourceType" AS ENUM ('manufacturer_specification', 'objective_measurement', 'structured_expert_evaluation', 'player_feedback', 'parent_feedback', 'coach_feedback', 'field_observation', 'historical_outcome', 'internal_derived', 'other');

-- CreateEnum
CREATE TYPE "EquipmentDNAEvidenceRecordStatus" AS ENUM ('active', 'superseded', 'disputed', 'withdrawn');

-- CreateEnum
CREATE TYPE "EquipmentEvaluationMethod" AS ENUM ('direct_specification', 'instrument_measurement', 'standardized_rubric', 'multi_evaluator_consensus', 'structured_feedback', 'derived_mapping', 'manual_review');

-- CreateEnum
CREATE TYPE "EquipmentAttributeConfidence" AS ENUM ('validated', 'high', 'moderate', 'estimated');

-- CreateEnum
CREATE TYPE "EquipmentDNAAttributeEvaluationStatus" AS ENUM ('draft', 'active', 'superseded', 'rejected');

-- CreateEnum
CREATE TYPE "EquipmentDNAEvaluatorType" AS ENUM ('system', 'staff', 'expert', 'external');

-- CreateTable
CREATE TABLE "equipment_dna_evidence_records" (
    "id" UUID NOT NULL,
    "equipmentId" UUID,
    "equipmentVariantId" UUID,
    "targetLevel" "EquipmentDNATargetLevel" NOT NULL,
    "attributeKey" TEXT NOT NULL,
    "attributeDefinitionVersion" TEXT NOT NULL,
    "sourceType" "EquipmentDNAEvidenceSourceType" NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceReference" TEXT,
    "sourceDate" TIMESTAMP(3),
    "retrievedAt" TIMESTAMP(3),
    "method" "EquipmentEvaluationMethod" NOT NULL,
    "rawValue" JSONB,
    "normalizedValue" JSONB,
    "unit" TEXT,
    "notes" TEXT,
    "status" "EquipmentDNAEvidenceRecordStatus" NOT NULL DEFAULT 'active',
    "evaluatorType" "EquipmentDNAEvaluatorType",
    "evaluatorReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_dna_evidence_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_dna_attribute_evaluations" (
    "id" UUID NOT NULL,
    "equipmentId" UUID,
    "equipmentVariantId" UUID,
    "targetLevel" "EquipmentDNATargetLevel" NOT NULL,
    "attributeKey" TEXT NOT NULL,
    "attributeDefinitionVersion" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "confidence" "EquipmentAttributeConfidence" NOT NULL DEFAULT 'estimated',
    "evaluationMethod" "EquipmentEvaluationMethod" NOT NULL,
    "evaluationVersion" INTEGER NOT NULL DEFAULT 1,
    "status" "EquipmentDNAAttributeEvaluationStatus" NOT NULL DEFAULT 'draft',
    "rationale" TEXT,
    "evaluatedAt" TIMESTAMP(3),
    "reviewDueAt" TIMESTAMP(3),
    "supersedesEvaluationId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_dna_attribute_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_dna_attribute_evaluation_evidence" (
    "evaluationId" UUID NOT NULL,
    "evidenceRecordId" UUID NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_dna_attribute_evaluation_evidence_pkey" PRIMARY KEY ("evaluationId","evidenceRecordId")
);

-- CreateIndex
CREATE INDEX "equipment_dna_evidence_records_equipmentId_idx" ON "equipment_dna_evidence_records"("equipmentId");

-- CreateIndex
CREATE INDEX "equipment_dna_evidence_records_equipmentVariantId_idx" ON "equipment_dna_evidence_records"("equipmentVariantId");

-- CreateIndex
CREATE INDEX "equipment_dna_evidence_records_targetLevel_idx" ON "equipment_dna_evidence_records"("targetLevel");

-- CreateIndex
CREATE INDEX "equipment_dna_evidence_records_attributeKey_idx" ON "equipment_dna_evidence_records"("attributeKey");

-- CreateIndex
CREATE INDEX "equipment_dna_evidence_records_attributeDefinitionVersion_idx" ON "equipment_dna_evidence_records"("attributeDefinitionVersion");

-- CreateIndex
CREATE INDEX "equipment_dna_evidence_records_sourceType_idx" ON "equipment_dna_evidence_records"("sourceType");

-- CreateIndex
CREATE INDEX "equipment_dna_evidence_records_status_idx" ON "equipment_dna_evidence_records"("status");

-- CreateIndex
CREATE INDEX "equipment_dna_evidence_records_createdAt_idx" ON "equipment_dna_evidence_records"("createdAt");

-- CreateIndex
CREATE INDEX "equipment_dna_attribute_evaluations_equipmentId_idx" ON "equipment_dna_attribute_evaluations"("equipmentId");

-- CreateIndex
CREATE INDEX "equipment_dna_attribute_evaluations_equipmentVariantId_idx" ON "equipment_dna_attribute_evaluations"("equipmentVariantId");

-- CreateIndex
CREATE INDEX "equipment_dna_attribute_evaluations_targetLevel_idx" ON "equipment_dna_attribute_evaluations"("targetLevel");

-- CreateIndex
CREATE INDEX "equipment_dna_attribute_evaluations_attributeKey_idx" ON "equipment_dna_attribute_evaluations"("attributeKey");

-- CreateIndex
CREATE INDEX "equipment_dna_attribute_evaluations_attributeDefinitionVers_idx" ON "equipment_dna_attribute_evaluations"("attributeDefinitionVersion");

-- CreateIndex
CREATE INDEX "equipment_dna_attribute_evaluations_status_idx" ON "equipment_dna_attribute_evaluations"("status");

-- CreateIndex
CREATE INDEX "equipment_dna_attribute_evaluations_evaluationVersion_idx" ON "equipment_dna_attribute_evaluations"("evaluationVersion");

-- CreateIndex
CREATE INDEX "equipment_dna_attribute_evaluations_evaluatedAt_idx" ON "equipment_dna_attribute_evaluations"("evaluatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_dna_attribute_evaluations_equipmentId_equipmentVa_key" ON "equipment_dna_attribute_evaluations"("equipmentId", "equipmentVariantId", "attributeKey", "attributeDefinitionVersion", "evaluationVersion");

-- CreateIndex
CREATE INDEX "equipment_dna_attribute_evaluation_evidence_evidenceRecordI_idx" ON "equipment_dna_attribute_evaluation_evidence"("evidenceRecordId");

-- AddForeignKey
ALTER TABLE "equipment_dna_evidence_records" ADD CONSTRAINT "equipment_dna_evidence_records_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_dna_evidence_records" ADD CONSTRAINT "equipment_dna_evidence_records_equipmentVariantId_fkey" FOREIGN KEY ("equipmentVariantId") REFERENCES "equipment_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_dna_attribute_evaluations" ADD CONSTRAINT "equipment_dna_attribute_evaluations_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_dna_attribute_evaluations" ADD CONSTRAINT "equipment_dna_attribute_evaluations_equipmentVariantId_fkey" FOREIGN KEY ("equipmentVariantId") REFERENCES "equipment_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_dna_attribute_evaluation_evidence" ADD CONSTRAINT "equipment_dna_attribute_evaluation_evidence_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "equipment_dna_attribute_evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_dna_attribute_evaluation_evidence" ADD CONSTRAINT "equipment_dna_attribute_evaluation_evidence_evidenceRecord_fkey" FOREIGN KEY ("evidenceRecordId") REFERENCES "equipment_dna_evidence_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
