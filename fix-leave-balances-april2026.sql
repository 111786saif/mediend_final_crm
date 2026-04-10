-- =============================================================
-- Leave Balance Correction Script
-- Excel data: correct balances as of March 2026
-- This script sets balances to March 2026 values from Excel
-- No April accrual applied
-- =============================================================

BEGIN;

-- Step 1: Get leave type IDs into variables using CTEs

-- ARYAN (Code: 2556) | March: CL=2 SL=1 EL=1 | +April -> CL=3 SL=1.5 EL=1.5
-- ASHWANI (Code: 2405) | March: CL=3 SL=2.5 EL=4.5 | +April -> CL=4 SL=3.0 EL=5.0
-- Abhishek Kashyap (Code: 2434) | March: CL=5 SL=7 EL=7 | +April -> CL=6 SL=7.5 EL=7.5
-- Ahbab (Code: 2521) | March: CL=3 SL=3.5 EL=3.5 | +April -> CL=4 SL=4.0 EL=4.0
-- Amir Saifi (Code: 2038) | March: CL=1 SL=0.5 EL=0.5 | +April -> CL=2 SL=1.0 EL=1.0
-- Amit Prakash Jain (Code: 1000) | March: CL=0 SL=0 EL=0 | +April -> CL=1 SL=0.5 EL=0.5
-- Amit Shukla (Code: 2371) | March: CL=3 SL=4.5 EL=8.5 | +April -> CL=4 SL=5.0 EL=9.0
-- Anishika Singh (Code: 2560) | March: CL=1 SL=0.5 EL=0.5 | +April -> CL=2 SL=1.0 EL=1.0
-- Ankit (Code: 2542) | March: CL=3 SL=1.5 EL=1.5 | +April -> CL=4 SL=2.0 EL=2.0
-- Ankita Nirmal (Code: 2526) | March: CL=0 SL=12 EL=18 | +April -> CL=1 SL=12.5 EL=18.5
-- Arsh Saifi (Code: 2540) | March: CL=3 SL=1.5 EL=1.5 | +April -> CL=4 SL=2.0 EL=2.0
-- Asad Khan (Code: 2545) | March: CL=3 SL=1.5 EL=1.5 | +April -> CL=4 SL=2.0 EL=2.0
-- Asif Noor (Code: 2541) | March: CL=3 SL=1.5 EL=1.5 | +April -> CL=4 SL=2.0 EL=2.0
-- Avnish Thakur (Code: 2436) | March: CL=7 SL=5.5 EL=7.5 | +April -> CL=8 SL=6.0 EL=8.0
-- Ayan Siddhiqui (Code: 2367) | March: CL=1 SL=0.5 EL=0.5 | +April -> CL=2 SL=1.0 EL=1.0
-- C. P. Singh (Code: 1330) | March: CL=1 SL=1.5 EL=2 | +April -> CL=2 SL=2.0 EL=2.5
-- DIVYA (Code: 2558) | March: CL=1 SL=0.5 EL=0.5 | +April -> CL=2 SL=1.0 EL=1.0
-- Gagandeep Singh (Code: 2053) | March: CL=2 SL=1 EL=1 | +April -> CL=3 SL=1.5 EL=1.5
-- HUMA (Code: 2404) | March: CL=5.5 SL=7.5 EL=8 | +April -> CL=6.5 SL=8.0 EL=8.5
-- Hardeep Bhargav (Code: 2047) | March: CL=1 SL=0.5 EL=1 | +April -> CL=2 SL=1.0 EL=1.5
-- Harsh Kumar (Code: 2563) | March: CL=1 SL=0.5 EL=0.5 | +April -> CL=2 SL=1.0 EL=1.0
-- Isha Sharma (Code: 2559) | March: CL=1 SL=0.5 EL=0.5 | +April -> CL=2 SL=1.0 EL=1.0
-- Ishant sharma (Code: 2553) | March: CL=2 SL=1 EL=1 | +April -> CL=3 SL=1.5 EL=1.5
-- Kritika Kumari (Code: 2510) | March: CL=1 SL=1.5 EL=4.5 | +April -> CL=2 SL=2.0 EL=5.0
-- Lalit Singh (Code: 2535) | March: CL=4 SL=2 EL=2 | +April -> CL=5 SL=2.5 EL=2.5
-- MAYANK (Code: 2480) | March: CL=1 SL=1.5 EL=4.5 | +April -> CL=2 SL=2.0 EL=5.0
-- Mani Prakash (Code: 2525) | March: CL=7 SL=3.5 EL=3.5 | +April -> CL=8 SL=4.0 EL=4.0
-- Manohar Kumar Chaudhary (Code: 2311) | March: CL=3 SL=1.5 EL=1.5 | +April -> CL=4 SL=2.0 EL=2.0
-- Mayank Jain (Code: 1836) | March: CL=1 SL=0.5 EL=1 | +April -> CL=2 SL=1.0 EL=1.5
-- Mohit Raghav (Code: 2046) | March: CL=2 SL=1 EL=1 | +April -> CL=3 SL=1.5 EL=1.5
-- Mohit Sharma (Code: 2357) | March: CL=1 SL=1.5 EL=7.5 | +April -> CL=2 SL=2.0 EL=8.0
-- NAMAN KATIYAR (Code: 2548) | March: CL=2 SL=1 EL=1 | +April -> CL=3 SL=1.5 EL=1.5
-- Neha Mandal (Code: 2313) | March: CL=1 SL=0.5 EL=0.5 | +April -> CL=2 SL=1.0 EL=1.0
-- Neha Raj (Code: 2171) | March: CL=1 SL=2.5 EL=2.5 | +April -> CL=2 SL=3.0 EL=3.0
-- Nishkarsh Sharma (Code: 2562) | March: CL=1 SL=0.5 EL=0.5 | +April -> CL=2 SL=1.0 EL=1.0
-- Nitin Tyagi (Code: 2567) | March: CL=1 SL=0.5 EL=0.5 | +April -> CL=2 SL=1.0 EL=1.0
-- PRASHANT SINGH (Code: 2552) | March: CL=2 SL=1 EL=1 | +April -> CL=3 SL=1.5 EL=1.5
-- Pankaj Pal (Code: 2484) | March: CL=3.5 SL=5 EL=5 | +April -> CL=4.5 SL=5.5 EL=5.5
-- Prince (Code: 2522) | March: CL=7 SL=3.5 EL=3.5 | +April -> CL=8 SL=4.0 EL=4.0
-- Rajat Srivastav (Code: 2543) | March: CL=3 SL=1.5 EL=1.5 | +April -> CL=4 SL=2.0 EL=2.0
-- Rashid siddiqui (Code: 2547) | March: CL=2 SL=1 EL=1 | +April -> CL=3 SL=1.5 EL=1.5
-- SWATI (Code: 2544) | March: CL=3 SL=1.5 EL=1.5 | +April -> CL=4 SL=2.0 EL=2.0
-- Sajid Hussain (Code: 1445) | March: CL=1 SL=1.5 EL=7.5 | +April -> CL=2 SL=2.0 EL=8.0
-- Sameer Khan (Code: 2566) | March: CL=1 SL=0.5 EL=0.5 | +April -> CL=2 SL=1.0 EL=1.0
-- Saurabh Chaudhary (Code: 1321) | March: CL=1 SL=1 EL=2 | +April -> CL=2 SL=1.5 EL=2.5
-- Shivam Rohilla (Code: 2349) | March: CL=1 SL=0.5 EL=0.5 | +April -> CL=2 SL=1.0 EL=1.0
-- Shubham Tyagi (Code: 2414) | March: CL=2 SL=2 EL=4.5 | +April -> CL=3 SL=2.5 EL=5.0
-- Sumit Pal (Code: 2530) | March: CL=5 SL=2.5 EL=2.5 | +April -> CL=6 SL=3.0 EL=3.0
-- Vaishali Tomar (Code: 2362) | March: CL=2 SL=1 EL=1.5 | +April -> CL=3 SL=1.5 EL=2.0
-- Vinay Gupta (Code: 2561) | March: CL=1 SL=0.5 EL=0.5 | +April -> CL=2 SL=1.0 EL=1.0
-- Vishal Sharma (Code: 2503) | March: CL=1 SL=0.5 EL=5 | +April -> CL=2 SL=1.0 EL=5.5
-- Vishal Tiwari (Code: 2550) | March: CL=2 SL=1 EL=1 | +April -> CL=3 SL=1.5 EL=1.5
-- Vishal upadhyay (Code: 2536) | March: CL=4 SL=2 EL=2 | +April -> CL=5 SL=2.5 EL=2.5
-- Wasim Raza (Code: 1403) | March: CL=2 SL=0.5 EL=5.5 | +April -> CL=3 SL=1.0 EL=6.0
-- Yash Agarwal (Code: 2565) | March: CL=2 SL=1 EL=1 | +April -> CL=3 SL=1.5 EL=1.5

