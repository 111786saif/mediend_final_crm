ALTER TABLE "PLRecord"
  ADD COLUMN "caseType" TEXT,
  ADD COLUMN "instrumentsPaymentStatus" TEXT,
  ADD COLUMN "cabStatus" TEXT,
  ADD COLUMN "emiSubventionPct" DOUBLE PRECISION,
  ADD COLUMN "emiSubventionCharges" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "referralPct" DOUBLE PRECISION,
  ADD COLUMN "referralStatus" TEXT,
  ADD COLUMN "referralName" TEXT;
