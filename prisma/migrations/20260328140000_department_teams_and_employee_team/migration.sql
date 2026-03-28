-- DepartmentTeam + Employee.teamId (replaces legacy User.teamId + "Team" table).
-- Safe to re-run in part: uses IF NOT EXISTS / guarded DO blocks where practical.

-- 1) DepartmentTeam
CREATE TABLE IF NOT EXISTS "DepartmentTeam" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "teamLeadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepartmentTeam_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DepartmentTeam_teamLeadId_key" ON "DepartmentTeam"("teamLeadId");

CREATE INDEX IF NOT EXISTS "DepartmentTeam_departmentId_idx" ON "DepartmentTeam"("departmentId");

CREATE INDEX IF NOT EXISTS "DepartmentTeam_teamLeadId_idx" ON "DepartmentTeam"("teamLeadId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DepartmentTeam_departmentId_fkey') THEN
    ALTER TABLE "DepartmentTeam" ADD CONSTRAINT "DepartmentTeam_departmentId_fkey"
      FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DepartmentTeam_teamLeadId_fkey') THEN
    ALTER TABLE "DepartmentTeam" ADD CONSTRAINT "DepartmentTeam_teamLeadId_fkey"
      FOREIGN KEY ("teamLeadId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 2) Employee.teamId -> DepartmentTeam
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "teamId" TEXT;

CREATE INDEX IF NOT EXISTS "Employee_teamId_idx" ON "Employee"("teamId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Employee_teamId_fkey') THEN
    ALTER TABLE "Employee" ADD CONSTRAINT "Employee_teamId_fkey"
      FOREIGN KEY ("teamId") REFERENCES "DepartmentTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 3) Copy legacy "Team" rows into DepartmentTeam (same id so User.teamId / FKs stay valid)
DO $$
DECLARE
  fallback_dept TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Team') THEN
    RETURN;
  END IF;

  SELECT d."id" INTO fallback_dept FROM "Department" d ORDER BY d."createdAt" ASC NULLS LAST LIMIT 1;
  IF fallback_dept IS NULL THEN
    RAISE EXCEPTION 'DepartmentTeam migration requires at least one row in "Department" to map legacy teams';
  END IF;

  -- Several legacy teams can reference the same User as teamLeadId; DepartmentTeam.teamLeadId is unique.
  -- Assign the lead on one row per employee (earliest team); others get NULL.
  INSERT INTO "DepartmentTeam" ("id", "name", "departmentId", "teamLeadId", "createdAt", "updatedAt")
  SELECT
    src."id",
    src."name",
    src."departmentId",
    CASE
      WHEN src."lead_emp_id" IS NOT NULL AND src."lead_slot" = 1 THEN src."lead_emp_id"
      ELSE NULL
    END AS "teamLeadId",
    src."createdAt",
    src."updatedAt"
  FROM (
    SELECT
      t."id",
      t."name",
      COALESCE(
        dept_from_member."departmentId",
        dept_from_lead."departmentId",
        fallback_dept
      ) AS "departmentId",
      lead_emp."id" AS "lead_emp_id",
      ROW_NUMBER() OVER (
        PARTITION BY CASE WHEN lead_emp."id" IS NULL THEN t."id" ELSE lead_emp."id" END
        ORDER BY t."createdAt" ASC NULLS LAST, t."id" ASC
      ) AS "lead_slot",
      t."createdAt",
      t."updatedAt"
    FROM "Team" t
    LEFT JOIN LATERAL (
      SELECT e."departmentId"
      FROM "Employee" e
      INNER JOIN "User" u ON u."id" = e."userId"
      WHERE u."teamId" = t."id" AND e."departmentId" IS NOT NULL
      LIMIT 1
    ) dept_from_member ON true
    LEFT JOIN LATERAL (
      SELECT e."departmentId"
      FROM "Employee" e
      WHERE t."teamLeadId" IS NOT NULL AND e."userId" = t."teamLeadId" AND e."departmentId" IS NOT NULL
      LIMIT 1
    ) dept_from_lead ON true
    LEFT JOIN LATERAL (
      SELECT e."id"
      FROM "Employee" e
      WHERE t."teamLeadId" IS NOT NULL AND e."userId" = t."teamLeadId"
      LIMIT 1
    ) lead_emp ON true
  ) src
  WHERE NOT EXISTS (SELECT 1 FROM "DepartmentTeam" dt WHERE dt."id" = src."id");
END $$;

-- 4) Move membership from User.teamId to Employee.teamId
UPDATE "Employee" e
SET "teamId" = u."teamId"
FROM "User" u
WHERE e."userId" = u."id"
  AND u."teamId" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "DepartmentTeam" dt WHERE dt."id" = u."teamId");

-- Clear User.teamId when it points at nothing migrated (avoid orphan FK drops)
UPDATE "User" u
SET "teamId" = NULL
WHERE u."teamId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "DepartmentTeam" dt WHERE dt."id" = u."teamId");

-- 5) Drop User.teamId (legacy CRM team membership)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'teamId'
  ) THEN
    ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_teamId_fkey";
    ALTER TABLE "User" DROP COLUMN "teamId";
  END IF;
END $$;

-- 6) Drop legacy Team table
DROP TABLE IF EXISTS "Team";
