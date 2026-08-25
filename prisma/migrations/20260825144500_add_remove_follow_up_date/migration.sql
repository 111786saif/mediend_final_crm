-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "followUpDateClearedAt" TIMESTAMP(3),
ADD COLUMN     "removeFollowUpDate" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "BulkLeadReassignmentRun" ADD COLUMN     "removePreviousFollowUpDate" BOOLEAN NOT NULL DEFAULT false;
