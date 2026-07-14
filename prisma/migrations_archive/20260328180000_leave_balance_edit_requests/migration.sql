-- CreateEnum
CREATE TYPE "LeaveBalanceEditRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'LEAVE_BALANCE_EDIT_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'LEAVE_BALANCE_EDIT_RESOLVED';

-- CreateTable
CREATE TABLE "LeaveBalanceEditRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "prevCL" DOUBLE PRECISION NOT NULL,
    "prevSL" DOUBLE PRECISION NOT NULL,
    "prevEL" DOUBLE PRECISION NOT NULL,
    "proposedCL" DOUBLE PRECISION NOT NULL,
    "proposedSL" DOUBLE PRECISION NOT NULL,
    "proposedEL" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "status" "LeaveBalanceEditRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewRemarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveBalanceEditRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeaveBalanceEditRequest_employeeId_idx" ON "LeaveBalanceEditRequest"("employeeId");

-- CreateIndex
CREATE INDEX "LeaveBalanceEditRequest_status_idx" ON "LeaveBalanceEditRequest"("status");

-- CreateIndex
CREATE INDEX "LeaveBalanceEditRequest_createdAt_idx" ON "LeaveBalanceEditRequest"("createdAt");

-- AddForeignKey
ALTER TABLE "LeaveBalanceEditRequest" ADD CONSTRAINT "LeaveBalanceEditRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveBalanceEditRequest" ADD CONSTRAINT "LeaveBalanceEditRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveBalanceEditRequest" ADD CONSTRAINT "LeaveBalanceEditRequest_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
