-- Update User.role by email (from production User export).
-- Usage:
--   docker compose --profile tools run --rm \
--     -v "/root/mediend.workspace/scripts/db/update-roles-from-backup.sql:/sql/update-roles.sql:ro" \
--     --entrypoint sh postgres -c '
--       PG_URL=$(echo "$DATABASE_URL" | sed -E "s/[?&]schema=[^&]*//; s/\?&/?/; s/\?$//")
--       psql "$PG_URL" -v ON_ERROR_STOP=1 -f /sql/update-roles.sql
--     '
--
-- Or simpler (local postgres service):
--   docker compose exec -T postgres psql -U postgres -d mediend_crm -v ON_ERROR_STOP=1 \
--     -f - < scripts/db/update-roles-from-backup.sql

BEGIN;

UPDATE "User" SET "role" = 'BD', "updatedAt" = NOW() WHERE lower("email") = 'b.ashwani@mediend.com';
UPDATE "User" SET "role" = 'BD', "updatedAt" = NOW() WHERE lower("email") = 'huma.praveen@mediend.com';
UPDATE "User" SET "role" = 'TEAM_LEAD', "updatedAt" = NOW() WHERE lower("email") = 'mayank.pandey@mediend.com';
UPDATE "User" SET "role" = 'TEAM_LEAD', "updatedAt" = NOW() WHERE lower("email") = 'amir.saifi@mediend.com';
UPDATE "User" SET "role" = 'BD', "updatedAt" = NOW() WHERE lower("email") = 'abhishek.kashyap@mediend.com';
UPDATE "User" SET "role" = 'TEAM_LEAD', "updatedAt" = NOW() WHERE lower("email") = 'amit.shukla@mediend.com';
UPDATE "User" SET "role" = 'BD', "updatedAt" = NOW() WHERE lower("email") = 'pankaj@mediend.com';
UPDATE "User" SET "role" = 'BD', "updatedAt" = NOW() WHERE lower("email") = 'avnish.thakur@mediend.com';
UPDATE "User" SET "role" = 'BD', "updatedAt" = NOW() WHERE lower("email") = 'prince.meena@mediend.com';
UPDATE "User" SET "role" = 'BD', "updatedAt" = NOW() WHERE lower("email") = 'ahbab.ahmad@mediend.com';
UPDATE "User" SET "role" = 'BD', "updatedAt" = NOW() WHERE lower("email") = 'mani.prakash@mediend.com';
UPDATE "User" SET "role" = 'BD', "updatedAt" = NOW() WHERE lower("email") = 'sumit.pal@mediend.com';
UPDATE "User" SET "role" = 'TEAM_LEAD', "updatedAt" = NOW() WHERE lower("email") = 'mohit.raghav@mediend.com';
UPDATE "User" SET "role" = 'BD', "updatedAt" = NOW() WHERE lower("email") = 'lalit.kumar@mediend.com';
UPDATE "User" SET "role" = 'BD', "updatedAt" = NOW() WHERE lower("email") = 'vishal.upadhyay@mediend.com';
UPDATE "User" SET "role" = 'SALES_HEAD', "updatedAt" = NOW() WHERE lower("email") = 'hardeep@mediend.com';
UPDATE "User" SET "role" = 'INSURANCE_HEAD', "updatedAt" = NOW() WHERE lower("email") = 'shivam.rohilla@mediend.com';
UPDATE "User" SET "role" = 'INSURANCE_HEAD', "updatedAt" = NOW() WHERE lower("email") = 'vishal.sharma@mediend.com';
UPDATE "User" SET "role" = 'COMPLIANCE_HEAD', "updatedAt" = NOW() WHERE lower("email") = 'compliance_audit@mediend.com';
UPDATE "User" SET "role" = 'BD', "updatedAt" = NOW() WHERE lower("email") = 'miscpay@mediend.com';
UPDATE "User" SET "role" = 'PL_HEAD', "updatedAt" = NOW() WHERE lower("email") = 'recon.medi@mediend.com';
UPDATE "User" SET "role" = 'EXECUTIVE_ASSISTANT', "updatedAt" = NOW() WHERE lower("email") = 'care@mediend.com';
UPDATE "User" SET "role" = 'BD', "updatedAt" = NOW() WHERE lower("email") = 'rajat.srivastav@mediend.com';
UPDATE "User" SET "role" = 'BD', "updatedAt" = NOW() WHERE lower("email") = 'arsh.saifi@mediend.com';
UPDATE "User" SET "role" = 'BD', "updatedAt" = NOW() WHERE lower("email") = 'rashid.siddiqui@mediend.com';
UPDATE "User" SET "role" = 'TEAM_LEAD', "updatedAt" = NOW() WHERE lower("email") = 'asif.noor@mediend.com';
UPDATE "User" SET "role" = 'BD', "updatedAt" = NOW() WHERE lower("email") = 'naman.katiyar@mediend.com';
UPDATE "User" SET "role" = 'BD', "updatedAt" = NOW() WHERE lower("email") = 'prashant.singh@mediend.com';
UPDATE "User" SET "role" = 'BD', "updatedAt" = NOW() WHERE lower("email") = 'asad.khan@mediend.com';
UPDATE "User" SET "role" = 'BD', "updatedAt" = NOW() WHERE lower("email") = 'ishant.sharma@mediend.com';
UPDATE "User" SET "role" = 'BD', "updatedAt" = NOW() WHERE lower("email") = 'aryan@mediend.com';
UPDATE "User" SET "role" = 'DIGITAL_MARKETING_HEAD', "updatedAt" = NOW() WHERE lower("email") = 'wasim@mediend.com';
UPDATE "User" SET "role" = 'USER', "updatedAt" = NOW() WHERE lower("email") = 'mediend.digital1@gmail.com';
UPDATE "User" SET "role" = 'USER', "updatedAt" = NOW() WHERE lower("email") = 'kundkunddigital4@gmail.com';
UPDATE "User" SET "role" = 'USER', "updatedAt" = NOW() WHERE lower("email") = 'kundkunddigital7@gmail.com';
UPDATE "User" SET "role" = 'USER', "updatedAt" = NOW() WHERE lower("email") = 'mediend.digital15@gmail.com';
UPDATE "User" SET "role" = 'USER', "updatedAt" = NOW() WHERE lower("email") = 'mediend.digital16@gmail.com';
UPDATE "User" SET "role" = 'USER', "updatedAt" = NOW() WHERE lower("email") = 'vishal.tiwari@mediend.com';
UPDATE "User" SET "role" = 'USER', "updatedAt" = NOW() WHERE lower("email") = 'risha.majeed@mediend.com';
UPDATE "User" SET "role" = 'USER', "updatedAt" = NOW() WHERE lower("email") = 'swati@mediend.com';
UPDATE "User" SET "role" = 'USER', "updatedAt" = NOW() WHERE lower("email") = 'kktc.demat04@gmail.com';
UPDATE "User" SET "role" = 'USER', "updatedAt" = NOW() WHERE lower("email") = 'shubham.tyagi@collegele.com';
UPDATE "User" SET "role" = 'FINANCE_HEAD', "updatedAt" = NOW() WHERE lower("email") = 'admin@kundkundtc.com';
UPDATE "User" SET "role" = 'USER', "updatedAt" = NOW() WHERE lower("email") = 'mohit.sharma@collegele.com';
UPDATE "User" SET "role" = 'USER', "updatedAt" = NOW() WHERE lower("email") = 'kritika@mediend.com';
UPDATE "User" SET "role" = 'USER', "updatedAt" = NOW() WHERE lower("email") = 'mediend.hr@gmail.com';
UPDATE "User" SET "role" = 'HR_HEAD', "updatedAt" = NOW() WHERE lower("email") = 'hr@mediend.com';
UPDATE "User" SET "role" = 'USER', "updatedAt" = NOW() WHERE lower("email") = 'divya@mediend.com';
UPDATE "User" SET "role" = 'MD', "updatedAt" = NOW() WHERE lower("email") = 'admin@mediend.com';
UPDATE "User" SET "role" = 'IT_HEAD', "updatedAt" = NOW() WHERE lower("email") = 'cto@mediend.com';

-- Also fix mediend.com variant if EA was seeded under that email
UPDATE "User" SET "role" = 'EXECUTIVE_ASSISTANT', "updatedAt" = NOW() WHERE lower("email") = 'shubham.tyagi@mediend.com';

COMMIT;

-- Verification
SELECT "email", "name", "role"
FROM "User"
WHERE lower("email") IN (
  'admin@mediend.com',
  'hardeep@mediend.com',
  'care@mediend.com',
  'hr@mediend.com',
  'cto@mediend.com',
  'shivam.rohilla@mediend.com',
  'vishal.sharma@mediend.com',
  'recon.medi@mediend.com',
  'compliance_audit@mediend.com',
  'wasim@mediend.com',
  'admin@kundkundtc.com'
)
ORDER BY "role", "email";
