-- Doctor app auth foundation
CREATE TABLE "DoctorAppAccount" (
  "id" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DoctorAppAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DoctorAppRefreshToken" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "jti" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DoctorAppRefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DoctorAppAccount_doctorId_key" ON "DoctorAppAccount"("doctorId");
CREATE UNIQUE INDEX "DoctorAppAccount_email_key" ON "DoctorAppAccount"("email");
CREATE INDEX "DoctorAppAccount_isActive_idx" ON "DoctorAppAccount"("isActive");

CREATE UNIQUE INDEX "DoctorAppRefreshToken_jti_key" ON "DoctorAppRefreshToken"("jti");
CREATE INDEX "DoctorAppRefreshToken_accountId_idx" ON "DoctorAppRefreshToken"("accountId");
CREATE INDEX "DoctorAppRefreshToken_expiresAt_idx" ON "DoctorAppRefreshToken"("expiresAt");

ALTER TABLE "DoctorAppAccount"
  ADD CONSTRAINT "DoctorAppAccount_doctorId_fkey"
  FOREIGN KEY ("doctorId") REFERENCES "DoctorMaster"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DoctorAppRefreshToken"
  ADD CONSTRAINT "DoctorAppRefreshToken_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "DoctorAppAccount"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
