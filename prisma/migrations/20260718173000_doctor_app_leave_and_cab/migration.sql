-- Doctor mobile app leave and cab workflow tables

CREATE TABLE "DoctorLeaveRequest" (
  "id" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "reason" TEXT,
  "status" "LeaveRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DoctorLeaveRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DoctorCabRequest" (
  "id" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "pickup" TEXT NOT NULL,
  "drop" TEXT NOT NULL,
  "pickupLat" DOUBLE PRECISION,
  "pickupLng" DOUBLE PRECISION,
  "dropLat" DOUBLE PRECISION,
  "dropLng" DOUBLE PRECISION,
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "status" "AppointmentStatus" NOT NULL DEFAULT 'PENDING',
  "reviewNotes" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "vendorName" TEXT,
  "vendorPhone" TEXT,
  "assignedVendorById" TEXT,
  "assignedVendorAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DoctorCabRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DoctorLeaveRequest_doctorId_createdAt_idx" ON "DoctorLeaveRequest"("doctorId", "createdAt");
CREATE INDEX "DoctorLeaveRequest_status_idx" ON "DoctorLeaveRequest"("status");
CREATE INDEX "DoctorLeaveRequest_startDate_endDate_idx" ON "DoctorLeaveRequest"("startDate", "endDate");

CREATE INDEX "DoctorCabRequest_doctorId_createdAt_idx" ON "DoctorCabRequest"("doctorId", "createdAt");
CREATE INDEX "DoctorCabRequest_status_idx" ON "DoctorCabRequest"("status");
CREATE INDEX "DoctorCabRequest_scheduledFor_idx" ON "DoctorCabRequest"("scheduledFor");

ALTER TABLE "DoctorLeaveRequest"
  ADD CONSTRAINT "DoctorLeaveRequest_doctorId_fkey"
  FOREIGN KEY ("doctorId") REFERENCES "DoctorMaster"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DoctorLeaveRequest"
  ADD CONSTRAINT "DoctorLeaveRequest_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DoctorCabRequest"
  ADD CONSTRAINT "DoctorCabRequest_doctorId_fkey"
  FOREIGN KEY ("doctorId") REFERENCES "DoctorMaster"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DoctorCabRequest"
  ADD CONSTRAINT "DoctorCabRequest_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DoctorCabRequest"
  ADD CONSTRAINT "DoctorCabRequest_assignedVendorById_fkey"
  FOREIGN KEY ("assignedVendorById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
