-- Finance verification for hospital / P&L payment installments
CREATE TYPE "InstallmentVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

ALTER TABLE "PaymentInstallment"
  ADD COLUMN IF NOT EXISTS "verificationStatus" "InstallmentVerificationStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "verifiedById" TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejectionRemarks" TEXT;

-- Existing rows already recorded in production — treat as already verified
UPDATE "PaymentInstallment"
SET "verificationStatus" = 'VERIFIED',
    "verifiedAt" = COALESCE("verifiedAt", "createdAt")
WHERE "verificationStatus" = 'PENDING';

CREATE INDEX IF NOT EXISTS "PaymentInstallment_verificationStatus_idx"
  ON "PaymentInstallment"("verificationStatus");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PaymentInstallment_verifiedById_fkey'
  ) THEN
    ALTER TABLE "PaymentInstallment"
      ADD CONSTRAINT "PaymentInstallment_verifiedById_fkey"
      FOREIGN KEY ("verifiedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
