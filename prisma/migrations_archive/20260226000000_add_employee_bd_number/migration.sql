-- AlterTable
ALTER TABLE "Employee" ADD COLUMN "bdNumber" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Employee_bdNumber_key" ON "Employee"("bdNumber");

-- CreateIndex
CREATE INDEX "Employee_bdNumber_idx" ON "Employee"("bdNumber");
