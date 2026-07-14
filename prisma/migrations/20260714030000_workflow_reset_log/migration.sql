-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'WORKFLOW_RESET';

-- CreateTable
CREATE TABLE IF NOT EXISTS "WorkflowResetLog" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "leadRef" TEXT NOT NULL,
    "previousStepNumber" INTEGER NOT NULL,
    "previousStepLabel" TEXT NOT NULL,
    "previousCaseStage" "CaseStage" NOT NULL,
    "resetToStepNumber" INTEGER NOT NULL,
    "resetToStepLabel" TEXT NOT NULL,
    "resetToCaseStage" "CaseStage" NOT NULL,
    "stepsReverted" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "resetById" TEXT NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "WorkflowResetLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkflowResetLog_leadId_idx" ON "WorkflowResetLog"("leadId");
CREATE INDEX IF NOT EXISTS "WorkflowResetLog_resetAt_idx" ON "WorkflowResetLog"("resetAt");
CREATE INDEX IF NOT EXISTS "WorkflowResetLog_resetById_idx" ON "WorkflowResetLog"("resetById");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "WorkflowResetLog"
    ADD CONSTRAINT "WorkflowResetLog_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "WorkflowResetLog"
    ADD CONSTRAINT "WorkflowResetLog_resetById_fkey"
    FOREIGN KEY ("resetById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
