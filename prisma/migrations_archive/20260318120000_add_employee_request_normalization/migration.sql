-- Add EMPLOYEE_REQUEST to NormalizationType enum
ALTER TYPE "NormalizationType" ADD VALUE 'EMPLOYEE_REQUEST';

-- Add new columns to AttendanceNormalization
ALTER TABLE "AttendanceNormalization" ADD COLUMN "managerApprovedById" TEXT;
ALTER TABLE "AttendanceNormalization" ADD COLUMN "managerApprovedAt" TIMESTAMP(3);
ALTER TABLE "AttendanceNormalization" ADD COLUMN "normalizeAs" TEXT;

-- Add foreign key for managerApprovedById
ALTER TABLE "AttendanceNormalization" ADD CONSTRAINT "AttendanceNormalization_managerApprovedById_fkey" FOREIGN KEY ("managerApprovedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create index for managerApprovedById
CREATE INDEX "AttendanceNormalization_managerApprovedById_idx" ON "AttendanceNormalization"("managerApprovedById");
