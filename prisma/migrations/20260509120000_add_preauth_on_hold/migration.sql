-- AlterEnum
-- Add ON_HOLD status: internal Insurance pause on a raised pre-auth.
ALTER TYPE "PreAuthStatus" ADD VALUE IF NOT EXISTS 'ON_HOLD';

-- AlterTable
ALTER TABLE "PreAuthorization"
  ADD COLUMN IF NOT EXISTS "holdReason" TEXT,
  ADD COLUMN IF NOT EXISTS "heldAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "heldById" TEXT;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PreAuthorization_heldById_fkey'
  ) THEN
    ALTER TABLE "PreAuthorization"
      ADD CONSTRAINT "PreAuthorization_heldById_fkey"
      FOREIGN KEY ("heldById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
