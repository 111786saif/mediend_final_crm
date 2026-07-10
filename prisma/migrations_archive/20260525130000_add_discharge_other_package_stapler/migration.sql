-- AlterTable: Add optional otherCharges, packageAmount, staplerCharges to DischargeSheet
ALTER TABLE "DischargeSheet" ADD COLUMN "otherCharges" TEXT;
ALTER TABLE "DischargeSheet" ADD COLUMN "packageAmount" TEXT;
ALTER TABLE "DischargeSheet" ADD COLUMN "staplerCharges" TEXT;
