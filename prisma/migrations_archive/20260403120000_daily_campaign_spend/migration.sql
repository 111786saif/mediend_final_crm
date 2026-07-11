-- CreateTable
CREATE TABLE "DailyCampaignSpend" (
    "id" TEXT NOT NULL,
    "campaignName" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "spend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyCampaignSpend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyCampaignSpend_date_idx" ON "DailyCampaignSpend"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyCampaignSpend_campaignName_date_key" ON "DailyCampaignSpend"("campaignName", "date");

-- AddForeignKey
ALTER TABLE "DailyCampaignSpend" ADD CONSTRAINT "DailyCampaignSpend_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
