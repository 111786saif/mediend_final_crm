-- Rename Lead.leadDate -> Lead.assignedDate (field always held MySQL Lead_Date,
-- which is semantically the BDM-assignment timestamp, not the lead-receive date).
-- LeadEntryDate continues to hold the true "lead received" date.

ALTER TABLE "Lead" RENAME COLUMN "leadDate" TO "assignedDate";

ALTER INDEX "Lead_leadDate_idx" RENAME TO "Lead_assignedDate_idx";
