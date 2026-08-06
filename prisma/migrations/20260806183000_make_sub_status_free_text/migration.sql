ALTER TABLE "Lead"
ALTER COLUMN "subStatus" TYPE VARCHAR(25)
USING CASE
  WHEN "subStatus" IS NULL THEN NULL
  ELSE LEFT("subStatus"::text, 25)
END;

ALTER TABLE "BulkLeadReassignmentRun"
ALTER COLUMN "subStatus" TYPE VARCHAR(25)
USING CASE
  WHEN "subStatus" IS NULL THEN NULL
  ELSE LEFT("subStatus"::text, 25)
END;
