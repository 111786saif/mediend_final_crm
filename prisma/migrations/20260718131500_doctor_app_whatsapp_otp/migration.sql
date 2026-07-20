-- Doctor app WhatsApp auth
ALTER TABLE "DoctorAppAccount"
  ADD COLUMN "phoneNumber" TEXT;

CREATE UNIQUE INDEX "DoctorAppAccount_phoneNumber_key" ON "DoctorAppAccount"("phoneNumber");

CREATE TABLE "DoctorAppWhatsappOtp" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "phoneNumber" TEXT NOT NULL,
  "otp" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DoctorAppWhatsappOtp_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DoctorAppWhatsappOtp_accountId_idx" ON "DoctorAppWhatsappOtp"("accountId");
CREATE INDEX "DoctorAppWhatsappOtp_phoneNumber_idx" ON "DoctorAppWhatsappOtp"("phoneNumber");
CREATE INDEX "DoctorAppWhatsappOtp_expiresAt_idx" ON "DoctorAppWhatsappOtp"("expiresAt");

ALTER TABLE "DoctorAppWhatsappOtp"
  ADD CONSTRAINT "DoctorAppWhatsappOtp_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "DoctorAppAccount"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
