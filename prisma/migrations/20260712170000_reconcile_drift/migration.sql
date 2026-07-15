-- AlterEnum
DO $$
BEGIN
  ALTER TYPE "NotificationType" ADD VALUE 'RANK_IMPROVED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- AlterEnum
DO $$
BEGIN
  ALTER TYPE "UserRole" ADD VALUE 'ACCESS_MATRIX';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- AlterTable
ALTER TABLE "CrmAssignmentRule" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CrmAssignmentRuleMember" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CrmCampaign" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CrmCampaignCircle" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CrmCampaignCity" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CrmCampaignLeadSource" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CrmCampaignSource" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CrmCampaignTeamLeadAssignment" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "UserCrmPermission" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "TierDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "metric" "TargetMetric" NOT NULL,
    "thresholdValue" DOUBLE PRECISION NOT NULL,
    "order" INTEGER NOT NULL,
    "rewardAmount" DOUBLE PRECISION,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TierDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RankSnapshot" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RankSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TierDefinition_metric_order_idx" ON "TierDefinition"("metric", "order");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RankSnapshot_entityType_month_idx" ON "RankSnapshot"("entityType", "month");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RankSnapshot_entityType_entityId_metric_month_key" ON "RankSnapshot"("entityType", "entityId", "metric", "month");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'TierDefinition_createdById_fkey'
  ) THEN
    ALTER TABLE "TierDefinition"
    ADD CONSTRAINT "TierDefinition_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

-- RenameIndex
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class
    WHERE relkind = 'i'
      AND relname = 'CrmCampaignTeamLeadAssignment_campaignId_month_year_isActive_pr'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_class
    WHERE relkind = 'i'
      AND relname = 'CrmCampaignTeamLeadAssignment_campaignId_month_year_isActiv_idx'
  ) THEN
    ALTER INDEX "CrmCampaignTeamLeadAssignment_campaignId_month_year_isActive_pr"
    RENAME TO "CrmCampaignTeamLeadAssignment_campaignId_month_year_isActiv_idx";
  END IF;
END
$$;

-- RenameIndex
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class
    WHERE relkind = 'i'
      AND relname = 'CrmCampaignTeamLeadAssignment_campaignId_teamLeadEmployeeId_mon'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_class
    WHERE relkind = 'i'
      AND relname = 'CrmCampaignTeamLeadAssignment_campaignId_teamLeadEmployeeId_key'
  ) THEN
    ALTER INDEX "CrmCampaignTeamLeadAssignment_campaignId_teamLeadEmployeeId_mon"
    RENAME TO "CrmCampaignTeamLeadAssignment_campaignId_teamLeadEmployeeId_key";
  END IF;
END
$$;
