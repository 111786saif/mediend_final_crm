-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'COMPLIANCE_HEAD';

-- CreateEnum
CREATE TYPE "ComplianceCallStatus" AS ENUM ('PENDING', 'COMPLETED', 'DID_NOT_PICK', 'WRONG_NUMBER', 'CALLBACK_SCHEDULED');

-- CreateTable
CREATE TABLE "ComplianceCall" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "status" "ComplianceCallStatus" NOT NULL DEFAULT 'PENDING',
    "rating" INTEGER,
    "notes" TEXT,
    "lastAttemptedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "callbackAt" TIMESTAMP(3),
    "calledByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceCall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceCall_leadId_key" ON "ComplianceCall"("leadId");

-- CreateIndex
CREATE INDEX "ComplianceCall_status_idx" ON "ComplianceCall"("status");

-- CreateIndex
CREATE INDEX "ComplianceCall_createdAt_idx" ON "ComplianceCall"("createdAt");

-- CreateIndex
CREATE INDEX "ComplianceCall_rating_idx" ON "ComplianceCall"("rating");

-- CreateIndex
CREATE INDEX "ComplianceCall_completedAt_idx" ON "ComplianceCall"("completedAt");

-- AddForeignKey
ALTER TABLE "ComplianceCall" ADD CONSTRAINT "ComplianceCall_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceCall" ADD CONSTRAINT "ComplianceCall_calledByUserId_fkey" FOREIGN KEY ("calledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
