ALTER TABLE "AdmissionRecord"
ADD COLUMN IF NOT EXISTS "ipdImplantUsed" BOOLEAN,
ADD COLUMN IF NOT EXISTS "ipdNoShowReason" TEXT;

CREATE TABLE IF NOT EXISTS "AdmissionRecordImplantUsage" (
  "id" TEXT NOT NULL,
  "admissionRecordId" TEXT NOT NULL,
  "implantId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "notes" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AdmissionRecordImplantUsage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AdmissionRecordPrescriptionImage" (
  "id" TEXT NOT NULL,
  "admissionRecordId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "storageKey" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AdmissionRecordPrescriptionImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AdmissionRecordImplantUsage_admissionRecordId_sortOrder_idx"
  ON "AdmissionRecordImplantUsage"("admissionRecordId", "sortOrder");

CREATE INDEX IF NOT EXISTS "AdmissionRecordImplantUsage_implantId_idx"
  ON "AdmissionRecordImplantUsage"("implantId");

CREATE INDEX IF NOT EXISTS "AdmissionRecordPrescriptionImage_admissionRecordId_sortOrder_idx"
  ON "AdmissionRecordPrescriptionImage"("admissionRecordId", "sortOrder");

ALTER TABLE "AdmissionRecordImplantUsage"
ADD CONSTRAINT "AdmissionRecordImplantUsage_admissionRecordId_fkey"
FOREIGN KEY ("admissionRecordId") REFERENCES "AdmissionRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdmissionRecordImplantUsage"
ADD CONSTRAINT "AdmissionRecordImplantUsage_implantId_fkey"
FOREIGN KEY ("implantId") REFERENCES "ImplantMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AdmissionRecordPrescriptionImage"
ADD CONSTRAINT "AdmissionRecordPrescriptionImage_admissionRecordId_fkey"
FOREIGN KEY ("admissionRecordId") REFERENCES "AdmissionRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
