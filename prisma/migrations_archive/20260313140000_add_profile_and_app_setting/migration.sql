-- AlterTable: User - add profile fields (phoneNumber, address, profilePicture)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "profilePicture" TEXT;

-- AlterTable: Employee - add bankAccountName (was in schema but never migrated)
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "bankAccountName" TEXT;

-- CreateTable: AppSetting (for home banner and other app-level settings)
CREATE TABLE IF NOT EXISTS "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);
