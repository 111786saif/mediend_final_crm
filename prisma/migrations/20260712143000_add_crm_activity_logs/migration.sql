CREATE TABLE IF NOT EXISTS "CrmActivityLog" (
  "id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "entityLabel" TEXT,
  "status" TEXT NOT NULL DEFAULT 'SUCCESS',
  "summary" TEXT NOT NULL,
  "metadata" JSONB,
  "actorUserId" TEXT,
  "actorRole" TEXT,
  "route" TEXT,
  "method" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CrmActivityLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CrmActivityLog_createdAt_idx"
ON "CrmActivityLog"("createdAt");

CREATE INDEX IF NOT EXISTS "CrmActivityLog_status_createdAt_idx"
ON "CrmActivityLog"("status", "createdAt");

CREATE INDEX IF NOT EXISTS "CrmActivityLog_entityType_createdAt_idx"
ON "CrmActivityLog"("entityType", "createdAt");

CREATE INDEX IF NOT EXISTS "CrmActivityLog_actorUserId_createdAt_idx"
ON "CrmActivityLog"("actorUserId", "createdAt");

CREATE INDEX IF NOT EXISTS "CrmActivityLog_action_createdAt_idx"
ON "CrmActivityLog"("action", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'CrmActivityLog_actorUserId_fkey'
  ) THEN
    ALTER TABLE "CrmActivityLog"
    ADD CONSTRAINT "CrmActivityLog_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;
