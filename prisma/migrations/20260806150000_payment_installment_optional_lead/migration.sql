-- AlterTable
ALTER TABLE "PaymentInstallment" ALTER COLUMN "leadId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PaymentInstallment" ADD COLUMN "hospitalName" TEXT;

-- CreateIndex
CREATE INDEX "PaymentInstallment_hospitalName_idx" ON "PaymentInstallment"("hospitalName");
