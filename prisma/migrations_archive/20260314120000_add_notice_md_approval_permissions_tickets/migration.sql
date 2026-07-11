-- AlterEnum: Add IT_HEAD and TESTER to UserRole (TESTER may already exist from prior migration)
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'IT_HEAD';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'TESTER';

-- AlterEnum: Add new values to NotificationType
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'HOSPITAL_SUGGESTION_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'LEAVE_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'LEAVE_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'LEAVE_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'FEEDBACK_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'INCREMENT_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NORMALIZATION_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TICKET_CREATED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TICKET_RESPONDED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NOTICE_PUBLISHED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MD_APPROVAL_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MD_APPROVAL_RESPONDED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MD_APPROVAL_FINANCE_ACK';

-- CreateEnum: NoticeTargetType
CREATE TYPE "NoticeTargetType" AS ENUM ('EVERYONE', 'EVERYONE_EXCEPT_MD', 'DEPARTMENT', 'SPECIFIC');

-- CreateEnum: MDApprovalStatus
CREATE TYPE "MDApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable: SupportTicket - make departmentId optional, add targetHeadRole
ALTER TABLE "SupportTicket" ALTER COLUMN "departmentId" DROP NOT NULL;
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "targetHeadRole" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SupportTicket_targetHeadRole_idx" ON "SupportTicket"("targetHeadRole");

-- CreateTable: Notice
CREATE TABLE "Notice" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "targetType" "NoticeTargetType" NOT NULL,
    "targetDepartmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notice_createdById_idx" ON "Notice"("createdById");
CREATE INDEX "Notice_createdAt_idx" ON "Notice"("createdAt");

-- AddForeignKey
ALTER TABLE "Notice" ADD CONSTRAINT "Notice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notice" ADD CONSTRAINT "Notice_targetDepartmentId_fkey" FOREIGN KEY ("targetDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: NoticeRecipient
CREATE TABLE "NoticeRecipient" (
    "id" TEXT NOT NULL,
    "noticeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoticeRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NoticeRecipient_noticeId_userId_key" ON "NoticeRecipient"("noticeId", "userId");
CREATE INDEX "NoticeRecipient_noticeId_idx" ON "NoticeRecipient"("noticeId");
CREATE INDEX "NoticeRecipient_userId_idx" ON "NoticeRecipient"("userId");
CREATE INDEX "NoticeRecipient_acknowledgedAt_idx" ON "NoticeRecipient"("acknowledgedAt");

-- AddForeignKey
ALTER TABLE "NoticeRecipient" ADD CONSTRAINT "NoticeRecipient_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "Notice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NoticeRecipient" ADD CONSTRAINT "NoticeRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: MDApprovalRequest
CREATE TABLE "MDApprovalRequest" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "amount" DOUBLE PRECISION,
    "status" "MDApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "respondedById" TEXT,
    "responseNote" TEXT,
    "respondedAt" TIMESTAMP(3),
    "financeAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "financeAcknowledgedById" TEXT,
    "financeAcknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MDApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MDApprovalRequest_requestedById_idx" ON "MDApprovalRequest"("requestedById");
CREATE INDEX "MDApprovalRequest_status_idx" ON "MDApprovalRequest"("status");
CREATE INDEX "MDApprovalRequest_createdAt_idx" ON "MDApprovalRequest"("createdAt");

-- AddForeignKey
ALTER TABLE "MDApprovalRequest" ADD CONSTRAINT "MDApprovalRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MDApprovalRequest" ADD CONSTRAINT "MDApprovalRequest_respondedById_fkey" FOREIGN KEY ("respondedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MDApprovalRequest" ADD CONSTRAINT "MDApprovalRequest_financeAcknowledgedById_fkey" FOREIGN KEY ("financeAcknowledgedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: UserFeaturePermission
CREATE TABLE "UserFeaturePermission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "grantedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserFeaturePermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserFeaturePermission_userId_featureKey_key" ON "UserFeaturePermission"("userId", "featureKey");
CREATE INDEX "UserFeaturePermission_userId_idx" ON "UserFeaturePermission"("userId");
CREATE INDEX "UserFeaturePermission_featureKey_idx" ON "UserFeaturePermission"("featureKey");

-- AddForeignKey
ALTER TABLE "UserFeaturePermission" ADD CONSTRAINT "UserFeaturePermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserFeaturePermission" ADD CONSTRAINT "UserFeaturePermission_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
