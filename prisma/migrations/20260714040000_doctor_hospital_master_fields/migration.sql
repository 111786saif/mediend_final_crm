-- AlterTable HospitalMaster
ALTER TABLE "HospitalMaster" ADD COLUMN IF NOT EXISTS "mouAgreementUrl" TEXT;

-- AlterTable DoctorMaster
ALTER TABLE "DoctorMaster" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "DoctorMaster" ADD COLUMN IF NOT EXISTS "treatment" TEXT;
ALTER TABLE "DoctorMaster" ADD COLUMN IF NOT EXISTS "age" INTEGER;
ALTER TABLE "DoctorMaster" ADD COLUMN IF NOT EXISTS "sex" TEXT;
ALTER TABLE "DoctorMaster" ADD COLUMN IF NOT EXISTS "aadhaarNumber" TEXT;
ALTER TABLE "DoctorMaster" ADD COLUMN IF NOT EXISTS "aadhaarCardUrl" TEXT;
ALTER TABLE "DoctorMaster" ADD COLUMN IF NOT EXISTS "panNumber" TEXT;
ALTER TABLE "DoctorMaster" ADD COLUMN IF NOT EXISTS "panCardUrl" TEXT;
ALTER TABLE "DoctorMaster" ADD COLUMN IF NOT EXISTS "agreementUrl" TEXT;
ALTER TABLE "DoctorMaster" ADD COLUMN IF NOT EXISTS "experienceYears" INTEGER;
ALTER TABLE "DoctorMaster" ADD COLUMN IF NOT EXISTS "experienceNotes" TEXT;
ALTER TABLE "DoctorMaster" ADD COLUMN IF NOT EXISTS "feeStructure" TEXT;
ALTER TABLE "DoctorMaster" ADD COLUMN IF NOT EXISTS "ratingAverage" DOUBLE PRECISION;
ALTER TABLE "DoctorMaster" ADD COLUMN IF NOT EXISTS "ratingCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "DoctorMaster" ADD COLUMN IF NOT EXISTS "documents" JSONB;

CREATE INDEX IF NOT EXISTS "DoctorMaster_category_idx" ON "DoctorMaster"("category");

-- CreateTable HospitalMasterInsurance
CREATE TABLE IF NOT EXISTS "HospitalMasterInsurance" (
    "hospitalId" TEXT NOT NULL,
    "insuranceId" TEXT NOT NULL,

    CONSTRAINT "HospitalMasterInsurance_pkey" PRIMARY KEY ("hospitalId", "insuranceId")
);

CREATE INDEX IF NOT EXISTS "HospitalMasterInsurance_insuranceId_idx" ON "HospitalMasterInsurance"("insuranceId");

DO $$ BEGIN
  ALTER TABLE "HospitalMasterInsurance"
    ADD CONSTRAINT "HospitalMasterInsurance_hospitalId_fkey"
    FOREIGN KEY ("hospitalId") REFERENCES "HospitalMaster"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "HospitalMasterInsurance"
    ADD CONSTRAINT "HospitalMasterInsurance_insuranceId_fkey"
    FOREIGN KEY ("insuranceId") REFERENCES "InsuranceMaster"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
