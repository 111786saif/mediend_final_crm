-- AlterTable
-- Multiple ID card uploads (e.g. Aadhaar/PAN front & back): [{ "name": string, "url": string }]
ALTER TABLE "KYPSubmission" ADD COLUMN "aadharFiles" JSONB,
ADD COLUMN "panFiles" JSONB;
