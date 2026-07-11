-- AlterEnum
-- Add IPD_DONE to IpdStatus (ADMITTED_DONE = patient admitted, IPD_DONE = surgery done)
ALTER TYPE "IpdStatus" ADD VALUE IF NOT EXISTS 'IPD_DONE';
