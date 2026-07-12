CREATE TABLE IF NOT EXISTS "LeadRemarkEntry" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LeadRemarkEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LeadRemarkEntry_leadId_createdAt_idx"
ON "LeadRemarkEntry"("leadId", "createdAt");

CREATE INDEX IF NOT EXISTS "LeadRemarkEntry_createdById_createdAt_idx"
ON "LeadRemarkEntry"("createdById", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'LeadRemarkEntry_leadId_fkey'
  ) THEN
    ALTER TABLE "LeadRemarkEntry"
    ADD CONSTRAINT "LeadRemarkEntry_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'LeadRemarkEntry_createdById_fkey'
  ) THEN
    ALTER TABLE "LeadRemarkEntry"
    ADD CONSTRAINT "LeadRemarkEntry_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;
END $$;
