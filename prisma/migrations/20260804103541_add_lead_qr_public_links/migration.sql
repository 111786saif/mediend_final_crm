-- CreateTable
CREATE TABLE "LeadQrPublicLink" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastOpenedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadQrPublicLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadQrPublicLink_leadId_createdAt_idx" ON "LeadQrPublicLink"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "LeadQrPublicLink_actorUserId_createdAt_idx" ON "LeadQrPublicLink"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "LeadQrPublicLink_expiresAt_idx" ON "LeadQrPublicLink"("expiresAt");

-- AddForeignKey
ALTER TABLE "LeadQrPublicLink" ADD CONSTRAINT "LeadQrPublicLink_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadQrPublicLink" ADD CONSTRAINT "LeadQrPublicLink_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
