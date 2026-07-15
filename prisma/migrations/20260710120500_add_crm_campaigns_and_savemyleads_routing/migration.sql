CREATE TABLE "CrmCampaignSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmCampaignSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmCampaignLeadSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmCampaignLeadSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmCampaignCircle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmCampaignCircle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmCampaignCity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmCampaignCity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmCampaign" (
    "id" TEXT NOT NULL,
    "externalCampaignId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "leadSourceId" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "cityId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmCampaignTeamLeadAssignment" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "teamLeadEmployeeId" TEXT NOT NULL,
    "teamLeadUserId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmCampaignTeamLeadAssignment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "IncomingLead"
ADD COLUMN "externalCampaignId" TEXT,
ADD COLUMN "normalizedPhone" TEXT,
ADD COLUMN "processedLeadId" TEXT,
ADD COLUMN "selectedTeamLeadUserId" TEXT,
ADD COLUMN "selectedTeamLeadEmployeeId" TEXT,
ADD COLUMN "selectedBdUserId" TEXT,
ADD COLUMN "errorMessage" TEXT,
ADD COLUMN "processedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "CrmCampaignSource_name_key" ON "CrmCampaignSource"("name");
CREATE UNIQUE INDEX "CrmCampaignLeadSource_sourceId_name_key" ON "CrmCampaignLeadSource"("sourceId", "name");
CREATE UNIQUE INDEX "CrmCampaignCircle_name_key" ON "CrmCampaignCircle"("name");
CREATE UNIQUE INDEX "CrmCampaignCity_circleId_name_key" ON "CrmCampaignCity"("circleId", "name");
CREATE UNIQUE INDEX "CrmCampaign_externalCampaignId_key" ON "CrmCampaign"("externalCampaignId");
CREATE UNIQUE INDEX "CrmCampaignTeamLeadAssignment_campaignId_teamLeadEmployeeId_month_year_key" ON "CrmCampaignTeamLeadAssignment"("campaignId", "teamLeadEmployeeId", "month", "year");

CREATE INDEX "CrmCampaignSource_name_idx" ON "CrmCampaignSource"("name");
CREATE INDEX "CrmCampaignSource_isActive_idx" ON "CrmCampaignSource"("isActive");
CREATE INDEX "CrmCampaignLeadSource_name_idx" ON "CrmCampaignLeadSource"("name");
CREATE INDEX "CrmCampaignLeadSource_sourceId_idx" ON "CrmCampaignLeadSource"("sourceId");
CREATE INDEX "CrmCampaignLeadSource_isActive_idx" ON "CrmCampaignLeadSource"("isActive");
CREATE INDEX "CrmCampaignCircle_name_idx" ON "CrmCampaignCircle"("name");
CREATE INDEX "CrmCampaignCircle_isActive_idx" ON "CrmCampaignCircle"("isActive");
CREATE INDEX "CrmCampaignCity_name_idx" ON "CrmCampaignCity"("name");
CREATE INDEX "CrmCampaignCity_circleId_idx" ON "CrmCampaignCity"("circleId");
CREATE INDEX "CrmCampaignCity_isActive_idx" ON "CrmCampaignCity"("isActive");
CREATE INDEX "CrmCampaign_sourceId_idx" ON "CrmCampaign"("sourceId");
CREATE INDEX "CrmCampaign_leadSourceId_idx" ON "CrmCampaign"("leadSourceId");
CREATE INDEX "CrmCampaign_circleId_idx" ON "CrmCampaign"("circleId");
CREATE INDEX "CrmCampaign_cityId_idx" ON "CrmCampaign"("cityId");
CREATE INDEX "CrmCampaign_isActive_idx" ON "CrmCampaign"("isActive");
CREATE INDEX "CrmCampaignTeamLeadAssignment_campaignId_month_year_isActive_priority_idx" ON "CrmCampaignTeamLeadAssignment"("campaignId", "month", "year", "isActive", "priority");
CREATE INDEX "CrmCampaignTeamLeadAssignment_teamLeadEmployeeId_month_year_idx" ON "CrmCampaignTeamLeadAssignment"("teamLeadEmployeeId", "month", "year");
CREATE INDEX "CrmCampaignTeamLeadAssignment_teamLeadUserId_month_year_idx" ON "CrmCampaignTeamLeadAssignment"("teamLeadUserId", "month", "year");
CREATE INDEX "IncomingLead_externalCampaignId_idx" ON "IncomingLead"("externalCampaignId");
CREATE INDEX "IncomingLead_normalizedPhone_idx" ON "IncomingLead"("normalizedPhone");
CREATE INDEX "IncomingLead_selectedTeamLeadEmployeeId_receivedAt_idx" ON "IncomingLead"("selectedTeamLeadEmployeeId", "receivedAt");
CREATE INDEX "IncomingLead_selectedBdUserId_receivedAt_idx" ON "IncomingLead"("selectedBdUserId", "receivedAt");

ALTER TABLE "CrmCampaignLeadSource"
ADD CONSTRAINT "CrmCampaignLeadSource_sourceId_fkey"
FOREIGN KEY ("sourceId") REFERENCES "CrmCampaignSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CrmCampaignCity"
ADD CONSTRAINT "CrmCampaignCity_circleId_fkey"
FOREIGN KEY ("circleId") REFERENCES "CrmCampaignCircle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CrmCampaign"
ADD CONSTRAINT "CrmCampaign_sourceId_fkey"
FOREIGN KEY ("sourceId") REFERENCES "CrmCampaignSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CrmCampaign"
ADD CONSTRAINT "CrmCampaign_leadSourceId_fkey"
FOREIGN KEY ("leadSourceId") REFERENCES "CrmCampaignLeadSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CrmCampaign"
ADD CONSTRAINT "CrmCampaign_circleId_fkey"
FOREIGN KEY ("circleId") REFERENCES "CrmCampaignCircle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CrmCampaign"
ADD CONSTRAINT "CrmCampaign_cityId_fkey"
FOREIGN KEY ("cityId") REFERENCES "CrmCampaignCity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CrmCampaignTeamLeadAssignment"
ADD CONSTRAINT "CrmCampaignTeamLeadAssignment_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "CrmCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CrmCampaignTeamLeadAssignment"
ADD CONSTRAINT "CrmCampaignTeamLeadAssignment_teamLeadEmployeeId_fkey"
FOREIGN KEY ("teamLeadEmployeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CrmCampaignTeamLeadAssignment"
ADD CONSTRAINT "CrmCampaignTeamLeadAssignment_teamLeadUserId_fkey"
FOREIGN KEY ("teamLeadUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
