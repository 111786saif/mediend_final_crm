-- Fix orphan FK references after restoring an old mediend-crm-v2 pg_dump.
-- Safe for production data: does NOT delete leads/users/employees.
-- Reassigns broken user attribution to the first ADMIN/MD/SUPER_ADMIN user.

-- Optional user FKs -> NULL
UPDATE "LedgerEntry" SET "deletedById" = NULL
WHERE "deletedById" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = "LedgerEntry"."deletedById");

UPDATE "LedgerEntry" SET "deleteRequestedById" = NULL
WHERE "deleteRequestedById" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = "LedgerEntry"."deleteRequestedById");

UPDATE "LedgerEntry" SET "deleteApprovedById" = NULL
WHERE "deleteApprovedById" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = "LedgerEntry"."deleteApprovedById");

UPDATE "LedgerEntry" SET "editRequestedById" = NULL
WHERE "editRequestedById" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = "LedgerEntry"."editRequestedById");

UPDATE "LedgerEntry" SET "editApprovedById" = NULL
WHERE "editApprovedById" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = "LedgerEntry"."editApprovedById");

UPDATE "LedgerEntry" SET "approvedById" = NULL
WHERE "approvedById" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = "LedgerEntry"."approvedById");

UPDATE "CaseChatMessage" SET "senderId" = NULL
WHERE "senderId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = "CaseChatMessage"."senderId");

UPDATE "DischargeSheet" SET "plRecordId" = NULL
WHERE "plRecordId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "PLRecord" p WHERE p.id = "DischargeSheet"."plRecordId");

-- Required user FKs -> fallback admin
UPDATE "LedgerEntry" SET "createdById" = f.id
FROM (SELECT id FROM "User" WHERE role IN ('ADMIN','MD','SUPER_ADMIN') ORDER BY CASE role WHEN 'ADMIN' THEN 1 WHEN 'SUPER_ADMIN' THEN 2 ELSE 3 END LIMIT 1) f
WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = "LedgerEntry"."createdById");

UPDATE "LedgerAuditLog" SET "performedById" = f.id
FROM (SELECT id FROM "User" WHERE role IN ('ADMIN','MD','SUPER_ADMIN') ORDER BY CASE role WHEN 'ADMIN' THEN 1 WHEN 'SUPER_ADMIN' THEN 2 ELSE 3 END LIMIT 1) f
WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = "LedgerAuditLog"."performedById");

UPDATE "SalesEntry" SET "createdById" = f.id
FROM (SELECT id FROM "User" WHERE role IN ('ADMIN','MD','SUPER_ADMIN') ORDER BY CASE role WHEN 'ADMIN' THEN 1 WHEN 'SUPER_ADMIN' THEN 2 ELSE 3 END LIMIT 1) f
WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = "SalesEntry"."createdById");

UPDATE "KYPSubmission" SET "submittedById" = f.id
FROM (SELECT id FROM "User" WHERE role IN ('ADMIN','MD','SUPER_ADMIN') ORDER BY CASE role WHEN 'ADMIN' THEN 1 WHEN 'SUPER_ADMIN' THEN 2 ELSE 3 END LIMIT 1) f
WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = "KYPSubmission"."submittedById");

UPDATE "AdmissionRecord" SET "initiatedById" = f.id
FROM (SELECT id FROM "User" WHERE role IN ('ADMIN','MD','SUPER_ADMIN') ORDER BY CASE role WHEN 'ADMIN' THEN 1 WHEN 'SUPER_ADMIN' THEN 2 ELSE 3 END LIMIT 1) f
WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = "AdmissionRecord"."initiatedById");

UPDATE "InsuranceInitiateForm" SET "createdById" = f.id
FROM (SELECT id FROM "User" WHERE role IN ('ADMIN','MD','SUPER_ADMIN') ORDER BY CASE role WHEN 'ADMIN' THEN 1 WHEN 'SUPER_ADMIN' THEN 2 ELSE 3 END LIMIT 1) f
WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = "InsuranceInitiateForm"."createdById");

UPDATE "CaseStageHistory" SET "changedById" = f.id
FROM (SELECT id FROM "User" WHERE role IN ('ADMIN','MD','SUPER_ADMIN') ORDER BY CASE role WHEN 'ADMIN' THEN 1 WHEN 'SUPER_ADMIN' THEN 2 ELSE 3 END LIMIT 1) f
WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = "CaseStageHistory"."changedById");

UPDATE "DischargeSheet" SET "createdById" = f.id
FROM (SELECT id FROM "User" WHERE role IN ('ADMIN','MD','SUPER_ADMIN') ORDER BY CASE role WHEN 'ADMIN' THEN 1 WHEN 'SUPER_ADMIN' THEN 2 ELSE 3 END LIMIT 1) f
WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = "DischargeSheet"."createdById");

DELETE FROM "HospitalSuggestion" hs
WHERE NOT EXISTS (SELECT 1 FROM "PreAuthorization" p WHERE p.id = hs."preAuthId");
