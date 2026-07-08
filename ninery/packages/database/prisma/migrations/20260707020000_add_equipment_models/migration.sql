-- CreateTable
CREATE TABLE "equipment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "brand" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_variants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "equipmentId" UUID NOT NULL,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "size" TEXT,
    "color" TEXT,
    "attributes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_dna" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "equipmentId" UUID NOT NULL,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_dna_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_characteristics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_characteristics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_dna_scores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "equipmentDNAId" UUID NOT NULL,
    "characteristicId" UUID NOT NULL,
    "score" DECIMAL(5,2) NOT NULL,
    "confidence" DECIMAL(5,2),
    "rationale" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_dna_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "equipment_brand_idx" ON "equipment"("brand");

-- CreateIndex
CREATE INDEX "equipment_category_idx" ON "equipment"("category");

-- CreateIndex
CREATE INDEX "equipment_brand_name_idx" ON "equipment"("brand", "name");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_variants_sku_key" ON "equipment_variants"("sku");

-- CreateIndex
CREATE INDEX "equipment_variants_equipmentId_idx" ON "equipment_variants"("equipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_dna_equipmentId_key" ON "equipment_dna"("equipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_characteristics_key_key" ON "equipment_characteristics"("key");

-- CreateIndex
CREATE INDEX "equipment_characteristics_sortOrder_idx" ON "equipment_characteristics"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_dna_scores_equipmentDNAId_characteristicId_key" ON "equipment_dna_scores"("equipmentDNAId", "characteristicId");

-- CreateIndex
CREATE INDEX "equipment_dna_scores_equipmentDNAId_idx" ON "equipment_dna_scores"("equipmentDNAId");

-- CreateIndex
CREATE INDEX "equipment_dna_scores_characteristicId_idx" ON "equipment_dna_scores"("characteristicId");

-- AddForeignKey
ALTER TABLE "equipment_variants" ADD CONSTRAINT "equipment_variants_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_dna" ADD CONSTRAINT "equipment_dna_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_dna_scores" ADD CONSTRAINT "equipment_dna_scores_equipmentDNAId_fkey" FOREIGN KEY ("equipmentDNAId") REFERENCES "equipment_dna"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_dna_scores" ADD CONSTRAINT "equipment_dna_scores_characteristicId_fkey" FOREIGN KEY ("characteristicId") REFERENCES "equipment_characteristics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
