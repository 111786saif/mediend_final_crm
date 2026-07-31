-- Experience type + personal invite email + onboarding document URLs
DO $$ BEGIN
  CREATE TYPE "ExperienceType" AS ENUM ('FRESHER', 'EXPERIENCED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "salarySlipDocUrl" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "bankStatementDocUrl" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "experienceType" "ExperienceType";
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "personalEmail" TEXT;
