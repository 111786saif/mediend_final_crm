-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('MD', 'EXECUTIVE_ASSISTANT', 'SALES_HEAD', 'CATEGORY_MANAGER', 'ASSISTANT_CATEGORY_MANAGER', 'TEAM_LEAD', 'BD', 'INSURANCE_HEAD', 'PL_HEAD', 'OUTSTANDING_HEAD', 'HR_HEAD', 'FINANCE_HEAD', 'DIGITAL_MARKETING_HEAD', 'IT_HEAD', 'LOAN_DEMAT_HEAD', 'COMPLIANCE_HEAD', 'ADMIN', 'USER', 'TESTER');

-- CreateEnum
CREATE TYPE "ComplianceCallStatus" AS ENUM ('PENDING', 'COMPLETED', 'DID_NOT_PICK', 'WRONG_NUMBER', 'CALLBACK_SCHEDULED');

-- CreateEnum
CREATE TYPE "SatisfactionLevel" AS ENUM ('SATISFIED', 'NEUTRAL', 'NOT_SATISFIED');

-- CreateEnum
CREATE TYPE "ConcernCategory" AS ENUM ('HOSPITAL_STAFF', 'PAYMENT', 'BD', 'NO_UPDATE_FOLLOWUP', 'DOCTOR', 'SURGERY_RELATED', 'CAB_PAYMENT', 'OTHERS');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('DONE', 'NOT_DONE');

-- CreateEnum
CREATE TYPE "SalesTeamCostEntryType" AS ENUM ('INCENTIVE', 'SEATING', 'MISC');

-- CreateEnum
CREATE TYPE "EmployeeIncentiveStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID');

-- CreateEnum
CREATE TYPE "EmployeeSeatingMiscCostStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID');

-- CreateEnum
CREATE TYPE "FlowType" AS ENUM ('INSURANCE', 'CASH');

-- CreateEnum
CREATE TYPE "PipelineStage" AS ENUM ('SALES', 'INSURANCE', 'PL', 'COMPLETED', 'LOST');

-- CreateEnum
CREATE TYPE "TargetType" AS ENUM ('BD', 'TEAM', 'DEPARTMENT_HEAD');

-- CreateEnum
CREATE TYPE "PeriodType" AS ENUM ('WEEK', 'MONTH');

-- CreateEnum
CREATE TYPE "TargetMetric" AS ENUM ('LEADS_CLOSED', 'NET_PROFIT', 'BILL_AMOUNT', 'SURGERIES_DONE', 'IPD_DONE', 'HEAD_COUNT', 'LEADS_GENERATED', 'REVENUE');

-- CreateEnum
CREATE TYPE "BonusRuleType" AS ENUM ('PERCENT_ABOVE_TARGET', 'FIXED_COUNT');

-- CreateEnum
CREATE TYPE "InsuranceCaseStatus" AS ENUM ('IN_PROGRESS', 'APPROVED', 'REJECTED', 'QUERY');

-- CreateEnum
CREATE TYPE "LeaveRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LeaveBalanceEditRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PunchDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "PayrollComponentType" AS ENUM ('ALLOWANCE', 'DEDUCTION');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('OFFER_LETTER', 'INCREMENT_LETTER', 'EXPERIENCE_LETTER', 'RELIEVING_LETTER', 'INTERNSHIP_OFFER_LETTER', 'INTERNSHIP_COMPLETION_LETTER', 'EXIT_INTERVIEW_FORM', 'CUSTOM');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('PENDING', 'REVIEWED', 'ACKNOWLEDGED');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "MeetType" AS ENUM ('VIRTUAL', 'OFFLINE');

-- CreateEnum
CREATE TYPE "MeetModule" AS ENUM ('INTERVIEW', 'MD_APPOINTMENT', 'GENERAL');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'SHORTLISTED', 'REJECTED', 'HIRED');

