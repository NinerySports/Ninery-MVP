-- CreateEnum
CREATE TYPE "ReferenceDataType" AS ENUM (
  'manufacturer',
  'position',
  'competition_level',
  'certification',
  'equipment_category',
  'development_stage'
);

-- CreateTable
CREATE TABLE "reference_data" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" "ReferenceDataType" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reference_data_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reference_data_type_code_key" ON "reference_data"("type", "code");

-- CreateIndex
CREATE INDEX "reference_data_type_idx" ON "reference_data"("type");

-- CreateIndex
CREATE INDEX "reference_data_active_idx" ON "reference_data"("active");
