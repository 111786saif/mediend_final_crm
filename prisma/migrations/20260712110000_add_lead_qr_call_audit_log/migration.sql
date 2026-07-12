CREATE TABLE IF NOT EXISTS "LeadQrCallAuditLog" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "source" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadQrCallAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LeadQrCallAuditLog_leadId_createdAt_idx" ON "LeadQrCallAuditLog"("leadId", "createdAt");
CREATE INDEX IF NOT EXISTS "LeadQrCallAuditLog_userId_createdAt_idx" ON "LeadQrCallAuditLog"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "LeadQrCallAuditLog_action_createdAt_idx" ON "LeadQrCallAuditLog"("action", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'LeadQrCallAuditLog_leadId_fkey'
  ) THEN
    ALTER TABLE "LeadQrCallAuditLog"
    ADD CONSTRAINT "LeadQrCallAuditLog_leadId_fkey"
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
    WHERE conname = 'LeadQrCallAuditLog_userId_fkey'
  ) THEN
    ALTER TABLE "LeadQrCallAuditLog"
    ADD CONSTRAINT "LeadQrCallAuditLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;
END $$;
