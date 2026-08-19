CREATE TABLE "EmployeeProfileActivityLog" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeProfileActivityLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmployeeProfileActivityLog_employeeId_createdAt_idx" ON "EmployeeProfileActivityLog"("employeeId", "createdAt");
CREATE INDEX "EmployeeProfileActivityLog_actorUserId_idx" ON "EmployeeProfileActivityLog"("actorUserId");

ALTER TABLE "EmployeeProfileActivityLog" ADD CONSTRAINT "EmployeeProfileActivityLog_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeProfileActivityLog" ADD CONSTRAINT "EmployeeProfileActivityLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
