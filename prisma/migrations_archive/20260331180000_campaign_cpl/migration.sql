-- CreateTable
CREATE TABLE "CampaignCPL" (
    "id" TEXT NOT NULL,
    "campaignName" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "cpl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignCPL_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampaignCPL_year_month_idx" ON "CampaignCPL"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignCPL_campaignName_month_year_key" ON "CampaignCPL"("campaignName", "month", "year");

-- AddForeignKey
ALTER TABLE "CampaignCPL" ADD CONSTRAINT "CampaignCPL_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
