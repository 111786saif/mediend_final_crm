-- Meets (interviews, MD appointments, general)
CREATE TYPE "MeetType" AS ENUM ('VIRTUAL', 'OFFLINE');

CREATE TYPE "MeetModule" AS ENUM ('INTERVIEW', 'MD_APPOINTMENT', 'GENERAL');

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MEET_SCHEDULED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MEET_REMINDER';

CREATE TABLE "Meet" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "MeetType" NOT NULL DEFAULT 'OFFLINE',
    "meetLink" TEXT,
    "location" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "module" "MeetModule" NOT NULL DEFAULT 'GENERAL',
    "interviewRound" INTEGER,
    "candidateName" TEXT,
    "candidateRole" TEXT,
    "departmentId" TEXT,
    "notes" TEXT,
    "resumeUrl" TEXT,
    "isRecorded" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "mdAppointmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Meet_mdAppointmentId_key" ON "Meet"("mdAppointmentId");
CREATE INDEX "Meet_scheduledAt_idx" ON "Meet"("scheduledAt");
CREATE INDEX "Meet_module_idx" ON "Meet"("module");
CREATE INDEX "Meet_createdById_idx" ON "Meet"("createdById");

CREATE TABLE "MeetParticipant" (
    "id" TEXT NOT NULL,
    "meetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "MeetParticipant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MeetParticipant_meetId_userId_key" ON "MeetParticipant"("meetId", "userId");
CREATE INDEX "MeetParticipant_userId_idx" ON "MeetParticipant"("userId");

ALTER TABLE "Meet" ADD CONSTRAINT "Meet_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Meet" ADD CONSTRAINT "Meet_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Meet" ADD CONSTRAINT "Meet_mdAppointmentId_fkey" FOREIGN KEY ("mdAppointmentId") REFERENCES "MDAppointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MeetParticipant" ADD CONSTRAINT "MeetParticipant_meetId_fkey" FOREIGN KEY ("meetId") REFERENCES "Meet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetParticipant" ADD CONSTRAINT "MeetParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
