-- CreateTable
CREATE TABLE IF NOT EXISTS "EmployeeSalesTeamSalaryOverride" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeSalesTeamSalaryOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "EmployeeSalesTeamSalaryOverrideHistory" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "previousSalary" DOUBLE PRECISION NOT NULL,
    "updatedSalary" DOUBLE PRECISION NOT NULL,
    "difference" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeSalesTeamSalaryOverrideHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmployeeSalesTeamSalaryOverride_month_year_idx" ON "EmployeeSalesTeamSalaryOverride"("month", "year");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "EmployeeSalesTeamSalaryOverride_employeeId_month_year_key" ON "EmployeeSalesTeamSalaryOverride"("employeeId", "month", "year");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmployeeSalesTeamSalaryOverrideHistory_employeeId_month_yea_idx" ON "EmployeeSalesTeamSalaryOverrideHistory"("employeeId", "month", "year", "updatedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmployeeSalesTeamSalaryOverrideHistory_updatedAt_idx" ON "EmployeeSalesTeamSalaryOverrideHistory"("updatedAt");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "EmployeeSalesTeamSalaryOverride" ADD CONSTRAINT "EmployeeSalesTeamSalaryOverride_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "EmployeeSalesTeamSalaryOverride" ADD CONSTRAINT "EmployeeSalesTeamSalaryOverride_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "EmployeeSalesTeamSalaryOverrideHistory" ADD CONSTRAINT "EmployeeSalesTeamSalaryOverrideHistory_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "EmployeeSalesTeamSalaryOverrideHistory" ADD CONSTRAINT "EmployeeSalesTeamSalaryOverrideHistory_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
