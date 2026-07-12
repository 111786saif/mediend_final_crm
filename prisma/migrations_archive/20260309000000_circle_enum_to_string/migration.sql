-- AlterTable: Change circle from Circle enum to TEXT on Lead and Team.
-- Circle values now come from MySQL (e.g. "PUNE", "Mumbai") and are stored as plain strings.
-- NO DATA LOSS: USING "circle"::text preserves every existing value (North/South/East/West/Central → same as strings).

ALTER TABLE "Lead" ALTER COLUMN "circle" TYPE TEXT USING "circle"::text;
ALTER TABLE "Team" ALTER COLUMN "circle" TYPE TEXT USING "circle"::text;

-- DropEnum: Remove the Circle enum type (columns already converted, so no data loss).
DROP TYPE "Circle";
