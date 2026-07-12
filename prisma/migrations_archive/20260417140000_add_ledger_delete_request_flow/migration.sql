-- AlterEnum
ALTER TYPE "LedgerAuditAction" ADD VALUE 'DELETE_REQUESTED';
ALTER TYPE "LedgerAuditAction" ADD VALUE 'DELETE_APPROVED';
ALTER TYPE "LedgerAuditAction" ADD VALUE 'DELETE_REJECTED';

-- AlterTable
ALTER TABLE "LedgerEntry" ADD COLUMN "deleteRequestStatus" "LedgerStatus",
ADD COLUMN "deleteRequestReason" TEXT,
ADD COLUMN "deleteRequestedById" TEXT,
ADD COLUMN "deleteRequestedAt" TIMESTAMP(3),
ADD COLUMN "deleteApprovalReason" TEXT,
ADD COLUMN "deleteApprovedById" TEXT,
ADD COLUMN "deleteApprovedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "LedgerEntry_deleteRequestStatus_idx" ON "LedgerEntry"("deleteRequestStatus");

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_deleteRequestedById_fkey" FOREIGN KEY ("deleteRequestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_deleteApprovedById_fkey" FOREIGN KEY ("deleteApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
