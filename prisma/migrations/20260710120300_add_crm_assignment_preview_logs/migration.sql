CREATE TABLE "CrmAssignmentPreviewLog" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "leadRef" TEXT NOT NULL,
    "syncSource" TEXT NOT NULL,
    "currentBdUserId" TEXT NOT NULL,
    "currentBdName" TEXT,
    "matchedRuleId" TEXT,
    "matchedRuleName" TEXT,
    "matchedRuleStrategy" "CrmAssignmentStrategy",
    "proposedBdUserId" TEXT,
    "proposedBdEmployeeId" TEXT,
    "proposedBdName" TEXT,
    "proposedTeamLeadUserId" TEXT,
    "proposedTeamLeadEmployeeId" TEXT,
    "proposedTeamLeadName" TEXT,
    "proposedSalesHeadUserId" TEXT,
    "proposedSalesHeadEmployeeId" TEXT,
    "proposedSalesHeadName" TEXT,
    "isMatched" BOOLEAN NOT NULL DEFAULT false,
    "wouldReassignBd" BOOLEAN NOT NULL DEFAULT false,
    "assignmentDate" TIMESTAMP(3) NOT NULL,
    "explanation" TEXT NOT NULL,
    "inputSnapshot" JSONB NOT NULL,
    "assignmentSnapshot" JSONB,
    "candidateDiagnostics" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmAssignmentPreviewLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CrmAssignmentPreviewLog_leadId_createdAt_idx" ON "CrmAssignmentPreviewLog"("leadId", "createdAt");
CREATE INDEX "CrmAssignmentPreviewLog_leadRef_createdAt_idx" ON "CrmAssignmentPreviewLog"("leadRef", "createdAt");
CREATE INDEX "CrmAssignmentPreviewLog_syncSource_createdAt_idx" ON "CrmAssignmentPreviewLog"("syncSource", "createdAt");
CREATE INDEX "CrmAssignmentPreviewLog_currentBdUserId_idx" ON "CrmAssignmentPreviewLog"("currentBdUserId");
CREATE INDEX "CrmAssignmentPreviewLog_proposedBdUserId_idx" ON "CrmAssignmentPreviewLog"("proposedBdUserId");

ALTER TABLE "CrmAssignmentPreviewLog"
ADD CONSTRAINT "CrmAssignmentPreviewLog_leadId_fkey"
FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
