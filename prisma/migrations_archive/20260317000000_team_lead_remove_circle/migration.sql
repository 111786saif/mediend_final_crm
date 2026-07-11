-- Add teamLeadId column (nullable, unique, FK to User)
ALTER TABLE "Team" ADD COLUMN "teamLeadId" TEXT;

ALTER TABLE "Team" ADD CONSTRAINT "Team_teamLeadId_key" UNIQUE ("teamLeadId");

ALTER TABLE "Team" ADD CONSTRAINT "Team_teamLeadId_fkey"
  FOREIGN KEY ("teamLeadId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: for each team, find the TEAM_LEAD member and set teamLeadId
UPDATE "Team" t
SET "teamLeadId" = sub."id"
FROM (
  SELECT u."id", u."teamId"
  FROM "User" u
  WHERE u."role" = 'TEAM_LEAD' AND u."teamId" IS NOT NULL
) sub
WHERE t."id" = sub."teamId"
  AND t."teamLeadId" IS NULL;

-- Drop circle index and column
DROP INDEX IF EXISTS "Team_circle_idx";
ALTER TABLE "Team" DROP COLUMN IF EXISTS "circle";

-- Add index on teamLeadId
CREATE INDEX IF NOT EXISTS "Team_teamLeadId_idx" ON "Team"("teamLeadId");
