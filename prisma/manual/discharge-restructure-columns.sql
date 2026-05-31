-- Discharge sheet restructure — additive columns only (safe, idempotent).
-- Applied manually via `prisma db execute` because this DB is db-push-managed
-- and schema.prisma carries unrelated drift (leadDate→assignedDate rename) that
-- a full `db push` / `migrate dev` would act on. These ALTERs touch only the
-- new DischargeSheet columns.
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
