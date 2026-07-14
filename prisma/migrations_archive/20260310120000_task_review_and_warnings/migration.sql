-- CreateEnum
CREATE TYPE "WarningType" AS ENUM ('REPEATED_DEADLINE_MISS', 'LOW_QUALITY_WORK', 'UNRESPONSIVE', 'TASK_ABANDONMENT', 'OTHER');

-- AlterEnum (add EMPLOYEE_DONE to TaskStatus)
ALTER TYPE "TaskStatus" ADD VALUE 'EMPLOYEE_DONE';

-- AlterTable Task: replace completionRating with grade and rejectionCount
ALTER TABLE "Task" DROP COLUMN IF EXISTS "completionRating";
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "grade" TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "rejectionCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable TaskComment: add parentId for threading
ALTER TABLE "TaskComment" ADD COLUMN IF NOT EXISTS "parentId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TaskComment_parentId_idx" ON "TaskComment"("parentId");

-- AddForeignKey (TaskComment parent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TaskComment_parentId_fkey'
  ) THEN
    ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_parentId_fkey"
      FOREIGN KEY ("parentId") REFERENCES "TaskComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateTable Warning
CREATE TABLE "Warning" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "taskId" TEXT,
    "type" "WarningType" NOT NULL,
    "note" TEXT NOT NULL,
    "issuedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Warning_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Warning_employeeId_idx" ON "Warning"("employeeId");
CREATE INDEX "Warning_taskId_idx" ON "Warning"("taskId");
CREATE INDEX "Warning_issuedById_idx" ON "Warning"("issuedById");

-- AddForeignKey
ALTER TABLE "Warning" ADD CONSTRAINT "Warning_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Warning" ADD CONSTRAINT "Warning_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Warning" ADD CONSTRAINT "Warning_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
