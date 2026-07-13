-- Doctor payoff requests + activity logs for payoff & invoice requests

CREATE TYPE "DoctorPayoffRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE IF NOT EXISTS "InvoiceRequestActivity" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "remarks" TEXT,
  "actorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvoiceRequestActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DoctorPayoffRequest" (
  "id" TEXT NOT NULL,
  "doctorName" TEXT NOT NULL,
  "hospitalName" TEXT,
  "leadId" TEXT,
  "leadIds" JSONB,
  "requestAmount" DOUBLE PRECISION NOT NULL,
  "requestRemarks" TEXT,
  "financeRemarks" TEXT,
  "rejectionRemarks" TEXT,
  "attachments" JSONB,
  "status" "DoctorPayoffRequestStatus" NOT NULL DEFAULT 'PENDING',
  "requestedById" TEXT NOT NULL,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DoctorPayoffRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DoctorPayoffRequestActivity" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "remarks" TEXT,
  "actorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DoctorPayoffRequestActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InvoiceRequestActivity_requestId_idx" ON "InvoiceRequestActivity"("requestId");
CREATE INDEX IF NOT EXISTS "InvoiceRequestActivity_createdAt_idx" ON "InvoiceRequestActivity"("createdAt");
CREATE INDEX IF NOT EXISTS "InvoiceRequestActivity_actorId_idx" ON "InvoiceRequestActivity"("actorId");

CREATE INDEX IF NOT EXISTS "DoctorPayoffRequest_doctorName_idx" ON "DoctorPayoffRequest"("doctorName");
CREATE INDEX IF NOT EXISTS "DoctorPayoffRequest_hospitalName_idx" ON "DoctorPayoffRequest"("hospitalName");
CREATE INDEX IF NOT EXISTS "DoctorPayoffRequest_leadId_idx" ON "DoctorPayoffRequest"("leadId");
CREATE INDEX IF NOT EXISTS "DoctorPayoffRequest_status_idx" ON "DoctorPayoffRequest"("status");
CREATE INDEX IF NOT EXISTS "DoctorPayoffRequest_requestedById_idx" ON "DoctorPayoffRequest"("requestedById");
CREATE INDEX IF NOT EXISTS "DoctorPayoffRequest_createdAt_idx" ON "DoctorPayoffRequest"("createdAt");

CREATE INDEX IF NOT EXISTS "DoctorPayoffRequestActivity_requestId_idx" ON "DoctorPayoffRequestActivity"("requestId");
CREATE INDEX IF NOT EXISTS "DoctorPayoffRequestActivity_createdAt_idx" ON "DoctorPayoffRequestActivity"("createdAt");
CREATE INDEX IF NOT EXISTS "DoctorPayoffRequestActivity_actorId_idx" ON "DoctorPayoffRequestActivity"("actorId");

DO $$ BEGIN
  ALTER TABLE "InvoiceRequestActivity"
    ADD CONSTRAINT "InvoiceRequestActivity_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES "InvoiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "InvoiceRequestActivity"
    ADD CONSTRAINT "InvoiceRequestActivity_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DoctorPayoffRequest"
    ADD CONSTRAINT "DoctorPayoffRequest_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DoctorPayoffRequest"
    ADD CONSTRAINT "DoctorPayoffRequest_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DoctorPayoffRequest"
    ADD CONSTRAINT "DoctorPayoffRequest_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DoctorPayoffRequestActivity"
    ADD CONSTRAINT "DoctorPayoffRequestActivity_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES "DoctorPayoffRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DoctorPayoffRequestActivity"
    ADD CONSTRAINT "DoctorPayoffRequestActivity_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
