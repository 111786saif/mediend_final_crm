-- AlterTable
ALTER TABLE "Employee" ADD COLUMN "designation" TEXT,
ADD COLUMN "bankAccountNumber" TEXT,
ADD COLUMN "uanNumber" TEXT;

-- CreateTable
CREATE TABLE "SalaryStructure" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "annualCtc" DOUBLE PRECISION NOT NULL,
    "monthlyGross" DOUBLE PRECISION NOT NULL,
    "basicSalary" DOUBLE PRECISION NOT NULL,
    "medicalAllowance" DOUBLE PRECISION NOT NULL,
    "conveyanceAllowance" DOUBLE PRECISION NOT NULL,
    "otherAllowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "specialAllowance" DOUBLE PRECISION NOT NULL,
    "insuranceDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "applyTds" BOOLEAN NOT NULL DEFAULT false,
    "tdsMonthly" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tdsRatePercent" DOUBLE PRECISION,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryStructure_pkey" PRIMARY KEY ("id")
);

-- CreateEnum
CREATE TYPE "MonthlyPayrollStatus" AS ENUM ('DRAFT', 'APPROVED', 'PAID');

-- CreateTable
CREATE TABLE "MonthlyPayroll" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "totalDaysInMonth" INTEGER NOT NULL,
    "payableDays" DOUBLE PRECISION NOT NULL,
    "unpaidLeaves" INTEGER NOT NULL DEFAULT 0,
    "halfDays" INTEGER NOT NULL DEFAULT 0,
    "adjustedBasic" DOUBLE PRECISION NOT NULL,
    "adjustedMedical" DOUBLE PRECISION NOT NULL,
    "adjustedConveyance" DOUBLE PRECISION NOT NULL,
    "adjustedOther" DOUBLE PRECISION NOT NULL,
    "adjustedSpecial" DOUBLE PRECISION NOT NULL,
    "adjustedGross" DOUBLE PRECISION NOT NULL,
    "epfEmployee" DOUBLE PRECISION NOT NULL,
    "applyEsic" BOOLEAN NOT NULL DEFAULT false,
    "esicAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "applyTds" BOOLEAN NOT NULL DEFAULT false,
    "tdsAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "insurance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDeductions" DOUBLE PRECISION NOT NULL,
    "epfEmployer" DOUBLE PRECISION NOT NULL,
    "netPayable" DOUBLE PRECISION NOT NULL,
    "status" "MonthlyPayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "disbursedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "paidAt" TIMESTAMP(3),
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyPayroll_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalaryStructure_employeeId_idx" ON "SalaryStructure"("employeeId");

-- CreateIndex
CREATE INDEX "SalaryStructure_effectiveFrom_idx" ON "SalaryStructure"("effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyPayroll_employeeId_month_year_key" ON "MonthlyPayroll"("employeeId", "month", "year");

-- CreateIndex
CREATE INDEX "MonthlyPayroll_employeeId_idx" ON "MonthlyPayroll"("employeeId");

-- CreateIndex
CREATE INDEX "MonthlyPayroll_month_year_idx" ON "MonthlyPayroll"("month", "year");

-- CreateIndex
CREATE INDEX "MonthlyPayroll_status_idx" ON "MonthlyPayroll"("status");

-- AddForeignKey
ALTER TABLE "SalaryStructure" ADD CONSTRAINT "SalaryStructure_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyPayroll" ADD CONSTRAINT "MonthlyPayroll_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
