-- AlterEnum
ALTER TYPE "DocumentType" ADD VALUE 'CUSTOM';

-- AlterTable
ALTER TABLE "EmployeeDocument" ADD COLUMN "title" TEXT;

-- AlterTable
ALTER TABLE "MDApprovalRequest" ADD COLUMN "attachments" JSONB;
