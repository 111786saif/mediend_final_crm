-- CreateTable
CREATE TABLE "UserTaskSeen" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserTaskSeen_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserTaskSeen_userId_taskId_key" ON "UserTaskSeen"("userId", "taskId");

-- CreateIndex
CREATE INDEX "UserTaskSeen_userId_idx" ON "UserTaskSeen"("userId");

-- CreateIndex
CREATE INDEX "UserTaskSeen_taskId_idx" ON "UserTaskSeen"("taskId");

-- AddForeignKey
ALTER TABLE "UserTaskSeen" ADD CONSTRAINT "UserTaskSeen_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTaskSeen" ADD CONSTRAINT "UserTaskSeen_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
