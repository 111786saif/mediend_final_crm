-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'ON_PIP', 'ON_NOTICE', 'TERMINATED');

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "pipStartDate" TIMESTAMP(3),
ADD COLUMN     "pipEndDate" TIMESTAMP(3),
ADD COLUMN     "noticePeriodStartDate" TIMESTAMP(3),
ADD COLUMN     "noticePeriodEndDate" TIMESTAMP(3),
ADD COLUMN     "finalWorkingDay" TIMESTAMP(3),
ADD COLUMN     "terminationReason" TEXT,
ADD COLUMN     "fnfCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fnfCompletedAt" TIMESTAMP(3),
ADD COLUMN     "fnfCompletedById" TEXT;

-- CreateIndex
CREATE INDEX "Employee_fnfCompletedById_idx" ON "Employee"("fnfCompletedById");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_fnfCompletedById_fkey" FOREIGN KEY ("fnfCompletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
