CREATE TABLE "status_category" (
  "id" SERIAL NOT NULL,
  "category" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "status_category_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "status_category_category_key" ON "status_category"("category");

CREATE TABLE "status_group" (
  "id" SERIAL NOT NULL,
  "categoryId" INTEGER NOT NULL,
  "group" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "status_group_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "status_group_categoryId_group_key" ON "status_group"("categoryId", "group");
CREATE INDEX "status_group_categoryId_idx" ON "status_group"("categoryId");
ALTER TABLE "status_group" ADD CONSTRAINT "status_group_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "status_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "status" (
  "id" SERIAL NOT NULL,
  "categoryId" INTEGER NOT NULL,
  "groupId" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "status_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "status_code_key" ON "status"("code");
CREATE UNIQUE INDEX "status_groupId_status_key" ON "status"("groupId", "status");
CREATE INDEX "status_categoryId_groupId_idx" ON "status"("categoryId", "groupId");
ALTER TABLE "status" ADD CONSTRAINT "status_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "status_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "status" ADD CONSTRAINT "status_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "status_group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "status_category" ("category", "sortOrder", "updatedAt") VALUES
  ('Relevant Leads', 1, CURRENT_TIMESTAMP),
  ('Appointments', 2, CURRENT_TIMESTAMP),
  ('Irrelevant', 3, CURRENT_TIMESTAMP),
  ('Churning Data', 4, CURRENT_TIMESTAMP);

INSERT INTO "status_group" ("categoryId", "group", "sortOrder", "updatedAt")
SELECT c.id, v."group", v."sortOrder", CURRENT_TIMESTAMP
FROM (VALUES
  ('Relevant Leads', 'New Leads', 1), ('Relevant Leads', 'Follow-up', 2), ('Relevant Leads', 'Callback', 3), ('Relevant Leads', 'Closed', 4), ('Relevant Leads', 'Fund Issues', 5),
  ('Appointments', 'IPD Done', 1), ('Appointments', 'OPD Done', 2), ('Appointments', 'IPD Schedule', 3), ('Appointments', 'OPD Schedule', 4),
  ('Irrelevant', 'Junk', 1), ('Irrelevant', 'Out of Station', 2), ('Irrelevant', 'Out of Station follow-up', 3), ('Irrelevant', 'Duplicate lead', 4), ('Irrelevant', 'IPD Lost', 5), ('Irrelevant', 'DNP Exhausted', 6),
  ('Churning Data', 'Nurture', 1), ('Churning Data', 'DNP', 2)
) AS v(category, "group", "sortOrder") JOIN "status_category" c ON c.category = v.category;

INSERT INTO "status" ("categoryId", "groupId", "status", "code", "sortOrder", "updatedAt")
SELECT c.id, g.id, v.status, v.code, v."sortOrder", CURRENT_TIMESTAMP
FROM (VALUES
  ('Relevant Leads', 'New Leads', 'New Leads', 'new-leads', 1),
  ('Relevant Leads', 'Follow-up', 'Follow-up 1', 'follow-up-1', 1), ('Relevant Leads', 'Follow-up', 'Follow-up 2', 'follow-up-2', 2), ('Relevant Leads', 'Follow-up', 'Follow-up 3', 'follow-up-3', 3), ('Relevant Leads', 'Follow-up', 'Followup', 'followup', 4),
  ('Relevant Leads', 'Callback', 'Call Back (T)', 'call-back-t', 1), ('Relevant Leads', 'Callback', 'Call Back (SD)', 'call-back-sd', 2), ('Relevant Leads', 'Callback', 'Call Back Next Week', 'call-back-next-week', 3), ('Relevant Leads', 'Callback', 'Call Back Next Month', 'call-back-next-month', 4),
  ('Relevant Leads', 'Closed', 'Closed', 'closed', 1), ('Relevant Leads', 'Fund Issues', 'Fund Issues', 'fund-issues', 1),
  ('Appointments', 'IPD Done', 'IPD Done', 'ipd-done', 1), ('Appointments', 'OPD Done', 'OPD Done', 'opd-done', 1), ('Appointments', 'IPD Schedule', 'IPD Schedule', 'ipd-schedule', 1), ('Appointments', 'OPD Schedule', 'OPD Schedule', 'opd-schedule', 1),
  ('Irrelevant', 'Junk', 'Junk', 'junk', 1), ('Irrelevant', 'Out of Station', 'Out of Station', 'out-of-station', 1), ('Irrelevant', 'Out of Station follow-up', 'Out of Station follow-up', 'out-of-station-follow-up', 1), ('Irrelevant', 'Duplicate lead', 'Duplicate lead', 'duplicate-lead', 1), ('Irrelevant', 'IPD Lost', 'IPD Lost', 'ipd-lost', 1), ('Irrelevant', 'DNP Exhausted', 'DNP Exhausted', 'dnp-exhausted', 1),
  ('Churning Data', 'Nurture', 'Nurture', 'nurture', 1), ('Churning Data', 'Nurture', 'Nurture 1', 'nurture-1', 2), ('Churning Data', 'Nurture', 'Nurture 2', 'nurture-2', 3), ('Churning Data', 'Nurture', 'Nurture 3', 'nurture-3', 4), ('Churning Data', 'Nurture', 'Nurture 4', 'nurture-4', 5), ('Churning Data', 'Nurture', 'Nurture5', 'nurture5', 6),
  ('Churning Data', 'DNP', 'DNP', 'dnp', 1), ('Churning Data', 'DNP', 'DNP 1', 'dnp-1', 2), ('Churning Data', 'DNP', 'DNP 2', 'dnp-2', 3), ('Churning Data', 'DNP', 'DNP 3', 'dnp-3', 4), ('Churning Data', 'DNP', 'DNP 4', 'dnp-4', 5), ('Churning Data', 'DNP', 'DNP 5', 'dnp-5', 6)
) AS v(category, "group", status, code, "sortOrder")
JOIN "status_category" c ON c.category = v.category
JOIN "status_group" g ON g."categoryId" = c.id AND g."group" = v."group";

ALTER TABLE "Lead" ADD COLUMN "statusId" INTEGER;

-- Preserve existing non-standard labels instead of silently changing historic lead data.
INSERT INTO "status_group" ("categoryId", "group", "sortOrder", "updatedAt")
SELECT id, 'Legacy statuses', 999, CURRENT_TIMESTAMP FROM "status_category" WHERE category = 'Relevant Leads';
INSERT INTO "status" ("categoryId", "groupId", "status", "code", "sortOrder", "updatedAt")
SELECT c.id, g.id, labels.status, 'legacy-' || md5(lower(labels.status)), 999, CURRENT_TIMESTAMP
FROM (SELECT DISTINCT btrim(status) AS status FROM "Lead" WHERE btrim(status) <> '') labels
JOIN "status_category" c ON c.category = 'Relevant Leads'
JOIN "status_group" g ON g."categoryId" = c.id AND g."group" = 'Legacy statuses'
LEFT JOIN "status" s ON lower(s.status) = lower(labels.status)
WHERE s.id IS NULL;

UPDATE "Lead" l SET "statusId" = s.id
FROM "status" s WHERE lower(btrim(l.status)) = lower(s.status);
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_statusId_fkey"
  FOREIGN KEY ("statusId") REFERENCES "status"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Lead_statusId_idx" ON "Lead"("statusId");

-- All old writers that still send a status label are resolved to its status-table row.
CREATE OR REPLACE FUNCTION "sync_lead_status"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."statusId" IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.status IS NOT DISTINCT FROM OLD.status) THEN
    SELECT status INTO NEW.status FROM "status" WHERE id = NEW."statusId";
  ELSE
    SELECT id INTO NEW."statusId" FROM "status" WHERE lower(status) = lower(btrim(NEW.status)) AND "isActive" = true;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "Lead_status_sync" BEFORE INSERT OR UPDATE OF status, "statusId" ON "Lead"
FOR EACH ROW EXECUTE FUNCTION "sync_lead_status"();
