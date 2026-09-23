-- Apply with web/worker/import writers stopped. Entire conversion is atomic.
BEGIN;
SET LOCAL lock_timeout = '30s';
LOCK TABLE "Lead", "IncomingLead" IN ACCESS EXCLUSIVE MODE;

-- Keep an auditable, permanent mapping; legacyId also keeps old links recoverable.
CREATE TABLE "LeadIdMigrationMap" (
  "tableName" text NOT NULL,
  "oldId" text NOT NULL,
  "newId" integer NOT NULL,
  PRIMARY KEY ("tableName", "oldId"),
  UNIQUE ("tableName", "newId")
);
INSERT INTO "LeadIdMigrationMap"
SELECT 'Lead', id, row_number() OVER (ORDER BY "createdDate" ASC, id ASC)::integer FROM "Lead";
INSERT INTO "LeadIdMigrationMap"
SELECT 'IncomingLead', id, row_number() OVER (ORDER BY "receivedAt" ASC, id ASC)::integer FROM "IncomingLead";

DO $$ BEGIN
  IF EXISTS (SELECT "oldId" FROM "LeadIdMigrationMap" GROUP BY "oldId" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Overlapping legacy IDs require an explicit polymorphic-reference mapping; migration rolled back';
  END IF;
END $$;

-- Discover actual FK dependencies, including constraints added outside Prisma.
CREATE TEMP TABLE lead_id_foreign_keys ON COMMIT DROP AS
SELECT c.conrelid::regclass AS child_table, c.conname, pg_get_constraintdef(c.oid) AS definition,
       c.confrelid::regclass::text AS parent_table, a.attname AS child_column
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
WHERE c.contype = 'f' AND c.confrelid IN ('"Lead"'::regclass, '"IncomingLead"'::regclass)
  AND c.confkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = c.confrelid AND attname = 'id')]::smallint[];

CREATE TEMP TABLE lead_id_columns ON COMMIT DROP AS
SELECT child_table, child_column, replace(parent_table, '"', '') AS parent_table FROM lead_id_foreign_keys
UNION
SELECT format('%I.%I', table_schema, table_name)::regclass, column_name, 'Lead'
FROM information_schema.columns
WHERE table_schema = current_schema() AND column_name IN ('leadId', 'processedLeadId') AND data_type IN ('text', 'character varying');

CREATE OR REPLACE FUNCTION pg_temp.new_lead_id(old_id text, parent_table text) RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE result integer;
BEGIN
  IF old_id IS NULL THEN RETURN NULL; END IF;
  SELECT "newId" INTO result FROM "LeadIdMigrationMap" WHERE "tableName" = parent_table AND "oldId" = old_id;
  IF result IS NULL THEN RAISE EXCEPTION 'Orphan reference: %.id = %; migration rolled back', parent_table, old_id; END IF;
  RETURN result;
END $$;

DO $$
DECLARE item record;
BEGIN
  FOR item IN SELECT * FROM lead_id_columns LOOP
    EXECUTE format('LOCK TABLE %s IN ACCESS EXCLUSIVE MODE', item.child_table);
    -- Validate every relationship before altering any column.
    EXECUTE format('SELECT pg_temp.new_lead_id(%I::text, %L) FROM %s', item.child_column, item.parent_table, item.child_table);
  END LOOP;
  FOR item IN SELECT * FROM lead_id_foreign_keys LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', item.child_table, item.conname);
  END LOOP;
  FOR item IN SELECT * FROM lead_id_columns LOOP
    EXECUTE format('ALTER TABLE %s ALTER COLUMN %I TYPE integer USING pg_temp.new_lead_id(%I::text, %L)',
      item.child_table, item.child_column, item.child_column, item.parent_table);
  END LOOP;
END $$;

ALTER TABLE "Lead" RENAME COLUMN id TO "legacyId";
ALTER TABLE "Lead" DROP CONSTRAINT "Lead_pkey";
ALTER TABLE "Lead" ALTER COLUMN "legacyId" DROP NOT NULL;
ALTER TABLE "Lead" ALTER COLUMN "legacyId" DROP DEFAULT;
ALTER TABLE "Lead" ADD COLUMN id integer;
UPDATE "Lead" SET id = pg_temp.new_lead_id("legacyId", 'Lead');
ALTER TABLE "Lead" ALTER COLUMN id SET NOT NULL;
ALTER TABLE "Lead" ADD PRIMARY KEY (id);
CREATE UNIQUE INDEX "Lead_legacyId_key" ON "Lead" ("legacyId");
CREATE SEQUENCE "Lead_id_seq" OWNED BY "Lead".id;
SELECT setval('"Lead_id_seq"', COALESCE((SELECT max(id) FROM "Lead"), 0) + 1, false);
ALTER TABLE "Lead" ALTER COLUMN id SET DEFAULT nextval('"Lead_id_seq"');

