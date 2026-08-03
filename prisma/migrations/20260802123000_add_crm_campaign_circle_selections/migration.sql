CREATE TABLE "CrmCampaignCircleSelection" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "circleId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CrmCampaignCircleSelection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CrmCampaignCircleSelection_campaignId_circleId_key"
ON "CrmCampaignCircleSelection"("campaignId", "circleId");

CREATE INDEX "CrmCampaignCircleSelection_campaignId_idx"
ON "CrmCampaignCircleSelection"("campaignId");

CREATE INDEX "CrmCampaignCircleSelection_circleId_idx"
ON "CrmCampaignCircleSelection"("circleId");

ALTER TABLE "CrmCampaignCircleSelection"
ADD CONSTRAINT "CrmCampaignCircleSelection_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "CrmCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CrmCampaignCircleSelection"
ADD CONSTRAINT "CrmCampaignCircleSelection_circleId_fkey"
FOREIGN KEY ("circleId") REFERENCES "CrmCampaignCircle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "CrmCampaignCircleSelection" ("id", "campaignId", "circleId", "createdAt", "updatedAt")
SELECT
  md5("id" || "circleId" || clock_timestamp()::text || random()::text),
  "id",
  "circleId",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "CrmCampaign"
ON CONFLICT ("campaignId", "circleId") DO NOTHING;
