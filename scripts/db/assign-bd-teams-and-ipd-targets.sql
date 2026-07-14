-- Assign BDs under TLs + set July 2026 monthly IPD target = 21 for all BDs.
--
-- Usage:
--   docker compose exec -T postgres psql -U postgres -d mediend_crm -v ON_ERROR_STOP=1 \
--     < scripts/db/assign-bd-teams-and-ipd-targets.sql
--
-- Edit the BD employeeCode lists under each TL block before running.
-- Period: July 2026 (change dates below if needed).

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 0) Ensure each TL has a DepartmentTeam row (creates if missing)
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO "DepartmentTeam" ("id", "name", "departmentId", "teamLeadId", "createdAt", "updatedAt")
SELECT
  md5(random()::text || clock_timestamp()::text),
  COALESCE(u.name, u.email) || '''s Team',
  COALESCE(
    e."departmentId",
    (SELECT d.id FROM "Department" d WHERE upper(d.name) = 'SURGERY SALES' LIMIT 1),
    (SELECT d.id FROM "Department" d ORDER BY d."createdAt" LIMIT 1)
  ),
  e.id,
  NOW(),
  NOW()
FROM "User" u
JOIN "Employee" e ON e."userId" = u.id
WHERE u.role = 'TEAM_LEAD'
  AND NOT EXISTS (
    SELECT 1 FROM "DepartmentTeam" dt WHERE dt."teamLeadId" = e.id
  )
  AND COALESCE(
    e."departmentId",
    (SELECT d.id FROM "Department" d WHERE upper(d.name) = 'SURGERY SALES' LIMIT 1),
    (SELECT d.id FROM "Department" d ORDER BY d."createdAt" LIMIT 1)
  ) IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1) Sync teamId for BDs who already report to a TEAM_LEAD
-- ═══════════════════════════════════════════════════════════════════════════
UPDATE "Employee" bd
SET
  "teamId" = dt.id,
  "updatedAt" = NOW()
FROM "DepartmentTeam" dt
JOIN "Employee" tl ON tl.id = dt."teamLeadId"
JOIN "User" tl_u ON tl_u.id = tl."userId"
WHERE bd."managerId" = tl.id
  AND bd."teamId" IS DISTINCT FROM dt.id
  AND tl_u.role = 'TEAM_LEAD'
  AND EXISTS (
    SELECT 1 FROM "User" bd_u
    WHERE bd_u.id = bd."userId" AND bd_u.role = 'BD'
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 2) Force managerId + teamId for specific TL → BD lists
--    (edit emp codes / emails as needed)
-- ═══════════════════════════════════════════════════════════════════════════

-- Sanjeev Pandey
WITH tl AS (
  SELECT e.id AS tl_emp_id, dt.id AS team_id
  FROM "User" u
  JOIN "Employee" e ON e."userId" = u.id
  JOIN "DepartmentTeam" dt ON dt."teamLeadId" = e.id
  WHERE lower(u.email) = lower('sanjeev.pandey@mediend.com')
)
UPDATE "Employee" bd
SET
  "managerId" = tl.tl_emp_id,
  "teamId" = tl.team_id,
  "updatedAt" = NOW()
FROM tl
WHERE bd."employeeCode" IN ('9776', '9775', '9075');

-- Harsh Kumar
WITH tl AS (
  SELECT e.id AS tl_emp_id, dt.id AS team_id
  FROM "User" u
  JOIN "Employee" e ON e."userId" = u.id
  JOIN "DepartmentTeam" dt ON dt."teamLeadId" = e.id
  WHERE lower(u.email) = lower('harsh.kumar@mediend.com')
)
UPDATE "Employee" bd
SET
  "managerId" = tl.tl_emp_id,
  "teamId" = tl.team_id,
  "updatedAt" = NOW()
FROM tl
WHERE bd."employeeCode" IN ('641', '611');

-- Template for more TLs (uncomment + fill):
-- WITH tl AS (
--   SELECT e.id AS tl_emp_id, dt.id AS team_id
--   FROM "User" u
--   JOIN "Employee" e ON e."userId" = u.id
--   JOIN "DepartmentTeam" dt ON dt."teamLeadId" = e.id
--   WHERE lower(u.email) = lower('amir.saifi@mediend.com')
-- )
-- UPDATE "Employee" bd
-- SET "managerId" = tl.tl_emp_id, "teamId" = tl.team_id, "updatedAt" = NOW()
-- FROM tl
-- WHERE bd."employeeCode" IN ('XXXX', 'YYYY');

-- ═══════════════════════════════════════════════════════════════════════════
-- 3) Monthly IPD_DONE target = 21 for ALL BDs (July 2026)
--    targetForId = User.id for BD targets
--    Idempotent: skips if same BD + month + IPD_DONE already exists
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO "Target" (
  "id",
  "targetType",
  "targetForId",
  "periodType",
  "periodStartDate",
  "periodEndDate",
  "metric",
  "targetValue",
  "createdById",
  "createdAt",
  "updatedAt"
)
SELECT
  md5(random()::text || clock_timestamp()::text || u.id),
  'BD',
  u.id,
  'MONTH',
  TIMESTAMPTZ '2026-07-01 00:00:00+00',
  TIMESTAMPTZ '2026-07-31 23:59:59+00',
  'IPD_DONE',
  21,
  COALESCE(
    (SELECT id FROM "User" WHERE role = 'MD' ORDER BY "createdAt" LIMIT 1),
    (SELECT id FROM "User" WHERE role = 'SALES_HEAD' ORDER BY "createdAt" LIMIT 1),
    (SELECT id FROM "User" WHERE role = 'ADMIN' ORDER BY "createdAt" LIMIT 1)
  ),
  NOW(),
  NOW()
FROM "User" u
WHERE u.role = 'BD'
  AND NOT EXISTS (
    SELECT 1
    FROM "Target" t
    WHERE t."targetType" = 'BD'
      AND t."targetForId" = u.id
      AND t."periodType" = 'MONTH'
      AND t.metric = 'IPD_DONE'
      AND t."periodStartDate" = TIMESTAMPTZ '2026-07-01 00:00:00+00'
  )
  AND EXISTS (
    SELECT 1 FROM "User" creator
    WHERE creator.role IN ('MD', 'SALES_HEAD', 'ADMIN')
  );

COMMIT;

-- ── Verification ────────────────────────────────────────────────────────────
SELECT
  tl_u.email AS tl_email,
  tl_u.name AS tl_name,
  COUNT(bd.id) AS bd_count,
  string_agg(bd."employeeCode", ', ' ORDER BY bd."employeeCode") AS bd_codes
FROM "DepartmentTeam" dt
JOIN "Employee" tl ON tl.id = dt."teamLeadId"
JOIN "User" tl_u ON tl_u.id = tl."userId"
LEFT JOIN "Employee" bd ON bd."teamId" = dt.id AND bd."managerId" = tl.id
LEFT JOIN "User" bd_u ON bd_u.id = bd."userId" AND bd_u.role = 'BD'
WHERE tl_u.role = 'TEAM_LEAD'
GROUP BY tl_u.email, tl_u.name
ORDER BY tl_u.email;

SELECT
  u.email,
  u.name,
  t."targetValue",
  t.metric,
  t."periodStartDate"::date AS period_start,
  t."periodEndDate"::date AS period_end
FROM "Target" t
JOIN "User" u ON u.id = t."targetForId"
WHERE t."targetType" = 'BD'
  AND t.metric = 'IPD_DONE'
  AND t."periodStartDate" = TIMESTAMPTZ '2026-07-01 00:00:00+00'
ORDER BY u.email;