ALTER TABLE "IncomingLead" RENAME COLUMN id TO "legacyId";
ALTER TABLE "IncomingLead" DROP CONSTRAINT "IncomingLead_pkey";
ALTER TABLE "IncomingLead" ALTER COLUMN "legacyId" DROP NOT NULL;
ALTER TABLE "IncomingLead" ALTER COLUMN "legacyId" DROP DEFAULT;
ALTER TABLE "IncomingLead" ADD COLUMN id integer;
UPDATE "IncomingLead" SET id = pg_temp.new_lead_id("legacyId", 'IncomingLead');
ALTER TABLE "IncomingLead" ALTER COLUMN id SET NOT NULL;
ALTER TABLE "IncomingLead" ADD PRIMARY KEY (id);
CREATE UNIQUE INDEX "IncomingLead_legacyId_key" ON "IncomingLead" ("legacyId");
CREATE SEQUENCE "IncomingLead_id_seq" OWNED BY "IncomingLead".id;
SELECT setval('"IncomingLead_id_seq"', COALESCE((SELECT max(id) FROM "IncomingLead"), 0) + 1, false);
ALTER TABLE "IncomingLead" ALTER COLUMN id SET DEFAULT nextval('"IncomingLead_id_seq"');

DO $$
DECLARE item record;
BEGIN
  FOR item IN SELECT * FROM lead_id_foreign_keys LOOP
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', item.child_table, item.conname, item.definition);
  END LOOP;
END $$;

-- Polymorphic references must stay text because they also refer to non-lead entities.
UPDATE "CrmActivityLog" a SET "entityId" = m."newId"::text
FROM "LeadIdMigrationMap" m WHERE a."entityId" = m."oldId";
UPDATE "Notification" n SET "relatedId" = m."newId"::text
FROM "LeadIdMigrationMap" m WHERE n."relatedId" = m."oldId";

-- Update complete path segments in saved links; preserve query strings and anchors.
CREATE OR REPLACE FUNCTION pg_temp.remap_lead_link(value text) RETURNS text LANGUAGE sql AS $$
  SELECT string_agg(COALESCE(m."newId"::text || substr(segment, length(m."oldId") + 1), segment), '/' ORDER BY ord)
  FROM unnest(string_to_array(value, '/')) WITH ORDINALITY parts(segment, ord)
  LEFT JOIN "LeadIdMigrationMap" m ON m."oldId" = split_part(split_part(segment, '?', 1), '#', 1)
$$;
UPDATE "Notification" SET link = pg_temp.remap_lead_link(link) WHERE link IS NOT NULL;
UPDATE "CrmActivityLog" SET route = pg_temp.remap_lead_link(route) WHERE route IS NOT NULL;

-- Rewrite exact ID values recursively in persisted jobs, audit metadata and payloads.
-- Never replace substrings in user text or external system numeric identifiers.
CREATE OR REPLACE FUNCTION pg_temp.remap_lead_json(value jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE result jsonb; mapped integer;
BEGIN
  CASE jsonb_typeof(value)
    WHEN 'object' THEN
      SELECT COALESCE(jsonb_object_agg(key, pg_temp.remap_lead_json(v)), '{}'::jsonb) INTO result FROM jsonb_each(value) e(key, v);
    WHEN 'array' THEN
      SELECT COALESCE(jsonb_agg(pg_temp.remap_lead_json(v) ORDER BY ord), '[]'::jsonb) INTO result FROM jsonb_array_elements(value) WITH ORDINALITY e(v, ord);
    WHEN 'string' THEN
      SELECT "newId" INTO mapped FROM "LeadIdMigrationMap" WHERE "oldId" = value #>> '{}' LIMIT 1;
      result := CASE WHEN mapped IS NOT NULL THEN to_jsonb(mapped)
        WHEN (value #>> '{}') ~ '^(/|https?://)' THEN to_jsonb(pg_temp.remap_lead_link(value #>> '{}'))
        ELSE value END;
    ELSE result := value;
  END CASE;
  RETURN result;
END $$;
DO $$
DECLARE item record;
BEGIN
  FOR item IN SELECT table_schema, table_name, column_name FROM information_schema.columns
    WHERE table_schema = current_schema() AND data_type = 'jsonb'
  LOOP
    EXECUTE format('UPDATE %I.%I SET %I = pg_temp.remap_lead_json(%I) WHERE %I IS NOT NULL AND %I IS DISTINCT FROM pg_temp.remap_lead_json(%I)',
      item.table_schema, item.table_name, item.column_name, item.column_name, item.column_name, item.column_name, item.column_name);
  END LOOP;
END $$;

CREATE INDEX "IncomingLead_receivedAt_id_idx" ON "IncomingLead" ("receivedAt", id);
COMMIT;
