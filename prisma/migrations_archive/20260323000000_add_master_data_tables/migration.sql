-- CreateTable
CREATE TABLE "HospitalMaster" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "googleMapLink" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorMaster" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TPAMaster" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TPAMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnesthesiaMaster" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnesthesiaMaster_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HospitalMaster_name_key" ON "HospitalMaster"("name");

-- CreateIndex
CREATE INDEX "HospitalMaster_name_idx" ON "HospitalMaster"("name");

-- CreateIndex
CREATE INDEX "HospitalMaster_isActive_idx" ON "HospitalMaster"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorMaster_name_key" ON "DoctorMaster"("name");

-- CreateIndex
CREATE INDEX "DoctorMaster_name_idx" ON "DoctorMaster"("name");

-- CreateIndex
CREATE INDEX "DoctorMaster_isActive_idx" ON "DoctorMaster"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TPAMaster_name_key" ON "TPAMaster"("name");

-- CreateIndex
CREATE INDEX "TPAMaster_name_idx" ON "TPAMaster"("name");

-- CreateIndex
CREATE INDEX "TPAMaster_isActive_idx" ON "TPAMaster"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AnesthesiaMaster_name_key" ON "AnesthesiaMaster"("name");

-- CreateIndex
CREATE INDEX "AnesthesiaMaster_name_idx" ON "AnesthesiaMaster"("name");

-- CreateIndex
CREATE INDEX "AnesthesiaMaster_isActive_idx" ON "AnesthesiaMaster"("isActive");
