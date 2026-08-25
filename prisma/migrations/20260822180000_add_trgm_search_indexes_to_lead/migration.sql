-- CreateExtension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateIndex for CRM Search Optimization
CREATE INDEX IF NOT EXISTS "Lead_patientName_trgm_idx" ON "Lead" USING gin ("patientName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Lead_category_trgm_idx" ON "Lead" USING gin ("category" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Lead_treatment_trgm_idx" ON "Lead" USING gin ("treatment" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Lead_leadRef_trgm_idx" ON "Lead" USING gin ("leadRef" gin_trgm_ops);
