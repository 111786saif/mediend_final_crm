CREATE TABLE "CrmCampaignBdDailyLimit" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "teamLeadEmployeeId" TEXT NOT NULL,
    "bdEmployeeId" TEXT NOT NULL,
    "bdUserId" TEXT NOT NULL,
    "maxLeadsPerDay" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmCampaignBdDailyLimit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CrmCampaignBdDailyLimit_campaignId_teamLeadEmployeeId_bdEmp_key"
ON "CrmCampaignBdDailyLimit"("campaignId", "teamLeadEmployeeId", "bdEmployeeId");

CREATE INDEX "CrmCampaignBdDailyLimit_campaignId_teamLeadEmployeeId_idx"
ON "CrmCampaignBdDailyLimit"("campaignId", "teamLeadEmployeeId");

CREATE INDEX "CrmCampaignBdDailyLimit_bdEmployeeId_idx"
ON "CrmCampaignBdDailyLimit"("bdEmployeeId");

CREATE INDEX "CrmCampaignBdDailyLimit_bdUserId_idx"
ON "CrmCampaignBdDailyLimit"("bdUserId");

ALTER TABLE "CrmCampaignBdDailyLimit"
ADD CONSTRAINT "CrmCampaignBdDailyLimit_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "CrmCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CrmCampaignBdDailyLimit"
ADD CONSTRAINT "CrmCampaignBdDailyLimit_teamLeadEmployeeId_fkey"
FOREIGN KEY ("teamLeadEmployeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CrmCampaignBdDailyLimit"
ADD CONSTRAINT "CrmCampaignBdDailyLimit_bdEmployeeId_fkey"
FOREIGN KEY ("bdEmployeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CrmCampaignBdDailyLimit"
ADD CONSTRAINT "CrmCampaignBdDailyLimit_bdUserId_fkey"
FOREIGN KEY ("bdUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
