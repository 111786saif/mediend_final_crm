-- AlterTable: discharge sheet restructure — anesthesia charge, computed
-- "other charges", the deduction split (copay / other, collected by hospital /
-- mediend), axis tariff deduction + paid, the computed actual final amount, and
-- the approval-letter / deduction-receipt upload URLs.
--
-- NOTE: this DB is `prisma db push`-managed and its migration history is desynced
-- from the live schema, so these columns were already applied to production via
-- `prisma db execute` (see prisma/manual/discharge-restructure-columns.sql).
-- IF NOT EXISTS keeps this migration idempotent on that instance while still
-- creating the columns on a fresh `prisma migrate deploy` database.
ALTER TABLE "DischargeSheet" ADD COLUMN IF NOT EXISTS "anesthesiaAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "DischargeSheet" ADD COLUMN IF NOT EXISTS "otherChargesAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "DischargeSheet" ADD COLUMN IF NOT EXISTS "copayAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "DischargeSheet" ADD COLUMN IF NOT EXISTS "collectedByHospital" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "DischargeSheet" ADD COLUMN IF NOT EXISTS "collectedByMediend" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "DischargeSheet" ADD COLUMN IF NOT EXISTS "axisTariffDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "DischargeSheet" ADD COLUMN IF NOT EXISTS "axisTariffDeductionPaid" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "DischargeSheet" ADD COLUMN IF NOT EXISTS "actualFinalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "DischargeSheet" ADD COLUMN IF NOT EXISTS "finalApprovedUrl" TEXT;
ALTER TABLE "DischargeSheet" ADD COLUMN IF NOT EXISTS "deductionReceiptUrl" TEXT;
