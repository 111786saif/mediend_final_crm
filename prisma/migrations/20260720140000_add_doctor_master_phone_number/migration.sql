-- Add doctor phone number to doctor master for admin/master-data management
ALTER TABLE "DoctorMaster"
  ADD COLUMN "phoneNumber" TEXT;

CREATE UNIQUE INDEX "DoctorMaster_phoneNumber_key" ON "DoctorMaster"("phoneNumber");
CREATE INDEX "DoctorMaster_phoneNumber_idx" ON "DoctorMaster"("phoneNumber");
