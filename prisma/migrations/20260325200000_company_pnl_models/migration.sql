-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'LOAN_DEMAT_HEAD';

-- CreateEnum
CREATE TYPE "ITProjectStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ON_HOLD', 'CANCELLED');
CREATE TYPE "ITBillingType" AS ENUM ('FIXED', 'MONTHLY', 'MILESTONE');
CREATE TYPE "ITResourceType" AS ENUM ('SALARIED', 'FREELANCE');
CREATE TYPE "ITResourcePaymentType" AS ENUM ('MONTHLY', 'ONE_TIME', 'BOTH');
CREATE TYPE "RevenueDepartment" AS ENUM ('LOAN_DEMAT', 'GOOGLE_ADS');
CREATE TYPE "PnLCategoryType" AS ENUM ('REVENUE', 'EXPENSE');

-- CreateTable
CREATE TABLE "ITProject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientName" TEXT,
    "description" TEXT,
    "projectValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "billingType" "ITBillingType" NOT NULL DEFAULT 'MONTHLY',
    "monthlyBilling" DOUBLE PRECISION,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" "ITProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ITProject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ITFreelancer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "skill" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ITFreelancer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ITProjectResource" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "resourceType" "ITResourceType" NOT NULL,
    "employeeId" TEXT,
    "freelancerId" TEXT,
    "allocationPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentType" "ITResourcePaymentType" NOT NULL DEFAULT 'MONTHLY',
    "monthlyCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "oneTimeCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ITProjectResource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ITProjectBooking" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ITProjectBooking_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DepartmentRevenue" (
    "id" TEXT NOT NULL,
    "department" "RevenueDepartment" NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "description" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepartmentRevenue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PnLCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PnLCategoryType" NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sourceKey" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PnLCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PnLEntry" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "isAutoFilled" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PnLEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ITProject_status_idx" ON "ITProject"("status");
CREATE INDEX "ITProject_createdById_idx" ON "ITProject"("createdById");
CREATE INDEX "ITFreelancer_isActive_idx" ON "ITFreelancer"("isActive");
CREATE INDEX "ITFreelancer_createdById_idx" ON "ITFreelancer"("createdById");
CREATE INDEX "ITProjectResource_projectId_idx" ON "ITProjectResource"("projectId");
CREATE INDEX "ITProjectResource_employeeId_idx" ON "ITProjectResource"("employeeId");
CREATE INDEX "ITProjectResource_freelancerId_idx" ON "ITProjectResource"("freelancerId");
CREATE UNIQUE INDEX "ITProjectBooking_projectId_month_year_key" ON "ITProjectBooking"("projectId", "month", "year");
CREATE INDEX "ITProjectBooking_month_year_idx" ON "ITProjectBooking"("month", "year");
CREATE INDEX "DepartmentRevenue_department_month_year_idx" ON "DepartmentRevenue"("department", "month", "year");
CREATE UNIQUE INDEX "PnLCategory_sourceKey_key" ON "PnLCategory"("sourceKey");
CREATE INDEX "PnLCategory_type_idx" ON "PnLCategory"("type");
CREATE INDEX "PnLCategory_isActive_idx" ON "PnLCategory"("isActive");
CREATE UNIQUE INDEX "PnLEntry_categoryId_month_year_key" ON "PnLEntry"("categoryId", "month", "year");
CREATE INDEX "PnLEntry_month_year_idx" ON "PnLEntry"("month", "year");

-- AddForeignKey
ALTER TABLE "ITProject" ADD CONSTRAINT "ITProject_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ITFreelancer" ADD CONSTRAINT "ITFreelancer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ITProjectResource" ADD CONSTRAINT "ITProjectResource_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ITProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ITProjectResource" ADD CONSTRAINT "ITProjectResource_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ITProjectResource" ADD CONSTRAINT "ITProjectResource_freelancerId_fkey" FOREIGN KEY ("freelancerId") REFERENCES "ITFreelancer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ITProjectBooking" ADD CONSTRAINT "ITProjectBooking_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ITProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ITProjectBooking" ADD CONSTRAINT "ITProjectBooking_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DepartmentRevenue" ADD CONSTRAINT "DepartmentRevenue_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PnLCategory" ADD CONSTRAINT "PnLCategory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PnLEntry" ADD CONSTRAINT "PnLEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "PnLCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PnLEntry" ADD CONSTRAINT "PnLEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
