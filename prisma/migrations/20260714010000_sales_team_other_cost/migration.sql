-- AlterTable
ALTER TABLE "EmployeeMonthlySeatingMiscCost" ADD COLUMN IF NOT EXISTS "otherCost" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "EmployeeMonthlySeatingMiscCostHistory" ADD COLUMN IF NOT EXISTS "otherCost" DOUBLE PRECISION NOT NULL DEFAULT 0;
