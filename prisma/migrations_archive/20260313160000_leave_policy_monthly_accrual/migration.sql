-- AlterTable
ALTER TABLE "LeaveTypeMaster" ADD COLUMN "code" TEXT,
ADD COLUMN "monthlyAccrual" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "carryForward" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "probationUnlockDays" DOUBLE PRECISION;

-- CreateIndex
CREATE UNIQUE INDEX "LeaveTypeMaster_code_key" ON "LeaveTypeMaster"("code");

-- CreateIndex
CREATE INDEX "LeaveTypeMaster_code_idx" ON "LeaveTypeMaster"("code");

-- AlterTable: LeaveRequest.days Int -> Float
ALTER TABLE "LeaveRequest" ALTER COLUMN "days" TYPE DOUBLE PRECISION USING "days"::double precision;

-- Update existing leave types with policy values
UPDATE "LeaveTypeMaster" SET "code" = 'CL', "monthlyAccrual" = 1, "carryForward" = false, "probationUnlockDays" = NULL WHERE "name" = 'CL';
UPDATE "LeaveTypeMaster" SET "code" = 'SL', "monthlyAccrual" = 0.5, "carryForward" = false, "probationUnlockDays" = NULL WHERE "name" = 'SL';
UPDATE "LeaveTypeMaster" SET "code" = 'EL', "monthlyAccrual" = 0.5, "carryForward" = true, "probationUnlockDays" = 12 WHERE "name" = 'EL';
