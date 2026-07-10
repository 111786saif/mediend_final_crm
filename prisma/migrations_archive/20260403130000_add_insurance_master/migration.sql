-- CreateTable
CREATE TABLE "InsuranceMaster" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsuranceMaster_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InsuranceMaster_name_key" ON "InsuranceMaster"("name");

-- CreateIndex
CREATE INDEX "InsuranceMaster_name_idx" ON "InsuranceMaster"("name");

-- CreateIndex
CREATE INDEX "InsuranceMaster_isActive_idx" ON "InsuranceMaster"("isActive");
