-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "SalesTeamBulkCostType" AS ENUM ('MISC', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "SalesTeamBulkCostEntry" (
    "id" TEXT NOT NULL,
    "costType" "SalesTeamBulkCostType" NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "remark" TEXT NOT NULL,
    "employeeId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesTeamBulkCostEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SalesTeamBulkCostEntryHistory" (
    "id" TEXT NOT NULL,
    "entryId" TEXT,
    "costType" "SalesTeamBulkCostType" NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "remark" TEXT NOT NULL,
    "employeeId" TEXT,
    "employeeName" TEXT,
    "previousAmount" DOUBLE PRECISION,
    "previousRemark" TEXT,
    "previousEmployeeId" TEXT,
    "previousEmployeeName" TEXT,
    "changedByUserId" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesTeamBulkCostEntryHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SalesTeamBulkCostEntry_month_year_costType_idx" ON "SalesTeamBulkCostEntry"("month", "year", "costType");
CREATE INDEX IF NOT EXISTS "SalesTeamBulkCostEntry_employeeId_idx" ON "SalesTeamBulkCostEntry"("employeeId");
CREATE INDEX IF NOT EXISTS "SalesTeamBulkCostEntry_costType_createdAt_idx" ON "SalesTeamBulkCostEntry"("costType", "createdAt");
CREATE INDEX IF NOT EXISTS "SalesTeamBulkCostEntryHistory_costType_changedAt_idx" ON "SalesTeamBulkCostEntryHistory"("costType", "changedAt");
CREATE INDEX IF NOT EXISTS "SalesTeamBulkCostEntryHistory_month_year_costType_idx" ON "SalesTeamBulkCostEntryHistory"("month", "year", "costType");
CREATE INDEX IF NOT EXISTS "SalesTeamBulkCostEntryHistory_entryId_changedAt_idx" ON "SalesTeamBulkCostEntryHistory"("entryId", "changedAt");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "SalesTeamBulkCostEntry" ADD CONSTRAINT "SalesTeamBulkCostEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "SalesTeamBulkCostEntry" ADD CONSTRAINT "SalesTeamBulkCostEntry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "SalesTeamBulkCostEntry" ADD CONSTRAINT "SalesTeamBulkCostEntry_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "SalesTeamBulkCostEntryHistory" ADD CONSTRAINT "SalesTeamBulkCostEntryHistory_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "SalesTeamBulkCostEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "SalesTeamBulkCostEntryHistory" ADD CONSTRAINT "SalesTeamBulkCostEntryHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
