-- AlterTable
ALTER TABLE "Task" ADD COLUMN "completedById" TEXT,
ADD COLUMN "completedAt" TIMESTAMP(3),
ADD COLUMN "completionRating" INTEGER,
ADD COLUMN "completionComments" TEXT;

-- CreateIndex
CREATE INDEX "Task_completedById_idx" ON "Task"("completedById");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
