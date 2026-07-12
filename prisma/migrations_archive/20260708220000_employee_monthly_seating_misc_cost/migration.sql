-- CreateEnum
CREATE TYPE "EmployeeSeatingMiscCostStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID');

-- CreateTable
CREATE TABLE "EmployeeMonthlySeatingMiscCost" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "seatingCost" DOUBLE PRECISION NOT NULL,
    "masterSeatingCostId" TEXT,
    "miscCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "EmployeeSeatingMiscCostStatus" NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeMonthlySeatingMiscCost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeMonthlySeatingMiscCostHistory" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "seatingCost" DOUBLE PRECISION NOT NULL,
    "miscCost" DOUBLE PRECISION NOT NULL,
    "status" "EmployeeSeatingMiscCostStatus" NOT NULL,
    "remarks" TEXT,
    "changedByUserId" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeMonthlySeatingMiscCostHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeMonthlySeatingMiscCost_employeeId_month_year_key" ON "EmployeeMonthlySeatingMiscCost"("employeeId", "month", "year");

-- CreateIndex
CREATE INDEX "EmployeeMonthlySeatingMiscCost_month_year_idx" ON "EmployeeMonthlySeatingMiscCost"("month", "year");

-- CreateIndex
CREATE INDEX "EmployeeMonthlySeatingMiscCost_status_idx" ON "EmployeeMonthlySeatingMiscCost"("status");

-- CreateIndex
CREATE INDEX "EmployeeMonthlySeatingMiscCostHistory_recordId_changedAt_idx" ON "EmployeeMonthlySeatingMiscCostHistory"("recordId", "changedAt");

-- AddForeignKey
ALTER TABLE "EmployeeMonthlySeatingMiscCost" ADD CONSTRAINT "EmployeeMonthlySeatingMiscCost_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeMonthlySeatingMiscCost" ADD CONSTRAINT "EmployeeMonthlySeatingMiscCost_masterSeatingCostId_fkey" FOREIGN KEY ("masterSeatingCostId") REFERENCES "EmployeeMasterSeatingCost"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeMonthlySeatingMiscCost" ADD CONSTRAINT "EmployeeMonthlySeatingMiscCost_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeMonthlySeatingMiscCost" ADD CONSTRAINT "EmployeeMonthlySeatingMiscCost_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeMonthlySeatingMiscCostHistory" ADD CONSTRAINT "EmployeeMonthlySeatingMiscCostHistory_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "EmployeeMonthlySeatingMiscCost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeMonthlySeatingMiscCostHistory" ADD CONSTRAINT "EmployeeMonthlySeatingMiscCostHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
