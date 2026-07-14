-- CreateEnum
CREATE TYPE "ATSStatus" AS ENUM ('NO_ATS', 'AUTO_APPROVED', 'PENDING_REVIEW');

-- CreateTable
CREATE TABLE "TreatmentMaster" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "atsNewDelhi" DOUBLE PRECISION,
    "atsMumbai" DOUBLE PRECISION,
    "atsPune" DOUBLE PRECISION,
    "atsHyderabad" DOUBLE PRECISION,
    "atsBangalore" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreatmentMaster_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TreatmentMaster_name_key" ON "TreatmentMaster"("name");

-- Add columns to Lead table
ALTER TABLE "Lead" ADD COLUMN "treatmentMasterId" TEXT;
ALTER TABLE "Lead" ADD COLUMN "atsAmount" DOUBLE PRECISION;
ALTER TABLE "Lead" ADD COLUMN "atsStatus" "ATSStatus" NOT NULL DEFAULT 'NO_ATS';

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_treatmentMasterId_fkey" FOREIGN KEY ("treatmentMasterId") REFERENCES "TreatmentMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;
