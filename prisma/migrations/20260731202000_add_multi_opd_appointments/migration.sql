CREATE TYPE "LeadOpdPhase" AS ENUM ('PRE', 'POST');

CREATE TYPE "LeadOpdStatus" AS ENUM ('SCHEDULED', 'DONE', 'CANCELLED', 'NO_SHOW');

CREATE TABLE "LeadOpdAppointment" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "phase" "LeadOpdPhase" NOT NULL,
  "slot" INTEGER NOT NULL,
  "status" "LeadOpdStatus" NOT NULL DEFAULT 'SCHEDULED',
  "hospitalName" TEXT,
  "doctorName" TEXT,
  "contactNumber" TEXT,
  "charges" INTEGER NOT NULL DEFAULT 0,
  "scheduleDate" TIMESTAMP(3),
  "meetingType" INTEGER,
  "surgeryAdvised" TEXT,
  "surgeryRemarkCode" TEXT,
  "reasonNoSurgeryCode" TEXT,
  "followUpReasonCode" TEXT,
  "implantRequired" BOOLEAN,
  "diagnosis" TEXT,
  "remarks" TEXT,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LeadOpdAppointment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeadOpdAppointmentPrescriptionImage" (
  "id" TEXT NOT NULL,
  "opdAppointmentId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "storageKey" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LeadOpdAppointmentPrescriptionImage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LeadOpdAppointment_leadId_phase_slot_key"
ON "LeadOpdAppointment"("leadId", "phase", "slot");

CREATE INDEX "LeadOpdAppointment_leadId_phase_slot_idx"
ON "LeadOpdAppointment"("leadId", "phase", "slot");

CREATE INDEX "LeadOpdAppointment_status_idx"
ON "LeadOpdAppointment"("status");

CREATE INDEX "LeadOpdAppointment_scheduleDate_idx"
ON "LeadOpdAppointment"("scheduleDate");

CREATE INDEX "LeadOpdAppointment_surgeryRemarkCode_idx"
ON "LeadOpdAppointment"("surgeryRemarkCode");

CREATE INDEX "LeadOpdAppointment_reasonNoSurgeryCode_idx"
ON "LeadOpdAppointment"("reasonNoSurgeryCode");

CREATE INDEX "LeadOpdAppointment_followUpReasonCode_idx"
ON "LeadOpdAppointment"("followUpReasonCode");

CREATE INDEX "LeadOpdAppointmentPrescriptionImage_opdAppointmentId_idx"
ON "LeadOpdAppointmentPrescriptionImage"("opdAppointmentId");

ALTER TABLE "LeadOpdAppointment"
ADD CONSTRAINT "LeadOpdAppointment_leadId_fkey"
FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeadOpdAppointment"
ADD CONSTRAINT "LeadOpdAppointment_surgeryRemarkCode_fkey"
FOREIGN KEY ("surgeryRemarkCode") REFERENCES "SurgeryRemarkMaster"("code") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LeadOpdAppointment"
ADD CONSTRAINT "LeadOpdAppointment_reasonNoSurgeryCode_fkey"
FOREIGN KEY ("reasonNoSurgeryCode") REFERENCES "ReasonNoSurgeryMaster"("code") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LeadOpdAppointment"
ADD CONSTRAINT "LeadOpdAppointment_followUpReasonCode_fkey"
FOREIGN KEY ("followUpReasonCode") REFERENCES "FollowUpReasonMaster"("code") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LeadOpdAppointmentPrescriptionImage"
ADD CONSTRAINT "LeadOpdAppointmentPrescriptionImage_opdAppointmentId_fkey"
FOREIGN KEY ("opdAppointmentId") REFERENCES "LeadOpdAppointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
