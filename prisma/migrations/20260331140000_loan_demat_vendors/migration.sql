-- CreateTable
CREATE TABLE "LoanDematVendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanDematVendor_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "DepartmentRevenue" ADD COLUMN "vendorId" TEXT;

-- CreateIndex
CREATE INDEX "LoanDematVendor_isActive_sortOrder_name_idx" ON "LoanDematVendor"("isActive", "sortOrder", "name");

-- CreateIndex
CREATE INDEX "DepartmentRevenue_department_vendorId_month_year_idx" ON "DepartmentRevenue"("department", "vendorId", "month", "year");

-- AddForeignKey
ALTER TABLE "DepartmentRevenue" ADD CONSTRAINT "DepartmentRevenue_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "LoanDematVendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
