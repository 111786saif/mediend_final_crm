-- CreateTable
CREATE TABLE "CumulativeReportManualEntry" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "patientSummary" JSONB NOT NULL,
    "concernCategory" JSONB NOT NULL,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CumulativeReportManualEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CumulativeReportManualEntry_year_key" ON "CumulativeReportManualEntry"("year");

-- CreateIndex
CREATE INDEX "CumulativeReportManualEntry_updatedAt_idx" ON "CumulativeReportManualEntry"("updatedAt");

-- AddForeignKey
ALTER TABLE "CumulativeReportManualEntry" ADD CONSTRAINT "CumulativeReportManualEntry_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
