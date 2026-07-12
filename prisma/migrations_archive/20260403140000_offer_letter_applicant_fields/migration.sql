-- AlterTable: make employeeId optional for offer letters (applicants)
ALTER TABLE "EmployeeDocument" ALTER COLUMN "employeeId" DROP NOT NULL;

-- AddColumn
ALTER TABLE "EmployeeDocument" ADD COLUMN "applicantName" TEXT;
ALTER TABLE "EmployeeDocument" ADD COLUMN "applicantEmail" TEXT;
