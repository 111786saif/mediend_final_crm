-- CreateEnum
CREATE TYPE "SalesTeamCostEntryType" AS ENUM ('INCENTIVE', 'SEATING');

-- CreateTable
CREATE TABLE "SalesTeamCostEntry" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "entryType" "SalesTeamCostEntryType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "addedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesTeamCostEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalesTeamCostEntry_employeeId_entryType_idx" ON "SalesTeamCostEntry"("employeeId", "entryType");

-- CreateIndex
CREATE INDEX "SalesTeamCostEntry_entryDate_idx" ON "SalesTeamCostEntry"("entryDate");

-- AddForeignKey
ALTER TABLE "SalesTeamCostEntry" ADD CONSTRAINT "SalesTeamCostEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesTeamCostEntry" ADD CONSTRAINT "SalesTeamCostEntry_addedByUserId_fkey" FOREIGN KEY ("addedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
