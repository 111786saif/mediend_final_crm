-- Attendance seed for employee code 2046 (Vaishali) — March 2026
-- All times stored as UTC (IST − 5h30m)
-- Previous wrong seed stored IST times directly as UTC (so 10:15 IST → 10:15 UTC → displayed as 15:45 IST)

-- Step 1: Remove the wrong records for these 6 dates
DELETE FROM "AttendanceLog"
WHERE "employeeId" = (SELECT id FROM "Employee" WHERE "employeeCode" = '2046')
  AND "logDate" BETWEEN '2026-03-12 00:00:00+00' AND '2026-03-23 23:59:59+00';

-- Step 2: Insert correct records (IST → UTC by subtracting 5h30m)
INSERT INTO "AttendanceLog" (id, "employeeId", "logDate", "punchDirection", temperature, "createdAt")
SELECT
  gen_random_uuid()::text,
  e.id,
  v.ts,
  v.dir::"PunchDirection",
  0,
  NOW()
FROM "Employee" e
CROSS JOIN (VALUES
  -- 12/03/2026 : In 10:15 IST → 04:45 UTC | Out 19:42 IST → 14:12 UTC
  ('2026-03-12 04:45:00+00'::timestamptz, 'IN'),
  ('2026-03-12 14:12:00+00'::timestamptz, 'OUT'),

  -- 13/03/2026 : In 10:45 IST → 05:15 UTC | Out 20:28 IST → 14:58 UTC
  ('2026-03-13 05:15:00+00'::timestamptz, 'IN'),
  ('2026-03-13 14:58:00+00'::timestamptz, 'OUT'),

  -- 16/03/2026 : In 10:15 IST → 04:45 UTC | Out 19:22 IST → 13:52 UTC
  ('2026-03-16 04:45:00+00'::timestamptz, 'IN'),
  ('2026-03-16 13:52:00+00'::timestamptz, 'OUT'),

  -- 18/03/2026 : In 10:15 IST → 04:45 UTC (group punch — individual not marked) | Out 19:15 IST → 13:45 UTC
  ('2026-03-18 04:45:00+00'::timestamptz, 'IN'),
  ('2026-03-18 13:45:00+00'::timestamptz, 'OUT'),

  -- 21/03/2026 : In 10:15 IST → 04:45 UTC | Out 20:32 IST → 15:02 UTC
  ('2026-03-21 04:45:00+00'::timestamptz, 'IN'),
  ('2026-03-21 15:02:00+00'::timestamptz, 'OUT'),

  -- 23/03/2026 : In 11:00 IST → 05:30 UTC | Out 19:57 IST → 14:27 UTC
  ('2026-03-23 05:30:00+00'::timestamptz, 'IN'),
  ('2026-03-23 14:27:00+00'::timestamptz, 'OUT')
) AS v(ts, dir)
WHERE e."employeeCode" = '2046'
ON CONFLICT ("employeeId", "logDate", "punchDirection") DO NOTHING;
