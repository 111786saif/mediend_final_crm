CREATE TABLE "BulkLeadReassignmentRun" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "leadIds" JSONB NOT NULL,
  "bdUserIds" JSONB NOT NULL,
  "pauseSeconds" INTEGER NOT NULL,
  "subStatus" INTEGER,
  "removePreviousRemarks" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "processedCount" INTEGER NOT NULL DEFAULT 0,
  "currentLeadIndex" INTEGER NOT NULL DEFAULT 0,
  "currentBdIndex" INTEGER NOT NULL DEFAULT 0,
  "currentCycleNumber" INTEGER NOT NULL DEFAULT 0,
  "totalLeads" INTEGER NOT NULL,
  "totalBds" INTEGER NOT NULL,
  "bullJobId" TEXT,
  "nextRunAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BulkLeadReassignmentRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BulkLeadReassignmentRun_actorUserId_createdAt_idx"
  ON "BulkLeadReassignmentRun"("actorUserId", "createdAt");

CREATE INDEX "BulkLeadReassignmentRun_status_createdAt_idx"
  ON "BulkLeadReassignmentRun"("status", "createdAt");

CREATE INDEX "BulkLeadReassignmentRun_nextRunAt_idx"
  ON "BulkLeadReassignmentRun"("nextRunAt");

ALTER TABLE "BulkLeadReassignmentRun"
  ADD CONSTRAINT "BulkLeadReassignmentRun_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
