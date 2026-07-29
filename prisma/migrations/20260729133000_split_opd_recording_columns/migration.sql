ALTER TABLE "Lead"
ADD COLUMN IF NOT EXISTS "opdSurgeryAdvised" TEXT,
ADD COLUMN IF NOT EXISTS "opdSurgeryRemarkCode" TEXT,
ADD COLUMN IF NOT EXISTS "opdReasonNoSurgeryCode" TEXT,
ADD COLUMN IF NOT EXISTS "opdFollowUpReasonCode" TEXT,
ADD COLUMN IF NOT EXISTS "opdImplantRequired" BOOLEAN,
ADD COLUMN IF NOT EXISTS "opdDiagnosis" TEXT;

CREATE TABLE IF NOT EXISTS "LeadOpdPrescriptionImage" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "storageKey" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LeadOpdPrescriptionImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Lead_opdSurgeryRemarkCode_idx" ON "Lead"("opdSurgeryRemarkCode");
CREATE INDEX IF NOT EXISTS "Lead_opdReasonNoSurgeryCode_idx" ON "Lead"("opdReasonNoSurgeryCode");
CREATE INDEX IF NOT EXISTS "Lead_opdFollowUpReasonCode_idx" ON "Lead"("opdFollowUpReasonCode");
CREATE INDEX IF NOT EXISTS "LeadOpdPrescriptionImage_leadId_sortOrder_idx" ON "LeadOpdPrescriptionImage"("leadId", "sortOrder");

UPDATE "Lead"
SET
  "opdSurgeryAdvised" = COALESCE("opdSurgeryAdvised", "opdRecording"->>'surgeryAdvised'),
  "opdSurgeryRemarkCode" = COALESCE(
    "opdSurgeryRemarkCode",
    "opdRecording"->'surgeryRemark'->>'code',
    "opdRecording"->>'surgeryRemarksType'
  ),
  "opdReasonNoSurgeryCode" = COALESCE(
    "opdReasonNoSurgeryCode",
    "opdRecording"->'reasonNoSurgery'->>'code'
  ),
  "opdFollowUpReasonCode" = COALESCE(
    "opdFollowUpReasonCode",
    "opdRecording"->'followUpReason'->>'code'
  ),
  "opdImplantRequired" = COALESCE(
    "opdImplantRequired",
    CASE
      WHEN jsonb_typeof("opdRecording"->'implantRequired') = 'boolean'
        THEN ("opdRecording"->>'implantRequired')::boolean
      ELSE NULL
    END
  ),
  "opdDiagnosis" = COALESCE("opdDiagnosis", "opdRecording"->>'diagnosis'),
  "diseaseDetails" = COALESCE("diseaseDetails", "opdRecording"->>'diagnosis')
WHERE "opdRecording" IS NOT NULL;

INSERT INTO "LeadOpdPrescriptionImage" (
  "id",
  "leadId",
  "fileName",
  "fileUrl",
  "storageKey",
  "sortOrder",
  "createdAt",
  "updatedAt"
)
SELECT
  "Lead"."id" || '-opdimg-' || image.ordinality::text AS "id",
  "Lead"."id" AS "leadId",
  COALESCE(NULLIF(image.value->>'name', ''), 'Prescription') AS "fileName",
  image.value->>'url' AS "fileUrl",
  NULLIF(image.value->>'key', '') AS "storageKey",
  GREATEST(image.ordinality - 1, 0)::integer AS "sortOrder",
  CURRENT_TIMESTAMP AS "createdAt",
  CURRENT_TIMESTAMP AS "updatedAt"
FROM "Lead"
CROSS JOIN LATERAL jsonb_array_elements(COALESCE("Lead"."opdRecording"->'prescriptionImages', '[]'::jsonb))
  WITH ORDINALITY AS image(value, ordinality)
WHERE COALESCE(image.value->>'url', '') <> ''
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "LeadOpdPrescriptionImage"
ADD CONSTRAINT "LeadOpdPrescriptionImage_leadId_fkey"
FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Lead"
ADD CONSTRAINT "Lead_opdSurgeryRemarkCode_fkey"
FOREIGN KEY ("opdSurgeryRemarkCode") REFERENCES "SurgeryRemarkMaster"("code") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Lead"
ADD CONSTRAINT "Lead_opdReasonNoSurgeryCode_fkey"
FOREIGN KEY ("opdReasonNoSurgeryCode") REFERENCES "ReasonNoSurgeryMaster"("code") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Lead"
ADD CONSTRAINT "Lead_opdFollowUpReasonCode_fkey"
FOREIGN KEY ("opdFollowUpReasonCode") REFERENCES "FollowUpReasonMaster"("code") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Lead"
DROP COLUMN IF EXISTS "opdRecording";
