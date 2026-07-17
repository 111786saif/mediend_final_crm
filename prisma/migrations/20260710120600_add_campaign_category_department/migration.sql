ALTER TABLE "CrmCampaign"
ADD COLUMN IF NOT EXISTS "category" TEXT,
ADD COLUMN IF NOT EXISTS "departmentId" TEXT;

CREATE INDEX IF NOT EXISTS "CrmCampaign_category_idx" ON "CrmCampaign"("category");
CREATE INDEX IF NOT EXISTS "CrmCampaign_departmentId_idx" ON "CrmCampaign"("departmentId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'CrmCampaign_departmentId_fkey'
  ) THEN
    ALTER TABLE "CrmCampaign"
    ADD CONSTRAINT "CrmCampaign_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "Department"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;
