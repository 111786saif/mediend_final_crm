-- AlterTable: Section-specific remarks on PLRecord
ALTER TABLE "PLRecord" ADD COLUMN "doctorRemarks" TEXT;
ALTER TABLE "PLRecord" ADD COLUMN "costBreakdownRemarks" TEXT;

-- AlterTable: Section-specific remarks mirrored on DischargeSheet
ALTER TABLE "DischargeSheet" ADD COLUMN "doctorRemarks" TEXT;
ALTER TABLE "DischargeSheet" ADD COLUMN "costBreakdownRemarks" TEXT;

-- CreateEnum: Installment recipient and mode
CREATE TYPE "InstallmentRecipient" AS ENUM ('HOSPITAL', 'DOCTOR', 'MEDIEND');
CREATE TYPE "InstallmentMode" AS ENUM ('CASH', 'UPI', 'NEFT', 'RTGS', 'CHEQUE', 'CARD', 'OTHER');

-- CreateTable: PaymentInstallment ledger
CREATE TABLE "PaymentInstallment" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "recipient" "InstallmentRecipient" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paidOn" TIMESTAMP(3) NOT NULL,
    "mode" "InstallmentMode",
    "reference" TEXT,
    "notes" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentInstallment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PaymentInstallment_leadId_idx" ON "PaymentInstallment"("leadId");
CREATE INDEX "PaymentInstallment_recipient_idx" ON "PaymentInstallment"("recipient");
CREATE INDEX "PaymentInstallment_paidOn_idx" ON "PaymentInstallment"("paidOn");

ALTER TABLE "PaymentInstallment" ADD CONSTRAINT "PaymentInstallment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentInstallment" ADD CONSTRAINT "PaymentInstallment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
