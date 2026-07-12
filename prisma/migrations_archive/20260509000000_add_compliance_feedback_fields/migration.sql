-- CreateEnum
CREATE TYPE "SatisfactionLevel" AS ENUM ('SATISFIED', 'NEUTRAL', 'NOT_SATISFIED');

-- CreateEnum
CREATE TYPE "ConcernCategory" AS ENUM ('HOSPITAL_STAFF', 'PAYMENT', 'BD', 'NO_UPDATE_FOLLOWUP', 'DOCTOR', 'SURGERY_RELATED', 'CAB_PAYMENT', 'OTHERS');

-- AlterTable
ALTER TABLE "ComplianceCall"
  ADD COLUMN "problemDuringSurgery"   TEXT,
  ADD COLUMN "problemAfterSurgery"    TEXT,
  ADD COLUMN "commitmentStatus"       TEXT,
  ADD COLUMN "concernResolved"        TEXT,
  ADD COLUMN "doctorBehaviour"        TEXT,
  ADD COLUMN "hospitalStaffBehaviour" TEXT,
  ADD COLUMN "bdmBehaviour"           TEXT,
  ADD COLUMN "mediendService"         TEXT,
  ADD COLUMN "overallExperience"      TEXT,
  ADD COLUMN "paymentQuery"           TEXT,
  ADD COLUMN "referralConfirmation"   TEXT,
  ADD COLUMN "referralName"           TEXT,
  ADD COLUMN "referralContact"        TEXT,
  ADD COLUMN "opdStatus"              TEXT,
  ADD COLUMN "opdMode"                TEXT,
  ADD COLUMN "additionalRemark"       TEXT,
  ADD COLUMN "satisfaction"           "SatisfactionLevel",
  ADD COLUMN "concernCategories"      "ConcernCategory"[] NOT NULL DEFAULT ARRAY[]::"ConcernCategory"[];

-- CreateIndex
CREATE INDEX "ComplianceCall_satisfaction_idx" ON "ComplianceCall"("satisfaction");
