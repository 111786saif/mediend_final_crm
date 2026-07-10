-- AlterTable
ALTER TABLE "AttendanceNormalization" ADD COLUMN "hoursUsed" INTEGER;

-- Backfill: existing SELF normalizations count as 1 hour used
UPDATE "AttendanceNormalization" SET "hoursUsed" = 1 WHERE "type" = 'SELF' AND "hoursUsed" IS NULL;
