-- Onboarding status enum and employee columns
DO $$ BEGIN
  CREATE TYPE "OnboardingStatus" AS ENUM ('PENDING_PROFILE', 'PENDING_APPROVAL', 'APPROVED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Employee"
  ADD COLUMN IF NOT EXISTS "onboardingStatus" "OnboardingStatus" NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN IF NOT EXISTS "onboardingSubmittedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "onboardingApprovedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "onboardingApprovedById" TEXT;

DO $$ BEGIN
  ALTER TABLE "Employee"
    ADD CONSTRAINT "Employee_onboardingApprovedById_fkey"
    FOREIGN KEY ("onboardingApprovedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "Employee_onboardingStatus_idx" ON "Employee"("onboardingStatus");

-- Notification types for onboarding
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ONBOARDING_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ONBOARDING_APPROVED';
