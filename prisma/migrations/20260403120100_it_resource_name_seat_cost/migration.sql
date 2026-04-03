-- AlterTable
ALTER TABLE "ITProjectResource" ADD COLUMN "resourceName" TEXT,
ADD COLUMN "seatCostApplied" BOOLEAN NOT NULL DEFAULT false;