-- Step 2: Upsert all leave balances

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  2,
  COALESCE(existing."used", 0),
  2 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2556' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1,
  COALESCE(existing."used", 0),
  1 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2556' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1,
  COALESCE(existing."used", 0),
  1 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2556' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  3,
  COALESCE(existing."used", 0),
  3 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2405' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  2.5,
  COALESCE(existing."used", 0),
  2.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2405' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  4.5,
  COALESCE(existing."used", 0),
  4.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2405' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  5,
  COALESCE(existing."used", 0),
  5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2434' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  7,
  COALESCE(existing."used", 0),
  7 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2434' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  7,
  COALESCE(existing."used", 0),
  7 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2434' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  3,
  COALESCE(existing."used", 0),
  3 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2521' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  3.5,
  COALESCE(existing."used", 0),
  3.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2521' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  3.5,
  COALESCE(existing."used", 0),
  3.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2521' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1,
  COALESCE(existing."used", 0),
  1 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2038' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  0.5,
  COALESCE(existing."used", 0),
  0.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2038' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  0.5,
  COALESCE(existing."used", 0),
  0.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2038' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  0,
  COALESCE(existing."used", 0),
  0 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '1000' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  0,
  COALESCE(existing."used", 0),
  0 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '1000' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  0,
  COALESCE(existing."used", 0),
  0 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '1000' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  3,
  COALESCE(existing."used", 0),
  3 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2371' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  4.5,
  COALESCE(existing."used", 0),
  4.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2371' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  8.5,
  COALESCE(existing."used", 0),
  8.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2371' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1,
  COALESCE(existing."used", 0),
  1 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2560' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  0.5,
  COALESCE(existing."used", 0),
  0.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2560' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  0.5,
  COALESCE(existing."used", 0),
  0.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2560' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  3,
  COALESCE(existing."used", 0),
  3 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2542' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1.5,
  COALESCE(existing."used", 0),
  1.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2542' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1.5,
  COALESCE(existing."used", 0),
  1.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2542' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  0,
  COALESCE(existing."used", 0),
  0 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2526' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  12,
  COALESCE(existing."used", 0),
  12 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2526' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  18,
  COALESCE(existing."used", 0),
  18 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2526' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  3,
  COALESCE(existing."used", 0),
  3 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2540' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1.5,
  COALESCE(existing."used", 0),
  1.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2540' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1.5,
  COALESCE(existing."used", 0),
  1.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2540' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  3,
  COALESCE(existing."used", 0),
  3 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2545' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1.5,
  COALESCE(existing."used", 0),
  1.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2545' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1.5,
  COALESCE(existing."used", 0),
  1.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2545' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  3,
  COALESCE(existing."used", 0),
  3 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2541' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1.5,
  COALESCE(existing."used", 0),
  1.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2541' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1.5,
  COALESCE(existing."used", 0),
  1.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2541' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  7,
  COALESCE(existing."used", 0),
  7 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2436' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  5.5,
  COALESCE(existing."used", 0),
  5.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2436' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  7.5,
  COALESCE(existing."used", 0),
  7.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2436' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1,
  COALESCE(existing."used", 0),
  1 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2367' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  0.5,
  COALESCE(existing."used", 0),
  0.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2367' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  0.5,
  COALESCE(existing."used", 0),
  0.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2367' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1,
  COALESCE(existing."used", 0),
  1 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '1330' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1.5,
  COALESCE(existing."used", 0),
  1.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '1330' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  2,
  COALESCE(existing."used", 0),
  2 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '1330' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1,
  COALESCE(existing."used", 0),
  1 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2558' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  0.5,
  COALESCE(existing."used", 0),
  0.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2558' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  0.5,
  COALESCE(existing."used", 0),
  0.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2558' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  2,
  COALESCE(existing."used", 0),
  2 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2053' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1,
  COALESCE(existing."used", 0),
  1 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2053' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1,
  COALESCE(existing."used", 0),
  1 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2053' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  5.5,
  COALESCE(existing."used", 0),
  5.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2404' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  7.5,
  COALESCE(existing."used", 0),
  7.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2404' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  8,
  COALESCE(existing."used", 0),
  8 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2404' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1,
  COALESCE(existing."used", 0),
  1 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2047' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  0.5,
  COALESCE(existing."used", 0),
  0.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2047' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1,
  COALESCE(existing."used", 0),
  1 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2047' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1,
  COALESCE(existing."used", 0),
  1 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2563' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  0.5,
  COALESCE(existing."used", 0),
  0.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2563' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  0.5,
  COALESCE(existing."used", 0),
  0.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2563' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1,
  COALESCE(existing."used", 0),
  1 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2559' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  0.5,
  COALESCE(existing."used", 0),
  0.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2559' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  0.5,
  COALESCE(existing."used", 0),
  0.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2559' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  2,
  COALESCE(existing."used", 0),
  2 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2553' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1,
  COALESCE(existing."used", 0),
  1 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2553' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1,
  COALESCE(existing."used", 0),
  1 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2553' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1,
  COALESCE(existing."used", 0),
  1 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2510' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1.5,
  COALESCE(existing."used", 0),
  1.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2510' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  4.5,
  COALESCE(existing."used", 0),
  4.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2510' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  4,
  COALESCE(existing."used", 0),
  4 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2535' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  2,
  COALESCE(existing."used", 0),
  2 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2535' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  2,
  COALESCE(existing."used", 0),
  2 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2535' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1,
  COALESCE(existing."used", 0),
  1 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2480' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1.5,
  COALESCE(existing."used", 0),
  1.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2480' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  4.5,
  COALESCE(existing."used", 0),
  4.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2480' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  7,
  COALESCE(existing."used", 0),
  7 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2525' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  3.5,
  COALESCE(existing."used", 0),
  3.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2525' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  3.5,
  COALESCE(existing."used", 0),
  3.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2525' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  3,
  COALESCE(existing."used", 0),
  3 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2311' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1.5,
  COALESCE(existing."used", 0),
  1.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2311' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1.5,
  COALESCE(existing."used", 0),
  1.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2311' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1,
  COALESCE(existing."used", 0),
  1 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '1836' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  0.5,
  COALESCE(existing."used", 0),
  0.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '1836' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1,
  COALESCE(existing."used", 0),
  1 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '1836' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  2,
  COALESCE(existing."used", 0),
  2 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2046' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1,
  COALESCE(existing."used", 0),
  1 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2046' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1,
  COALESCE(existing."used", 0),
  1 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2046' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1,
  COALESCE(existing."used", 0),
  1 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2357' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1.5,
  COALESCE(existing."used", 0),
  1.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2357' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  7.5,
  COALESCE(existing."used", 0),
  7.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2357' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  2,
  COALESCE(existing."used", 0),
  2 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2548' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1,
  COALESCE(existing."used", 0),
  1 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2548' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1,
  COALESCE(existing."used", 0),
  1 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2548' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1,
  COALESCE(existing."used", 0),
  1 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2313' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  0.5,
  COALESCE(existing."used", 0),
  0.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2313' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  0.5,
  COALESCE(existing."used", 0),
  0.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2313' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1,
  COALESCE(existing."used", 0),
  1 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2171' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  2.5,
  COALESCE(existing."used", 0),
  2.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2171' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  2.5,
  COALESCE(existing."used", 0),
  2.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2171' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1,
  COALESCE(existing."used", 0),
  1 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2562' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  0.5,
  COALESCE(existing."used", 0),
  0.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2562' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  0.5,
  COALESCE(existing."used", 0),
  0.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2562' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1,
  COALESCE(existing."used", 0),
  1 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2567' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  0.5,
  COALESCE(existing."used", 0),
  0.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2567' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  0.5,
  COALESCE(existing."used", 0),
  0.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2567' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  2,
  COALESCE(existing."used", 0),
  2 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2552' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1,
  COALESCE(existing."used", 0),
  1 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2552' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1,
  COALESCE(existing."used", 0),
  1 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2552' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  3.5,
  COALESCE(existing."used", 0),
  3.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2484' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  5,
  COALESCE(existing."used", 0),
  5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2484' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  5,
  COALESCE(existing."used", 0),
  5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2484' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  7,
  COALESCE(existing."used", 0),
  7 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2522' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  3.5,
  COALESCE(existing."used", 0),
  3.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2522' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  3.5,
  COALESCE(existing."used", 0),
  3.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2522' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  3,
  COALESCE(existing."used", 0),
  3 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2543' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1.5,
  COALESCE(existing."used", 0),
  1.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2543' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1.5,
  COALESCE(existing."used", 0),
  1.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2543' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  2,
  COALESCE(existing."used", 0),
  2 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2547' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1,
  COALESCE(existing."used", 0),
  1 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2547' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1,
  COALESCE(existing."used", 0),
  1 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2547' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  3,
  COALESCE(existing."used", 0),
  3 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2544' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1.5,
  COALESCE(existing."used", 0),
  1.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2544' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1.5,
  COALESCE(existing."used", 0),
  1.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2544' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1,
  COALESCE(existing."used", 0),
  1 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '1445' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1.5,
  COALESCE(existing."used", 0),
  1.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '1445' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  7.5,
  COALESCE(existing."used", 0),
  7.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '1445' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1,
  COALESCE(existing."used", 0),
  1 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2566' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  0.5,
  COALESCE(existing."used", 0),
  0.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2566' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  0.5,
  COALESCE(existing."used", 0),
  0.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2566' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1,
  COALESCE(existing."used", 0),
  1 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '1321' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1,
  COALESCE(existing."used", 0),
  1 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '1321' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  2,
  COALESCE(existing."used", 0),
  2 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '1321' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1,
  COALESCE(existing."used", 0),
  1 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2349' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  0.5,
  COALESCE(existing."used", 0),
  0.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2349' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  0.5,
  COALESCE(existing."used", 0),
  0.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2349' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  2,
  COALESCE(existing."used", 0),
  2 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2414' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  2,
  COALESCE(existing."used", 0),
  2 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2414' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  4.5,
  COALESCE(existing."used", 0),
  4.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2414' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  5,
  COALESCE(existing."used", 0),
  5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2530' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  2.5,
  COALESCE(existing."used", 0),
  2.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2530' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  2.5,
  COALESCE(existing."used", 0),
  2.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2530' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  2,
  COALESCE(existing."used", 0),
  2 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2362' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1,
  COALESCE(existing."used", 0),
  1 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2362' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1.5,
  COALESCE(existing."used", 0),
  1.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2362' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1,
  COALESCE(existing."used", 0),
  1 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2561' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  0.5,
  COALESCE(existing."used", 0),
  0.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2561' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  0.5,
  COALESCE(existing."used", 0),
  0.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2561' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1,
  COALESCE(existing."used", 0),
  1 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2503' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  0.5,
  COALESCE(existing."used", 0),
  0.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2503' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  5,
  COALESCE(existing."used", 0),
  5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2503' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  2,
  COALESCE(existing."used", 0),
  2 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2550' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1,
  COALESCE(existing."used", 0),
  1 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2550' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1,
  COALESCE(existing."used", 0),
  1 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2550' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  4,
  COALESCE(existing."used", 0),
  4 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2536' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  2,
  COALESCE(existing."used", 0),
  2 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2536' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  2,
  COALESCE(existing."used", 0),
  2 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2536' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  2,
  COALESCE(existing."used", 0),
  2 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '1403' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  0.5,
  COALESCE(existing."used", 0),
  0.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '1403' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  5.5,
  COALESCE(existing."used", 0),
  5.5 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '1403' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  2,
  COALESCE(existing."used", 0),
  2 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2565' AND lt."code" = 'CL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1,
  COALESCE(existing."used", 0),
  1 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2565' AND lt."code" = 'SL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();

