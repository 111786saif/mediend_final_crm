-- CreateEnum
CREATE TYPE "EmployeeIncentiveStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID');

-- CreateTable
CREATE TABLE "EmployeeMonthlyIncentive" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "EmployeeIncentiveStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeMonthlyIncentive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeMonthlyIncentive_employeeId_month_year_key" ON "EmployeeMonthlyIncentive"("employeeId", "month", "year");

-- CreateIndex
CREATE INDEX "EmployeeMonthlyIncentive_month_year_idx" ON "EmployeeMonthlyIncentive"("month", "year");

-- CreateIndex
CREATE INDEX "EmployeeMonthlyIncentive_status_idx" ON "EmployeeMonthlyIncentive"("status");

-- AddForeignKey
ALTER TABLE "EmployeeMonthlyIncentive" ADD CONSTRAINT "EmployeeMonthlyIncentive_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeMonthlyIncentive" ADD CONSTRAINT "EmployeeMonthlyIncentive_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeMonthlyIncentive" ADD CONSTRAINT "EmployeeMonthlyIncentive_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