-- CreateEnum
CREATE TYPE "KYPStatus" AS ENUM ('PENDING', 'KYP_DETAILS_ADDED', 'PRE_AUTH_COMPLETE', 'FOLLOW_UP_COMPLETE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('KYP_SUBMITTED', 'PRE_AUTH_COMPLETE', 'FOLLOW_UP_COMPLETE', 'KYP_COMPLETED', 'QUERY_RAISED', 'QUERY_ANSWERED', 'DISCHARGE_SHEET_CREATED', 'PREAUTH_RAISED', 'INITIATED', 'DISCHARGED', 'CASE_CHAT_MESSAGE', 'TASK_ASSIGNED', 'TASK_DUE_SOON', 'DUE_DATE_CHANGE_REQUESTED', 'DUE_DATE_CHANGE_APPROVED', 'DUE_DATE_CHANGE_REJECTED', 'HOSPITAL_SUGGESTION_REQUESTED', 'LEAVE_REQUESTED', 'LEAVE_APPROVED', 'LEAVE_REJECTED', 'FEEDBACK_SUBMITTED', 'INCREMENT_REQUESTED', 'NORMALIZATION_REQUESTED', 'NORMALIZATION_APPROVED', 'NORMALIZATION_REJECTED', 'TICKET_CREATED', 'TICKET_RESPONDED', 'NOTICE_PUBLISHED', 'MD_APPROVAL_REQUESTED', 'MD_APPROVAL_RESPONDED', 'MD_APPROVAL_FINANCE_ACK', 'MEET_SCHEDULED', 'MEET_REMINDER', 'EMPLOYEE_ONBOARDED', 'LEAVE_BALANCE_EDIT_REQUESTED', 'LEAVE_BALANCE_EDIT_RESOLVED', 'GRACE2_MONTHLY_LIMIT_EXCEEDED');

-- CreateEnum
CREATE TYPE "NoticeTargetType" AS ENUM ('EVERYONE', 'EVERYONE_EXCEPT_MD', 'DEPARTMENT', 'SPECIFIC');

-- CreateEnum
CREATE TYPE "MDApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('GENERAL', 'LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'EMPLOYEE_DONE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WarningType" AS ENUM ('REPEATED_DEADLINE_MISS', 'LOW_QUALITY_WORK', 'UNRESPONSIVE', 'TASK_ABANDONMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "TaskApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "QueryStatus" AS ENUM ('PENDING', 'ANSWERED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "InsuranceType" AS ENUM ('INDIVIDUAL', 'FAMILY_FLOATER', 'GROUP_CORPORATE');

-- CreateEnum
CREATE TYPE "IpdStatus" AS ENUM ('ADMITTED_DONE', 'IPD_DONE', 'POSTPONED', 'CANCELLED', 'DISCHARGED');

-- CreateEnum
CREATE TYPE "PaidByParty" AS ENUM ('MEDIEND', 'HOSPITAL');

-- CreateEnum
CREATE TYPE "PLOutstandingStatus" AS ENUM ('NEW', 'DRAFT', 'OUTSTANDING');

-- CreateEnum
CREATE TYPE "CaseStage" AS ENUM ('NEW_LEAD', 'KYP_BASIC_COMPLETE', 'HOSPITALS_SUGGESTED', 'PREAUTH_RAISED', 'PREAUTH_COMPLETE', 'INITIATED', 'DISCHARGED', 'PL_PENDING', 'OUTSTANDING', 'CASH_IPD_PENDING', 'CASH_IPD_SUBMITTED', 'CASH_APPROVED', 'CASH_ON_HOLD', 'CASH_IPD_DONE', 'CASH_DISCHARGED', 'KYP_PENDING', 'KYP_COMPLETE', 'ADMITTED', 'IPD_DONE', 'KYP_BASIC_PENDING', 'KYP_DETAILED_PENDING', 'KYP_DETAILED_COMPLETE');

-- CreateEnum
CREATE TYPE "ChatMessageType" AS ENUM ('TEXT', 'FILE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "PreAuthStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'TEMP_APPROVED', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "ATSStatus" AS ENUM ('ABOVE_ATS', 'BELOW_ATS', 'NO_ATS');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'ON_PIP', 'ON_NOTICE', 'TERMINATED', 'ABSCONDED');

-- CreateEnum
CREATE TYPE "ITProjectStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ON_HOLD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ITBillingType" AS ENUM ('FIXED', 'MONTHLY', 'MILESTONE');

-- CreateEnum
CREATE TYPE "ITResourceType" AS ENUM ('SALARIED', 'FREELANCE');

-- CreateEnum
CREATE TYPE "ITResourcePaymentType" AS ENUM ('MONTHLY', 'ONE_TIME', 'BOTH');

-- CreateEnum
CREATE TYPE "RevenueDepartment" AS ENUM ('LOAN_DEMAT', 'GOOGLE_ADS');

-- CreateEnum
CREATE TYPE "PnLCategoryType" AS ENUM ('REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "UserStatusKind" AS ENUM ('AVAILABLE', 'ONLINE_ONLY', 'UNAVAILABLE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "NormalizationType" AS ENUM ('SELF', 'MANAGER', 'EMPLOYEE_REQUEST');

-- CreateEnum
CREATE TYPE "NormalizationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MonthlyPayrollStatus" AS ENUM ('DRAFT', 'APPROVED', 'PAID');

-- CreateEnum
CREATE TYPE "PartyType" AS ENUM ('BUYER', 'SELLER', 'VENDOR', 'CLIENT', 'SUPPLIER', 'OTHER');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('CREDIT', 'DEBIT', 'SELF_TRANSFER');

-- CreateEnum
CREATE TYPE "LedgerStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FinancePaymentType" AS ENUM ('EXPENSE', 'NON_EXPENSE', 'RECEIPT');

-- CreateEnum
CREATE TYPE "LedgerAuditAction" AS ENUM ('CREATED', 'UPDATED', 'APPROVED', 'REJECTED', 'DELETED', 'EDIT_REQUESTED', 'EDIT_APPROVED', 'EDIT_REJECTED', 'DELETE_REQUESTED', 'DELETE_APPROVED', 'DELETE_REJECTED');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('WAREHOUSE', 'SUB_WAREHOUSE');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('PURCHASE', 'ISSUE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "InventoryTransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('MODULE', 'SECTION', 'ENTITY');

-- CreateEnum
CREATE TYPE "PermissionLevel" AS ENUM ('NONE', 'READ', 'READ_WRITE', 'READ_WRITE_DELETE', 'FULL_ACCESS');

-- CreateEnum
CREATE TYPE "SubjectType" AS ENUM ('USER', 'ROLE');

-- CreateEnum
CREATE TYPE "InstallmentRecipient" AS ENUM ('HOSPITAL', 'DOCTOR', 'MEDIEND');

-- CreateEnum
CREATE TYPE "InstallmentMode" AS ENUM ('CASH', 'UPI', 'NEFT', 'RTGS', 'CHEQUE', 'CARD', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "phoneNumber" TEXT,
    "address" TEXT,
    "profilePicture" TEXT,
    "gender" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "currentAddress" JSONB,
    "permanentAddress" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserStatus" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "UserStatusKind" NOT NULL,
    "label" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "leadRef" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "sex" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "alternateNumber" TEXT,
    "attendantName" TEXT,
    "bdId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "pipelineStage" "PipelineStage" NOT NULL DEFAULT 'SALES',
    "caseStage" "CaseStage" NOT NULL DEFAULT 'NEW_LEAD',
    "circle" TEXT NOT NULL,
    "category" TEXT,
    "treatment" TEXT,
    "treatmentMasterId" TEXT,
    "atsAmount" DOUBLE PRECISION,
    "atsStatus" "ATSStatus" DEFAULT 'NO_ATS',
    "anesthesia" TEXT,
    "quantityGrade" TEXT,
    "surgeonName" TEXT,
    "surgeonType" TEXT,
    "hospitalName" TEXT NOT NULL,
    "flowType" "FlowType" NOT NULL DEFAULT 'INSURANCE',
    "modeOfPayment" TEXT,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "copay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "settledTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "billAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "insuranceName" TEXT,
    "tpa" TEXT,
    "sumInsured" DOUBLE PRECISION,
    "roomRent" DOUBLE PRECISION,
    "icu" DOUBLE PRECISION,
    "capping" DOUBLE PRECISION,
    "arrivalDate" TIMESTAMP(3),
    "arrivalTime" TEXT,
    "surgeryDate" TIMESTAMP(3),
    "operationTime" TEXT,
    "implantType" TEXT,
    "implantAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "instrument" TEXT,
    "consumables" TEXT,
    "createdById" TEXT NOT NULL,
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" TEXT NOT NULL,
    "updatedDate" TIMESTAMP(3) NOT NULL,
    "remarks" TEXT,
    "source" TEXT,
    "campaignName" TEXT,
    "bdeName" TEXT,
    "conversionDate" TIMESTAMP(3),
    "mediendProfit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hospitalShare" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "doctorShare" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "othersShare" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netProfit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ticketSize" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "collectedByMediend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "collectedByHospital" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "month" TEXT,
    "assignedDate" TIMESTAMP(3),
    "leadEntryDate" TIMESTAMP(3),
    "patientEmail" TEXT,
    "whatsapp" TEXT,
    "address" TEXT,
    "docUpload" TEXT,
    "diseaseDetails" TEXT,
    "followUpDate" TIMESTAMP(3),
    "subStatus" INTEGER,
    "opdHospital" TEXT,
    "opdDrName" TEXT,
    "opdContactNo" TEXT,
    "opdCharges" INTEGER NOT NULL DEFAULT 0,
    "opdScheduleDate" TIMESTAMP(3),
    "opdMeeting" INTEGER,
    "ipdAdmissionDate" TIMESTAMP(3),
    "ipdHospital" TEXT,
    "ipdDrName" TEXT,
    "ipdContactNo" TEXT,
    "ipdTotalPayment" INTEGER NOT NULL DEFAULT 0,
    "ipdDetails" TEXT,
    "paymentDetails" INTEGER,
    "attendantContactNo" TEXT,
    "waFormat" TEXT,
    "leadSource" INTEGER,
    "whatsappMessage" TEXT,
    "notification" BOOLEAN NOT NULL DEFAULT false,
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "smsSent" BOOLEAN NOT NULL DEFAULT false,
    "whatsappSent" BOOLEAN NOT NULL DEFAULT false,
    "website" TEXT,
    "description" TEXT,
    "refId" TEXT,
    "duplCount" INTEGER NOT NULL DEFAULT 0,
    "aes" BOOLEAN NOT NULL DEFAULT false,
    "profession" TEXT,
    "qr" TEXT,
    "removeRemarks" BOOLEAN NOT NULL DEFAULT false,
    "adId" TEXT,
    "campaignId" TEXT,
    "formId" TEXT,
    "teamLeadId" INTEGER,
    "remarksId" TEXT,
    "lostReason" TEXT,
    "lostAt" TIMESTAMP(3),

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallNote" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadStageEvent" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "fromStage" "PipelineStage" NOT NULL,
    "toStage" "PipelineStage" NOT NULL,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "LeadStageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Target" (
    "id" TEXT NOT NULL,
    "targetType" "TargetType" NOT NULL,
    "targetForId" TEXT NOT NULL,
    "periodType" "PeriodType" NOT NULL,
    "periodStartDate" TIMESTAMP(3) NOT NULL,
    "periodEndDate" TIMESTAMP(3) NOT NULL,
    "metric" "TargetMetric" NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "departmentTargets" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Target_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BonusRule" (
    "id" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "ruleType" "BonusRuleType" NOT NULL,
    "thresholdValue" DOUBLE PRECISION NOT NULL,
    "bonusAmount" DOUBLE PRECISION,
    "bonusPercentage" DOUBLE PRECISION,
    "capAmount" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BonusRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceCase" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "caseStatus" "InsuranceCaseStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "approvalAmount" DOUBLE PRECISION,
    "tpaRemarks" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "handledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsuranceCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PLRecord" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "outstandingStatus" "PLOutstandingStatus" NOT NULL DEFAULT 'NEW',
    "month" TIMESTAMP(3),
    "admissionDate" TIMESTAMP(3),
    "surgeryDate" TIMESTAMP(3),
    "status" TEXT,
    "paymentType" TEXT,
    "approvedOrCash" TEXT,
    "paymentCollectedAt" TEXT,
    "managerRole" TEXT,
    "managerName" TEXT,
    "bdmName" TEXT,
    "patientName" TEXT,
    "patientPhone" TEXT,
    "doctorName" TEXT,
    "hospitalName" TEXT,
    "category" TEXT,
    "treatment" TEXT,
    "circle" TEXT,
    "leadSource" TEXT,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "billAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashPaidByPatient" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashOrDedPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "referralAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cabCharges" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "implantCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "instrumentsCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "implantPaidBy" "PaidByParty",
    "instrumentsPaidBy" "PaidByParty",
    "actualImplantCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualInstrumentCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hospitalRecoverAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dcCharges" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "doctorCharges" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hospitalSharePct" DOUBLE PRECISION,
    "hospitalShareAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mediendSharePct" DOUBLE PRECISION,
    "mediendShareAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mediendNetProfit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "finalProfit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mediendProfit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hospitalPayoutStatus" TEXT,
    "doctorPayoutStatus" TEXT,
    "mediendInvoiceStatus" TEXT,
    "hospitalAmountPending" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "doctorAmountPending" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "doctorRemarks" TEXT,
    "costBreakdownRemarks" TEXT,
    "remarks" TEXT,
    "closedAt" TIMESTAMP(3),
    "handledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PLRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncomingLead" (
    "id" TEXT NOT NULL,
    "source" TEXT,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncomingLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "headId" TEXT,
    "shiftStartHour" INTEGER NOT NULL DEFAULT 10,
    "shiftStartMinute" INTEGER NOT NULL DEFAULT 0,
    "grace1Minutes" INTEGER NOT NULL DEFAULT 15,
    "grace2Minutes" INTEGER NOT NULL DEFAULT 15,
    "penaltyMinutes" INTEGER NOT NULL DEFAULT 30,
    "penaltyAmount" INTEGER NOT NULL DEFAULT 200,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentTeam" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "teamLeadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepartmentTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "bdNumber" INTEGER,
    "joinDate" TIMESTAMP(3),
    "salary" DOUBLE PRECISION,
    "departmentId" TEXT,
    "teamId" TEXT,
    "managerId" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "aadharNumber" TEXT,
    "panNumber" TEXT,
    "aadharDocUrl" TEXT,
    "panDocUrl" TEXT,
    "designation" TEXT,
    "bankAccountName" TEXT,
    "bankAccountNumber" TEXT,
    "ifscCode" TEXT,
    "bankName" TEXT,
    "bankBranch" TEXT,
    "upiId" TEXT,
    "bloodGroup" TEXT,
    "employmentType" TEXT,
    "workLocation" TEXT,
    "passportDocUrl" TEXT,
    "drivingLicenseDocUrl" TEXT,
    "resumeDocUrl" TEXT,
    "educationalCertDocUrl" TEXT,
    "experienceCertDocUrl" TEXT,
    "appointmentLetterDocUrl" TEXT,
    "otherDocuments" JSONB,
    "uanNumber" TEXT,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "pipStartDate" TIMESTAMP(3),
    "pipEndDate" TIMESTAMP(3),
    "noticePeriodStartDate" TIMESTAMP(3),
    "noticePeriodEndDate" TIMESTAMP(3),
    "finalWorkingDay" TIMESTAMP(3),
    "terminationReason" TEXT,
    "statusNote" TEXT,
    "fnfDeadline" TIMESTAMP(3),
    "fnfCompleted" BOOLEAN NOT NULL DEFAULT false,
    "fnfCompletedAt" TIMESTAMP(3),
    "fnfCompletedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceLog" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "logDate" TIMESTAMP(3) NOT NULL,
    "punchDirection" "PunchDirection" NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "serialNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceNormalization" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "NormalizationType" NOT NULL,
    "requestedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "managerApprovedById" TEXT,
    "managerApprovedAt" TIMESTAMP(3),
    "status" "NormalizationStatus" NOT NULL DEFAULT 'APPROVED',
    "reason" TEXT,
    "hrRejectionReason" TEXT,
    "hoursUsed" INTEGER,
    "normalizeAs" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceNormalization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveTypeMaster" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "maxDays" INTEGER NOT NULL,
    "monthlyAccrual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "carryForward" BOOLEAN NOT NULL DEFAULT false,
    "probationUnlockDays" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveTypeMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "days" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "isUnpaid" BOOLEAN NOT NULL DEFAULT false,
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'PENDING',
    "targetApproverId" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveBalance" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "allocated" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "used" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remaining" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveBalanceEditRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "prevCL" DOUBLE PRECISION NOT NULL,
    "prevSL" DOUBLE PRECISION NOT NULL,
    "prevEL" DOUBLE PRECISION NOT NULL,
    "proposedCL" DOUBLE PRECISION NOT NULL,
    "proposedSL" DOUBLE PRECISION NOT NULL,
    "proposedEL" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "status" "LeaveBalanceEditRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewRemarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveBalanceEditRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRecord" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "disbursedAt" TIMESTAMP(3) NOT NULL,
    "basicSalary" DOUBLE PRECISION NOT NULL,
    "grossSalary" DOUBLE PRECISION NOT NULL,
    "netSalary" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollComponent" (
    "id" TEXT NOT NULL,
    "payrollRecordId" TEXT NOT NULL,
    "componentType" "PayrollComponentType" NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryStructure" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "annualCtc" DOUBLE PRECISION NOT NULL,
    "monthlyGross" DOUBLE PRECISION NOT NULL,
    "basicSalary" DOUBLE PRECISION NOT NULL,
    "hraAllowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "medicalAllowance" DOUBLE PRECISION NOT NULL,
    "conveyanceAllowance" DOUBLE PRECISION NOT NULL,
    "otherAllowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "specialAllowance" DOUBLE PRECISION NOT NULL,
    "insuranceDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "applyPf" BOOLEAN NOT NULL DEFAULT true,
    "applyTds" BOOLEAN NOT NULL DEFAULT false,
    "tdsMonthly" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tdsRatePercent" DOUBLE PRECISION,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyPayroll" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "totalDaysInMonth" INTEGER NOT NULL,
    "payableDays" DOUBLE PRECISION NOT NULL,
    "unpaidLeaves" INTEGER NOT NULL DEFAULT 0,
    "paidLeaves" INTEGER NOT NULL DEFAULT 0,
    "halfDays" INTEGER NOT NULL DEFAULT 0,
    "lateFines" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "adjustedBasic" DOUBLE PRECISION NOT NULL,
    "adjustedHra" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "adjustedMedical" DOUBLE PRECISION NOT NULL,
    "adjustedConveyance" DOUBLE PRECISION NOT NULL,
    "adjustedOther" DOUBLE PRECISION NOT NULL,
    "adjustedSpecial" DOUBLE PRECISION NOT NULL,
    "adjustedGross" DOUBLE PRECISION NOT NULL,
    "epfEmployee" DOUBLE PRECISION NOT NULL,
    "applyEsic" BOOLEAN NOT NULL DEFAULT false,
    "esicAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "applyTds" BOOLEAN NOT NULL DEFAULT false,
    "tdsAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "insurance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDeductions" DOUBLE PRECISION NOT NULL,
    "epfEmployer" DOUBLE PRECISION NOT NULL,
    "netPayable" DOUBLE PRECISION NOT NULL,
    "status" "MonthlyPayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "disbursedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "paidAt" TIMESTAMP(3),
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyPayroll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeDocument" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT,
    "documentType" "DocumentType" NOT NULL,
    "documentUrl" TEXT,
    "title" TEXT,
    "applicantName" TEXT,
    "applicantEmail" TEXT,
    "metadata" JSONB,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ackToken" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedIp" TEXT,

    CONSTRAINT "EmployeeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnonymousMessage" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnonymousMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MDAppointment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "preferredDate" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MDAppointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meet" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "MeetType" NOT NULL DEFAULT 'OFFLINE',
    "meetLink" TEXT,
    "location" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "module" "MeetModule" NOT NULL DEFAULT 'GENERAL',
    "interviewRound" INTEGER,
    "candidateName" TEXT,
    "candidateRole" TEXT,
    "candidatePhone" TEXT,
    "departmentId" TEXT,
    "notes" TEXT,
    "resumeUrl" TEXT,
    "isRecorded" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "mdAppointmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetParticipant" (
    "id" TEXT NOT NULL,
    "meetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attended" BOOLEAN,
    "remarks" TEXT,

    CONSTRAINT "MeetParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentalHealthRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "reason" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "hrResponse" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentalHealthRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "departmentId" TEXT,
    "targetHeadRole" TEXT,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "response" TEXT,
    "respondedAt" TIMESTAMP(3),
    "attachments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncrementRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "currentSalary" DOUBLE PRECISION NOT NULL,
    "requestedAmount" DOUBLE PRECISION,
    "reason" TEXT NOT NULL,
    "achievements" TEXT,
    "documents" JSONB,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "approvalPercentage" DOUBLE PRECISION,
    "hrRemarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncrementRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalJobPosting" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "department" TEXT,
    "requirements" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternalJobPosting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IJPApplication" (
    "id" TEXT NOT NULL,
    "postingId" TEXT NOT NULL,
    "referredById" TEXT NOT NULL,
    "candidateName" TEXT NOT NULL,
    "candidateEmail" TEXT,
    "candidatePhone" TEXT,
    "resumeUrl" TEXT NOT NULL,
    "description" TEXT,
    "documents" JSONB,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IJPApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyMaster" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "partyType" "PartyType" NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "gstNumber" TEXT,
    "panNumber" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeadMaster" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HeadMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMaster" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentTypeMaster" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "paymentType" "FinancePaymentType" NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentTypeMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentModeMaster" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "openingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentModeMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "transactionType" "TransactionType" NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "partyId" TEXT,
    "description" TEXT NOT NULL,
    "headId" TEXT,
    "paymentTypeId" TEXT,
    "paymentAmount" DOUBLE PRECISION,
    "componentA" DOUBLE PRECISION,
    "componentB" DOUBLE PRECISION,
    "receivedAmount" DOUBLE PRECISION,
    "paymentModeId" TEXT,
    "fromPaymentModeId" TEXT,
    "toPaymentModeId" TEXT,
    "transferAmount" DOUBLE PRECISION,
    "openingBalance" DOUBLE PRECISION NOT NULL,
    "currentBalance" DOUBLE PRECISION NOT NULL,
    "status" "LedgerStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "deletedReason" TEXT,
    "deleteRequestStatus" "LedgerStatus",
    "deleteRequestReason" TEXT,
    "deleteRequestedById" TEXT,
    "deleteRequestedAt" TIMESTAMP(3),
    "deleteApprovalReason" TEXT,
    "deleteApprovedById" TEXT,
    "deleteApprovedAt" TIMESTAMP(3),
    "editRequestStatus" "LedgerStatus",
    "editRequestReason" TEXT,
    "editRequestData" JSONB,
    "editRequestedById" TEXT,
    "editRequestedAt" TIMESTAMP(3),
    "editApprovalReason" TEXT,
    "editApprovedById" TEXT,
    "editApprovedAt" TIMESTAMP(3),
    "editCount" INTEGER NOT NULL DEFAULT 0,
    "attachments" JSONB,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerAuditLog" (
    "id" TEXT NOT NULL,
    "ledgerEntryId" TEXT NOT NULL,
    "action" "LedgerAuditAction" NOT NULL,
    "previousData" JSONB,
    "newData" JSONB,
    "reason" TEXT,
    "performedById" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesEntry" (
    "id" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocationMaster" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "LocationType" NOT NULL,
    "parentId" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocationMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemMaster" (
    "id" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "minimumStockLevel" DOUBLE PRECISION NOT NULL,
    "maximumStockLevel" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "movementType" "StockMovementType" NOT NULL,
    "referenceId" TEXT NOT NULL,
    "referenceType" "StockMovementType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseTransaction" (
    "id" TEXT NOT NULL,
    "purchaseNumber" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "purchaseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "status" "InventoryTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueTransaction" (
    "id" TEXT NOT NULL,
    "issueNumber" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "issuedToId" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "status" "InventoryTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IssueTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadRemark" (
    "id" TEXT NOT NULL,
    "leadRef" TEXT NOT NULL,
    "remarks" TEXT NOT NULL,
    "updateBy" INTEGER,
    "updateDate" TIMESTAMP(3) NOT NULL,
    "ip" TEXT,
    "leadStatus" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadRemark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncState" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'mysql_leads',
    "lastSyncedDate" TIMESTAMP(3) NOT NULL,
    "lastSyncedId" INTEGER,
    "recordsCount" INTEGER NOT NULL DEFAULT 0,
    "lastRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KYPSubmission" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "aadhar" TEXT,
    "pan" TEXT,
    "insuranceCard" TEXT,
    "disease" TEXT,
    "location" TEXT,
    "area" TEXT,
    "remark" TEXT,
    "insuranceType" "InsuranceType",
    "aadharFileUrl" TEXT,
    "panFileUrl" TEXT,
    "aadharFiles" JSONB,
    "panFiles" JSONB,
    "insuranceCardFileUrl" TEXT,
    "prescriptionFileUrl" TEXT,
    "diseasePhotos" JSONB,
    "otherFiles" JSONB,
    "patientConsent" BOOLEAN NOT NULL DEFAULT false,
    "status" "KYPStatus" NOT NULL DEFAULT 'PENDING',
    "submittedById" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "documentEditCounts" JSONB,
    "documentEditHistory" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KYPSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreAuthorization" (
    "id" TEXT NOT NULL,
    "kypSubmissionId" TEXT NOT NULL,
    "sumInsured" TEXT,
    "balanceInsured" TEXT,
    "roomRent" TEXT,
    "capping" TEXT,
    "copay" TEXT,
    "icu" TEXT,
    "hospitalNameSuggestion" TEXT,
    "insurance" TEXT,
    "tpa" TEXT,
    "hospitalSuggestions" JSONB,
    "roomTypes" JSONB,
    "requestedHospitalName" TEXT,
    "requestedRoomType" TEXT,
    "bdSuggestedHospital" TEXT,
    "diseaseDescription" TEXT,
    "diseaseImages" JSONB,
    "preAuthRaisedAt" TIMESTAMP(3),
    "preAuthRaisedById" TEXT,
    "isNewHospitalRequest" BOOLEAN NOT NULL DEFAULT false,
    "newHospitalPreAuthRaised" BOOLEAN NOT NULL DEFAULT false,
    "expectedAdmissionDate" TIMESTAMP(3),
    "expectedSurgeryDate" TIMESTAMP(3),
    "investigationFileUrls" JSONB,
    "prescriptionFiles" JSONB,
    "notes" TEXT,
    "insuranceType" TEXT,
    "handledById" TEXT,
    "handledAt" TIMESTAMP(3),
    "approvalStatus" "PreAuthStatus" NOT NULL DEFAULT 'PENDING',
    "approvedAmount" DOUBLE PRECISION,
    "approvalNotes" TEXT,
    "rejectionReason" TEXT,
    "rejectionLetterUrl" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "holdReason" TEXT,
    "heldAt" TIMESTAMP(3),
    "heldById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalSuggestion" (
    "id" TEXT NOT NULL,
    "preAuthId" TEXT NOT NULL,
    "hospitalName" TEXT NOT NULL,
    "suggestedDoctor" TEXT,
    "tentativeBill" DOUBLE PRECISION,
    "roomRentGeneral" DOUBLE PRECISION,
    "roomRentSingle" DOUBLE PRECISION,
    "roomRentDeluxe" DOUBLE PRECISION,
    "roomRentSemiPrivate" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HospitalSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "relatedId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notice" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "targetType" "NoticeTargetType" NOT NULL,
    "targetDepartmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoticeRecipient" (
    "id" TEXT NOT NULL,
    "noticeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoticeRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MDApprovalRequest" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "amount" DOUBLE PRECISION,
    "attachments" JSONB,
    "status" "MDApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "respondedById" TEXT,
    "responseNote" TEXT,
    "respondedAt" TIMESTAMP(3),
    "financeAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "financeAcknowledgedById" TEXT,
    "financeAcknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MDApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserFeaturePermission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "grantedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserFeaturePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "ResourceType" NOT NULL,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionAssignment" (
    "id" TEXT NOT NULL,
    "subjectType" "SubjectType" NOT NULL DEFAULT 'USER',
    "userId" TEXT,
    "role" TEXT,
    "resourceId" TEXT NOT NULL,
    "permissionLevel" "PermissionLevel" NOT NULL DEFAULT 'NONE',
    "canGrant" BOOLEAN NOT NULL DEFAULT false,
    "grantedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PermissionAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionAuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "oldLevel" "PermissionLevel",
    "newLevel" "PermissionLevel",
    "oldCanGrant" BOOLEAN,
    "newCanGrant" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PermissionAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignCPL" (
    "id" TEXT NOT NULL,
    "campaignName" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "cpl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignCPL_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyCampaignSpend" (
    "id" TEXT NOT NULL,
    "campaignName" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "spend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyCampaignSpend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceQuery" (
    "id" TEXT NOT NULL,
    "preAuthorizationId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT,
    "status" "QueryStatus" NOT NULL DEFAULT 'PENDING',
    "raisedById" TEXT NOT NULL,
    "answeredById" TEXT,
    "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsuranceQuery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreAuthPDF" (
    "id" TEXT NOT NULL,
    "preAuthorizationId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "pdfUrl" TEXT NOT NULL,
    "recipients" JSONB,
    "sentAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PreAuthPDF_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionRecord" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "admissionDate" TIMESTAMP(3) NOT NULL,
    "admissionTime" TEXT NOT NULL,
    "admittingHospital" TEXT NOT NULL,
    "expectedSurgeryDate" TIMESTAMP(3),
    "surgeryDate" TIMESTAMP(3),
    "surgeryTime" TEXT,
    "hospitalAddress" TEXT,
    "googleMapLocation" TEXT,
    "tpa" TEXT,
    "instrument" TEXT,
    "implantConsumables" TEXT,
    "noMediendLogo" BOOLEAN NOT NULL DEFAULT false,
    "cabAdmissionPickupLocation" TEXT,
    "cabAdmissionPickupDateTime" TIMESTAMP(3),
    "cabAdmissionFrom" TEXT,
    "cabAdmissionTo" TEXT,
    "cabDischargePickupLocation" TEXT,
    "cabDischargePickupDateTime" TIMESTAMP(3),
    "cabDischargeFrom" TEXT,
    "cabDischargeTo" TEXT,
    "ipdStatus" "IpdStatus",
    "ipdStatusReason" TEXT,
    "newSurgeryDate" TIMESTAMP(3),
    "ipdDischargeDate" TIMESTAMP(3),
    "ipdStatusNotes" TEXT,
    "ipdStatusUpdatedAt" TIMESTAMP(3),
    "notes" TEXT,
    "initiatedById" TEXT NOT NULL,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdmissionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceInitiateForm" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "totalBillAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherReductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "copay" DOUBLE PRECISION,
    "copayBuffer" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deductible" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "exceedsPolicyLimit" TEXT,
    "policyDeductibleAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAuthorizedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amountToBePaidByInsurance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "roomCategory" TEXT,
    "initialApprovalByHospitalUrl" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsuranceInitiateForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseStageHistory" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "fromStage" "CaseStage",
    "toStage" "CaseStage" NOT NULL,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "CaseStageHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseChatMessage" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "senderId" TEXT,
    "type" "ChatMessageType" NOT NULL,
    "content" TEXT NOT NULL,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatReadReceipt" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatReadReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DischargeSheet" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "kypSubmissionId" TEXT,
    "month" TIMESTAMP(3),
    "dischargeDate" TIMESTAMP(3),
    "admissionDate" TIMESTAMP(3),
    "surgeryDate" TIMESTAMP(3),
    "status" TEXT,
    "paymentType" TEXT,
    "approvedOrCash" TEXT,
    "paymentCollectedAt" TEXT,
    "managerRole" TEXT,
    "managerName" TEXT,
    "bdmName" TEXT,
    "patientName" TEXT,
    "patientPhone" TEXT,
    "doctorName" TEXT,
    "hospitalName" TEXT,
    "category" TEXT,
    "treatment" TEXT,
    "circle" TEXT,
    "leadSource" TEXT,
    "tentativeAmount" DOUBLE PRECISION,
    "copayPct" DOUBLE PRECISION,
    "dischargeSummaryUrl" TEXT,
    "otNotesUrl" TEXT,
    "codesCount" INTEGER,
    "finalBillUrl" TEXT,
    "finalApprovedUrl" TEXT,
    "deductionReceiptUrl" TEXT,
    "settlementLetterUrl" TEXT,
    "roomRentAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pharmacyAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "investigationAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "consumablesAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "implantsAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "instrumentsAmount" DOUBLE PRECISION,
    "anesthesiaAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherChargesAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalFinalBill" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "finalApprovedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "finalAmount" DOUBLE PRECISION,
    "copayAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "collectedByHospital" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "collectedByMediend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "axisTariffDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "axisTariffDeductionPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualFinalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deductionAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "waivedOffAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "settlementPart" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tdsAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netSettlementAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "billAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashPaidByPatient" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashOrDedPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "referralAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cabCharges" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "implantCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "instrumentsCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "implantPaidBy" "PaidByParty",
    "instrumentsPaidBy" "PaidByParty",
    "dcCharges" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "doctorCharges" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hospitalSharePct" DOUBLE PRECISION,
    "hospitalShareAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mediendSharePct" DOUBLE PRECISION,
    "mediendShareAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mediendNetProfit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "packageText" TEXT,
    "othersText" TEXT,
    "otherCharges" TEXT,
    "packageAmount" TEXT,
    "staplerCharges" TEXT,
    "remarks" TEXT,
    "doctorRemarks" TEXT,
    "costBreakdownRemarks" TEXT,
    "isFinalized" BOOLEAN NOT NULL DEFAULT false,
    "markedById" TEXT,
    "markedAt" TIMESTAMP(3),
    "finalizedById" TEXT,
    "finalizedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "plRecordId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DischargeSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutstandingCase" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "srNo" INTEGER,
    "month" TIMESTAMP(3),
    "dos" TIMESTAMP(3),
    "status" TEXT,
    "paymentReceived" BOOLEAN NOT NULL DEFAULT false,
    "managerName" TEXT,
    "bdmName" TEXT,
    "patientName" TEXT,
    "treatment" TEXT,
    "hospitalName" TEXT,
    "billAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "settlementAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashPaidByPatient" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overallAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "implantCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dciCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hospitalSharePct" DOUBLE PRECISION,
    "hospitalShareAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mediendSharePct" DOUBLE PRECISION,
    "mediendShareAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "outstandingDays" INTEGER,
    "remarks" TEXT,
    "remark2" TEXT,
    "handledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutstandingCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentInstallment" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "recipient" "InstallmentRecipient" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paidOn" TIMESTAMP(3) NOT NULL,
    "mode" "InstallmentMode",
    "reference" TEXT,
    "notes" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceCall" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "status" "ComplianceCallStatus" NOT NULL DEFAULT 'PENDING',
    "rating" INTEGER,
    "notes" TEXT,
    "lastAttemptedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "callbackAt" TIMESTAMP(3),
    "calledByUserId" TEXT,
    "problemDuringSurgery" TEXT,
    "problemAfterSurgery" TEXT,
    "commitmentStatus" TEXT,
    "concernResolved" TEXT,
    "doctorBehaviour" TEXT,
    "hospitalStaffBehaviour" TEXT,
    "bdmBehaviour" TEXT,
    "mediendService" TEXT,
    "overallExperience" TEXT,
    "paymentQuery" TEXT,
    "referralConfirmation" TEXT,
    "referralName" TEXT,
    "referralContact" TEXT,
    "opdStatus" TEXT,
    "opdMode" TEXT,
    "additionalRemark" TEXT,
    "satisfaction" "SatisfactionLevel",
    "concernCategories" "ConcernCategory"[] DEFAULT ARRAY[]::"ConcernCategory"[],
    "reviewStatus" "ReviewStatus",
    "reviewScreenshot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesTeamCostEntry" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "entryType" "SalesTeamCostEntryType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "addedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesTeamCostEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeMonthlyIncentive" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "EmployeeIncentiveStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeMonthlyIncentive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeMasterSeatingCost" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeMasterSeatingCost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeMonthlySeatingMiscCost" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "seatingCost" DOUBLE PRECISION NOT NULL,
    "masterSeatingCostId" TEXT,
    "miscCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "EmployeeSeatingMiscCostStatus" NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeMonthlySeatingMiscCost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeMonthlySeatingMiscCostHistory" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "seatingCost" DOUBLE PRECISION NOT NULL,
    "miscCost" DOUBLE PRECISION NOT NULL,
    "status" "EmployeeSeatingMiscCostStatus" NOT NULL,
    "remarks" TEXT,
    "changedByUserId" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeMonthlySeatingMiscCostHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "assigneeId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "completedById" TEXT,
    "completedAt" TIMESTAMP(3),
    "grade" TEXT,
    "completionComments" TEXT,
    "rejectionCount" INTEGER NOT NULL DEFAULT 0,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "allDay" BOOLEAN NOT NULL DEFAULT true,
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskDueDateApproval" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "oldDueDate" TIMESTAMP(3),
    "newDueDate" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "status" "TaskApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskDueDateApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTaskSeen" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserTaskSeen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskRating" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "ratedById" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "comments" TEXT,
    "action" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskProject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskComment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskActivityLog" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warning" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "taskId" TEXT,
    "type" "WarningType" NOT NULL,
    "note" TEXT NOT NULL,
    "issuedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Warning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MDTaskTeam" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MDTaskTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MDTaskTeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MDTaskTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MDWatchlistEmployee" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MDWatchlistEmployee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkLog" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "logDate" TIMESTAMP(3) NOT NULL,
    "intervalStart" INTEGER NOT NULL,
    "intervalEnd" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CronJobLog" (
    "id" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "recordsProcessed" INTEGER,
    "message" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CronJobLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalMaster" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "googleMapLink" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorMaster" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TPAMaster" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TPAMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnesthesiaMaster" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnesthesiaMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceMaster" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsuranceMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreatmentMaster" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "atsNewDelhi" DOUBLE PRECISION,
    "atsMumbai" DOUBLE PRECISION,
    "atsPune" DOUBLE PRECISION,
    "atsHyderabad" DOUBLE PRECISION,
    "atsBangalore" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreatmentMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ITProject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientName" TEXT,
    "description" TEXT,
    "projectValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "billingType" "ITBillingType" NOT NULL DEFAULT 'MONTHLY',
    "monthlyBilling" DOUBLE PRECISION,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" "ITProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ITProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ITFreelancer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "skill" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ITFreelancer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ITProjectResource" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "resourceType" "ITResourceType" NOT NULL,
    "employeeId" TEXT,
    "freelancerId" TEXT,
    "allocationPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentType" "ITResourcePaymentType" NOT NULL DEFAULT 'MONTHLY',
    "monthlyCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "oneTimeCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "resourceName" TEXT,
    "seatCostApplied" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ITProjectResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ITProjectBooking" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ITProjectBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanDematVendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanDematVendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentRevenue" (
    "id" TEXT NOT NULL,
    "department" "RevenueDepartment" NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "description" TEXT,
    "notes" TEXT,
    "vendorId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepartmentRevenue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PnLCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PnLCategoryType" NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sourceKey" TEXT,
    "departmentKey" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PnLCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PnLConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PnLConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PnLEntry" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "isAutoFilled" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PnLEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TargetPnLEntry" (
    "id" TEXT NOT NULL,
    "departmentKey" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TargetPnLEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestLog" (
    "id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "status" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "userId" TEXT,
    "ip" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "UserStatus_userId_startsAt_endsAt_idx" ON "UserStatus"("userId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "UserStatus_startsAt_idx" ON "UserStatus"("startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_leadRef_key" ON "Lead"("leadRef");

-- CreateIndex
CREATE INDEX "Lead_bdId_idx" ON "Lead"("bdId");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "Lead_pipelineStage_idx" ON "Lead"("pipelineStage");

-- CreateIndex
CREATE INDEX "Lead_caseStage_idx" ON "Lead"("caseStage");

-- CreateIndex
CREATE INDEX "Lead_circle_idx" ON "Lead"("circle");

-- CreateIndex
CREATE INDEX "Lead_hospitalName_idx" ON "Lead"("hospitalName");

-- CreateIndex
CREATE INDEX "Lead_treatment_idx" ON "Lead"("treatment");

-- CreateIndex
CREATE INDEX "Lead_source_idx" ON "Lead"("source");

-- CreateIndex
CREATE INDEX "Lead_createdDate_idx" ON "Lead"("createdDate");

-- CreateIndex
CREATE INDEX "Lead_conversionDate_idx" ON "Lead"("conversionDate");

-- CreateIndex
CREATE INDEX "Lead_surgeryDate_idx" ON "Lead"("surgeryDate");

-- CreateIndex
CREATE INDEX "Lead_leadEntryDate_idx" ON "Lead"("leadEntryDate");

-- CreateIndex
CREATE INDEX "Lead_assignedDate_idx" ON "Lead"("assignedDate");

-- CreateIndex
CREATE INDEX "Lead_followUpDate_idx" ON "Lead"("followUpDate");

-- CreateIndex
CREATE INDEX "CallNote_leadId_idx" ON "CallNote"("leadId");

-- CreateIndex
CREATE INDEX "CallNote_createdAt_idx" ON "CallNote"("createdAt");

-- CreateIndex
CREATE INDEX "LeadStageEvent_leadId_idx" ON "LeadStageEvent"("leadId");

-- CreateIndex
CREATE INDEX "LeadStageEvent_changedAt_idx" ON "LeadStageEvent"("changedAt");

-- CreateIndex
CREATE INDEX "Target_targetType_targetForId_idx" ON "Target"("targetType", "targetForId");

-- CreateIndex
CREATE INDEX "Target_periodStartDate_periodEndDate_idx" ON "Target"("periodStartDate", "periodEndDate");

-- CreateIndex
CREATE INDEX "BonusRule_targetId_idx" ON "BonusRule"("targetId");

-- CreateIndex
CREATE UNIQUE INDEX "InsuranceCase_leadId_key" ON "InsuranceCase"("leadId");

-- CreateIndex
CREATE INDEX "InsuranceCase_leadId_idx" ON "InsuranceCase"("leadId");

-- CreateIndex
CREATE INDEX "InsuranceCase_caseStatus_idx" ON "InsuranceCase"("caseStatus");

-- CreateIndex
CREATE INDEX "InsuranceCase_submittedAt_idx" ON "InsuranceCase"("submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PLRecord_leadId_key" ON "PLRecord"("leadId");

-- CreateIndex
CREATE INDEX "PLRecord_leadId_idx" ON "PLRecord"("leadId");

-- CreateIndex
CREATE INDEX "PLRecord_closedAt_idx" ON "PLRecord"("closedAt");

-- CreateIndex
CREATE INDEX "PLRecord_month_idx" ON "PLRecord"("month");

-- CreateIndex
CREATE INDEX "PLRecord_surgeryDate_idx" ON "PLRecord"("surgeryDate");

-- CreateIndex
CREATE INDEX "PLRecord_status_idx" ON "PLRecord"("status");

-- CreateIndex
CREATE INDEX "IncomingLead_status_idx" ON "IncomingLead"("status");

-- CreateIndex
CREATE INDEX "IncomingLead_receivedAt_idx" ON "IncomingLead"("receivedAt");

-- CreateIndex
CREATE INDEX "Department_headId_idx" ON "Department"("headId");

-- CreateIndex
CREATE INDEX "Department_name_idx" ON "Department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentTeam_teamLeadId_key" ON "DepartmentTeam"("teamLeadId");

-- CreateIndex
CREATE INDEX "DepartmentTeam_departmentId_idx" ON "DepartmentTeam"("departmentId");

-- CreateIndex
CREATE INDEX "DepartmentTeam_teamLeadId_idx" ON "DepartmentTeam"("teamLeadId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeCode_key" ON "Employee"("employeeCode");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_bdNumber_key" ON "Employee"("bdNumber");

-- CreateIndex
CREATE INDEX "Employee_userId_idx" ON "Employee"("userId");

-- CreateIndex
CREATE INDEX "Employee_employeeCode_idx" ON "Employee"("employeeCode");

-- CreateIndex
CREATE INDEX "Employee_bdNumber_idx" ON "Employee"("bdNumber");

-- CreateIndex
CREATE INDEX "Employee_departmentId_idx" ON "Employee"("departmentId");

-- CreateIndex
CREATE INDEX "Employee_teamId_idx" ON "Employee"("teamId");

-- CreateIndex
CREATE INDEX "Employee_managerId_idx" ON "Employee"("managerId");

-- CreateIndex
CREATE INDEX "AttendanceLog_employeeId_idx" ON "AttendanceLog"("employeeId");

-- CreateIndex
CREATE INDEX "AttendanceLog_logDate_idx" ON "AttendanceLog"("logDate");

-- CreateIndex
CREATE INDEX "AttendanceLog_punchDirection_idx" ON "AttendanceLog"("punchDirection");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceLog_employeeId_logDate_punchDirection_key" ON "AttendanceLog"("employeeId", "logDate", "punchDirection");

-- CreateIndex
CREATE INDEX "AttendanceNormalization_employeeId_idx" ON "AttendanceNormalization"("employeeId");

-- CreateIndex
CREATE INDEX "AttendanceNormalization_approvedById_idx" ON "AttendanceNormalization"("approvedById");

-- CreateIndex
CREATE INDEX "AttendanceNormalization_requestedById_idx" ON "AttendanceNormalization"("requestedById");

-- CreateIndex
CREATE INDEX "AttendanceNormalization_managerApprovedById_idx" ON "AttendanceNormalization"("managerApprovedById");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceNormalization_employeeId_date_key" ON "AttendanceNormalization"("employeeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveTypeMaster_name_key" ON "LeaveTypeMaster"("name");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveTypeMaster_code_key" ON "LeaveTypeMaster"("code");

-- CreateIndex
CREATE INDEX "LeaveTypeMaster_name_idx" ON "LeaveTypeMaster"("name");

-- CreateIndex
CREATE INDEX "LeaveTypeMaster_code_idx" ON "LeaveTypeMaster"("code");

-- CreateIndex
CREATE INDEX "LeaveTypeMaster_isActive_idx" ON "LeaveTypeMaster"("isActive");

-- CreateIndex
CREATE INDEX "LeaveRequest_employeeId_idx" ON "LeaveRequest"("employeeId");

-- CreateIndex
CREATE INDEX "LeaveRequest_status_idx" ON "LeaveRequest"("status");

-- CreateIndex
CREATE INDEX "LeaveRequest_startDate_idx" ON "LeaveRequest"("startDate");

-- CreateIndex
CREATE INDEX "LeaveRequest_leaveTypeId_idx" ON "LeaveRequest"("leaveTypeId");

-- CreateIndex
CREATE INDEX "LeaveRequest_targetApproverId_idx" ON "LeaveRequest"("targetApproverId");

-- CreateIndex
CREATE INDEX "LeaveBalance_employeeId_idx" ON "LeaveBalance"("employeeId");

-- CreateIndex
CREATE INDEX "LeaveBalance_leaveTypeId_idx" ON "LeaveBalance"("leaveTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveBalance_employeeId_leaveTypeId_key" ON "LeaveBalance"("employeeId", "leaveTypeId");

-- CreateIndex
CREATE INDEX "LeaveBalanceEditRequest_employeeId_idx" ON "LeaveBalanceEditRequest"("employeeId");

-- CreateIndex
CREATE INDEX "LeaveBalanceEditRequest_status_idx" ON "LeaveBalanceEditRequest"("status");

-- CreateIndex
CREATE INDEX "LeaveBalanceEditRequest_createdAt_idx" ON "LeaveBalanceEditRequest"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_date_key" ON "Holiday"("date");

-- CreateIndex
CREATE INDEX "Holiday_date_idx" ON "Holiday"("date");

-- CreateIndex
CREATE INDEX "PayrollRecord_employeeId_idx" ON "PayrollRecord"("employeeId");

-- CreateIndex
CREATE INDEX "PayrollRecord_month_year_idx" ON "PayrollRecord"("month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRecord_employeeId_month_year_key" ON "PayrollRecord"("employeeId", "month", "year");

-- CreateIndex
CREATE INDEX "PayrollComponent_payrollRecordId_idx" ON "PayrollComponent"("payrollRecordId");

-- CreateIndex
CREATE INDEX "PayrollComponent_componentType_idx" ON "PayrollComponent"("componentType");

-- CreateIndex
CREATE INDEX "SalaryStructure_employeeId_idx" ON "SalaryStructure"("employeeId");

-- CreateIndex
CREATE INDEX "SalaryStructure_effectiveFrom_idx" ON "SalaryStructure"("effectiveFrom");

-- CreateIndex
CREATE INDEX "MonthlyPayroll_employeeId_idx" ON "MonthlyPayroll"("employeeId");

-- CreateIndex
CREATE INDEX "MonthlyPayroll_month_year_idx" ON "MonthlyPayroll"("month", "year");

-- CreateIndex
CREATE INDEX "MonthlyPayroll_status_idx" ON "MonthlyPayroll"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyPayroll_employeeId_month_year_key" ON "MonthlyPayroll"("employeeId", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeDocument_ackToken_key" ON "EmployeeDocument"("ackToken");

-- CreateIndex
CREATE INDEX "EmployeeDocument_employeeId_idx" ON "EmployeeDocument"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeDocument_documentType_idx" ON "EmployeeDocument"("documentType");

-- CreateIndex
CREATE INDEX "Feedback_employeeId_idx" ON "Feedback"("employeeId");

-- CreateIndex
CREATE INDEX "Feedback_status_idx" ON "Feedback"("status");

-- CreateIndex
CREATE INDEX "Feedback_createdAt_idx" ON "Feedback"("createdAt");

-- CreateIndex
CREATE INDEX "AnonymousMessage_isRead_idx" ON "AnonymousMessage"("isRead");

-- CreateIndex
CREATE INDEX "AnonymousMessage_createdAt_idx" ON "AnonymousMessage"("createdAt");

-- CreateIndex
CREATE INDEX "MDAppointment_employeeId_idx" ON "MDAppointment"("employeeId");

-- CreateIndex
CREATE INDEX "MDAppointment_status_idx" ON "MDAppointment"("status");

-- CreateIndex
CREATE INDEX "MDAppointment_createdAt_idx" ON "MDAppointment"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Meet_mdAppointmentId_key" ON "Meet"("mdAppointmentId");

-- CreateIndex
CREATE INDEX "Meet_scheduledAt_idx" ON "Meet"("scheduledAt");

-- CreateIndex
CREATE INDEX "Meet_module_idx" ON "Meet"("module");

-- CreateIndex
CREATE INDEX "Meet_createdById_idx" ON "Meet"("createdById");

-- CreateIndex
CREATE INDEX "MeetParticipant_userId_idx" ON "MeetParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetParticipant_meetId_userId_key" ON "MeetParticipant"("meetId", "userId");

-- CreateIndex
CREATE INDEX "MentalHealthRequest_employeeId_idx" ON "MentalHealthRequest"("employeeId");

-- CreateIndex
CREATE INDEX "MentalHealthRequest_status_idx" ON "MentalHealthRequest"("status");

-- CreateIndex
CREATE INDEX "MentalHealthRequest_createdAt_idx" ON "MentalHealthRequest"("createdAt");

-- CreateIndex
CREATE INDEX "SupportTicket_employeeId_idx" ON "SupportTicket"("employeeId");

-- CreateIndex
CREATE INDEX "SupportTicket_departmentId_idx" ON "SupportTicket"("departmentId");

-- CreateIndex
CREATE INDEX "SupportTicket_targetHeadRole_idx" ON "SupportTicket"("targetHeadRole");

-- CreateIndex
CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket"("status");

-- CreateIndex
CREATE INDEX "SupportTicket_priority_idx" ON "SupportTicket"("priority");

-- CreateIndex
CREATE INDEX "SupportTicket_createdAt_idx" ON "SupportTicket"("createdAt");

-- CreateIndex
CREATE INDEX "IncrementRequest_employeeId_idx" ON "IncrementRequest"("employeeId");

-- CreateIndex
CREATE INDEX "IncrementRequest_status_idx" ON "IncrementRequest"("status");

-- CreateIndex
CREATE INDEX "IncrementRequest_createdAt_idx" ON "IncrementRequest"("createdAt");

-- CreateIndex
CREATE INDEX "InternalJobPosting_isActive_idx" ON "InternalJobPosting"("isActive");

-- CreateIndex
CREATE INDEX "InternalJobPosting_createdAt_idx" ON "InternalJobPosting"("createdAt");

-- CreateIndex
CREATE INDEX "IJPApplication_postingId_idx" ON "IJPApplication"("postingId");

-- CreateIndex
CREATE INDEX "IJPApplication_referredById_idx" ON "IJPApplication"("referredById");

-- CreateIndex
CREATE INDEX "IJPApplication_status_idx" ON "IJPApplication"("status");

-- CreateIndex
CREATE INDEX "IJPApplication_createdAt_idx" ON "IJPApplication"("createdAt");

-- CreateIndex
CREATE INDEX "PartyMaster_name_idx" ON "PartyMaster"("name");

-- CreateIndex
CREATE INDEX "PartyMaster_partyType_idx" ON "PartyMaster"("partyType");

-- CreateIndex
CREATE INDEX "PartyMaster_isActive_idx" ON "PartyMaster"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "HeadMaster_name_key" ON "HeadMaster"("name");

-- CreateIndex
CREATE INDEX "HeadMaster_name_idx" ON "HeadMaster"("name");

-- CreateIndex
CREATE INDEX "HeadMaster_isActive_idx" ON "HeadMaster"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMaster_name_key" ON "ProjectMaster"("name");

-- CreateIndex
CREATE INDEX "ProjectMaster_name_idx" ON "ProjectMaster"("name");

-- CreateIndex
CREATE INDEX "ProjectMaster_isActive_idx" ON "ProjectMaster"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTypeMaster_name_key" ON "PaymentTypeMaster"("name");

-- CreateIndex
CREATE INDEX "PaymentTypeMaster_paymentType_idx" ON "PaymentTypeMaster"("paymentType");

-- CreateIndex
CREATE INDEX "PaymentTypeMaster_isActive_idx" ON "PaymentTypeMaster"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentModeMaster_name_key" ON "PaymentModeMaster"("name");

-- CreateIndex
CREATE INDEX "PaymentModeMaster_name_idx" ON "PaymentModeMaster"("name");

-- CreateIndex
CREATE INDEX "PaymentModeMaster_isActive_idx" ON "PaymentModeMaster"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_serialNumber_key" ON "LedgerEntry"("serialNumber");

-- CreateIndex
CREATE INDEX "LedgerEntry_serialNumber_idx" ON "LedgerEntry"("serialNumber");

-- CreateIndex
CREATE INDEX "LedgerEntry_transactionType_idx" ON "LedgerEntry"("transactionType");

-- CreateIndex
CREATE INDEX "LedgerEntry_transactionDate_idx" ON "LedgerEntry"("transactionDate");

-- CreateIndex
CREATE INDEX "LedgerEntry_partyId_idx" ON "LedgerEntry"("partyId");

-- CreateIndex
CREATE INDEX "LedgerEntry_headId_idx" ON "LedgerEntry"("headId");

-- CreateIndex
CREATE INDEX "LedgerEntry_paymentModeId_idx" ON "LedgerEntry"("paymentModeId");

-- CreateIndex
CREATE INDEX "LedgerEntry_fromPaymentModeId_idx" ON "LedgerEntry"("fromPaymentModeId");

-- CreateIndex
CREATE INDEX "LedgerEntry_toPaymentModeId_idx" ON "LedgerEntry"("toPaymentModeId");

-- CreateIndex
CREATE INDEX "LedgerEntry_status_idx" ON "LedgerEntry"("status");

-- CreateIndex
CREATE INDEX "LedgerEntry_createdById_idx" ON "LedgerEntry"("createdById");

-- CreateIndex
CREATE INDEX "LedgerEntry_isDeleted_idx" ON "LedgerEntry"("isDeleted");

-- CreateIndex
CREATE INDEX "LedgerEntry_editRequestStatus_idx" ON "LedgerEntry"("editRequestStatus");

-- CreateIndex
CREATE INDEX "LedgerEntry_deleteRequestStatus_idx" ON "LedgerEntry"("deleteRequestStatus");

-- CreateIndex
CREATE INDEX "LedgerAuditLog_ledgerEntryId_idx" ON "LedgerAuditLog"("ledgerEntryId");

-- CreateIndex
CREATE INDEX "LedgerAuditLog_action_idx" ON "LedgerAuditLog"("action");

-- CreateIndex
CREATE INDEX "LedgerAuditLog_performedAt_idx" ON "LedgerAuditLog"("performedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SalesEntry_serialNumber_key" ON "SalesEntry"("serialNumber");

-- CreateIndex
CREATE INDEX "SalesEntry_transactionDate_idx" ON "SalesEntry"("transactionDate");

-- CreateIndex
CREATE INDEX "SalesEntry_projectId_idx" ON "SalesEntry"("projectId");

-- CreateIndex
CREATE INDEX "SalesEntry_isDeleted_idx" ON "SalesEntry"("isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "LocationMaster_code_key" ON "LocationMaster"("code");

-- CreateIndex
CREATE INDEX "LocationMaster_code_idx" ON "LocationMaster"("code");

-- CreateIndex
CREATE INDEX "LocationMaster_type_idx" ON "LocationMaster"("type");

-- CreateIndex
CREATE INDEX "LocationMaster_parentId_idx" ON "LocationMaster"("parentId");

-- CreateIndex
CREATE INDEX "LocationMaster_isActive_idx" ON "LocationMaster"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ItemMaster_itemCode_key" ON "ItemMaster"("itemCode");

-- CreateIndex
CREATE INDEX "ItemMaster_itemCode_idx" ON "ItemMaster"("itemCode");

-- CreateIndex
CREATE INDEX "ItemMaster_name_idx" ON "ItemMaster"("name");

-- CreateIndex
CREATE INDEX "ItemMaster_supplierId_idx" ON "ItemMaster"("supplierId");

-- CreateIndex
CREATE INDEX "ItemMaster_locationId_idx" ON "ItemMaster"("locationId");

-- CreateIndex
CREATE INDEX "ItemMaster_isActive_idx" ON "ItemMaster"("isActive");

-- CreateIndex
CREATE INDEX "StockMovement_itemId_idx" ON "StockMovement"("itemId");

-- CreateIndex
CREATE INDEX "StockMovement_locationId_idx" ON "StockMovement"("locationId");

-- CreateIndex
CREATE INDEX "StockMovement_referenceId_idx" ON "StockMovement"("referenceId");

-- CreateIndex
CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseTransaction_purchaseNumber_key" ON "PurchaseTransaction"("purchaseNumber");

-- CreateIndex
CREATE INDEX "PurchaseTransaction_purchaseNumber_idx" ON "PurchaseTransaction"("purchaseNumber");

-- CreateIndex
CREATE INDEX "PurchaseTransaction_itemId_idx" ON "PurchaseTransaction"("itemId");

-- CreateIndex
CREATE INDEX "PurchaseTransaction_supplierId_idx" ON "PurchaseTransaction"("supplierId");

-- CreateIndex
CREATE INDEX "PurchaseTransaction_locationId_idx" ON "PurchaseTransaction"("locationId");

-- CreateIndex
CREATE INDEX "PurchaseTransaction_purchaseDate_idx" ON "PurchaseTransaction"("purchaseDate");

-- CreateIndex
CREATE INDEX "PurchaseTransaction_status_idx" ON "PurchaseTransaction"("status");

-- CreateIndex
CREATE UNIQUE INDEX "IssueTransaction_issueNumber_key" ON "IssueTransaction"("issueNumber");

-- CreateIndex
CREATE INDEX "IssueTransaction_issueNumber_idx" ON "IssueTransaction"("issueNumber");

-- CreateIndex
CREATE INDEX "IssueTransaction_itemId_idx" ON "IssueTransaction"("itemId");

-- CreateIndex
CREATE INDEX "IssueTransaction_locationId_idx" ON "IssueTransaction"("locationId");

-- CreateIndex
CREATE INDEX "IssueTransaction_issuedToId_idx" ON "IssueTransaction"("issuedToId");

-- CreateIndex
CREATE INDEX "IssueTransaction_issueDate_idx" ON "IssueTransaction"("issueDate");

-- CreateIndex
CREATE INDEX "IssueTransaction_status_idx" ON "IssueTransaction"("status");

-- CreateIndex
CREATE INDEX "LeadRemark_leadRef_idx" ON "LeadRemark"("leadRef");

-- CreateIndex
CREATE INDEX "LeadRemark_updateDate_idx" ON "LeadRemark"("updateDate");

-- CreateIndex
CREATE UNIQUE INDEX "SyncState_sourceType_key" ON "SyncState"("sourceType");

-- CreateIndex
CREATE UNIQUE INDEX "KYPSubmission_leadId_key" ON "KYPSubmission"("leadId");

-- CreateIndex
CREATE INDEX "KYPSubmission_leadId_idx" ON "KYPSubmission"("leadId");

-- CreateIndex
CREATE INDEX "KYPSubmission_status_idx" ON "KYPSubmission"("status");

-- CreateIndex
CREATE INDEX "KYPSubmission_submittedAt_idx" ON "KYPSubmission"("submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PreAuthorization_kypSubmissionId_key" ON "PreAuthorization"("kypSubmissionId");

-- CreateIndex
CREATE INDEX "PreAuthorization_kypSubmissionId_idx" ON "PreAuthorization"("kypSubmissionId");

-- CreateIndex
CREATE INDEX "PreAuthorization_preAuthRaisedById_idx" ON "PreAuthorization"("preAuthRaisedById");

-- CreateIndex
CREATE INDEX "HospitalSuggestion_preAuthId_idx" ON "HospitalSuggestion"("preAuthId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_isRead_idx" ON "Notification"("isRead");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "Notice_createdById_idx" ON "Notice"("createdById");

-- CreateIndex
CREATE INDEX "Notice_createdAt_idx" ON "Notice"("createdAt");

-- CreateIndex
CREATE INDEX "NoticeRecipient_noticeId_idx" ON "NoticeRecipient"("noticeId");

-- CreateIndex
CREATE INDEX "NoticeRecipient_userId_idx" ON "NoticeRecipient"("userId");

-- CreateIndex
CREATE INDEX "NoticeRecipient_acknowledgedAt_idx" ON "NoticeRecipient"("acknowledgedAt");

-- CreateIndex
CREATE UNIQUE INDEX "NoticeRecipient_noticeId_userId_key" ON "NoticeRecipient"("noticeId", "userId");

-- CreateIndex
CREATE INDEX "MDApprovalRequest_requestedById_idx" ON "MDApprovalRequest"("requestedById");

-- CreateIndex
CREATE INDEX "MDApprovalRequest_status_idx" ON "MDApprovalRequest"("status");

-- CreateIndex
CREATE INDEX "MDApprovalRequest_createdAt_idx" ON "MDApprovalRequest"("createdAt");

-- CreateIndex
CREATE INDEX "UserFeaturePermission_userId_idx" ON "UserFeaturePermission"("userId");

-- CreateIndex
CREATE INDEX "UserFeaturePermission_featureKey_idx" ON "UserFeaturePermission"("featureKey");

-- CreateIndex
CREATE UNIQUE INDEX "UserFeaturePermission_userId_featureKey_key" ON "UserFeaturePermission"("userId", "featureKey");

-- CreateIndex
CREATE UNIQUE INDEX "Resource_key_key" ON "Resource"("key");

-- CreateIndex
CREATE INDEX "PermissionAssignment_resourceId_idx" ON "PermissionAssignment"("resourceId");

-- CreateIndex
CREATE INDEX "PermissionAssignment_role_idx" ON "PermissionAssignment"("role");

-- CreateIndex
CREATE UNIQUE INDEX "PermissionAssignment_userId_resourceId_key" ON "PermissionAssignment"("userId", "resourceId");

-- CreateIndex
CREATE INDEX "CampaignCPL_year_month_idx" ON "CampaignCPL"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignCPL_campaignName_month_year_key" ON "CampaignCPL"("campaignName", "month", "year");

-- CreateIndex
CREATE INDEX "DailyCampaignSpend_date_idx" ON "DailyCampaignSpend"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyCampaignSpend_campaignName_date_key" ON "DailyCampaignSpend"("campaignName", "date");

-- CreateIndex
CREATE INDEX "InsuranceQuery_preAuthorizationId_idx" ON "InsuranceQuery"("preAuthorizationId");

-- CreateIndex
CREATE INDEX "InsuranceQuery_status_idx" ON "InsuranceQuery"("status");

-- CreateIndex
CREATE INDEX "InsuranceQuery_raisedAt_idx" ON "InsuranceQuery"("raisedAt");

-- CreateIndex
CREATE INDEX "PreAuthPDF_preAuthorizationId_idx" ON "PreAuthPDF"("preAuthorizationId");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionRecord_leadId_key" ON "AdmissionRecord"("leadId");

-- CreateIndex
CREATE INDEX "AdmissionRecord_leadId_idx" ON "AdmissionRecord"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "InsuranceInitiateForm_leadId_key" ON "InsuranceInitiateForm"("leadId");

-- CreateIndex
CREATE INDEX "InsuranceInitiateForm_leadId_idx" ON "InsuranceInitiateForm"("leadId");

-- CreateIndex
CREATE INDEX "CaseStageHistory_leadId_idx" ON "CaseStageHistory"("leadId");

-- CreateIndex
CREATE INDEX "CaseStageHistory_changedAt_idx" ON "CaseStageHistory"("changedAt");

-- CreateIndex
CREATE INDEX "CaseChatMessage_leadId_createdAt_idx" ON "CaseChatMessage"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatReadReceipt_userId_idx" ON "ChatReadReceipt"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatReadReceipt_leadId_userId_key" ON "ChatReadReceipt"("leadId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "DischargeSheet_leadId_key" ON "DischargeSheet"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "DischargeSheet_kypSubmissionId_key" ON "DischargeSheet"("kypSubmissionId");

-- CreateIndex
CREATE UNIQUE INDEX "DischargeSheet_plRecordId_key" ON "DischargeSheet"("plRecordId");

-- CreateIndex
CREATE INDEX "DischargeSheet_leadId_idx" ON "DischargeSheet"("leadId");

-- CreateIndex
CREATE INDEX "DischargeSheet_kypSubmissionId_idx" ON "DischargeSheet"("kypSubmissionId");

-- CreateIndex
CREATE INDEX "DischargeSheet_month_idx" ON "DischargeSheet"("month");

-- CreateIndex
CREATE INDEX "DischargeSheet_surgeryDate_idx" ON "DischargeSheet"("surgeryDate");

-- CreateIndex
CREATE INDEX "DischargeSheet_status_idx" ON "DischargeSheet"("status");

-- CreateIndex
CREATE INDEX "DischargeSheet_isFinalized_idx" ON "DischargeSheet"("isFinalized");

-- CreateIndex
CREATE UNIQUE INDEX "OutstandingCase_leadId_key" ON "OutstandingCase"("leadId");

-- CreateIndex
CREATE INDEX "OutstandingCase_leadId_idx" ON "OutstandingCase"("leadId");

-- CreateIndex
CREATE INDEX "OutstandingCase_month_idx" ON "OutstandingCase"("month");

-- CreateIndex
CREATE INDEX "OutstandingCase_dos_idx" ON "OutstandingCase"("dos");

-- CreateIndex
CREATE INDEX "OutstandingCase_status_idx" ON "OutstandingCase"("status");

-- CreateIndex
CREATE INDEX "OutstandingCase_paymentReceived_idx" ON "OutstandingCase"("paymentReceived");

-- CreateIndex
CREATE INDEX "PaymentInstallment_leadId_idx" ON "PaymentInstallment"("leadId");

-- CreateIndex
CREATE INDEX "PaymentInstallment_recipient_idx" ON "PaymentInstallment"("recipient");

-- CreateIndex
CREATE INDEX "PaymentInstallment_paidOn_idx" ON "PaymentInstallment"("paidOn");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceCall_leadId_key" ON "ComplianceCall"("leadId");

-- CreateIndex
CREATE INDEX "ComplianceCall_status_idx" ON "ComplianceCall"("status");

-- CreateIndex
CREATE INDEX "ComplianceCall_createdAt_idx" ON "ComplianceCall"("createdAt");

-- CreateIndex
CREATE INDEX "ComplianceCall_rating_idx" ON "ComplianceCall"("rating");

-- CreateIndex
CREATE INDEX "ComplianceCall_completedAt_idx" ON "ComplianceCall"("completedAt");

-- CreateIndex
CREATE INDEX "ComplianceCall_satisfaction_idx" ON "ComplianceCall"("satisfaction");

-- CreateIndex
CREATE INDEX "ComplianceCall_reviewStatus_idx" ON "ComplianceCall"("reviewStatus");

-- CreateIndex
CREATE INDEX "SalesTeamCostEntry_employeeId_entryType_idx" ON "SalesTeamCostEntry"("employeeId", "entryType");

-- CreateIndex
CREATE INDEX "SalesTeamCostEntry_entryDate_idx" ON "SalesTeamCostEntry"("entryDate");

-- CreateIndex
CREATE INDEX "EmployeeMonthlyIncentive_month_year_idx" ON "EmployeeMonthlyIncentive"("month", "year");

-- CreateIndex
CREATE INDEX "EmployeeMonthlyIncentive_status_idx" ON "EmployeeMonthlyIncentive"("status");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeMonthlyIncentive_employeeId_month_year_key" ON "EmployeeMonthlyIncentive"("employeeId", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeMasterSeatingCost_employeeId_key" ON "EmployeeMasterSeatingCost"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeMasterSeatingCost_updatedAt_idx" ON "EmployeeMasterSeatingCost"("updatedAt");

-- CreateIndex
CREATE INDEX "EmployeeMonthlySeatingMiscCost_month_year_idx" ON "EmployeeMonthlySeatingMiscCost"("month", "year");

-- CreateIndex
CREATE INDEX "EmployeeMonthlySeatingMiscCost_status_idx" ON "EmployeeMonthlySeatingMiscCost"("status");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeMonthlySeatingMiscCost_employeeId_month_year_key" ON "EmployeeMonthlySeatingMiscCost"("employeeId", "month", "year");

-- CreateIndex
CREATE INDEX "EmployeeMonthlySeatingMiscCostHistory_recordId_changedAt_idx" ON "EmployeeMonthlySeatingMiscCostHistory"("recordId", "changedAt");

-- CreateIndex
CREATE INDEX "Task_assigneeId_idx" ON "Task"("assigneeId");

-- CreateIndex
CREATE INDEX "Task_createdById_idx" ON "Task"("createdById");

-- CreateIndex
CREATE INDEX "Task_completedById_idx" ON "Task"("completedById");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- CreateIndex
CREATE INDEX "Task_dueDate_idx" ON "Task"("dueDate");

-- CreateIndex
CREATE INDEX "Task_projectId_idx" ON "Task"("projectId");

-- CreateIndex
CREATE INDEX "TaskDueDateApproval_taskId_idx" ON "TaskDueDateApproval"("taskId");

-- CreateIndex
CREATE INDEX "TaskDueDateApproval_requestedById_idx" ON "TaskDueDateApproval"("requestedById");

-- CreateIndex
CREATE INDEX "TaskDueDateApproval_status_idx" ON "TaskDueDateApproval"("status");

-- CreateIndex
CREATE INDEX "UserTaskSeen_userId_idx" ON "UserTaskSeen"("userId");

-- CreateIndex
CREATE INDEX "UserTaskSeen_taskId_idx" ON "UserTaskSeen"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "UserTaskSeen_userId_taskId_key" ON "UserTaskSeen"("userId", "taskId");

-- CreateIndex
CREATE INDEX "TaskRating_employeeId_month_idx" ON "TaskRating"("employeeId", "month");

-- CreateIndex
CREATE INDEX "TaskRating_taskId_idx" ON "TaskRating"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskProject_name_key" ON "TaskProject"("name");

-- CreateIndex
CREATE INDEX "TaskProject_createdById_idx" ON "TaskProject"("createdById");

-- CreateIndex
CREATE INDEX "TaskComment_taskId_idx" ON "TaskComment"("taskId");

-- CreateIndex
CREATE INDEX "TaskComment_userId_idx" ON "TaskComment"("userId");

-- CreateIndex
CREATE INDEX "TaskComment_parentId_idx" ON "TaskComment"("parentId");

-- CreateIndex
CREATE INDEX "TaskActivityLog_taskId_idx" ON "TaskActivityLog"("taskId");

-- CreateIndex
CREATE INDEX "TaskActivityLog_userId_idx" ON "TaskActivityLog"("userId");

-- CreateIndex
CREATE INDEX "Warning_employeeId_idx" ON "Warning"("employeeId");

-- CreateIndex
CREATE INDEX "Warning_taskId_idx" ON "Warning"("taskId");

-- CreateIndex
CREATE INDEX "Warning_issuedById_idx" ON "Warning"("issuedById");

-- CreateIndex
CREATE INDEX "MDTaskTeam_ownerId_idx" ON "MDTaskTeam"("ownerId");

-- CreateIndex
CREATE INDEX "MDTaskTeamMember_teamId_idx" ON "MDTaskTeamMember"("teamId");

-- CreateIndex
CREATE INDEX "MDTaskTeamMember_employeeId_idx" ON "MDTaskTeamMember"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "MDTaskTeamMember_teamId_employeeId_key" ON "MDTaskTeamMember"("teamId", "employeeId");

-- CreateIndex
CREATE INDEX "MDWatchlistEmployee_ownerId_idx" ON "MDWatchlistEmployee"("ownerId");

-- CreateIndex
CREATE INDEX "MDWatchlistEmployee_employeeId_idx" ON "MDWatchlistEmployee"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "MDWatchlistEmployee_ownerId_employeeId_key" ON "MDWatchlistEmployee"("ownerId", "employeeId");

-- CreateIndex
CREATE INDEX "WorkLog_employeeId_idx" ON "WorkLog"("employeeId");

-- CreateIndex
CREATE INDEX "WorkLog_logDate_idx" ON "WorkLog"("logDate");

-- CreateIndex
CREATE UNIQUE INDEX "WorkLog_employeeId_logDate_intervalStart_key" ON "WorkLog"("employeeId", "logDate", "intervalStart");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_userId_endpoint_key" ON "PushSubscription"("userId", "endpoint");

-- CreateIndex
CREATE INDEX "CronJobLog_jobName_createdAt_idx" ON "CronJobLog"("jobName", "createdAt");

-- CreateIndex
CREATE INDEX "CronJobLog_createdAt_idx" ON "CronJobLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "HospitalMaster_name_key" ON "HospitalMaster"("name");

-- CreateIndex
CREATE INDEX "HospitalMaster_name_idx" ON "HospitalMaster"("name");

-- CreateIndex
CREATE INDEX "HospitalMaster_isActive_idx" ON "HospitalMaster"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorMaster_name_key" ON "DoctorMaster"("name");

-- CreateIndex
CREATE INDEX "DoctorMaster_name_idx" ON "DoctorMaster"("name");

-- CreateIndex
CREATE INDEX "DoctorMaster_isActive_idx" ON "DoctorMaster"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TPAMaster_name_key" ON "TPAMaster"("name");

-- CreateIndex
CREATE INDEX "TPAMaster_name_idx" ON "TPAMaster"("name");

-- CreateIndex
CREATE INDEX "TPAMaster_isActive_idx" ON "TPAMaster"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AnesthesiaMaster_name_key" ON "AnesthesiaMaster"("name");

-- CreateIndex
CREATE INDEX "AnesthesiaMaster_name_idx" ON "AnesthesiaMaster"("name");

-- CreateIndex
CREATE INDEX "AnesthesiaMaster_isActive_idx" ON "AnesthesiaMaster"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "InsuranceMaster_name_key" ON "InsuranceMaster"("name");

-- CreateIndex
CREATE INDEX "InsuranceMaster_name_idx" ON "InsuranceMaster"("name");

-- CreateIndex
CREATE INDEX "InsuranceMaster_isActive_idx" ON "InsuranceMaster"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TreatmentMaster_name_key" ON "TreatmentMaster"("name");

-- CreateIndex
CREATE INDEX "TreatmentMaster_name_idx" ON "TreatmentMaster"("name");

-- CreateIndex
CREATE INDEX "TreatmentMaster_category_idx" ON "TreatmentMaster"("category");

-- CreateIndex
CREATE INDEX "TreatmentMaster_isActive_idx" ON "TreatmentMaster"("isActive");

-- CreateIndex
CREATE INDEX "ITProject_status_idx" ON "ITProject"("status");

-- CreateIndex
CREATE INDEX "ITProject_createdById_idx" ON "ITProject"("createdById");

-- CreateIndex
CREATE INDEX "ITFreelancer_isActive_idx" ON "ITFreelancer"("isActive");

-- CreateIndex
CREATE INDEX "ITFreelancer_createdById_idx" ON "ITFreelancer"("createdById");

-- CreateIndex
CREATE INDEX "ITProjectResource_projectId_idx" ON "ITProjectResource"("projectId");

-- CreateIndex
CREATE INDEX "ITProjectResource_employeeId_idx" ON "ITProjectResource"("employeeId");

-- CreateIndex
CREATE INDEX "ITProjectResource_freelancerId_idx" ON "ITProjectResource"("freelancerId");

-- CreateIndex
CREATE INDEX "ITProjectBooking_month_year_idx" ON "ITProjectBooking"("month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "ITProjectBooking_projectId_month_year_key" ON "ITProjectBooking"("projectId", "month", "year");

-- CreateIndex
CREATE INDEX "LoanDematVendor_isActive_sortOrder_name_idx" ON "LoanDematVendor"("isActive", "sortOrder", "name");

-- CreateIndex
CREATE INDEX "DepartmentRevenue_department_month_year_idx" ON "DepartmentRevenue"("department", "month", "year");

-- CreateIndex
CREATE INDEX "DepartmentRevenue_department_vendorId_month_year_idx" ON "DepartmentRevenue"("department", "vendorId", "month", "year");

-- CreateIndex
CREATE INDEX "PnLCategory_type_idx" ON "PnLCategory"("type");

-- CreateIndex
CREATE INDEX "PnLCategory_isActive_idx" ON "PnLCategory"("isActive");

-- CreateIndex
CREATE INDEX "PnLCategory_departmentKey_idx" ON "PnLCategory"("departmentKey");

-- CreateIndex
CREATE UNIQUE INDEX "PnLCategory_sourceKey_departmentKey_key" ON "PnLCategory"("sourceKey", "departmentKey");

-- CreateIndex
CREATE UNIQUE INDEX "PnLConfig_key_key" ON "PnLConfig"("key");

-- CreateIndex
CREATE INDEX "PnLEntry_month_year_idx" ON "PnLEntry"("month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "PnLEntry_categoryId_month_year_key" ON "PnLEntry"("categoryId", "month", "year");

-- CreateIndex
CREATE INDEX "TargetPnLEntry_month_year_idx" ON "TargetPnLEntry"("month", "year");

-- CreateIndex
CREATE INDEX "TargetPnLEntry_departmentKey_idx" ON "TargetPnLEntry"("departmentKey");

-- CreateIndex
CREATE UNIQUE INDEX "TargetPnLEntry_departmentKey_sourceKey_month_year_key" ON "TargetPnLEntry"("departmentKey", "sourceKey", "month", "year");

-- CreateIndex
CREATE INDEX "RequestLog_createdAt_idx" ON "RequestLog"("createdAt");

-- CreateIndex
CREATE INDEX "RequestLog_status_createdAt_idx" ON "RequestLog"("status", "createdAt");

-- CreateIndex
CREATE INDEX "RequestLog_path_createdAt_idx" ON "RequestLog"("path", "createdAt");

-- AddForeignKey
ALTER TABLE "UserStatus" ADD CONSTRAINT "UserStatus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_bdId_fkey" FOREIGN KEY ("bdId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_treatmentMasterId_fkey" FOREIGN KEY ("treatmentMasterId") REFERENCES "TreatmentMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallNote" ADD CONSTRAINT "CallNote_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallNote" ADD CONSTRAINT "CallNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadStageEvent" ADD CONSTRAINT "LeadStageEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadStageEvent" ADD CONSTRAINT "LeadStageEvent_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Target" ADD CONSTRAINT "Target_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonusRule" ADD CONSTRAINT "BonusRule_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Target"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceCase" ADD CONSTRAINT "InsuranceCase_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceCase" ADD CONSTRAINT "InsuranceCase_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PLRecord" ADD CONSTRAINT "PLRecord_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PLRecord" ADD CONSTRAINT "PLRecord_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_headId_fkey" FOREIGN KEY ("headId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentTeam" ADD CONSTRAINT "DepartmentTeam_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentTeam" ADD CONSTRAINT "DepartmentTeam_teamLeadId_fkey" FOREIGN KEY ("teamLeadId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "DepartmentTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_fnfCompletedById_fkey" FOREIGN KEY ("fnfCompletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceLog" ADD CONSTRAINT "AttendanceLog_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceNormalization" ADD CONSTRAINT "AttendanceNormalization_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceNormalization" ADD CONSTRAINT "AttendanceNormalization_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceNormalization" ADD CONSTRAINT "AttendanceNormalization_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceNormalization" ADD CONSTRAINT "AttendanceNormalization_managerApprovedById_fkey" FOREIGN KEY ("managerApprovedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveTypeMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_targetApproverId_fkey" FOREIGN KEY ("targetApproverId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveTypeMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveBalanceEditRequest" ADD CONSTRAINT "LeaveBalanceEditRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveBalanceEditRequest" ADD CONSTRAINT "LeaveBalanceEditRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveBalanceEditRequest" ADD CONSTRAINT "LeaveBalanceEditRequest_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRecord" ADD CONSTRAINT "PayrollRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollComponent" ADD CONSTRAINT "PayrollComponent_payrollRecordId_fkey" FOREIGN KEY ("payrollRecordId") REFERENCES "PayrollRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryStructure" ADD CONSTRAINT "SalaryStructure_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyPayroll" ADD CONSTRAINT "MonthlyPayroll_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDocument" ADD CONSTRAINT "EmployeeDocument_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MDAppointment" ADD CONSTRAINT "MDAppointment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meet" ADD CONSTRAINT "Meet_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meet" ADD CONSTRAINT "Meet_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meet" ADD CONSTRAINT "Meet_mdAppointmentId_fkey" FOREIGN KEY ("mdAppointmentId") REFERENCES "MDAppointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetParticipant" ADD CONSTRAINT "MeetParticipant_meetId_fkey" FOREIGN KEY ("meetId") REFERENCES "Meet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetParticipant" ADD CONSTRAINT "MeetParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentalHealthRequest" ADD CONSTRAINT "MentalHealthRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncrementRequest" ADD CONSTRAINT "IncrementRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IJPApplication" ADD CONSTRAINT "IJPApplication_postingId_fkey" FOREIGN KEY ("postingId") REFERENCES "InternalJobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IJPApplication" ADD CONSTRAINT "IJPApplication_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "PartyMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_headId_fkey" FOREIGN KEY ("headId") REFERENCES "HeadMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_paymentTypeId_fkey" FOREIGN KEY ("paymentTypeId") REFERENCES "PaymentTypeMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_paymentModeId_fkey" FOREIGN KEY ("paymentModeId") REFERENCES "PaymentModeMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_fromPaymentModeId_fkey" FOREIGN KEY ("fromPaymentModeId") REFERENCES "PaymentModeMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_toPaymentModeId_fkey" FOREIGN KEY ("toPaymentModeId") REFERENCES "PaymentModeMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_deleteRequestedById_fkey" FOREIGN KEY ("deleteRequestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_deleteApprovedById_fkey" FOREIGN KEY ("deleteApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_editRequestedById_fkey" FOREIGN KEY ("editRequestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_editApprovedById_fkey" FOREIGN KEY ("editApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerAuditLog" ADD CONSTRAINT "LedgerAuditLog_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "LedgerEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerAuditLog" ADD CONSTRAINT "LedgerAuditLog_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesEntry" ADD CONSTRAINT "SalesEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ProjectMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesEntry" ADD CONSTRAINT "SalesEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationMaster" ADD CONSTRAINT "LocationMaster_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "LocationMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemMaster" ADD CONSTRAINT "ItemMaster_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "PartyMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemMaster" ADD CONSTRAINT "ItemMaster_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "LocationMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ItemMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "LocationMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseTransaction" ADD CONSTRAINT "PurchaseTransaction_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ItemMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseTransaction" ADD CONSTRAINT "PurchaseTransaction_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "PartyMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseTransaction" ADD CONSTRAINT "PurchaseTransaction_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "LocationMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseTransaction" ADD CONSTRAINT "PurchaseTransaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueTransaction" ADD CONSTRAINT "IssueTransaction_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ItemMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueTransaction" ADD CONSTRAINT "IssueTransaction_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "LocationMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueTransaction" ADD CONSTRAINT "IssueTransaction_issuedToId_fkey" FOREIGN KEY ("issuedToId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueTransaction" ADD CONSTRAINT "IssueTransaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KYPSubmission" ADD CONSTRAINT "KYPSubmission_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KYPSubmission" ADD CONSTRAINT "KYPSubmission_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreAuthorization" ADD CONSTRAINT "PreAuthorization_kypSubmissionId_fkey" FOREIGN KEY ("kypSubmissionId") REFERENCES "KYPSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreAuthorization" ADD CONSTRAINT "PreAuthorization_preAuthRaisedById_fkey" FOREIGN KEY ("preAuthRaisedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreAuthorization" ADD CONSTRAINT "PreAuthorization_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreAuthorization" ADD CONSTRAINT "PreAuthorization_heldById_fkey" FOREIGN KEY ("heldById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalSuggestion" ADD CONSTRAINT "HospitalSuggestion_preAuthId_fkey" FOREIGN KEY ("preAuthId") REFERENCES "PreAuthorization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notice" ADD CONSTRAINT "Notice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notice" ADD CONSTRAINT "Notice_targetDepartmentId_fkey" FOREIGN KEY ("targetDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoticeRecipient" ADD CONSTRAINT "NoticeRecipient_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "Notice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoticeRecipient" ADD CONSTRAINT "NoticeRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MDApprovalRequest" ADD CONSTRAINT "MDApprovalRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MDApprovalRequest" ADD CONSTRAINT "MDApprovalRequest_respondedById_fkey" FOREIGN KEY ("respondedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MDApprovalRequest" ADD CONSTRAINT "MDApprovalRequest_financeAcknowledgedById_fkey" FOREIGN KEY ("financeAcknowledgedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFeaturePermission" ADD CONSTRAINT "UserFeaturePermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFeaturePermission" ADD CONSTRAINT "UserFeaturePermission_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionAssignment" ADD CONSTRAINT "PermissionAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionAssignment" ADD CONSTRAINT "PermissionAssignment_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionAssignment" ADD CONSTRAINT "PermissionAssignment_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignCPL" ADD CONSTRAINT "CampaignCPL_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyCampaignSpend" ADD CONSTRAINT "DailyCampaignSpend_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceQuery" ADD CONSTRAINT "InsuranceQuery_preAuthorizationId_fkey" FOREIGN KEY ("preAuthorizationId") REFERENCES "PreAuthorization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceQuery" ADD CONSTRAINT "InsuranceQuery_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceQuery" ADD CONSTRAINT "InsuranceQuery_answeredById_fkey" FOREIGN KEY ("answeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreAuthPDF" ADD CONSTRAINT "PreAuthPDF_preAuthorizationId_fkey" FOREIGN KEY ("preAuthorizationId") REFERENCES "PreAuthorization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreAuthPDF" ADD CONSTRAINT "PreAuthPDF_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionRecord" ADD CONSTRAINT "AdmissionRecord_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionRecord" ADD CONSTRAINT "AdmissionRecord_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceInitiateForm" ADD CONSTRAINT "InsuranceInitiateForm_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceInitiateForm" ADD CONSTRAINT "InsuranceInitiateForm_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseStageHistory" ADD CONSTRAINT "CaseStageHistory_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseStageHistory" ADD CONSTRAINT "CaseStageHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseChatMessage" ADD CONSTRAINT "CaseChatMessage_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseChatMessage" ADD CONSTRAINT "CaseChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatReadReceipt" ADD CONSTRAINT "ChatReadReceipt_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatReadReceipt" ADD CONSTRAINT "ChatReadReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DischargeSheet" ADD CONSTRAINT "DischargeSheet_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DischargeSheet" ADD CONSTRAINT "DischargeSheet_kypSubmissionId_fkey" FOREIGN KEY ("kypSubmissionId") REFERENCES "KYPSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DischargeSheet" ADD CONSTRAINT "DischargeSheet_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DischargeSheet" ADD CONSTRAINT "DischargeSheet_finalizedById_fkey" FOREIGN KEY ("finalizedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DischargeSheet" ADD CONSTRAINT "DischargeSheet_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DischargeSheet" ADD CONSTRAINT "DischargeSheet_plRecordId_fkey" FOREIGN KEY ("plRecordId") REFERENCES "PLRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutstandingCase" ADD CONSTRAINT "OutstandingCase_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutstandingCase" ADD CONSTRAINT "OutstandingCase_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentInstallment" ADD CONSTRAINT "PaymentInstallment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentInstallment" ADD CONSTRAINT "PaymentInstallment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceCall" ADD CONSTRAINT "ComplianceCall_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceCall" ADD CONSTRAINT "ComplianceCall_calledByUserId_fkey" FOREIGN KEY ("calledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesTeamCostEntry" ADD CONSTRAINT "SalesTeamCostEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesTeamCostEntry" ADD CONSTRAINT "SalesTeamCostEntry_addedByUserId_fkey" FOREIGN KEY ("addedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeMonthlyIncentive" ADD CONSTRAINT "EmployeeMonthlyIncentive_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeMonthlyIncentive" ADD CONSTRAINT "EmployeeMonthlyIncentive_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeMonthlyIncentive" ADD CONSTRAINT "EmployeeMonthlyIncentive_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeMasterSeatingCost" ADD CONSTRAINT "EmployeeMasterSeatingCost_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeMasterSeatingCost" ADD CONSTRAINT "EmployeeMasterSeatingCost_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeMasterSeatingCost" ADD CONSTRAINT "EmployeeMasterSeatingCost_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeMonthlySeatingMiscCost" ADD CONSTRAINT "EmployeeMonthlySeatingMiscCost_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeMonthlySeatingMiscCost" ADD CONSTRAINT "EmployeeMonthlySeatingMiscCost_masterSeatingCostId_fkey" FOREIGN KEY ("masterSeatingCostId") REFERENCES "EmployeeMasterSeatingCost"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeMonthlySeatingMiscCost" ADD CONSTRAINT "EmployeeMonthlySeatingMiscCost_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeMonthlySeatingMiscCost" ADD CONSTRAINT "EmployeeMonthlySeatingMiscCost_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeMonthlySeatingMiscCostHistory" ADD CONSTRAINT "EmployeeMonthlySeatingMiscCostHistory_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "EmployeeMonthlySeatingMiscCost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeMonthlySeatingMiscCostHistory" ADD CONSTRAINT "EmployeeMonthlySeatingMiscCostHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "TaskProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDueDateApproval" ADD CONSTRAINT "TaskDueDateApproval_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDueDateApproval" ADD CONSTRAINT "TaskDueDateApproval_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTaskSeen" ADD CONSTRAINT "UserTaskSeen_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTaskSeen" ADD CONSTRAINT "UserTaskSeen_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskRating" ADD CONSTRAINT "TaskRating_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskRating" ADD CONSTRAINT "TaskRating_ratedById_fkey" FOREIGN KEY ("ratedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskRating" ADD CONSTRAINT "TaskRating_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskProject" ADD CONSTRAINT "TaskProject_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "TaskComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskActivityLog" ADD CONSTRAINT "TaskActivityLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskActivityLog" ADD CONSTRAINT "TaskActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warning" ADD CONSTRAINT "Warning_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warning" ADD CONSTRAINT "Warning_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warning" ADD CONSTRAINT "Warning_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MDTaskTeam" ADD CONSTRAINT "MDTaskTeam_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MDTaskTeamMember" ADD CONSTRAINT "MDTaskTeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "MDTaskTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MDTaskTeamMember" ADD CONSTRAINT "MDTaskTeamMember_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MDWatchlistEmployee" ADD CONSTRAINT "MDWatchlistEmployee_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MDWatchlistEmployee" ADD CONSTRAINT "MDWatchlistEmployee_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkLog" ADD CONSTRAINT "WorkLog_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ITProject" ADD CONSTRAINT "ITProject_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ITFreelancer" ADD CONSTRAINT "ITFreelancer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ITProjectResource" ADD CONSTRAINT "ITProjectResource_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ITProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ITProjectResource" ADD CONSTRAINT "ITProjectResource_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ITProjectResource" ADD CONSTRAINT "ITProjectResource_freelancerId_fkey" FOREIGN KEY ("freelancerId") REFERENCES "ITFreelancer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ITProjectBooking" ADD CONSTRAINT "ITProjectBooking_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ITProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ITProjectBooking" ADD CONSTRAINT "ITProjectBooking_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentRevenue" ADD CONSTRAINT "DepartmentRevenue_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "LoanDematVendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentRevenue" ADD CONSTRAINT "DepartmentRevenue_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PnLCategory" ADD CONSTRAINT "PnLCategory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PnLEntry" ADD CONSTRAINT "PnLEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "PnLCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PnLEntry" ADD CONSTRAINT "PnLEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TargetPnLEntry" ADD CONSTRAINT "TargetPnLEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
