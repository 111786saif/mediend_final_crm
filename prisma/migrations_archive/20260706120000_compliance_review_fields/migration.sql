-- Idempotent: safe to re-run if partially applied
DO $$ BEGIN
  CREATE TYPE "ReviewStatus" AS ENUM ('DONE', 'NOT_DONE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "ComplianceCall" ADD COLUMN IF NOT EXISTS "reviewStatus" "ReviewStatus";
ALTER TABLE "ComplianceCall" ADD COLUMN IF NOT EXISTS "reviewScreenshot" TEXT;

CREATE INDEX IF NOT EXISTS "ComplianceCall_reviewStatus_idx" ON "ComplianceCall"("reviewStatus");
