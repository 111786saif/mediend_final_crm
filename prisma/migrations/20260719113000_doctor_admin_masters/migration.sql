-- Doctor admin master tables

CREATE TABLE "ImplantMaster" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "category" TEXT,
  "manufacturer" TEXT,
  "unitCost" DOUBLE PRECISION,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ImplantMaster_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SurgeryRemarkMaster" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SurgeryRemarkMaster_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReasonNoSurgeryMaster" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ReasonNoSurgeryMaster_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FollowUpReasonMaster" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FollowUpReasonMaster_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ImplantMaster_name_key" ON "ImplantMaster"("name");
CREATE UNIQUE INDEX "ImplantMaster_code_key" ON "ImplantMaster"("code");
CREATE INDEX "ImplantMaster_name_idx" ON "ImplantMaster"("name");
CREATE INDEX "ImplantMaster_code_idx" ON "ImplantMaster"("code");
CREATE INDEX "ImplantMaster_isActive_idx" ON "ImplantMaster"("isActive");

CREATE UNIQUE INDEX "SurgeryRemarkMaster_code_key" ON "SurgeryRemarkMaster"("code");
CREATE INDEX "SurgeryRemarkMaster_displayOrder_idx" ON "SurgeryRemarkMaster"("displayOrder");
CREATE INDEX "SurgeryRemarkMaster_isActive_idx" ON "SurgeryRemarkMaster"("isActive");

CREATE UNIQUE INDEX "ReasonNoSurgeryMaster_code_key" ON "ReasonNoSurgeryMaster"("code");
CREATE INDEX "ReasonNoSurgeryMaster_displayOrder_idx" ON "ReasonNoSurgeryMaster"("displayOrder");
CREATE INDEX "ReasonNoSurgeryMaster_isActive_idx" ON "ReasonNoSurgeryMaster"("isActive");

CREATE UNIQUE INDEX "FollowUpReasonMaster_code_key" ON "FollowUpReasonMaster"("code");
CREATE INDEX "FollowUpReasonMaster_displayOrder_idx" ON "FollowUpReasonMaster"("displayOrder");
CREATE INDEX "FollowUpReasonMaster_isActive_idx" ON "FollowUpReasonMaster"("isActive");
