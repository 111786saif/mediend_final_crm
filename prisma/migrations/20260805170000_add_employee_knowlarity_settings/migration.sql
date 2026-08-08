ALTER TABLE "Employee"
ADD COLUMN "knowlarityPhoneNumber" TEXT,
ADD COLUMN "knowlarityCallerId" TEXT,
ADD COLUMN "knowlarityNotificationsEnabled" BOOLEAN NOT NULL DEFAULT false;
