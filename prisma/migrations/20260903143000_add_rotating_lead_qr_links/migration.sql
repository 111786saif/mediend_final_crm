ALTER TABLE "LeadQrPublicLink"
  ADD COLUMN "token" TEXT;

-- Retain access to pre-existing links while all newly created links use random tokens.
UPDATE "LeadQrPublicLink"
SET "token" = "id"
WHERE "token" IS NULL;

ALTER TABLE "LeadQrPublicLink"
  ALTER COLUMN "token" SET NOT NULL;

CREATE UNIQUE INDEX "LeadQrPublicLink_token_key" ON "LeadQrPublicLink"("token");

CREATE TABLE "LeadQrScanLink" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "lastScannedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadQrScanLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LeadQrScanLink_token_key" ON "LeadQrScanLink"("token");
CREATE INDEX "LeadQrScanLink_leadId_createdAt_idx" ON "LeadQrScanLink"("leadId", "createdAt");
CREATE INDEX "LeadQrScanLink_actorUserId_createdAt_idx" ON "LeadQrScanLink"("actorUserId", "createdAt");

ALTER TABLE "LeadQrScanLink"
  ADD CONSTRAINT "LeadQrScanLink_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeadQrScanLink"
  ADD CONSTRAINT "LeadQrScanLink_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
