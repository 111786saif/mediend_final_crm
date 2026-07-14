-- Hospital share % (dedicated column) + JSON bag for remaining Hospital Master fields
ALTER TABLE "HospitalMaster" ADD COLUMN IF NOT EXISTS "hospitalShare" DOUBLE PRECISION;
ALTER TABLE "HospitalMaster" ADD COLUMN IF NOT EXISTS "details" JSONB;
