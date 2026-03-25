-- Department-scoped P&L expense categories + PnLConfig

-- 1) Add column
ALTER TABLE "PnLCategory" ADD COLUMN IF NOT EXISTS "departmentKey" TEXT;

-- 2) Legacy single expense rows: assign to Surgery department bucket
UPDATE "PnLCategory"
SET "departmentKey" = 'SURGERY'
WHERE "type" = 'EXPENSE'
  AND "sourceKey" IS NOT NULL
  AND "departmentKey" IS NULL;

-- 3) Drop old unique on sourceKey only (name from initial Prisma migration)
DROP INDEX IF EXISTS "PnLCategory_sourceKey_key";

-- 4) Compound unique (PostgreSQL allows multiple NULL pairs)
CREATE UNIQUE INDEX "PnLCategory_sourceKey_departmentKey_key" ON "PnLCategory" ("sourceKey", "departmentKey");

CREATE INDEX IF NOT EXISTS "PnLCategory_departmentKey_idx" ON "PnLCategory" ("departmentKey");

-- 5) PnL key-value config
CREATE TABLE IF NOT EXISTS "PnLConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PnLConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PnLConfig_key_key" ON "PnLConfig"("key");

INSERT INTO "PnLConfig" ("id", "key", "value", "updatedAt")
SELECT md5(random()::text), 'SEAT_COST_PER_EMPLOYEE', 25000, NOW()
WHERE NOT EXISTS (SELECT 1 FROM "PnLConfig" WHERE "key" = 'SEAT_COST_PER_EMPLOYEE');
