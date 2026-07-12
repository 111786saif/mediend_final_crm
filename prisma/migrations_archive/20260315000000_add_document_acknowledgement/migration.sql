-- AlterTable
ALTER TABLE "EmployeeDocument" ADD COLUMN "ackToken" TEXT;
ALTER TABLE "EmployeeDocument" ADD COLUMN "acknowledgedAt" TIMESTAMP(3);
ALTER TABLE "EmployeeDocument" ADD COLUMN "acknowledgedIp" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeDocument_ackToken_key" ON "EmployeeDocument"("ackToken");
