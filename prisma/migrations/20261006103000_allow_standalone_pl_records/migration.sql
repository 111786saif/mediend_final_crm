-- Preserve P&L data imported before the CRM Lead exists.
ALTER TABLE "PLRecord" ADD COLUMN IF NOT EXISTS "leadRef" TEXT;
ALTER TABLE "PLRecord" ALTER COLUMN "leadId" DROP NOT NULL;

-- Give all existing Lead-linked P&L rows their stable Excel import key.
UPDATE "PLRecord" AS pl
SET "leadRef" = lead."leadRef"
FROM "Lead" AS lead
WHERE pl."leadId" = lead.id
  AND pl."leadRef" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "PLRecord_leadRef_key"
  ON "PLRecord" ("leadRef")
  WHERE "leadRef" IS NOT NULL;

ALTER TABLE "PLRecord" DROP CONSTRAINT IF EXISTS "PLRecord_leadId_fkey";
ALTER TABLE "PLRecord"
  ADD CONSTRAINT "PLRecord_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"(id)
  ON DELETE SET NULL ON UPDATE CASCADE;