INSERT INTO "LeaveBalance" ("id", "employeeId", "leaveTypeId", "allocated", "used", "remaining", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  lt."id",
  1,
  COALESCE(existing."used", 0),
  1 - COALESCE(existing."used", 0),
  NOW(),
  NOW()
FROM "Employee" e
CROSS JOIN "LeaveTypeMaster" lt
LEFT JOIN "LeaveBalance" existing ON existing."employeeId" = e."id" AND existing."leaveTypeId" = lt."id"
WHERE e."employeeCode" = '2565' AND lt."code" = 'EL'
ON CONFLICT ("employeeId", "leaveTypeId")
DO UPDATE SET
  "allocated" = EXCLUDED."allocated",
  "remaining" = EXCLUDED."allocated" - "LeaveBalance"."used",
  "updatedAt" = NOW();


-- Step 3: Verify the update
SELECT 
  e."employeeCode",
  u."name",
  lt."code" AS leave_type,
  lb."allocated",
  lb."used",
  lb."remaining"
FROM "LeaveBalance" lb
JOIN "Employee" e ON e."id" = lb."employeeId"
JOIN "User" u ON u."id" = e."userId"
JOIN "LeaveTypeMaster" lt ON lt."id" = lb."leaveTypeId"
ORDER BY e."employeeCode", lt."code";

-- If everything looks correct, run COMMIT;
-- If something is wrong, run ROLLBACK;

COMMIT;