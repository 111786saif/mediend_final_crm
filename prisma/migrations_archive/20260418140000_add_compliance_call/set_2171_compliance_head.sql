-- Run AFTER the COMPLIANCE_HEAD enum value is added (see migration.sql in this folder).
-- Promotes the user whose Employee.employeeCode = '2171' to COMPLIANCE_HEAD.

UPDATE "User"
SET "role" = 'COMPLIANCE_HEAD'
WHERE "id" = (
  SELECT "userId" FROM "Employee" WHERE "employeeCode" = '2171'
);

-- Sanity check
SELECT u."id", u."name", u."email", u."role", e."employeeCode"
FROM "User" u
JOIN "Employee" e ON e."userId" = u."id"
WHERE e."employeeCode" = '2171';
