ALTER TABLE "CrmCampaign"
ADD COLUMN "treatment" TEXT,
ADD COLUMN "treatmentMasterId" TEXT;

CREATE INDEX "CrmCampaign_treatment_idx" ON "CrmCampaign"("treatment");
CREATE INDEX "CrmCampaign_treatmentMasterId_idx" ON "CrmCampaign"("treatmentMasterId");

ALTER TABLE "CrmCampaign"
ADD CONSTRAINT "CrmCampaign_treatmentMasterId_fkey"
FOREIGN KEY ("treatmentMasterId") REFERENCES "TreatmentMaster"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
