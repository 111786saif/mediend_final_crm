-- CreateEnum
CREATE TYPE "PLOutstandingStatus" AS ENUM ('NEW', 'DRAFT', 'OUTSTANDING');

-- AlterTable
ALTER TABLE "PLRecord" ADD COLUMN "outstandingStatus" "PLOutstandingStatus" NOT NULL DEFAULT 'NEW';
