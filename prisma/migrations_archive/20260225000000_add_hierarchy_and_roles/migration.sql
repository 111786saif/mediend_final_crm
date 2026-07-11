-- AlterEnum: Add new values to UserRole
ALTER TYPE "UserRole" ADD VALUE 'EXECUTIVE_ASSISTANT';
ALTER TYPE "UserRole" ADD VALUE 'CATEGORY_MANAGER';
ALTER TYPE "UserRole" ADD VALUE 'ASSISTANT_CATEGORY_MANAGER';
ALTER TYPE "UserRole" ADD VALUE 'DIGITAL_MARKETING_HEAD';

-- AlterTable: Employee - add managerId for hierarchy
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "managerId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Employee_managerId_idx" ON "Employee"("managerId");

-- AddForeignKey (Employee.managerId -> Employee.id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Employee_managerId_fkey'
  ) THEN
    ALTER TABLE "Employee" ADD CONSTRAINT "Employee_managerId_fkey"
      FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AlterTable: LeaveRequest - add targetApproverId
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "targetApproverId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LeaveRequest_targetApproverId_idx" ON "LeaveRequest"("targetApproverId");

-- AddForeignKey (LeaveRequest.targetApproverId -> Employee.id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LeaveRequest_targetApproverId_fkey'
  ) THEN
    ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_targetApproverId_fkey"
      FOREIGN KEY ("targetApproverId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
