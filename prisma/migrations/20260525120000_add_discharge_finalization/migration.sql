-- Two-step discharge flow:
-- Insurance MARKS the patient discharged (creates DischargeSheet row with just
-- dischargeDate + markedBy/markedAt + isFinalized=false). Later they FINALIZE
-- by filling the full form — that flips isFinalized=true and runs the
-- PLRecord auto-create / pipeline=PL / compliance side effects.

-- AlterTable
ALTER TABLE "DischargeSheet"
  ADD COLUMN IF NOT EXISTS "isFinalized" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "markedById" TEXT,
  ADD COLUMN IF NOT EXISTS "markedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "finalizedById" TEXT,
  ADD COLUMN IF NOT EXISTS "finalizedAt" TIMESTAMP(3);

-- Backfill: any pre-existing DischargeSheet rows were created under the old
-- single-step flow (POST = create + finalize), so they are by definition
-- finalized.
UPDATE "DischargeSheet"
  SET "isFinalized" = true,
      "finalizedAt" = COALESCE("finalizedAt", "createdAt"),
      "finalizedById" = COALESCE("finalizedById", "createdById"),
      "markedAt" = COALESCE("markedAt", "createdAt"),
      "markedById" = COALESCE("markedById", "createdById")
  WHERE "isFinalized" = false;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DischargeSheet_markedById_fkey'
  ) THEN
    ALTER TABLE "DischargeSheet"
      ADD CONSTRAINT "DischargeSheet_markedById_fkey"
      FOREIGN KEY ("markedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DischargeSheet_finalizedById_fkey'
  ) THEN
    ALTER TABLE "DischargeSheet"
      ADD CONSTRAINT "DischargeSheet_finalizedById_fkey"
      FOREIGN KEY ("finalizedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DischargeSheet_isFinalized_idx" ON "DischargeSheet"("isFinalized");
