-- AlterEnum: Add CASH_IPD_DONE to CaseStage
ALTER TYPE "CaseStage" ADD VALUE 'CASH_IPD_DONE';

-- AlterTable: Add packageText and othersText to DischargeSheet
ALTER TABLE "DischargeSheet" ADD COLUMN "packageText" TEXT;
ALTER TABLE "DischargeSheet" ADD COLUMN "othersText" TEXT;
