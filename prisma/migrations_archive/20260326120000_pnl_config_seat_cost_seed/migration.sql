-- Idempotent: ensure default seat cost per employee (₹/month) exists in PnLConfig.
-- Safe if 20260325210000_pnl_department_expenses already inserted the row.
INSERT INTO "PnLConfig" ("id", "key", "value", "updatedAt")
SELECT md5(random()::text || clock_timestamp()::text), 'SEAT_COST_PER_EMPLOYEE', 25000, NOW()
WHERE NOT EXISTS (SELECT 1 FROM "PnLConfig" WHERE "key" = 'SEAT_COST_PER_EMPLOYEE');
