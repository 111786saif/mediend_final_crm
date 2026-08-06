ALTER TABLE "Lead"
ADD COLUMN "openedInCrmAt" TIMESTAMP(3);

CREATE INDEX "Lead_openedInCrmAt_idx" ON "Lead"("openedInCrmAt");
