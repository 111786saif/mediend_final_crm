CREATE TYPE "CrmAssignmentStrategy" AS ENUM ('TARGET_BALANCED', 'ROUND_ROBIN', 'MANUAL_POOL_ORDER');

CREATE TABLE "CrmAssignmentRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "city" TEXT,
    "category" TEXT,
    "departmentId" TEXT,
    "strategy" "CrmAssignmentStrategy" NOT NULL DEFAULT 'TARGET_BALANCED',
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmAssignmentRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmAssignmentRuleMember" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmAssignmentRuleMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CrmAssignmentRuleMember_ruleId_employeeId_key" ON "CrmAssignmentRuleMember"("ruleId", "employeeId");
CREATE INDEX "CrmAssignmentRule_isActive_priority_idx" ON "CrmAssignmentRule"("isActive", "priority");
CREATE INDEX "CrmAssignmentRule_city_idx" ON "CrmAssignmentRule"("city");
CREATE INDEX "CrmAssignmentRule_category_idx" ON "CrmAssignmentRule"("category");
CREATE INDEX "CrmAssignmentRule_departmentId_idx" ON "CrmAssignmentRule"("departmentId");
CREATE INDEX "CrmAssignmentRuleMember_employeeId_idx" ON "CrmAssignmentRuleMember"("employeeId");
CREATE INDEX "CrmAssignmentRuleMember_ruleId_isActive_priority_idx" ON "CrmAssignmentRuleMember"("ruleId", "isActive", "priority");

ALTER TABLE "CrmAssignmentRule"
ADD CONSTRAINT "CrmAssignmentRule_departmentId_fkey"
FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CrmAssignmentRule"
ADD CONSTRAINT "CrmAssignmentRule_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CrmAssignmentRule"
ADD CONSTRAINT "CrmAssignmentRule_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CrmAssignmentRuleMember"
ADD CONSTRAINT "CrmAssignmentRuleMember_ruleId_fkey"
FOREIGN KEY ("ruleId") REFERENCES "CrmAssignmentRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CrmAssignmentRuleMember"
ADD CONSTRAINT "CrmAssignmentRuleMember_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
