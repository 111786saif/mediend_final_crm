-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "leadDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Lead_leadDate_idx" ON "Lead"("leadDate");
