UPDATE "User"
SET "role" = 'EXECUTIVE_ASSISTANT'
WHERE "id" = (
  SELECT "userId" FROM "Employee" WHERE "employeeCode" = '2414'
);

UPDATE "Employee"
SET "designation" = 'Executive Assistant'
WHERE "employeeCode" = '2414';

SELECT u."id", u."name", u."email", u."role", e."employeeCode", e."designation"
FROM "User" u
JOIN "Employee" e ON e."userId" = u."id"
WHERE e."employeeCode" = '2414';
