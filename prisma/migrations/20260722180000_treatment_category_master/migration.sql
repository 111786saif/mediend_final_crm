-- CreateTable
CREATE TABLE "TreatmentCategoryMaster" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreatmentCategoryMaster_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TreatmentCategoryMaster_name_key" ON "TreatmentCategoryMaster"("name");

-- CreateIndex
CREATE INDEX "TreatmentCategoryMaster_name_idx" ON "TreatmentCategoryMaster"("name");

-- CreateIndex
CREATE INDEX "TreatmentCategoryMaster_isActive_idx" ON "TreatmentCategoryMaster"("isActive");
