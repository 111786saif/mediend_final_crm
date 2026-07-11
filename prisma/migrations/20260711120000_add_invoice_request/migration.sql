-- CreateEnum
CREATE TYPE "InvoiceRequestStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateTable
CREATE TABLE "InvoiceRequest" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "status" "InvoiceRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestRemarks" TEXT,
    "invoiceNumber" TEXT,
    "invoiceAmount" DOUBLE PRECISION,
    "invoicePdfUrl" TEXT,
    "invoicePdfName" TEXT,
    "financeRemarks" TEXT,
    "rejectionRemarks" TEXT,
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvoiceRequest_leadId_idx" ON "InvoiceRequest"("leadId");
CREATE INDEX "InvoiceRequest_status_idx" ON "InvoiceRequest"("status");
CREATE INDEX "InvoiceRequest_requestedById_idx" ON "InvoiceRequest"("requestedById");
CREATE INDEX "InvoiceRequest_createdAt_idx" ON "InvoiceRequest"("createdAt");

-- AddForeignKey
ALTER TABLE "InvoiceRequest" ADD CONSTRAINT "InvoiceRequest_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceRequest" ADD CONSTRAINT "InvoiceRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceRequest" ADD CONSTRAINT "InvoiceRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
