-- CreateTable
CREATE TABLE "EmployeeMasterSeatingCost" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeMasterSeatingCost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeMasterSeatingCost_employeeId_key" ON "EmployeeMasterSeatingCost"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeMasterSeatingCost_updatedAt_idx" ON "EmployeeMasterSeatingCost"("updatedAt");

-- AddForeignKey
ALTER TABLE "EmployeeMasterSeatingCost" ADD CONSTRAINT "EmployeeMasterSeatingCost_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeMasterSeatingCost" ADD CONSTRAINT "EmployeeMasterSeatingCost_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeMasterSeatingCost" ADD CONSTRAINT "EmployeeMasterSeatingCost_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
