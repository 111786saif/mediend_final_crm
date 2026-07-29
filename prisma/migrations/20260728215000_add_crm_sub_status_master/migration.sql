CREATE TABLE "CrmSubStatusMaster" (
  "id" TEXT NOT NULL,
  "key" INTEGER NOT NULL,
  "value" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CrmSubStatusMaster_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CrmSubStatusMaster_key_key" ON "CrmSubStatusMaster"("key");
CREATE INDEX "CrmSubStatusMaster_key_idx" ON "CrmSubStatusMaster"("key");
CREATE INDEX "CrmSubStatusMaster_value_idx" ON "CrmSubStatusMaster"("value");
CREATE INDEX "CrmSubStatusMaster_isActive_idx" ON "CrmSubStatusMaster"("isActive");
