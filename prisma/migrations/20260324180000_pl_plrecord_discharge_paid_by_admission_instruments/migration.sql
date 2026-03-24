-- CreateEnum
CREATE TYPE "PaidByParty" AS ENUM ('MEDIEND', 'HOSPITAL');

-- AlterTable
ALTER TABLE "PLRecord" ADD COLUMN     "admissionDate" TIMESTAMP(3),
ADD COLUMN     "instrumentsCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "implantPaidBy" "PaidByParty",
ADD COLUMN     "instrumentsPaidBy" "PaidByParty";

-- AlterTable
ALTER TABLE "DischargeSheet" ADD COLUMN     "admissionDate" TIMESTAMP(3),
ADD COLUMN     "instrumentsCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "implantPaidBy" "PaidByParty",
ADD COLUMN     "instrumentsPaidBy" "PaidByParty";
