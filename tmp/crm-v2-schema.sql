--
-- PostgreSQL database dump
--

\restrict g9iUXlLJLZgbWHs5pabY8S5ghk6EWSyqeyuzwFzk1W2ekiqGInknatlgHc2zyZS

-- Dumped from database version 16.15
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA crm_v2;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA crm_v2 IS 'standard public schema';


--
-- Name: ATSStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."ATSStatus" AS ENUM (
    'ABOVE_ATS',
    'BELOW_ATS',
    'NO_ATS'
);


--
-- Name: ApplicationStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."ApplicationStatus" AS ENUM (
    'PENDING',
    'SHORTLISTED',
    'REJECTED',
    'HIRED'
);


--
-- Name: AppointmentStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."AppointmentStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'COMPLETED'
);


--
-- Name: BonusRuleType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."BonusRuleType" AS ENUM (
    'PERCENT_ABOVE_TARGET',
    'FIXED_COUNT'
);


--
-- Name: CaseStage; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."CaseStage" AS ENUM (
    'NEW_LEAD',
    'KYP_BASIC_COMPLETE',
    'HOSPITALS_SUGGESTED',
    'PREAUTH_RAISED',
    'PREAUTH_COMPLETE',
    'INITIATED',
    'DISCHARGED',
    'PL_PENDING',
    'OUTSTANDING',
    'CASH_IPD_PENDING',
    'CASH_IPD_SUBMITTED',
    'CASH_APPROVED',
    'CASH_ON_HOLD',
    'CASH_DISCHARGED',
    'KYP_PENDING',
    'KYP_COMPLETE',
    'ADMITTED',
    'IPD_DONE',
    'KYP_BASIC_PENDING',
    'KYP_DETAILED_PENDING',
    'KYP_DETAILED_COMPLETE',
    'CASH_IPD_DONE',
    'OPD_SCHEDULED',
    'OPD_DONE',
    'CASH_OPD_SCHEDULED',
    'CASH_OPD_DONE'
);


--
-- Name: ChatMessageType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."ChatMessageType" AS ENUM (
    'TEXT',
    'FILE',
    'SYSTEM'
);


--
-- Name: ComplianceCallStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."ComplianceCallStatus" AS ENUM (
    'PENDING',
    'COMPLETED',
    'DID_NOT_PICK',
    'WRONG_NUMBER',
    'CALLBACK_SCHEDULED'
);


--
-- Name: ConcernCategory; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."ConcernCategory" AS ENUM (
    'HOSPITAL_STAFF',
    'PAYMENT',
    'BD',
    'NO_UPDATE_FOLLOWUP',
    'DOCTOR',
    'SURGERY_RELATED',
    'CAB_PAYMENT',
    'OTHERS'
);


--
-- Name: CrmAssignmentStrategy; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."CrmAssignmentStrategy" AS ENUM (
    'TARGET_BALANCED',
    'ROUND_ROBIN',
    'MANUAL_POOL_ORDER'
);


--
-- Name: DoctorPayoffRequestStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."DoctorPayoffRequestStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


--
-- Name: DocumentType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."DocumentType" AS ENUM (
    'OFFER_LETTER',
    'INCREMENT_LETTER',
    'EXPERIENCE_LETTER',
    'RELIEVING_LETTER',
    'CUSTOM',
    'INTERNSHIP_OFFER_LETTER',
    'INTERNSHIP_COMPLETION_LETTER',
    'EXIT_INTERVIEW_FORM'
);


--
-- Name: EmployeeIncentiveStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."EmployeeIncentiveStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'PAID'
);


--
-- Name: EmployeeSeatingMiscCostStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."EmployeeSeatingMiscCostStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'PAID'
);


--
-- Name: EmployeeStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."EmployeeStatus" AS ENUM (
    'ACTIVE',
    'ON_PIP',
    'ON_NOTICE',
    'TERMINATED',
    'ABSCONDED'
);


--
-- Name: ExperienceType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."ExperienceType" AS ENUM (
    'FRESHER',
    'EXPERIENCED'
);


--
-- Name: FeedbackStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."FeedbackStatus" AS ENUM (
    'PENDING',
    'REVIEWED',
    'ACKNOWLEDGED'
);


--
-- Name: FinancePaymentType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."FinancePaymentType" AS ENUM (
    'EXPENSE',
    'NON_EXPENSE',
    'RECEIPT'
);


--
-- Name: FlowType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."FlowType" AS ENUM (
    'INSURANCE',
    'CASH'
);


--
-- Name: ITBillingType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."ITBillingType" AS ENUM (
    'FIXED',
    'MONTHLY',
    'MILESTONE'
);


--
-- Name: ITProjectStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."ITProjectStatus" AS ENUM (
    'ACTIVE',
    'COMPLETED',
    'ON_HOLD',
    'CANCELLED'
);


--
-- Name: ITResourcePaymentType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."ITResourcePaymentType" AS ENUM (
    'MONTHLY',
    'ONE_TIME',
    'BOTH'
);


--
-- Name: ITResourceType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."ITResourceType" AS ENUM (
    'SALARIED',
    'FREELANCE'
);


--
-- Name: InstallmentMode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."InstallmentMode" AS ENUM (
    'CASH',
    'UPI',
    'NEFT',
    'RTGS',
    'CHEQUE',
    'CARD',
    'OTHER'
);


--
-- Name: InstallmentRecipient; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."InstallmentRecipient" AS ENUM (
    'HOSPITAL',
    'DOCTOR',
    'MEDIEND'
);


--
-- Name: InstallmentVerificationStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."InstallmentVerificationStatus" AS ENUM (
    'PENDING',
    'VERIFIED',
    'REJECTED'
);


--
-- Name: InsuranceCaseStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."InsuranceCaseStatus" AS ENUM (
    'IN_PROGRESS',
    'APPROVED',
    'REJECTED',
    'QUERY'
);


--
-- Name: InsuranceType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."InsuranceType" AS ENUM (
    'INDIVIDUAL',
    'FAMILY_FLOATER',
    'GROUP_CORPORATE'
);


--
-- Name: InventoryTransactionStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."InventoryTransactionStatus" AS ENUM (
    'PENDING',
    'COMPLETED',
    'CANCELLED'
);


--
-- Name: InvoiceRequestStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."InvoiceRequestStatus" AS ENUM (
    'PENDING',
    'VERIFIED',
    'REJECTED'
);


--
-- Name: IpdStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."IpdStatus" AS ENUM (
    'ADMITTED_DONE',
    'IPD_DONE',
    'POSTPONED',
    'CANCELLED',
    'DISCHARGED'
);


--
-- Name: KYPStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."KYPStatus" AS ENUM (
    'PENDING',
    'KYP_DETAILS_ADDED',
    'PRE_AUTH_COMPLETE',
    'FOLLOW_UP_COMPLETE',
    'COMPLETED'
);


--
-- Name: KnowledgeSourceType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."KnowledgeSourceType" AS ENUM (
    'UPLOAD',
    'TEXT',
    'URL'
);


--
-- Name: KnowledgeVisibility; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."KnowledgeVisibility" AS ENUM (
    'GENERAL',
    'RESTRICTED'
);


--
-- Name: LeadOpdPhase; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."LeadOpdPhase" AS ENUM (
    'PRE',
    'POST'
);


--
-- Name: LeadOpdStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."LeadOpdStatus" AS ENUM (
    'SCHEDULED',
    'DONE',
    'CANCELLED',
    'NO_SHOW'
);


--
-- Name: LeaveBalanceEditRequestStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."LeaveBalanceEditRequestStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


--
-- Name: LeaveRequestStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."LeaveRequestStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


--
-- Name: LedgerAuditAction; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."LedgerAuditAction" AS ENUM (
    'CREATED',
    'UPDATED',
    'APPROVED',
    'REJECTED',
    'DELETED',
    'EDIT_REQUESTED',
    'EDIT_APPROVED',
    'EDIT_REJECTED',
    'DELETE_REQUESTED',
    'DELETE_APPROVED',
    'DELETE_REJECTED'
);


--
-- Name: LedgerStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."LedgerStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


--
-- Name: LocationType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."LocationType" AS ENUM (
    'WAREHOUSE',
    'SUB_WAREHOUSE'
);


--
-- Name: MDApprovalStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."MDApprovalStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


--
-- Name: MeetModule; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."MeetModule" AS ENUM (
    'INTERVIEW',
    'MD_APPOINTMENT',
    'GENERAL'
);


--
-- Name: MeetType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."MeetType" AS ENUM (
    'VIRTUAL',
    'OFFLINE'
);


--
-- Name: MonthlyPayrollStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."MonthlyPayrollStatus" AS ENUM (
    'DRAFT',
    'APPROVED',
    'PAID'
);


--
-- Name: NormalizationStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."NormalizationStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


--
-- Name: NormalizationType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."NormalizationType" AS ENUM (
    'SELF',
    'MANAGER',
    'EMPLOYEE_REQUEST'
);


--
-- Name: NoticeTargetType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."NoticeTargetType" AS ENUM (
    'EVERYONE',
    'EVERYONE_EXCEPT_MD',
    'DEPARTMENT',
    'SPECIFIC'
);


--
-- Name: NotificationType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."NotificationType" AS ENUM (
    'KYP_SUBMITTED',
    'PRE_AUTH_COMPLETE',
    'FOLLOW_UP_COMPLETE',
    'KYP_COMPLETED',
    'QUERY_RAISED',
    'QUERY_ANSWERED',
    'DISCHARGE_SHEET_CREATED',
    'PREAUTH_RAISED',
    'INITIATED',
    'DISCHARGED',
    'CASE_CHAT_MESSAGE',
    'TASK_ASSIGNED',
    'TASK_DUE_SOON',
    'DUE_DATE_CHANGE_REQUESTED',
    'DUE_DATE_CHANGE_APPROVED',
    'DUE_DATE_CHANGE_REJECTED',
    'HOSPITAL_SUGGESTION_REQUESTED',
    'LEAVE_REQUESTED',
    'LEAVE_APPROVED',
    'LEAVE_REJECTED',
    'FEEDBACK_SUBMITTED',
    'INCREMENT_REQUESTED',
    'NORMALIZATION_REQUESTED',
    'TICKET_CREATED',
    'TICKET_RESPONDED',
    'NOTICE_PUBLISHED',
    'MD_APPROVAL_REQUESTED',
    'MD_APPROVAL_RESPONDED',
    'MD_APPROVAL_FINANCE_ACK',
    'NORMALIZATION_APPROVED',
    'NORMALIZATION_REJECTED',
    'MEET_SCHEDULED',
    'MEET_REMINDER',
    'EMPLOYEE_ONBOARDED',
    'LEAVE_BALANCE_EDIT_REQUESTED',
    'LEAVE_BALANCE_EDIT_RESOLVED',
    'GRACE2_MONTHLY_LIMIT_EXCEEDED',
    'RANK_IMPROVED',
    'WORKFLOW_RESET',
    'ONBOARDING_SUBMITTED',
    'ONBOARDING_APPROVED',
    'NEW_HIRE_WELCOME'
);


--
-- Name: OnboardingStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."OnboardingStatus" AS ENUM (
    'PENDING_PROFILE',
    'PENDING_APPROVAL',
    'APPROVED'
);


--
-- Name: PLOutstandingStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."PLOutstandingStatus" AS ENUM (
    'NEW',
    'DRAFT',
    'OUTSTANDING'
);


--
-- Name: PaidByParty; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."PaidByParty" AS ENUM (
    'MEDIEND',
    'HOSPITAL'
);


--
-- Name: PartyType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."PartyType" AS ENUM (
    'BUYER',
    'SELLER',
    'VENDOR',
    'CLIENT',
    'SUPPLIER',
    'OTHER'
);


--
-- Name: PayrollComponentType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."PayrollComponentType" AS ENUM (
    'ALLOWANCE',
    'DEDUCTION'
);


--
-- Name: PeriodType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."PeriodType" AS ENUM (
    'WEEK',
    'MONTH'
);


--
-- Name: PermissionLevel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."PermissionLevel" AS ENUM (
    'NONE',
    'READ',
    'READ_WRITE',
    'READ_WRITE_DELETE',
    'FULL_ACCESS'
);


--
-- Name: PipelineStage; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."PipelineStage" AS ENUM (
    'SALES',
    'INSURANCE',
    'PL',
    'COMPLETED',
    'LOST'
);


--
-- Name: PnLCategoryType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."PnLCategoryType" AS ENUM (
    'REVENUE',
    'EXPENSE'
);


--
-- Name: PreAuthStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."PreAuthStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'TEMP_APPROVED',
    'ON_HOLD'
);


--
-- Name: PunchDirection; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."PunchDirection" AS ENUM (
    'IN',
    'OUT'
);


--
-- Name: QueryStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."QueryStatus" AS ENUM (
    'PENDING',
    'ANSWERED',
    'RESOLVED'
);


--
-- Name: RequestStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."RequestStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


--
-- Name: ResourceType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."ResourceType" AS ENUM (
    'MODULE',
    'SECTION',
    'ENTITY'
);


--
-- Name: RevenueDepartment; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."RevenueDepartment" AS ENUM (
    'LOAN_DEMAT',
    'GOOGLE_ADS'
);


--
-- Name: ReviewStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."ReviewStatus" AS ENUM (
    'DONE',
    'NOT_DONE'
);


--
-- Name: SalesTeamBulkCostType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."SalesTeamBulkCostType" AS ENUM (
    'MISC',
    'OTHER'
);


--
-- Name: SalesTeamCostEntryType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."SalesTeamCostEntryType" AS ENUM (
    'INCENTIVE',
    'SEATING',
    'MISC'
);


--
-- Name: SatisfactionLevel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."SatisfactionLevel" AS ENUM (
    'SATISFIED',
    'NEUTRAL',
    'NOT_SATISFIED'
);


--
-- Name: StockMovementType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."StockMovementType" AS ENUM (
    'PURCHASE',
    'ISSUE',
    'ADJUSTMENT'
);


--
-- Name: SubjectType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."SubjectType" AS ENUM (
    'USER',
    'ROLE'
);


--
-- Name: SurgeryLedgerSource; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."SurgeryLedgerSource" AS ENUM (
    'EXCEL',
    'MANUAL'
);


--
-- Name: SurgeryLedgerUploadStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."SurgeryLedgerUploadStatus" AS ENUM (
    'PROCESSING',
    'COMPLETED',
    'FAILED'
);


--
-- Name: TargetMetric; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."TargetMetric" AS ENUM (
    'LEADS_CLOSED',
    'NET_PROFIT',
    'BILL_AMOUNT',
    'SURGERIES_DONE',
    'IPD_DONE',
    'HEAD_COUNT',
    'LEADS_GENERATED',
    'REVENUE'
);


--
-- Name: TargetType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."TargetType" AS ENUM (
    'BD',
    'TEAM',
    'DEPARTMENT_HEAD',
    'CATEGORY'
);


--
-- Name: TaskApprovalStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."TaskApprovalStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


--
-- Name: TaskPriority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."TaskPriority" AS ENUM (
    'GENERAL',
    'LOW',
    'MEDIUM',
    'HIGH',
    'URGENT'
);


--
-- Name: TaskStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."TaskStatus" AS ENUM (
    'PENDING',
    'IN_PROGRESS',
    'EMPLOYEE_DONE',
    'COMPLETED',
    'CANCELLED'
);


--
-- Name: TicketPriority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."TicketPriority" AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'URGENT'
);


--
-- Name: TicketStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."TicketStatus" AS ENUM (
    'OPEN',
    'IN_PROGRESS',
    'RESOLVED',
    'CLOSED'
);


--
-- Name: TransactionType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."TransactionType" AS ENUM (
    'CREDIT',
    'DEBIT',
    'SELF_TRANSFER'
);


--
-- Name: UserRole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."UserRole" AS ENUM (
    'MD',
    'EXECUTIVE_ASSISTANT',
    'SALES_HEAD',
    'CATEGORY_MANAGER',
    'ASSISTANT_CATEGORY_MANAGER',
    'TEAM_LEAD',
    'BD',
    'INSURANCE_HEAD',
    'PL_HEAD',
    'OUTSTANDING_HEAD',
    'HR_HEAD',
    'FINANCE_HEAD',
    'DIGITAL_MARKETING_HEAD',
    'ADMIN',
    'USER',
    'TESTER',
    'IT_HEAD',
    'LOAN_DEMAT_HEAD',
    'COMPLIANCE_HEAD',
    'ACCESS_MATRIX',
    'SUPER_ADMIN',
    'CRM_ADMIN'
);


--
-- Name: UserStatusKind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."UserStatusKind" AS ENUM (
    'AVAILABLE',
    'ONLINE_ONLY',
    'UNAVAILABLE',
    'CUSTOM'
);


--
-- Name: WarningType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE crm_v2."WarningType" AS ENUM (
    'REPEATED_DEADLINE_MISS',
    'LOW_QUALITY_WORK',
    'UNRESPONSIVE',
    'TASK_ABANDONMENT',
    'OTHER'
);


--
-- Name: sync_lead_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION crm_v2.sync_lead_status() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW."statusId" IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.status IS NOT DISTINCT FROM OLD.status) THEN
    SELECT status INTO NEW.status FROM "status" WHERE id = NEW."statusId";
  ELSE
    SELECT id INTO NEW."statusId" FROM "status" WHERE lower(status) = lower(btrim(NEW.status)) AND "isActive" = true;
  END IF;
  RETURN NEW;
END $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: AdmissionRecord; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."AdmissionRecord" (
    id text NOT NULL,
    "leadId" integer NOT NULL,
    "admissionDate" timestamp(3) without time zone NOT NULL,
    "admissionTime" text NOT NULL,
    "admittingHospital" text NOT NULL,
    "expectedSurgeryDate" timestamp(3) without time zone,
    "surgeryDate" timestamp(3) without time zone,
    "surgeryTime" text,
    "hospitalAddress" text,
    "googleMapLocation" text,
    tpa text,
    instrument text,
    "implantConsumables" text,
    "noMediendLogo" boolean DEFAULT false NOT NULL,
    "cabAdmissionPickupLocation" text,
    "cabAdmissionPickupDateTime" timestamp(3) without time zone,
    "cabAdmissionFrom" text,
    "cabAdmissionTo" text,
    "cabDischargePickupLocation" text,
    "cabDischargePickupDateTime" timestamp(3) without time zone,
    "cabDischargeFrom" text,
    "cabDischargeTo" text,
    "ipdStatus" crm_v2."IpdStatus",
    "ipdStatusReason" text,
    "newSurgeryDate" timestamp(3) without time zone,
    "ipdDischargeDate" timestamp(3) without time zone,
    "ipdStatusNotes" text,
    "ipdStatusUpdatedAt" timestamp(3) without time zone,
    notes text,
    "initiatedById" text NOT NULL,
    "initiatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "ipdImplantUsed" boolean,
    "ipdNoShowReason" text
);


--
-- Name: AdmissionRecordImplantUsage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."AdmissionRecordImplantUsage" (
    id text NOT NULL,
    "admissionRecordId" text NOT NULL,
    "implantId" text NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    notes text,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: AdmissionRecordPrescriptionImage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."AdmissionRecordPrescriptionImage" (
    id text NOT NULL,
    "admissionRecordId" text NOT NULL,
    "fileName" text NOT NULL,
    "fileUrl" text NOT NULL,
    "storageKey" text,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: AiConversation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."AiConversation" (
    id text NOT NULL,
    "userId" text NOT NULL,
    title text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: AiMessage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."AiMessage" (
    id text NOT NULL,
    "conversationId" text NOT NULL,
    "userId" text NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: AiToolCall; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."AiToolCall" (
    id text NOT NULL,
    "conversationId" text,
    "userId" text NOT NULL,
    "toolName" text NOT NULL,
    input jsonb,
    denied boolean DEFAULT false NOT NULL,
    "errorCode" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: AnesthesiaMaster; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."AnesthesiaMaster" (
    id text NOT NULL,
    name text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: AnonymousMessage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."AnonymousMessage" (
    id text NOT NULL,
    message text NOT NULL,
    "isRead" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: AppSetting; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."AppSetting" (
    key text NOT NULL,
    value text NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "updatedBy" text
);


--
-- Name: AttendanceLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."AttendanceLog" (
    id text NOT NULL,
    "employeeId" text NOT NULL,
    "logDate" timestamp(3) without time zone NOT NULL,
    "punchDirection" crm_v2."PunchDirection" NOT NULL,
    temperature double precision DEFAULT 0 NOT NULL,
    "serialNumber" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: AttendanceNormalization; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."AttendanceNormalization" (
    id text NOT NULL,
    "employeeId" text NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    type crm_v2."NormalizationType" NOT NULL,
    "requestedById" text NOT NULL,
    "approvedById" text,
    status crm_v2."NormalizationStatus" DEFAULT 'APPROVED'::crm_v2."NormalizationStatus" NOT NULL,
    reason text,
    "hoursUsed" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "managerApprovedAt" timestamp(3) without time zone,
    "managerApprovedById" text,
    "normalizeAs" text,
    "hrRejectionReason" text
);


--
-- Name: BonusRule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."BonusRule" (
    id text NOT NULL,
    "targetId" text NOT NULL,
    "ruleType" crm_v2."BonusRuleType" NOT NULL,
    "thresholdValue" double precision NOT NULL,
    "bonusAmount" double precision,
    "bonusPercentage" double precision,
    "capAmount" double precision,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: BulkLeadReassignmentRun; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."BulkLeadReassignmentRun" (
    id text NOT NULL,
    "actorUserId" text NOT NULL,
    "leadIds" jsonb NOT NULL,
    "bdUserIds" jsonb NOT NULL,
    "pauseSeconds" integer NOT NULL,
    "subStatus" character varying(25),
    "removePreviousRemarks" boolean DEFAULT false NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    "processedCount" integer DEFAULT 0 NOT NULL,
    "currentLeadIndex" integer DEFAULT 0 NOT NULL,
    "currentBdIndex" integer DEFAULT 0 NOT NULL,
    "currentCycleNumber" integer DEFAULT 0 NOT NULL,
    "totalLeads" integer NOT NULL,
    "totalBds" integer NOT NULL,
    "bullJobId" text,
    "nextRunAt" timestamp(3) without time zone,
    "startedAt" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone,
    "failedAt" timestamp(3) without time zone,
    "errorMessage" text,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "removePreviousFollowUpDate" boolean DEFAULT false NOT NULL
);


--
-- Name: CallNote; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."CallNote" (
    id text NOT NULL,
    "leadId" integer NOT NULL,
    content text NOT NULL,
    "createdById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: CampaignCPL; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."CampaignCPL" (
    id text NOT NULL,
    "campaignName" text NOT NULL,
    month integer NOT NULL,
    year integer NOT NULL,
    cpl double precision DEFAULT 0 NOT NULL,
    "createdById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: CaseChatMessage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."CaseChatMessage" (
    id text NOT NULL,
    "leadId" integer NOT NULL,
    "senderId" text,
    type crm_v2."ChatMessageType" NOT NULL,
    content text NOT NULL,
    "fileUrl" text,
    "fileName" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: CaseStageHistory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."CaseStageHistory" (
    id text NOT NULL,
    "leadId" integer NOT NULL,
    "fromStage" crm_v2."CaseStage",
    "toStage" crm_v2."CaseStage" NOT NULL,
    "changedById" text NOT NULL,
    "changedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    note text
);


--
-- Name: ChatReadReceipt; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."ChatReadReceipt" (
    id text NOT NULL,
    "leadId" integer NOT NULL,
    "userId" text NOT NULL,
    "lastReadAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ComplianceCall; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."ComplianceCall" (
    id text NOT NULL,
    "leadId" integer NOT NULL,
    status crm_v2."ComplianceCallStatus" DEFAULT 'PENDING'::crm_v2."ComplianceCallStatus" NOT NULL,
    rating integer,
    notes text,
    "lastAttemptedAt" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone,
    "callbackAt" timestamp(3) without time zone,
    "calledByUserId" text,
    "problemDuringSurgery" text,
    "problemAfterSurgery" text,
    "commitmentStatus" text,
    "concernResolved" text,
    "doctorBehaviour" text,
    "hospitalStaffBehaviour" text,
    "bdmBehaviour" text,
    "mediendService" text,
    "overallExperience" text,
    "paymentQuery" text,
    "referralConfirmation" text,
    "referralName" text,
    "referralContact" text,
    "opdStatus" text,
    "opdMode" text,
    "additionalRemark" text,
    satisfaction crm_v2."SatisfactionLevel",
    "concernCategories" crm_v2."ConcernCategory"[] DEFAULT ARRAY[]::crm_v2."ConcernCategory"[],
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "reviewStatus" crm_v2."ReviewStatus",
    "reviewScreenshot" text
);


--
-- Name: CrmActivityLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."CrmActivityLog" (
    id text NOT NULL,
    action text NOT NULL,
    "entityType" text NOT NULL,
    "entityId" text,
    "entityLabel" text,
    status text DEFAULT 'SUCCESS'::text NOT NULL,
    summary text NOT NULL,
    metadata jsonb,
    "actorUserId" text,
    "actorRole" text,
    route text,
    method text,
    "ipAddress" text,
    "userAgent" text,
    "errorMessage" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: CrmAssignmentPreviewLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."CrmAssignmentPreviewLog" (
    id text NOT NULL,
    "leadId" integer NOT NULL,
    "leadRef" text NOT NULL,
    "syncSource" text NOT NULL,
    "currentBdUserId" text NOT NULL,
    "currentBdName" text,
    "matchedRuleId" text,
    "matchedRuleName" text,
    "matchedRuleStrategy" crm_v2."CrmAssignmentStrategy",
    "proposedBdUserId" text,
    "proposedBdEmployeeId" text,
    "proposedBdName" text,
    "proposedTeamLeadUserId" text,
    "proposedTeamLeadEmployeeId" text,
    "proposedTeamLeadName" text,
    "proposedSalesHeadUserId" text,
    "proposedSalesHeadEmployeeId" text,
    "proposedSalesHeadName" text,
    "isMatched" boolean DEFAULT false NOT NULL,
    "wouldReassignBd" boolean DEFAULT false NOT NULL,
    "assignmentDate" timestamp(3) without time zone NOT NULL,
    explanation text NOT NULL,
    "inputSnapshot" jsonb NOT NULL,
    "assignmentSnapshot" jsonb,
    "candidateDiagnostics" jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: CrmAssignmentRule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."CrmAssignmentRule" (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    "isActive" boolean DEFAULT true NOT NULL,
    priority integer DEFAULT 100 NOT NULL,
    city text,
    category text,
    "departmentId" text,
    strategy crm_v2."CrmAssignmentStrategy" DEFAULT 'TARGET_BALANCED'::crm_v2."CrmAssignmentStrategy" NOT NULL,
    "createdById" text NOT NULL,
    "updatedById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: CrmAssignmentRuleMember; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."CrmAssignmentRuleMember" (
    id text NOT NULL,
    "ruleId" text NOT NULL,
    "employeeId" text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    priority integer DEFAULT 100 NOT NULL,
    weight integer DEFAULT 1 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: CrmCampaign; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."CrmCampaign" (
    id text NOT NULL,
    "externalCampaignId" text NOT NULL,
    "displayName" text NOT NULL,
    category text,
    "departmentId" text,
    "sourceId" text NOT NULL,
    "leadSourceId" text NOT NULL,
    "circleId" text NOT NULL,
    "cityId" text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    treatment text,
    "treatmentMasterId" text
);


--
-- Name: CrmCampaignBdDailyLimit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."CrmCampaignBdDailyLimit" (
    id text NOT NULL,
    "campaignId" text NOT NULL,
    "teamLeadEmployeeId" text NOT NULL,
    "bdEmployeeId" text NOT NULL,
    "bdUserId" text NOT NULL,
    "maxLeadsPerDay" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: CrmCampaignCircle; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."CrmCampaignCircle" (
    id text NOT NULL,
    name text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: CrmCampaignCircleSelection; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."CrmCampaignCircleSelection" (
    id text NOT NULL,
    "campaignId" text NOT NULL,
    "circleId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: CrmCampaignCity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."CrmCampaignCity" (
    id text NOT NULL,
    name text NOT NULL,
    "circleId" text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: CrmCampaignLeadSource; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."CrmCampaignLeadSource" (
    id text NOT NULL,
    name text NOT NULL,
    cpl double precision,
    "sourceId" text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: CrmCampaignSource; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."CrmCampaignSource" (
    id text NOT NULL,
    name text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: CrmCampaignTeamLeadAssignment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."CrmCampaignTeamLeadAssignment" (
    id text NOT NULL,
    "campaignId" text NOT NULL,
    "teamLeadEmployeeId" text NOT NULL,
    "teamLeadUserId" text NOT NULL,
    month integer NOT NULL,
    year integer NOT NULL,
    weight integer DEFAULT 1 NOT NULL,
    priority integer DEFAULT 100 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: CrmSubStatusMaster; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."CrmSubStatusMaster" (
    id text NOT NULL,
    key integer NOT NULL,
    value text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: CronJobLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."CronJobLog" (
    id text NOT NULL,
    "jobName" text NOT NULL,
    status text NOT NULL,
    "durationMs" integer NOT NULL,
    "recordsProcessed" integer,
    message text,
    error text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: CumulativeReportManualEntry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."CumulativeReportManualEntry" (
    id text NOT NULL,
    year integer NOT NULL,
    "patientSummary" jsonb NOT NULL,
    "concernCategory" jsonb NOT NULL,
    "updatedByUserId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: DailyCampaignSpend; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."DailyCampaignSpend" (
    id text NOT NULL,
    "campaignName" text NOT NULL,
    date date NOT NULL,
    spend double precision DEFAULT 0 NOT NULL,
    "createdById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Department; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."Department" (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    "headId" text,
    "shiftStartHour" integer DEFAULT 10 NOT NULL,
    "shiftStartMinute" integer DEFAULT 0 NOT NULL,
    "grace1Minutes" integer DEFAULT 15 NOT NULL,
    "grace2Minutes" integer DEFAULT 15 NOT NULL,
    "penaltyMinutes" integer DEFAULT 30 NOT NULL,
    "penaltyAmount" integer DEFAULT 200 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: DepartmentRevenue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."DepartmentRevenue" (
    id text NOT NULL,
    department crm_v2."RevenueDepartment" NOT NULL,
    month integer NOT NULL,
    year integer NOT NULL,
    amount double precision DEFAULT 0 NOT NULL,
    description text,
    notes text,
    "createdById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "vendorId" text
);


--
-- Name: DepartmentTeam; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."DepartmentTeam" (
    id text NOT NULL,
    name text NOT NULL,
    "departmentId" text NOT NULL,
    "teamLeadId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: DischargeSheet; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."DischargeSheet" (
    id text NOT NULL,
    "leadId" integer NOT NULL,
    "kypSubmissionId" text,
    month timestamp(3) without time zone,
    "dischargeDate" timestamp(3) without time zone,
    "surgeryDate" timestamp(3) without time zone,
    status text,
    "paymentType" text,
    "approvedOrCash" text,
    "paymentCollectedAt" text,
    "managerRole" text,
    "managerName" text,
    "bdmName" text,
    "patientName" text,
    "patientPhone" text,
    "doctorName" text,
    "hospitalName" text,
    category text,
    treatment text,
    circle text,
    "leadSource" text,
    "tentativeAmount" double precision,
    "copayPct" double precision,
    "dischargeSummaryUrl" text,
    "otNotesUrl" text,
    "codesCount" integer,
    "finalBillUrl" text,
    "settlementLetterUrl" text,
    "roomRentAmount" double precision DEFAULT 0 NOT NULL,
    "pharmacyAmount" double precision DEFAULT 0 NOT NULL,
    "investigationAmount" double precision DEFAULT 0 NOT NULL,
    "consumablesAmount" double precision DEFAULT 0 NOT NULL,
    "implantsAmount" double precision DEFAULT 0 NOT NULL,
    "instrumentsAmount" double precision,
    "totalFinalBill" double precision DEFAULT 0 NOT NULL,
    "finalApprovedAmount" double precision DEFAULT 0 NOT NULL,
    "finalAmount" double precision,
    "deductionAmount" double precision DEFAULT 0 NOT NULL,
    "discountAmount" double precision DEFAULT 0 NOT NULL,
    "waivedOffAmount" double precision DEFAULT 0 NOT NULL,
    "settlementPart" double precision DEFAULT 0 NOT NULL,
    "tdsAmount" double precision DEFAULT 0 NOT NULL,
    "otherDeduction" double precision DEFAULT 0 NOT NULL,
    "netSettlementAmount" double precision DEFAULT 0 NOT NULL,
    "totalAmount" double precision DEFAULT 0 NOT NULL,
    "billAmount" double precision DEFAULT 0 NOT NULL,
    "cashPaidByPatient" double precision DEFAULT 0 NOT NULL,
    "cashOrDedPaid" double precision DEFAULT 0 NOT NULL,
    "referralAmount" double precision DEFAULT 0 NOT NULL,
    "cabCharges" double precision DEFAULT 0 NOT NULL,
    "implantCost" double precision DEFAULT 0 NOT NULL,
    "dcCharges" double precision DEFAULT 0 NOT NULL,
    "doctorCharges" double precision DEFAULT 0 NOT NULL,
    "hospitalSharePct" double precision,
    "hospitalShareAmount" double precision DEFAULT 0 NOT NULL,
    "mediendSharePct" double precision,
    "mediendShareAmount" double precision DEFAULT 0 NOT NULL,
    "mediendNetProfit" double precision DEFAULT 0 NOT NULL,
    remarks text,
    "createdById" text NOT NULL,
    "plRecordId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "admissionDate" timestamp(3) without time zone,
    "implantPaidBy" crm_v2."PaidByParty",
    "instrumentsCost" double precision DEFAULT 0 NOT NULL,
    "instrumentsPaidBy" crm_v2."PaidByParty",
    "othersText" text,
    "packageText" text,
    "isFinalized" boolean DEFAULT false NOT NULL,
    "markedById" text,
    "markedAt" timestamp(3) without time zone,
    "finalizedById" text,
    "finalizedAt" timestamp(3) without time zone,
    "anesthesiaAmount" double precision DEFAULT 0 NOT NULL,
    "otherChargesAmount" double precision DEFAULT 0 NOT NULL,
    "copayAmount" double precision DEFAULT 0 NOT NULL,
    "collectedByHospital" double precision DEFAULT 0 NOT NULL,
    "collectedByMediend" double precision DEFAULT 0 NOT NULL,
    "axisTariffDeduction" double precision DEFAULT 0 NOT NULL,
    "axisTariffDeductionPaid" double precision DEFAULT 0 NOT NULL,
    "actualFinalAmount" double precision DEFAULT 0 NOT NULL,
    "finalApprovedUrl" text,
    "deductionReceiptUrl" text,
    "costBreakdownRemarks" text,
    "doctorRemarks" text,
    "otherCharges" text,
    "packageAmount" text,
    "staplerCharges" text
);


--
-- Name: DoctorAppAccount; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."DoctorAppAccount" (
    id text NOT NULL,
    "doctorId" text NOT NULL,
    email text NOT NULL,
    "phoneNumber" text,
    "passwordHash" text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "lastLoginAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: DoctorAppRefreshToken; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."DoctorAppRefreshToken" (
    id text NOT NULL,
    "accountId" text NOT NULL,
    jti text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "revokedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: DoctorAppWhatsappOtp; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."DoctorAppWhatsappOtp" (
    id text NOT NULL,
    "accountId" text NOT NULL,
    "phoneNumber" text NOT NULL,
    otp text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "verifiedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: DoctorCabRequest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."DoctorCabRequest" (
    id text NOT NULL,
    "doctorId" text NOT NULL,
    pickup text NOT NULL,
    drop text NOT NULL,
    "pickupLat" double precision,
    "pickupLng" double precision,
    "dropLat" double precision,
    "dropLng" double precision,
    "scheduledFor" timestamp(3) without time zone NOT NULL,
    status crm_v2."AppointmentStatus" DEFAULT 'PENDING'::crm_v2."AppointmentStatus" NOT NULL,
    "reviewNotes" text,
    "reviewedById" text,
    "reviewedAt" timestamp(3) without time zone,
    "vendorName" text,
    "vendorPhone" text,
    "assignedVendorById" text,
    "assignedVendorAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: DoctorLeaveRequest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."DoctorLeaveRequest" (
    id text NOT NULL,
    "doctorId" text NOT NULL,
    "startDate" timestamp(3) without time zone NOT NULL,
    "endDate" timestamp(3) without time zone NOT NULL,
    reason text,
    status crm_v2."LeaveRequestStatus" DEFAULT 'PENDING'::crm_v2."LeaveRequestStatus" NOT NULL,
    "reviewedById" text,
    "reviewedAt" timestamp(3) without time zone,
    "reviewNotes" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: DoctorMaster; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."DoctorMaster" (
    id text NOT NULL,
    name text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    category text,
    treatment text,
    age integer,
    sex text,
    "aadhaarNumber" text,
    "aadhaarCardUrl" text,
    "panNumber" text,
    "panCardUrl" text,
    "agreementUrl" text,
    "experienceYears" integer,
    "experienceNotes" text,
    "feeStructure" text,
    "ratingAverage" double precision,
    "ratingCount" integer DEFAULT 0 NOT NULL,
    documents jsonb,
    "phoneNumber" text
);


--
-- Name: DoctorPayoffRequest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."DoctorPayoffRequest" (
    id text NOT NULL,
    "doctorName" text NOT NULL,
    "hospitalName" text,
    "leadId" integer,
    "leadIds" jsonb,
    "requestAmount" double precision NOT NULL,
    "requestRemarks" text,
    "financeRemarks" text,
    "rejectionRemarks" text,
    attachments jsonb,
    status crm_v2."DoctorPayoffRequestStatus" DEFAULT 'PENDING'::crm_v2."DoctorPayoffRequestStatus" NOT NULL,
    "requestedById" text NOT NULL,
    "reviewedById" text,
    "reviewedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "verificationDocUrl" text,
    "verificationDocName" text
);


--
-- Name: DoctorPayoffRequestActivity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."DoctorPayoffRequestActivity" (
    id text NOT NULL,
    "requestId" text NOT NULL,
    action text NOT NULL,
    message text NOT NULL,
    remarks text,
    "actorId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: DocumentTemplate; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."DocumentTemplate" (
    id text NOT NULL,
    "documentType" crm_v2."DocumentType" NOT NULL,
    name text NOT NULL,
    "contentHtml" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Employee; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."Employee" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "employeeCode" text NOT NULL,
    "bdNumber" integer,
    "joinDate" timestamp(3) without time zone,
    salary double precision,
    "departmentId" text,
    "teamId" text,
    "managerId" text,
    "dateOfBirth" timestamp(3) without time zone,
    "aadharNumber" text,
    "panNumber" text,
    "aadharDocUrl" text,
    "panDocUrl" text,
    designation text,
    "bankAccountNumber" text,
    "ifscCode" text,
    "uanNumber" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "bankAccountName" text,
    "finalWorkingDay" timestamp(3) without time zone,
    "fnfCompleted" boolean DEFAULT false NOT NULL,
    "fnfCompletedAt" timestamp(3) without time zone,
    "fnfCompletedById" text,
    "noticePeriodEndDate" timestamp(3) without time zone,
    "noticePeriodStartDate" timestamp(3) without time zone,
    "pipEndDate" timestamp(3) without time zone,
    "pipStartDate" timestamp(3) without time zone,
    status crm_v2."EmployeeStatus" DEFAULT 'ACTIVE'::crm_v2."EmployeeStatus" NOT NULL,
    "terminationReason" text,
    "statusNote" text,
    "fnfDeadline" timestamp(3) without time zone,
    "bloodGroup" text,
    "employmentType" text,
    "workLocation" text,
    "bankName" text,
    "bankBranch" text,
    "upiId" text,
    "passportDocUrl" text,
    "drivingLicenseDocUrl" text,
    "resumeDocUrl" text,
    "educationalCertDocUrl" text,
    "experienceCertDocUrl" text,
    "appointmentLetterDocUrl" text,
    "otherDocuments" jsonb,
    "onboardingStatus" crm_v2."OnboardingStatus" DEFAULT 'APPROVED'::crm_v2."OnboardingStatus" NOT NULL,
    "onboardingSubmittedAt" timestamp(3) without time zone,
    "onboardingApprovedAt" timestamp(3) without time zone,
    "onboardingApprovedById" text,
    circle text,
    "bankStatementDocUrl" text,
    "experienceType" crm_v2."ExperienceType",
    "personalEmail" text,
    "salarySlipDocUrl" text,
    "knowlarityCallerId" text,
    "knowlarityNotificationsEnabled" boolean DEFAULT false NOT NULL,
    "knowlarityPhoneNumber" text
);


--
-- Name: EmployeeDocument; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."EmployeeDocument" (
    id text NOT NULL,
    "employeeId" text,
    "documentType" crm_v2."DocumentType" NOT NULL,
    "documentUrl" text,
    metadata jsonb,
    "generatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    title text,
    "ackToken" text,
    "acknowledgedAt" timestamp(3) without time zone,
    "acknowledgedIp" text,
    "applicantEmail" text,
    "applicantName" text,
    "contentHtml" text
);


--
-- Name: EmployeeMasterSeatingCost; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."EmployeeMasterSeatingCost" (
    id text NOT NULL,
    "employeeId" text NOT NULL,
    amount double precision NOT NULL,
    note text,
    "createdByUserId" text NOT NULL,
    "updatedByUserId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: EmployeeMonthlyIncentive; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."EmployeeMonthlyIncentive" (
    id text NOT NULL,
    "employeeId" text NOT NULL,
    month integer NOT NULL,
    year integer NOT NULL,
    amount double precision NOT NULL,
    status crm_v2."EmployeeIncentiveStatus" DEFAULT 'PENDING'::crm_v2."EmployeeIncentiveStatus" NOT NULL,
    note text,
    "createdByUserId" text NOT NULL,
    "updatedByUserId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: EmployeeMonthlySeatingMiscCost; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."EmployeeMonthlySeatingMiscCost" (
    id text NOT NULL,
    "employeeId" text NOT NULL,
    month integer NOT NULL,
    year integer NOT NULL,
    "seatingCost" double precision NOT NULL,
    "masterSeatingCostId" text,
    "miscCost" double precision DEFAULT 0 NOT NULL,
    status crm_v2."EmployeeSeatingMiscCostStatus" DEFAULT 'PENDING'::crm_v2."EmployeeSeatingMiscCostStatus" NOT NULL,
    remarks text,
    "createdByUserId" text NOT NULL,
    "updatedByUserId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "otherCost" double precision DEFAULT 0 NOT NULL
);


--
-- Name: EmployeeMonthlySeatingMiscCostHistory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."EmployeeMonthlySeatingMiscCostHistory" (
    id text NOT NULL,
    "recordId" text NOT NULL,
    action text NOT NULL,
    "seatingCost" double precision NOT NULL,
    "miscCost" double precision NOT NULL,
    status crm_v2."EmployeeSeatingMiscCostStatus" NOT NULL,
    remarks text,
    "changedByUserId" text NOT NULL,
    "changedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "otherCost" double precision DEFAULT 0 NOT NULL
);


--
-- Name: EmployeeProfileActivityLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."EmployeeProfileActivityLog" (
    id text NOT NULL,
    "employeeId" text NOT NULL,
    "actorUserId" text NOT NULL,
    action text NOT NULL,
    summary text NOT NULL,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: EmployeeSalesTeamSalaryOverride; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."EmployeeSalesTeamSalaryOverride" (
    id text NOT NULL,
    "employeeId" text NOT NULL,
    month integer NOT NULL,
    year integer NOT NULL,
    amount double precision NOT NULL,
    reason text NOT NULL,
    "updatedByUserId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: EmployeeSalesTeamSalaryOverrideHistory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."EmployeeSalesTeamSalaryOverrideHistory" (
    id text NOT NULL,
    "employeeId" text NOT NULL,
    month integer NOT NULL,
    year integer NOT NULL,
    "previousSalary" double precision NOT NULL,
    "updatedSalary" double precision NOT NULL,
    difference double precision NOT NULL,
    reason text NOT NULL,
    "updatedByUserId" text NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."Feedback" (
    id text NOT NULL,
    "employeeId" text NOT NULL,
    content text NOT NULL,
    status crm_v2."FeedbackStatus" DEFAULT 'PENDING'::crm_v2."FeedbackStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: FollowUpReasonMaster; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."FollowUpReasonMaster" (
    id text NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    "displayOrder" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: HeadMaster; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."HeadMaster" (
    id text NOT NULL,
    name text NOT NULL,
    department text,
    description text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Holiday; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."Holiday" (
    id text NOT NULL,
    date date NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: HospitalMaster; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."HospitalMaster" (
    id text NOT NULL,
    name text NOT NULL,
    address text,
    "googleMapLink" text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "mouAgreementUrl" text,
    "hospitalShare" double precision,
    details jsonb,
    "mediendShare" double precision
);


--
-- Name: HospitalMasterInsurance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."HospitalMasterInsurance" (
    "hospitalId" text NOT NULL,
    "insuranceId" text NOT NULL
);


--
-- Name: HospitalSuggestion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."HospitalSuggestion" (
    id text NOT NULL,
    "preAuthId" text NOT NULL,
    "hospitalName" text NOT NULL,
    "suggestedDoctor" text,
    "tentativeBill" double precision,
    "roomRentGeneral" double precision,
    "roomRentSingle" double precision,
    "roomRentDeluxe" double precision,
    "roomRentSemiPrivate" double precision,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: IJPApplication; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."IJPApplication" (
    id text NOT NULL,
    "postingId" text NOT NULL,
    "referredById" text NOT NULL,
    "candidateName" text NOT NULL,
    "candidateEmail" text,
    "candidatePhone" text,
    "resumeUrl" text NOT NULL,
    description text,
    documents jsonb,
    status crm_v2."ApplicationStatus" DEFAULT 'PENDING'::crm_v2."ApplicationStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ITFreelancer; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."ITFreelancer" (
    id text NOT NULL,
    name text NOT NULL,
    email text,
    phone text,
    skill text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ITProject; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."ITProject" (
    id text NOT NULL,
    name text NOT NULL,
    "clientName" text,
    description text,
    "projectValue" double precision DEFAULT 0 NOT NULL,
    "billingType" crm_v2."ITBillingType" DEFAULT 'MONTHLY'::crm_v2."ITBillingType" NOT NULL,
    "monthlyBilling" double precision,
    "startDate" timestamp(3) without time zone,
    "endDate" timestamp(3) without time zone,
    status crm_v2."ITProjectStatus" DEFAULT 'ACTIVE'::crm_v2."ITProjectStatus" NOT NULL,
    "createdById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ITProjectBooking; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."ITProjectBooking" (
    id text NOT NULL,
    "projectId" text NOT NULL,
    month integer NOT NULL,
    year integer NOT NULL,
    amount double precision DEFAULT 0 NOT NULL,
    notes text,
    "createdById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ITProjectResource; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."ITProjectResource" (
    id text NOT NULL,
    "projectId" text NOT NULL,
    "resourceType" crm_v2."ITResourceType" NOT NULL,
    "employeeId" text,
    "freelancerId" text,
    "allocationPercent" double precision DEFAULT 0 NOT NULL,
    "paymentType" crm_v2."ITResourcePaymentType" DEFAULT 'MONTHLY'::crm_v2."ITResourcePaymentType" NOT NULL,
    "monthlyCost" double precision DEFAULT 0 NOT NULL,
    "oneTimeCost" double precision DEFAULT 0 NOT NULL,
    "startDate" timestamp(3) without time zone,
    "endDate" timestamp(3) without time zone,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "resourceName" text,
    "seatCostApplied" boolean DEFAULT false NOT NULL
);


--
-- Name: ImplantMaster; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."ImplantMaster" (
    id text NOT NULL,
    name text NOT NULL,
    code text,
    category text,
    manufacturer text,
    "unitCost" double precision,
    description text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: IncomingLead; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."IncomingLead" (
    "legacyId" text,
    source text,
    payload jsonb NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "receivedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "errorMessage" text,
    "externalCampaignId" text,
    "normalizedPhone" text,
    "processedAt" timestamp(3) without time zone,
    "processedLeadId" integer,
    "selectedBdUserId" text,
    "selectedTeamLeadEmployeeId" text,
    "selectedTeamLeadUserId" text,
    category text,
    circle text,
    treatment text,
    id integer NOT NULL
);


--
-- Name: IncomingLead_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE crm_v2."IncomingLead_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: IncomingLead_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE crm_v2."IncomingLead_id_seq" OWNED BY crm_v2."IncomingLead".id;


--
-- Name: IncrementRequest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."IncrementRequest" (
    id text NOT NULL,
    "employeeId" text NOT NULL,
    "currentSalary" double precision NOT NULL,
    "requestedAmount" double precision,
    reason text NOT NULL,
    achievements text,
    documents jsonb,
    status crm_v2."RequestStatus" DEFAULT 'PENDING'::crm_v2."RequestStatus" NOT NULL,
    "approvalPercentage" double precision,
    "hrRemarks" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: InsuranceCase; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."InsuranceCase" (
    id text NOT NULL,
    "leadId" integer NOT NULL,
    "caseStatus" crm_v2."InsuranceCaseStatus" DEFAULT 'IN_PROGRESS'::crm_v2."InsuranceCaseStatus" NOT NULL,
    "approvalAmount" double precision,
    "tpaRemarks" text,
    "submittedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "approvedAt" timestamp(3) without time zone,
    "handledById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: InsuranceInitiateForm; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."InsuranceInitiateForm" (
    id text NOT NULL,
    "leadId" integer NOT NULL,
    "totalBillAmount" double precision DEFAULT 0 NOT NULL,
    discount double precision DEFAULT 0 NOT NULL,
    "otherReductions" double precision DEFAULT 0 NOT NULL,
    copay double precision,
    "copayBuffer" double precision DEFAULT 0 NOT NULL,
    deductible double precision DEFAULT 0 NOT NULL,
    "exceedsPolicyLimit" text,
    "policyDeductibleAmount" double precision DEFAULT 0 NOT NULL,
    "totalAuthorizedAmount" double precision DEFAULT 0 NOT NULL,
    "amountToBePaidByInsurance" double precision DEFAULT 0 NOT NULL,
    "roomCategory" text,
    "initialApprovalByHospitalUrl" text,
    "createdById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: InsuranceMaster; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."InsuranceMaster" (
    id text NOT NULL,
    name text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: InsuranceQuery; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."InsuranceQuery" (
    id text NOT NULL,
    "preAuthorizationId" text NOT NULL,
    question text NOT NULL,
    answer text,
    status crm_v2."QueryStatus" DEFAULT 'PENDING'::crm_v2."QueryStatus" NOT NULL,
    "raisedById" text NOT NULL,
    "answeredById" text,
    "raisedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "answeredAt" timestamp(3) without time zone,
    "resolvedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: InternalJobPosting; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."InternalJobPosting" (
    id text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    department text,
    requirements text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: InvoiceRequest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."InvoiceRequest" (
    id text NOT NULL,
    "leadId" integer NOT NULL,
    status crm_v2."InvoiceRequestStatus" DEFAULT 'PENDING'::crm_v2."InvoiceRequestStatus" NOT NULL,
    "requestRemarks" text,
    "invoiceNumber" text,
    "invoiceAmount" double precision,
    "invoicePdfUrl" text,
    "invoicePdfName" text,
    "financeRemarks" text,
    "rejectionRemarks" text,
    "requestedById" text NOT NULL,
    "reviewedById" text,
    "reviewedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: InvoiceRequestActivity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."InvoiceRequestActivity" (
    id text NOT NULL,
    "requestId" text NOT NULL,
    action text NOT NULL,
    message text NOT NULL,
    remarks text,
    "actorId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: IssueTransaction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."IssueTransaction" (
    id text NOT NULL,
    "issueNumber" text NOT NULL,
    "itemId" text NOT NULL,
    "locationId" text NOT NULL,
    quantity double precision NOT NULL,
    "unitPrice" double precision NOT NULL,
    "totalPrice" double precision NOT NULL,
    "issuedToId" text NOT NULL,
    "issueDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    description text,
    status crm_v2."InventoryTransactionStatus" DEFAULT 'PENDING'::crm_v2."InventoryTransactionStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdById" text NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ItemMaster; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."ItemMaster" (
    id text NOT NULL,
    "itemCode" text NOT NULL,
    name text NOT NULL,
    price double precision NOT NULL,
    unit text NOT NULL,
    "supplierId" text NOT NULL,
    "locationId" text NOT NULL,
    "minimumStockLevel" double precision NOT NULL,
    "maximumStockLevel" double precision NOT NULL,
    description text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: KYPSubmission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."KYPSubmission" (
    id text NOT NULL,
    "leadId" integer NOT NULL,
    aadhar text,
    pan text,
    "insuranceCard" text,
    disease text,
    location text,
    area text,
    remark text,
    "insuranceType" crm_v2."InsuranceType",
    "aadharFileUrl" text,
    "panFileUrl" text,
    "insuranceCardFileUrl" text,
    "prescriptionFileUrl" text,
    "diseasePhotos" jsonb,
    "otherFiles" jsonb,
    "patientConsent" boolean DEFAULT false NOT NULL,
    status crm_v2."KYPStatus" DEFAULT 'PENDING'::crm_v2."KYPStatus" NOT NULL,
    "submittedById" text NOT NULL,
    "submittedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "aadharFiles" jsonb,
    "panFiles" jsonb,
    "documentEditCounts" jsonb,
    "documentEditHistory" jsonb
);


--
-- Name: KnowledgeChunk; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."KnowledgeChunk" (
    id text NOT NULL,
    "documentId" text NOT NULL,
    "chunkIndex" integer NOT NULL,
    content text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english'::regconfig, content)) STORED
);


--
-- Name: KnowledgeDocument; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."KnowledgeDocument" (
    id text NOT NULL,
    title text NOT NULL,
    description text,
    "sourceType" crm_v2."KnowledgeSourceType" DEFAULT 'TEXT'::crm_v2."KnowledgeSourceType" NOT NULL,
    "fileUrl" text,
    "mimeType" text,
    "contentText" text,
    visibility crm_v2."KnowledgeVisibility" DEFAULT 'GENERAL'::crm_v2."KnowledgeVisibility" NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "uploadedById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: KnowledgeDocumentDepartment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."KnowledgeDocumentDepartment" (
    id text NOT NULL,
    "documentId" text NOT NULL,
    "departmentId" text NOT NULL
);


--
-- Name: KnowledgeDocumentRole; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."KnowledgeDocumentRole" (
    id text NOT NULL,
    "documentId" text NOT NULL,
    role text NOT NULL
);


--
-- Name: KnowledgeDocumentUser; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."KnowledgeDocumentUser" (
    id text NOT NULL,
    "documentId" text NOT NULL,
    "userId" text NOT NULL
);


--
-- Name: Lead; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."Lead" (
    "legacyId" text,
    "leadRef" text NOT NULL,
    "patientName" text NOT NULL,
    age integer NOT NULL,
    "dateOfBirth" timestamp(3) without time zone,
    sex text NOT NULL,
    "phoneNumber" text NOT NULL,
    "alternateNumber" text,
    "attendantName" text,
    "bdId" text NOT NULL,
    status text NOT NULL,
    "pipelineStage" crm_v2."PipelineStage" DEFAULT 'SALES'::crm_v2."PipelineStage" NOT NULL,
    "caseStage" crm_v2."CaseStage" DEFAULT 'NEW_LEAD'::crm_v2."CaseStage" NOT NULL,
    circle text NOT NULL,
    category text,
    treatment text,
    anesthesia text,
    "quantityGrade" text,
    "surgeonName" text,
    "surgeonType" text,
    "hospitalName" text NOT NULL,
    "flowType" crm_v2."FlowType" DEFAULT 'INSURANCE'::crm_v2."FlowType" NOT NULL,
    "modeOfPayment" text,
    discount double precision DEFAULT 0 NOT NULL,
    copay double precision DEFAULT 0 NOT NULL,
    deduction double precision DEFAULT 0 NOT NULL,
    "settledTotal" double precision DEFAULT 0 NOT NULL,
    "billAmount" double precision DEFAULT 0 NOT NULL,
    "insuranceName" text,
    tpa text,
    "sumInsured" double precision,
    "roomRent" double precision,
    icu double precision,
    capping double precision,
    "arrivalDate" timestamp(3) without time zone,
    "arrivalTime" text,
    "surgeryDate" timestamp(3) without time zone,
    "operationTime" text,
    "implantType" text,
    "implantAmount" double precision DEFAULT 0 NOT NULL,
    instrument text,
    consumables text,
    "createdById" text NOT NULL,
    "createdDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedById" text NOT NULL,
    "updatedDate" timestamp(3) without time zone NOT NULL,
    remarks text,
    source text,
    "campaignName" text,
    "bdeName" text,
    "conversionDate" timestamp(3) without time zone,
    "mediendProfit" double precision DEFAULT 0 NOT NULL,
    "hospitalShare" double precision DEFAULT 0 NOT NULL,
    "doctorShare" double precision DEFAULT 0 NOT NULL,
    "othersShare" double precision DEFAULT 0 NOT NULL,
    "netProfit" double precision DEFAULT 0 NOT NULL,
    "ticketSize" double precision DEFAULT 0 NOT NULL,
    "collectedByMediend" double precision DEFAULT 0 NOT NULL,
    "collectedByHospital" double precision DEFAULT 0 NOT NULL,
    month text,
    "leadEntryDate" timestamp(3) without time zone,
    "patientEmail" text,
    whatsapp text,
    address text,
    "docUpload" text,
    "diseaseDetails" text,
    "followUpDate" timestamp(3) without time zone,
    "subStatus" character varying(25),
    "opdHospital" text,
    "opdDrName" text,
    "opdContactNo" text,
    "opdCharges" integer DEFAULT 0 NOT NULL,
    "opdScheduleDate" timestamp(3) without time zone,
    "opdMeeting" integer,
    "ipdAdmissionDate" timestamp(3) without time zone,
    "ipdHospital" text,
    "ipdDrName" text,
    "ipdContactNo" text,
    "ipdTotalPayment" integer DEFAULT 0 NOT NULL,
    "ipdDetails" text,
    "paymentDetails" integer,
    "attendantContactNo" text,
    "waFormat" text,
    "leadSource" integer,
    "whatsappMessage" text,
    notification boolean DEFAULT false NOT NULL,
    "emailSent" boolean DEFAULT false NOT NULL,
    "smsSent" boolean DEFAULT false NOT NULL,
    "whatsappSent" boolean DEFAULT false NOT NULL,
    website text,
    description text,
    "refId" text,
    "duplCount" integer DEFAULT 0 NOT NULL,
    aes boolean DEFAULT false NOT NULL,
    profession text,
    qr text,
    "removeRemarks" boolean DEFAULT false NOT NULL,
    "adId" text,
    "campaignId" text,
    "formId" text,
    "teamLeadId" integer,
    "remarksId" text,
    "lostReason" text,
    "lostAt" timestamp(3) without time zone,
    "assignedDate" timestamp(3) without time zone,
    "atsAmount" double precision,
    "atsStatus" crm_v2."ATSStatus" DEFAULT 'NO_ATS'::crm_v2."ATSStatus",
    "treatmentMasterId" text,
    "remarksClearedAt" timestamp(3) without time zone,
    "isOldCrmLead" boolean DEFAULT false NOT NULL,
    "opdDiagnosis" text,
    "opdFollowUpReasonCode" text,
    "opdImplantRequired" boolean,
    "opdReasonNoSurgeryCode" text,
    "opdSurgeryAdvised" text,
    "opdSurgeryRemarkCode" text,
    "openedInCrmAt" timestamp(3) without time zone,
    "ipdPotentialDate" timestamp(3) without time zone,
    "ipdPotentialMarkedAt" timestamp(3) without time zone,
    "removeFollowUpDate" boolean DEFAULT false NOT NULL,
    "followUpDateClearedAt" timestamp(3) without time zone,
    id integer NOT NULL,
    "statusId" integer
);


--
-- Name: LeadIdMigrationMap; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."LeadIdMigrationMap" (
    "tableName" text NOT NULL,
    "oldId" text NOT NULL,
    "newId" integer NOT NULL
);


--
-- Name: LeadOpdAppointment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."LeadOpdAppointment" (
    id text NOT NULL,
    "leadId" integer NOT NULL,
    phase crm_v2."LeadOpdPhase" NOT NULL,
    slot integer NOT NULL,
    status crm_v2."LeadOpdStatus" DEFAULT 'SCHEDULED'::crm_v2."LeadOpdStatus" NOT NULL,
    "hospitalName" text,
    "doctorName" text,
    "contactNumber" text,
    charges integer DEFAULT 0 NOT NULL,
    "scheduleDate" timestamp(3) without time zone,
    "meetingType" integer,
    "surgeryAdvised" text,
    "surgeryRemarkCode" text,
    "reasonNoSurgeryCode" text,
    "followUpReasonCode" text,
    "implantRequired" boolean,
    diagnosis text,
    remarks text,
    "createdById" text,
    "updatedById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: LeadOpdAppointmentPrescriptionImage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."LeadOpdAppointmentPrescriptionImage" (
    id text NOT NULL,
    "opdAppointmentId" text NOT NULL,
    "fileName" text NOT NULL,
    "fileUrl" text NOT NULL,
    "storageKey" text,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: LeadOpdPrescriptionImage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."LeadOpdPrescriptionImage" (
    id text NOT NULL,
    "leadId" integer NOT NULL,
    "fileName" text NOT NULL,
    "fileUrl" text NOT NULL,
    "storageKey" text,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: LeadQrCallAuditLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."LeadQrCallAuditLog" (
    id text NOT NULL,
    "leadId" integer NOT NULL,
    "userId" text NOT NULL,
    action text NOT NULL,
    "phoneNumber" text NOT NULL,
    source text,
    "ipAddress" text,
    "userAgent" text,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: LeadQrPublicLink; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."LeadQrPublicLink" (
    id text NOT NULL,
    "leadId" integer NOT NULL,
    "actorUserId" text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "lastOpenedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    token text NOT NULL
);


--
-- Name: LeadQrScanLink; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."LeadQrScanLink" (
    id text NOT NULL,
    token text NOT NULL,
    "leadId" integer NOT NULL,
    "actorUserId" text NOT NULL,
    "lastScannedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: LeadRemark; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."LeadRemark" (
    id text NOT NULL,
    "leadRef" text NOT NULL,
    remarks text NOT NULL,
    "updateBy" integer,
    "updateDate" timestamp(3) without time zone NOT NULL,
    ip text,
    "leadStatus" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: LeadRemarkEntry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."LeadRemarkEntry" (
    id text NOT NULL,
    "leadId" integer NOT NULL,
    content text NOT NULL,
    "createdById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: LeadStageEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."LeadStageEvent" (
    id text NOT NULL,
    "leadId" integer NOT NULL,
    "fromStage" crm_v2."PipelineStage" NOT NULL,
    "toStage" crm_v2."PipelineStage" NOT NULL,
    "changedById" text NOT NULL,
    "changedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    note text
);


--
-- Name: Lead_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE crm_v2."Lead_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Lead_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE crm_v2."Lead_id_seq" OWNED BY crm_v2."Lead".id;


--
-- Name: LeaveBalance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."LeaveBalance" (
    id text NOT NULL,
    "employeeId" text NOT NULL,
    "leaveTypeId" text NOT NULL,
    allocated double precision DEFAULT 0 NOT NULL,
    used double precision DEFAULT 0 NOT NULL,
    remaining double precision DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: LeaveBalanceEditRequest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."LeaveBalanceEditRequest" (
    id text NOT NULL,
    "employeeId" text NOT NULL,
    "requestedByUserId" text NOT NULL,
    "prevCL" double precision NOT NULL,
    "prevSL" double precision NOT NULL,
    "prevEL" double precision NOT NULL,
    "proposedCL" double precision NOT NULL,
    "proposedSL" double precision NOT NULL,
    "proposedEL" double precision NOT NULL,
    reason text,
    status crm_v2."LeaveBalanceEditRequestStatus" DEFAULT 'PENDING'::crm_v2."LeaveBalanceEditRequestStatus" NOT NULL,
    "reviewedByUserId" text,
    "reviewedAt" timestamp(3) without time zone,
    "reviewRemarks" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: LeaveRequest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."LeaveRequest" (
    id text NOT NULL,
    "employeeId" text NOT NULL,
    "leaveTypeId" text NOT NULL,
    "startDate" timestamp(3) without time zone NOT NULL,
    "endDate" timestamp(3) without time zone NOT NULL,
    days double precision NOT NULL,
    reason text,
    "isUnpaid" boolean DEFAULT false NOT NULL,
    status crm_v2."LeaveRequestStatus" DEFAULT 'PENDING'::crm_v2."LeaveRequestStatus" NOT NULL,
    "targetApproverId" text,
    "approvedById" text,
    "approvedAt" timestamp(3) without time zone,
    remarks text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: LeaveTypeMaster; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."LeaveTypeMaster" (
    id text NOT NULL,
    name text NOT NULL,
    "maxDays" integer NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "carryForward" boolean DEFAULT false NOT NULL,
    code text,
    "monthlyAccrual" double precision DEFAULT 0 NOT NULL,
    "probationUnlockDays" double precision
);


--
-- Name: LedgerAuditLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."LedgerAuditLog" (
    id text NOT NULL,
    "ledgerEntryId" text NOT NULL,
    action crm_v2."LedgerAuditAction" NOT NULL,
    "previousData" jsonb,
    "newData" jsonb,
    reason text,
    "performedById" text NOT NULL,
    "performedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: LedgerEntry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."LedgerEntry" (
    id text NOT NULL,
    "serialNumber" text NOT NULL,
    "transactionType" crm_v2."TransactionType" NOT NULL,
    "transactionDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "partyId" text,
    description text NOT NULL,
    "headId" text,
    "paymentTypeId" text,
    "paymentAmount" double precision,
    "componentA" double precision,
    "componentB" double precision,
    "receivedAmount" double precision,
    "paymentModeId" text,
    "fromPaymentModeId" text,
    "toPaymentModeId" text,
    "transferAmount" double precision,
    "openingBalance" double precision NOT NULL,
    "currentBalance" double precision NOT NULL,
    status crm_v2."LedgerStatus" DEFAULT 'PENDING'::crm_v2."LedgerStatus" NOT NULL,
    "rejectionReason" text,
    "isDeleted" boolean DEFAULT false NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "deletedById" text,
    "deletedReason" text,
    "editRequestStatus" crm_v2."LedgerStatus",
    "editRequestReason" text,
    "editRequestData" jsonb,
    "editRequestedById" text,
    "editRequestedAt" timestamp(3) without time zone,
    "editApprovalReason" text,
    "editApprovedById" text,
    "editApprovedAt" timestamp(3) without time zone,
    "editCount" integer DEFAULT 0 NOT NULL,
    attachments jsonb,
    "createdById" text NOT NULL,
    "approvedById" text,
    "approvedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deleteApprovalReason" text,
    "deleteApprovedAt" timestamp(3) without time zone,
    "deleteApprovedById" text,
    "deleteRequestReason" text,
    "deleteRequestStatus" crm_v2."LedgerStatus",
    "deleteRequestedAt" timestamp(3) without time zone,
    "deleteRequestedById" text
);


--
-- Name: LoanDematVendor; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."LoanDematVendor" (
    id text NOT NULL,
    name text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: LocationMaster; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."LocationMaster" (
    id text NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    type crm_v2."LocationType" NOT NULL,
    "parentId" text,
    description text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: MDAppointment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."MDAppointment" (
    id text NOT NULL,
    "employeeId" text NOT NULL,
    "preferredDate" timestamp(3) without time zone,
    reason text NOT NULL,
    status crm_v2."AppointmentStatus" DEFAULT 'PENDING'::crm_v2."AppointmentStatus" NOT NULL,
    remarks text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: MDApprovalRequest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."MDApprovalRequest" (
    id text NOT NULL,
    title text NOT NULL,
    description text,
    amount double precision,
    status crm_v2."MDApprovalStatus" DEFAULT 'PENDING'::crm_v2."MDApprovalStatus" NOT NULL,
    "requestedById" text NOT NULL,
    "respondedById" text,
    "responseNote" text,
    "respondedAt" timestamp(3) without time zone,
    "financeAcknowledged" boolean DEFAULT false NOT NULL,
    "financeAcknowledgedById" text,
    "financeAcknowledgedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    attachments jsonb
);


--
-- Name: MDTaskTeam; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."MDTaskTeam" (
    id text NOT NULL,
    name text NOT NULL,
    "ownerId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: MDTaskTeamMember; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."MDTaskTeamMember" (
    id text NOT NULL,
    "teamId" text NOT NULL,
    "employeeId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: MDWatchlistEmployee; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."MDWatchlistEmployee" (
    id text NOT NULL,
    "ownerId" text NOT NULL,
    "employeeId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Meet; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."Meet" (
    id text NOT NULL,
    title text NOT NULL,
    description text,
    type crm_v2."MeetType" DEFAULT 'OFFLINE'::crm_v2."MeetType" NOT NULL,
    "meetLink" text,
    location text,
    "scheduledAt" timestamp(3) without time zone NOT NULL,
    "endTime" timestamp(3) without time zone,
    module crm_v2."MeetModule" DEFAULT 'GENERAL'::crm_v2."MeetModule" NOT NULL,
    "interviewRound" integer,
    "candidateName" text,
    "candidateRole" text,
    "departmentId" text,
    notes text,
    "resumeUrl" text,
    "isRecorded" boolean DEFAULT false NOT NULL,
    "createdById" text NOT NULL,
    "mdAppointmentId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "candidatePhone" text
);


--
-- Name: MeetParticipant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."MeetParticipant" (
    id text NOT NULL,
    "meetId" text NOT NULL,
    "userId" text NOT NULL,
    attended boolean,
    remarks text
);


--
-- Name: MentalHealthRequest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."MentalHealthRequest" (
    id text NOT NULL,
    "employeeId" text NOT NULL,
    reason text,
    status crm_v2."RequestStatus" DEFAULT 'PENDING'::crm_v2."RequestStatus" NOT NULL,
    "hrResponse" text,
    "respondedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: MonthlyPayroll; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."MonthlyPayroll" (
    id text NOT NULL,
    "employeeId" text NOT NULL,
    month integer NOT NULL,
    year integer NOT NULL,
    "totalDaysInMonth" integer NOT NULL,
    "payableDays" double precision NOT NULL,
    "unpaidLeaves" integer DEFAULT 0 NOT NULL,
    "paidLeaves" integer DEFAULT 0 NOT NULL,
    "halfDays" integer DEFAULT 0 NOT NULL,
    "lateFines" double precision DEFAULT 0 NOT NULL,
    "adjustedBasic" double precision NOT NULL,
    "adjustedHra" double precision DEFAULT 0 NOT NULL,
    "adjustedMedical" double precision NOT NULL,
    "adjustedConveyance" double precision NOT NULL,
    "adjustedOther" double precision NOT NULL,
    "adjustedSpecial" double precision NOT NULL,
    "adjustedGross" double precision NOT NULL,
    "epfEmployee" double precision NOT NULL,
    "applyEsic" boolean DEFAULT false NOT NULL,
    "esicAmount" double precision DEFAULT 0 NOT NULL,
    "applyTds" boolean DEFAULT false NOT NULL,
    "tdsAmount" double precision DEFAULT 0 NOT NULL,
    insurance double precision DEFAULT 0 NOT NULL,
    "totalDeductions" double precision NOT NULL,
    "epfEmployer" double precision NOT NULL,
    "netPayable" double precision NOT NULL,
    status crm_v2."MonthlyPayrollStatus" DEFAULT 'DRAFT'::crm_v2."MonthlyPayrollStatus" NOT NULL,
    "disbursedAt" timestamp(3) without time zone,
    "approvedById" text,
    "paidAt" timestamp(3) without time zone,
    "generatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Notice; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."Notice" (
    id text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    "createdById" text NOT NULL,
    "targetType" crm_v2."NoticeTargetType" NOT NULL,
    "targetDepartmentId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: NoticeRecipient; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."NoticeRecipient" (
    id text NOT NULL,
    "noticeId" text NOT NULL,
    "userId" text NOT NULL,
    "acknowledgedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Notification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."Notification" (
    id text NOT NULL,
    "userId" text NOT NULL,
    type crm_v2."NotificationType" NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    link text,
    "relatedId" text,
    "isRead" boolean DEFAULT false NOT NULL,
    "readAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: OutstandingCase; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."OutstandingCase" (
    id text NOT NULL,
    "leadId" integer NOT NULL,
    "srNo" integer,
    month timestamp(3) without time zone,
    dos timestamp(3) without time zone,
    status text,
    "paymentReceived" boolean DEFAULT false NOT NULL,
    "managerName" text,
    "bdmName" text,
    "patientName" text,
    treatment text,
    "hospitalName" text,
    "billAmount" double precision DEFAULT 0 NOT NULL,
    "settlementAmount" double precision DEFAULT 0 NOT NULL,
    "cashPaidByPatient" double precision DEFAULT 0 NOT NULL,
    "overallAmount" double precision DEFAULT 0 NOT NULL,
    "implantCost" double precision DEFAULT 0 NOT NULL,
    "dciCost" double precision DEFAULT 0 NOT NULL,
    "hospitalSharePct" double precision,
    "hospitalShareAmount" double precision DEFAULT 0 NOT NULL,
    "mediendSharePct" double precision,
    "mediendShareAmount" double precision DEFAULT 0 NOT NULL,
    "outstandingDays" integer,
    remarks text,
    remark2 text,
    "handledById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PLLedgerEntry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."PLLedgerEntry" (
    id text NOT NULL,
    source crm_v2."SurgeryLedgerSource" DEFAULT 'EXCEL'::crm_v2."SurgeryLedgerSource" NOT NULL,
    "importId" text,
    "sourceRow" integer,
    "leadRef" text,
    "patientName" text,
    category text,
    treatment text,
    circle text,
    "hospitalName" text,
    status text,
    month timestamp(3) without time zone,
    "managerName" text,
    "bdmName" text,
    "doctorName" text,
    "admissionDate" timestamp(3) without time zone,
    "surgeryDate" timestamp(3) without time zone,
    "paymentType" text,
    "outstandingStatus" text,
    "billAmount" double precision,
    "totalAmount" double precision,
    "totalDeduction" double precision,
    "cashOrDedPaid" double precision,
    "waivedOff" double precision,
    "hospitalSharePct" double precision,
    "hospitalShareAmount" double precision,
    "doctorCharges" double precision,
    "implantCost" double precision,
    "implantPaidBy" text,
    "instrumentsCost" double precision,
    "instrumentsPaidBy" text,
    "actualImplantCost" double precision,
    "actualInstrumentCost" double precision,
    "hospitalRecoverAmount" double precision,
    "dcCharges" double precision,
    "cabCharges" double precision,
    "referralAmount" double precision,
    "mediendSharePct" double precision,
    "mediendShareAmount" double precision,
    "mediendNetProfit" double precision,
    "mediendProfit" double precision,
    remarks text,
    "hospitalPayoutStatus" text,
    "doctorPayoutStatus" text,
    "mediendInvoiceStatus" text,
    "createdById" text,
    "updatedById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PLLedgerImport; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."PLLedgerImport" (
    id text NOT NULL,
    "fileName" text NOT NULL,
    "fileSize" integer DEFAULT 0 NOT NULL,
    status crm_v2."SurgeryLedgerUploadStatus" DEFAULT 'PROCESSING'::crm_v2."SurgeryLedgerUploadStatus" NOT NULL,
    "totalRows" integer DEFAULT 0 NOT NULL,
    "insertedRows" integer DEFAULT 0 NOT NULL,
    "skippedRows" integer DEFAULT 0 NOT NULL,
    "errorRows" integer DEFAULT 0 NOT NULL,
    errors jsonb,
    "uploadedById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PLRecord; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."PLRecord" (
    id text NOT NULL,
    "leadId" integer,
    month timestamp(3) without time zone,
    "surgeryDate" timestamp(3) without time zone,
    status text,
    "paymentType" text,
    "approvedOrCash" text,
    "paymentCollectedAt" text,
    "managerRole" text,
    "managerName" text,
    "bdmName" text,
    "patientName" text,
    "patientPhone" text,
    "doctorName" text,
    "hospitalName" text,
    category text,
    treatment text,
    circle text,
    "leadSource" text,
    "totalAmount" double precision DEFAULT 0 NOT NULL,
    "billAmount" double precision DEFAULT 0 NOT NULL,
    "cashPaidByPatient" double precision DEFAULT 0 NOT NULL,
    "cashOrDedPaid" double precision DEFAULT 0 NOT NULL,
    "referralAmount" double precision DEFAULT 0 NOT NULL,
    "cabCharges" double precision DEFAULT 0 NOT NULL,
    "implantCost" double precision DEFAULT 0 NOT NULL,
    "dcCharges" double precision DEFAULT 0 NOT NULL,
    "doctorCharges" double precision DEFAULT 0 NOT NULL,
    "hospitalSharePct" double precision,
    "hospitalShareAmount" double precision DEFAULT 0 NOT NULL,
    "mediendSharePct" double precision,
    "mediendShareAmount" double precision DEFAULT 0 NOT NULL,
    "mediendNetProfit" double precision DEFAULT 0 NOT NULL,
    "finalProfit" double precision DEFAULT 0 NOT NULL,
    "hospitalPayoutStatus" text,
    "doctorPayoutStatus" text,
    "mediendInvoiceStatus" text,
    "hospitalAmountPending" double precision DEFAULT 0 NOT NULL,
    "doctorAmountPending" double precision DEFAULT 0 NOT NULL,
    remarks text,
    "closedAt" timestamp(3) without time zone,
    "handledById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "admissionDate" timestamp(3) without time zone,
    "implantPaidBy" crm_v2."PaidByParty",
    "instrumentsCost" double precision DEFAULT 0 NOT NULL,
    "instrumentsPaidBy" crm_v2."PaidByParty",
    "costBreakdownRemarks" text,
    "doctorRemarks" text,
    "outstandingStatus" crm_v2."PLOutstandingStatus" DEFAULT 'NEW'::crm_v2."PLOutstandingStatus" NOT NULL,
    "actualImplantCost" double precision DEFAULT 0 NOT NULL,
    "actualInstrumentCost" double precision DEFAULT 0 NOT NULL,
    "hospitalRecoverAmount" double precision DEFAULT 0 NOT NULL,
    "mediendProfit" double precision DEFAULT 0 NOT NULL,
    "caseType" text,
    "instrumentsPaymentStatus" text,
    "cabStatus" text,
    "emiSubventionPct" double precision,
    "emiSubventionCharges" double precision DEFAULT 0 NOT NULL,
    "referralPct" double precision,
    "referralStatus" text,
    "referralName" text,
    "leadRef" text,
    "legacyLeadId" text
);


--
-- Name: PartyMaster; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."PartyMaster" (
    id text NOT NULL,
    name text NOT NULL,
    "partyType" crm_v2."PartyType" NOT NULL,
    "contactName" text,
    "contactEmail" text,
    "contactPhone" text,
    "gstNumber" text,
    "panNumber" text,
    address text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PaymentInstallment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."PaymentInstallment" (
    id text NOT NULL,
    "leadId" integer,
    recipient crm_v2."InstallmentRecipient" NOT NULL,
    amount double precision NOT NULL,
    "paidOn" timestamp(3) without time zone NOT NULL,
    mode crm_v2."InstallmentMode",
    reference text,
    notes text,
    "recordedById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "rejectionRemarks" text,
    "verificationStatus" crm_v2."InstallmentVerificationStatus" DEFAULT 'PENDING'::crm_v2."InstallmentVerificationStatus" NOT NULL,
    "verifiedAt" timestamp(3) without time zone,
    "verifiedById" text,
    "hospitalName" text
);


--
-- Name: PaymentModeMaster; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."PaymentModeMaster" (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    "openingBalance" double precision DEFAULT 0 NOT NULL,
    "currentBalance" double precision DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PaymentTypeMaster; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."PaymentTypeMaster" (
    id text NOT NULL,
    name text NOT NULL,
    "paymentType" crm_v2."FinancePaymentType" NOT NULL,
    description text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PayrollComponent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."PayrollComponent" (
    id text NOT NULL,
    "payrollRecordId" text NOT NULL,
    "componentType" crm_v2."PayrollComponentType" NOT NULL,
    name text NOT NULL,
    amount double precision NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PayrollRecord; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."PayrollRecord" (
    id text NOT NULL,
    "employeeId" text NOT NULL,
    month integer NOT NULL,
    year integer NOT NULL,
    "disbursedAt" timestamp(3) without time zone NOT NULL,
    "basicSalary" double precision NOT NULL,
    "grossSalary" double precision NOT NULL,
    "netSalary" double precision NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PermissionAssignment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."PermissionAssignment" (
    id text NOT NULL,
    "subjectType" crm_v2."SubjectType" DEFAULT 'USER'::crm_v2."SubjectType" NOT NULL,
    "userId" text,
    role text,
    "resourceId" text NOT NULL,
    "permissionLevel" crm_v2."PermissionLevel" DEFAULT 'NONE'::crm_v2."PermissionLevel" NOT NULL,
    "canGrant" boolean DEFAULT false NOT NULL,
    "grantedById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PermissionAuditLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."PermissionAuditLog" (
    id text NOT NULL,
    "actorId" text NOT NULL,
    "targetUserId" text NOT NULL,
    "resourceId" text NOT NULL,
    "oldLevel" crm_v2."PermissionLevel",
    "newLevel" crm_v2."PermissionLevel",
    "oldCanGrant" boolean,
    "newCanGrant" boolean,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: PnLCategory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."PnLCategory" (
    id text NOT NULL,
    name text NOT NULL,
    type crm_v2."PnLCategoryType" NOT NULL,
    "isSystem" boolean DEFAULT false NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "sourceKey" text,
    "createdById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "departmentKey" text
);


--
-- Name: PnLConfig; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."PnLConfig" (
    id text NOT NULL,
    key text NOT NULL,
    value double precision NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PnLEntry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."PnLEntry" (
    id text NOT NULL,
    "categoryId" text NOT NULL,
    month integer NOT NULL,
    year integer NOT NULL,
    amount double precision DEFAULT 0 NOT NULL,
    notes text,
    "isAutoFilled" boolean DEFAULT false NOT NULL,
    "createdById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PreAuthPDF; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."PreAuthPDF" (
    id text NOT NULL,
    "preAuthorizationId" text NOT NULL,
    version integer NOT NULL,
    "pdfUrl" text NOT NULL,
    recipients jsonb,
    "sentAt" timestamp(3) without time zone,
    "createdById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: PreAuthorization; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."PreAuthorization" (
    id text NOT NULL,
    "kypSubmissionId" text NOT NULL,
    "sumInsured" text,
    "balanceInsured" text,
    "roomRent" text,
    capping text,
    copay text,
    icu text,
    "hospitalNameSuggestion" text,
    insurance text,
    tpa text,
    "hospitalSuggestions" jsonb,
    "roomTypes" jsonb,
    "requestedHospitalName" text,
    "requestedRoomType" text,
    "bdSuggestedHospital" text,
    "diseaseDescription" text,
    "diseaseImages" jsonb,
    "preAuthRaisedAt" timestamp(3) without time zone,
    "preAuthRaisedById" text,
    "isNewHospitalRequest" boolean DEFAULT false NOT NULL,
    "newHospitalPreAuthRaised" boolean DEFAULT false NOT NULL,
    "expectedAdmissionDate" timestamp(3) without time zone,
    "expectedSurgeryDate" timestamp(3) without time zone,
    "investigationFileUrls" jsonb,
    "prescriptionFiles" jsonb,
    notes text,
    "insuranceType" text,
    "handledById" text,
    "handledAt" timestamp(3) without time zone,
    "approvalStatus" crm_v2."PreAuthStatus" DEFAULT 'PENDING'::crm_v2."PreAuthStatus" NOT NULL,
    "approvedAmount" double precision,
    "approvalNotes" text,
    "rejectionReason" text,
    "rejectionLetterUrl" text,
    "approvedAt" timestamp(3) without time zone,
    "rejectedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "heldAt" timestamp(3) without time zone,
    "heldById" text,
    "holdReason" text
);


--
-- Name: ProjectMaster; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."ProjectMaster" (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PurchaseTransaction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."PurchaseTransaction" (
    id text NOT NULL,
    "purchaseNumber" text NOT NULL,
    "itemId" text NOT NULL,
    "supplierId" text NOT NULL,
    "locationId" text NOT NULL,
    quantity double precision NOT NULL,
    "unitPrice" double precision NOT NULL,
    "totalPrice" double precision NOT NULL,
    "purchaseDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    description text,
    status crm_v2."InventoryTransactionStatus" DEFAULT 'PENDING'::crm_v2."InventoryTransactionStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdById" text NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PushSubscription; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."PushSubscription" (
    id text NOT NULL,
    "userId" text NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: RankSnapshot; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."RankSnapshot" (
    id text NOT NULL,
    "entityType" text NOT NULL,
    "entityId" text NOT NULL,
    metric text NOT NULL,
    month text NOT NULL,
    rank integer NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ReasonNoSurgeryMaster; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."ReasonNoSurgeryMaster" (
    id text NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    "displayOrder" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: RequestLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."RequestLog" (
    id text NOT NULL,
    method text NOT NULL,
    path text NOT NULL,
    status integer NOT NULL,
    "durationMs" integer NOT NULL,
    "userId" text,
    ip text,
    error text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Resource; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."Resource" (
    id text NOT NULL,
    key text NOT NULL,
    label text NOT NULL,
    type crm_v2."ResourceType" NOT NULL,
    "parentId" text,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL
);


--
-- Name: SalaryStructure; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."SalaryStructure" (
    id text NOT NULL,
    "employeeId" text NOT NULL,
    "annualCtc" double precision NOT NULL,
    "monthlyGross" double precision NOT NULL,
    "basicSalary" double precision NOT NULL,
    "hraAllowance" double precision DEFAULT 0 NOT NULL,
    "medicalAllowance" double precision NOT NULL,
    "conveyanceAllowance" double precision NOT NULL,
    "otherAllowance" double precision DEFAULT 0 NOT NULL,
    "specialAllowance" double precision NOT NULL,
    "insuranceDeduction" double precision DEFAULT 0 NOT NULL,
    "applyPf" boolean DEFAULT true NOT NULL,
    "applyTds" boolean DEFAULT false NOT NULL,
    "tdsMonthly" double precision DEFAULT 0 NOT NULL,
    "tdsRatePercent" double precision,
    "effectiveFrom" timestamp(3) without time zone NOT NULL,
    "effectiveTo" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: SalesEntry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."SalesEntry" (
    id text NOT NULL,
    "serialNumber" text NOT NULL,
    "transactionDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "projectId" text NOT NULL,
    description text NOT NULL,
    amount double precision NOT NULL,
    notes text,
    "isDeleted" boolean DEFAULT false NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "createdById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: SalesTeamBulkCostEntry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."SalesTeamBulkCostEntry" (
    id text NOT NULL,
    "costType" crm_v2."SalesTeamBulkCostType" NOT NULL,
    month integer NOT NULL,
    year integer NOT NULL,
    amount double precision NOT NULL,
    remark text NOT NULL,
    "employeeId" text,
    "createdByUserId" text NOT NULL,
    "updatedByUserId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: SalesTeamBulkCostEntryHistory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."SalesTeamBulkCostEntryHistory" (
    id text NOT NULL,
    "entryId" text,
    "costType" crm_v2."SalesTeamBulkCostType" NOT NULL,
    month integer NOT NULL,
    year integer NOT NULL,
    action text NOT NULL,
    amount double precision NOT NULL,
    remark text NOT NULL,
    "employeeId" text,
    "employeeName" text,
    "previousAmount" double precision,
    "previousRemark" text,
    "previousEmployeeId" text,
    "previousEmployeeName" text,
    "changedByUserId" text NOT NULL,
    "changedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: SalesTeamCostEntry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."SalesTeamCostEntry" (
    id text NOT NULL,
    "employeeId" text NOT NULL,
    "entryType" crm_v2."SalesTeamCostEntryType" NOT NULL,
    amount double precision NOT NULL,
    "entryDate" timestamp(3) without time zone NOT NULL,
    note text,
    "addedByUserId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: StockMovement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."StockMovement" (
    id text NOT NULL,
    "itemId" text NOT NULL,
    "locationId" text NOT NULL,
    quantity double precision NOT NULL,
    "movementType" crm_v2."StockMovementType" NOT NULL,
    "referenceId" text NOT NULL,
    "referenceType" crm_v2."StockMovementType" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdById" text NOT NULL
);


--
-- Name: SupportTicket; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."SupportTicket" (
    id text NOT NULL,
    "employeeId" text NOT NULL,
    "departmentId" text,
    subject text NOT NULL,
    description text NOT NULL,
    priority crm_v2."TicketPriority" DEFAULT 'MEDIUM'::crm_v2."TicketPriority" NOT NULL,
    status crm_v2."TicketStatus" DEFAULT 'OPEN'::crm_v2."TicketStatus" NOT NULL,
    response text,
    "respondedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "targetHeadRole" text,
    attachments jsonb
);


--
-- Name: SurgeryLedgerEntry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."SurgeryLedgerEntry" (
    id text NOT NULL,
    source crm_v2."SurgeryLedgerSource" DEFAULT 'EXCEL'::crm_v2."SurgeryLedgerSource" NOT NULL,
    "uploadId" text,
    "sourceRow" integer,
    month text,
    "leadDate" timestamp(3) without time zone,
    "managerName" text,
    "bdmName" text,
    "appointmentId" text,
    "patientNumber" text,
    "patientName" text,
    category text,
    treatment text,
    circle text,
    doctors text,
    hospitals text,
    "arrivalDate" timestamp(3) without time zone,
    "surgeryDate" timestamp(3) without time zone,
    week text,
    payment text,
    status text,
    "approvedOrCash" text,
    "cashOrDedPaid" double precision,
    total double precision,
    "billAmount" double precision,
    "totalDeduction" double precision,
    "waivedOff" double precision,
    "paymentCollectedAt" text,
    type text,
    "insuranceCompany" text,
    tpa text,
    "finalApproval" text,
    "leadSource" text,
    "hospitalSharePct" double precision,
    "hospitalShare" double precision,
    "doctorCharges" double precision,
    "doctorPaymentStatus" text,
    "instrumentsCharges" double precision,
    "instrumentsPaymentStatus" text,
    "dcCharges" double precision,
    "implantCost" double precision,
    "emiSubventionPct" double precision,
    "emiSubventionCharges" double precision,
    "cabCharges" double precision,
    "cabStatus" text,
    "referralPct" double precision,
    "referralAmount" double precision,
    "referralStatus" text,
    referral text,
    "mediendSharePct" double precision,
    "mediendShare" double precision,
    "mediendPaymentStatus" text,
    "mediendNetProfit" double precision,
    "createdById" text,
    "updatedById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: SurgeryLedgerUpload; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."SurgeryLedgerUpload" (
    id text NOT NULL,
    "fileName" text NOT NULL,
    "fileSize" integer DEFAULT 0 NOT NULL,
    status crm_v2."SurgeryLedgerUploadStatus" DEFAULT 'PROCESSING'::crm_v2."SurgeryLedgerUploadStatus" NOT NULL,
    "totalRows" integer DEFAULT 0 NOT NULL,
    "insertedRows" integer DEFAULT 0 NOT NULL,
    "skippedRows" integer DEFAULT 0 NOT NULL,
    "errorRows" integer DEFAULT 0 NOT NULL,
    errors jsonb,
    "uploadedById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: SurgeryRemarkMaster; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."SurgeryRemarkMaster" (
    id text NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    "displayOrder" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: SyncState; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."SyncState" (
    id text NOT NULL,
    "sourceType" text DEFAULT 'mysql_leads'::text NOT NULL,
    "lastSyncedDate" timestamp(3) without time zone NOT NULL,
    "lastSyncedId" integer,
    "recordsCount" integer DEFAULT 0 NOT NULL,
    "lastRunAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: TPAMaster; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."TPAMaster" (
    id text NOT NULL,
    name text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Target; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."Target" (
    id text NOT NULL,
    "targetType" crm_v2."TargetType" NOT NULL,
    "targetForId" text NOT NULL,
    "periodType" crm_v2."PeriodType" NOT NULL,
    "periodStartDate" timestamp(3) without time zone NOT NULL,
    "periodEndDate" timestamp(3) without time zone NOT NULL,
    metric crm_v2."TargetMetric" NOT NULL,
    "targetValue" double precision NOT NULL,
    "createdById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "departmentTargets" jsonb
);


--
-- Name: TargetPnLEntry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."TargetPnLEntry" (
    id text NOT NULL,
    "departmentKey" text NOT NULL,
    "sourceKey" text NOT NULL,
    month integer NOT NULL,
    year integer NOT NULL,
    amount double precision DEFAULT 0 NOT NULL,
    notes text,
    "createdById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Task; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."Task" (
    id text NOT NULL,
    title text NOT NULL,
    description text,
    "dueDate" timestamp(3) without time zone,
    priority crm_v2."TaskPriority" DEFAULT 'MEDIUM'::crm_v2."TaskPriority" NOT NULL,
    status crm_v2."TaskStatus" DEFAULT 'PENDING'::crm_v2."TaskStatus" NOT NULL,
    "assigneeId" text NOT NULL,
    "createdById" text NOT NULL,
    "completedById" text,
    "completedAt" timestamp(3) without time zone,
    grade text,
    "completionComments" text,
    "rejectionCount" integer DEFAULT 0 NOT NULL,
    "startTime" timestamp(3) without time zone,
    "endTime" timestamp(3) without time zone,
    "allDay" boolean DEFAULT true NOT NULL,
    "projectId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: TaskActivityLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."TaskActivityLog" (
    id text NOT NULL,
    "taskId" text NOT NULL,
    "userId" text NOT NULL,
    action text NOT NULL,
    details text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TaskComment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."TaskComment" (
    id text NOT NULL,
    "taskId" text NOT NULL,
    "userId" text NOT NULL,
    content text NOT NULL,
    "parentId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TaskDueDateApproval; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."TaskDueDateApproval" (
    id text NOT NULL,
    "taskId" text NOT NULL,
    "requestedById" text NOT NULL,
    "oldDueDate" timestamp(3) without time zone,
    "newDueDate" timestamp(3) without time zone,
    reason text NOT NULL,
    status crm_v2."TaskApprovalStatus" DEFAULT 'PENDING'::crm_v2."TaskApprovalStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TaskProject; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."TaskProject" (
    id text NOT NULL,
    name text NOT NULL,
    "createdById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TaskRating; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."TaskRating" (
    id text NOT NULL,
    "taskId" text NOT NULL,
    "ratedById" text NOT NULL,
    "employeeId" text NOT NULL,
    grade integer NOT NULL,
    comments text,
    action text NOT NULL,
    month integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TierDefinition; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."TierDefinition" (
    id text NOT NULL,
    name text NOT NULL,
    metric crm_v2."TargetMetric" NOT NULL,
    "thresholdValue" double precision NOT NULL,
    "order" integer NOT NULL,
    "rewardAmount" double precision,
    "createdById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: TreatmentCategoryMaster; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."TreatmentCategoryMaster" (
    id text NOT NULL,
    name text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: TreatmentMaster; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."TreatmentMaster" (
    id text NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    "atsNewDelhi" double precision,
    "atsMumbai" double precision,
    "atsPune" double precision,
    "atsHyderabad" double precision,
    "atsBangalore" double precision,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."User" (
    id text NOT NULL,
    email text NOT NULL,
    "passwordHash" text NOT NULL,
    name text NOT NULL,
    role crm_v2."UserRole" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    address text,
    "phoneNumber" text,
    "profilePicture" text,
    gender text,
    "emergencyContactName" text,
    "emergencyContactPhone" text,
    "currentAddress" jsonb,
    "permanentAddress" jsonb
);


--
-- Name: UserCrmPermission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."UserCrmPermission" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "permissionKey" text NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    "grantedById" text,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: UserFeaturePermission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."UserFeaturePermission" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "featureKey" text NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    "grantedById" text,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: UserStatus; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."UserStatus" (
    id text NOT NULL,
    "userId" text NOT NULL,
    kind crm_v2."UserStatusKind" NOT NULL,
    label text,
    "startsAt" timestamp(3) without time zone NOT NULL,
    "endsAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: UserTaskSeen; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."UserTaskSeen" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "taskId" text NOT NULL,
    "lastSeenAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Warning; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."Warning" (
    id text NOT NULL,
    "employeeId" text NOT NULL,
    "taskId" text,
    type crm_v2."WarningType" NOT NULL,
    note text NOT NULL,
    "issuedById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: WorkLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."WorkLog" (
    id text NOT NULL,
    "employeeId" text NOT NULL,
    "logDate" timestamp(3) without time zone NOT NULL,
    "intervalStart" integer NOT NULL,
    "intervalEnd" integer NOT NULL,
    description text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: WorkflowResetLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2."WorkflowResetLog" (
    id text NOT NULL,
    "leadId" integer NOT NULL,
    "patientName" text NOT NULL,
    "leadRef" text NOT NULL,
    "previousStepNumber" integer NOT NULL,
    "previousStepLabel" text NOT NULL,
    "previousCaseStage" crm_v2."CaseStage" NOT NULL,
    "resetToStepNumber" integer NOT NULL,
    "resetToStepLabel" text NOT NULL,
    "resetToCaseStage" crm_v2."CaseStage" NOT NULL,
    "stepsReverted" integer NOT NULL,
    reason text NOT NULL,
    "resetById" text NOT NULL,
    "resetAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "ipAddress" text,
    "userAgent" text
);


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Name: _prisma_migrations_backup_20260921; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2._prisma_migrations_backup_20260921 (
    id character varying(36),
    checksum character varying(64),
    finished_at timestamp with time zone,
    migration_name character varying(255),
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone,
    applied_steps_count integer
);


--
-- Name: inventory_attachment_bytes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2.inventory_attachment_bytes (
    workspace_id text NOT NULL,
    id text NOT NULL,
    bytes bytea NOT NULL
);


--
-- Name: inventory_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2.inventory_attachments (
    workspace_id text NOT NULL,
    id text NOT NULL,
    data jsonb NOT NULL
);


--
-- Name: inventory_audit_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2.inventory_audit_events (
    workspace_id text NOT NULL,
    id text NOT NULL,
    at timestamp(3) without time zone NOT NULL,
    data jsonb NOT NULL
);


--
-- Name: inventory_balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2.inventory_balances (
    workspace_id text NOT NULL,
    id text NOT NULL,
    data jsonb NOT NULL
);


--
-- Name: inventory_command_receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2.inventory_command_receipts (
    workspace_id text NOT NULL,
    request_id text NOT NULL,
    body_hash text NOT NULL,
    revision bigint NOT NULL
);


--
-- Name: inventory_deliveries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2.inventory_deliveries (
    workspace_id text NOT NULL,
    id text NOT NULL,
    data jsonb NOT NULL
);


--
-- Name: inventory_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2.inventory_locations (
    workspace_id text NOT NULL,
    id text NOT NULL,
    data jsonb NOT NULL
);


--
-- Name: inventory_lots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2.inventory_lots (
    workspace_id text NOT NULL,
    id text NOT NULL,
    data jsonb NOT NULL
);


--
-- Name: inventory_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2.inventory_payments (
    workspace_id text NOT NULL,
    id text NOT NULL,
    data jsonb NOT NULL
);


--
-- Name: inventory_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2.inventory_products (
    workspace_id text NOT NULL,
    id text NOT NULL,
    data jsonb NOT NULL
);


--
-- Name: inventory_purchases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2.inventory_purchases (
    workspace_id text NOT NULL,
    id text NOT NULL,
    data jsonb NOT NULL
);


--
-- Name: inventory_sales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2.inventory_sales (
    workspace_id text NOT NULL,
    id text NOT NULL,
    data jsonb NOT NULL
);


--
-- Name: inventory_transfers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2.inventory_transfers (
    workspace_id text NOT NULL,
    id text NOT NULL,
    data jsonb NOT NULL
);


--
-- Name: inventory_vendors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2.inventory_vendors (
    workspace_id text NOT NULL,
    id text NOT NULL,
    data jsonb NOT NULL
);


--
-- Name: inventory_workspaces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2.inventory_workspaces (
    workspace_id text NOT NULL,
    revision bigint DEFAULT 0 NOT NULL
);


--
-- Name: status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2.status (
    id integer NOT NULL,
    "categoryId" integer NOT NULL,
    "groupId" integer NOT NULL,
    status text NOT NULL,
    code text NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: status_category; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2.status_category (
    id integer NOT NULL,
    category text NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: status_category_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE crm_v2.status_category_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: status_category_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE crm_v2.status_category_id_seq OWNED BY crm_v2.status_category.id;


--
-- Name: status_group; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE crm_v2.status_group (
    id integer NOT NULL,
    "categoryId" integer NOT NULL,
    "group" text NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: status_group_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE crm_v2.status_group_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: status_group_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE crm_v2.status_group_id_seq OWNED BY crm_v2.status_group.id;


--
-- Name: status_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE crm_v2.status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: status_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE crm_v2.status_id_seq OWNED BY crm_v2.status.id;


--
-- Name: IncomingLead id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."IncomingLead" ALTER COLUMN id SET DEFAULT nextval('crm_v2."IncomingLead_id_seq"'::regclass);


--
-- Name: Lead id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."Lead" ALTER COLUMN id SET DEFAULT nextval('crm_v2."Lead_id_seq"'::regclass);


--
-- Name: status id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2.status ALTER COLUMN id SET DEFAULT nextval('crm_v2.status_id_seq'::regclass);


--
-- Name: status_category id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2.status_category ALTER COLUMN id SET DEFAULT nextval('crm_v2.status_category_id_seq'::regclass);


--
-- Name: status_group id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2.status_group ALTER COLUMN id SET DEFAULT nextval('crm_v2.status_group_id_seq'::regclass);


--
-- Name: AdmissionRecordImplantUsage AdmissionRecordImplantUsage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."AdmissionRecordImplantUsage"
    ADD CONSTRAINT "AdmissionRecordImplantUsage_pkey" PRIMARY KEY (id);


--
-- Name: AdmissionRecordPrescriptionImage AdmissionRecordPrescriptionImage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."AdmissionRecordPrescriptionImage"
    ADD CONSTRAINT "AdmissionRecordPrescriptionImage_pkey" PRIMARY KEY (id);


--
-- Name: AdmissionRecord AdmissionRecord_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."AdmissionRecord"
    ADD CONSTRAINT "AdmissionRecord_pkey" PRIMARY KEY (id);


--
-- Name: AiConversation AiConversation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."AiConversation"
    ADD CONSTRAINT "AiConversation_pkey" PRIMARY KEY (id);


--
-- Name: AiMessage AiMessage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."AiMessage"
    ADD CONSTRAINT "AiMessage_pkey" PRIMARY KEY (id);


--
-- Name: AiToolCall AiToolCall_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."AiToolCall"
    ADD CONSTRAINT "AiToolCall_pkey" PRIMARY KEY (id);


--
-- Name: AnesthesiaMaster AnesthesiaMaster_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."AnesthesiaMaster"
    ADD CONSTRAINT "AnesthesiaMaster_pkey" PRIMARY KEY (id);


--
-- Name: AnonymousMessage AnonymousMessage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."AnonymousMessage"
    ADD CONSTRAINT "AnonymousMessage_pkey" PRIMARY KEY (id);


--
-- Name: AppSetting AppSetting_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."AppSetting"
    ADD CONSTRAINT "AppSetting_pkey" PRIMARY KEY (key);


--
-- Name: AttendanceLog AttendanceLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."AttendanceLog"
    ADD CONSTRAINT "AttendanceLog_pkey" PRIMARY KEY (id);


--
-- Name: AttendanceNormalization AttendanceNormalization_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."AttendanceNormalization"
    ADD CONSTRAINT "AttendanceNormalization_pkey" PRIMARY KEY (id);


--
-- Name: BonusRule BonusRule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."BonusRule"
    ADD CONSTRAINT "BonusRule_pkey" PRIMARY KEY (id);


--
-- Name: BulkLeadReassignmentRun BulkLeadReassignmentRun_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."BulkLeadReassignmentRun"
    ADD CONSTRAINT "BulkLeadReassignmentRun_pkey" PRIMARY KEY (id);


--
-- Name: CallNote CallNote_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CallNote"
    ADD CONSTRAINT "CallNote_pkey" PRIMARY KEY (id);


--
-- Name: CampaignCPL CampaignCPL_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CampaignCPL"
    ADD CONSTRAINT "CampaignCPL_pkey" PRIMARY KEY (id);


--
-- Name: CaseChatMessage CaseChatMessage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CaseChatMessage"
    ADD CONSTRAINT "CaseChatMessage_pkey" PRIMARY KEY (id);


--
-- Name: CaseStageHistory CaseStageHistory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CaseStageHistory"
    ADD CONSTRAINT "CaseStageHistory_pkey" PRIMARY KEY (id);


--
-- Name: ChatReadReceipt ChatReadReceipt_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."ChatReadReceipt"
    ADD CONSTRAINT "ChatReadReceipt_pkey" PRIMARY KEY (id);


--
-- Name: ComplianceCall ComplianceCall_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."ComplianceCall"
    ADD CONSTRAINT "ComplianceCall_pkey" PRIMARY KEY (id);


--
-- Name: CrmActivityLog CrmActivityLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CrmActivityLog"
    ADD CONSTRAINT "CrmActivityLog_pkey" PRIMARY KEY (id);


--
-- Name: CrmAssignmentPreviewLog CrmAssignmentPreviewLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CrmAssignmentPreviewLog"
    ADD CONSTRAINT "CrmAssignmentPreviewLog_pkey" PRIMARY KEY (id);


--
-- Name: CrmAssignmentRuleMember CrmAssignmentRuleMember_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CrmAssignmentRuleMember"
    ADD CONSTRAINT "CrmAssignmentRuleMember_pkey" PRIMARY KEY (id);


--
-- Name: CrmAssignmentRule CrmAssignmentRule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CrmAssignmentRule"
    ADD CONSTRAINT "CrmAssignmentRule_pkey" PRIMARY KEY (id);


--
-- Name: CrmCampaignBdDailyLimit CrmCampaignBdDailyLimit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CrmCampaignBdDailyLimit"
    ADD CONSTRAINT "CrmCampaignBdDailyLimit_pkey" PRIMARY KEY (id);


--
-- Name: CrmCampaignCircleSelection CrmCampaignCircleSelection_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CrmCampaignCircleSelection"
    ADD CONSTRAINT "CrmCampaignCircleSelection_pkey" PRIMARY KEY (id);


--
-- Name: CrmCampaignCircle CrmCampaignCircle_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CrmCampaignCircle"
    ADD CONSTRAINT "CrmCampaignCircle_pkey" PRIMARY KEY (id);


--
-- Name: CrmCampaignCity CrmCampaignCity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CrmCampaignCity"
    ADD CONSTRAINT "CrmCampaignCity_pkey" PRIMARY KEY (id);


--
-- Name: CrmCampaignLeadSource CrmCampaignLeadSource_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CrmCampaignLeadSource"
    ADD CONSTRAINT "CrmCampaignLeadSource_pkey" PRIMARY KEY (id);


--
-- Name: CrmCampaignSource CrmCampaignSource_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CrmCampaignSource"
    ADD CONSTRAINT "CrmCampaignSource_pkey" PRIMARY KEY (id);


--
-- Name: CrmCampaignTeamLeadAssignment CrmCampaignTeamLeadAssignment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CrmCampaignTeamLeadAssignment"
    ADD CONSTRAINT "CrmCampaignTeamLeadAssignment_pkey" PRIMARY KEY (id);


--
-- Name: CrmCampaign CrmCampaign_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CrmCampaign"
    ADD CONSTRAINT "CrmCampaign_pkey" PRIMARY KEY (id);


--
-- Name: CrmSubStatusMaster CrmSubStatusMaster_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CrmSubStatusMaster"
    ADD CONSTRAINT "CrmSubStatusMaster_pkey" PRIMARY KEY (id);


--
-- Name: CronJobLog CronJobLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CronJobLog"
    ADD CONSTRAINT "CronJobLog_pkey" PRIMARY KEY (id);


--
-- Name: CumulativeReportManualEntry CumulativeReportManualEntry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CumulativeReportManualEntry"
    ADD CONSTRAINT "CumulativeReportManualEntry_pkey" PRIMARY KEY (id);


--
-- Name: DailyCampaignSpend DailyCampaignSpend_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."DailyCampaignSpend"
    ADD CONSTRAINT "DailyCampaignSpend_pkey" PRIMARY KEY (id);


--
-- Name: DepartmentRevenue DepartmentRevenue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."DepartmentRevenue"
    ADD CONSTRAINT "DepartmentRevenue_pkey" PRIMARY KEY (id);


--
-- Name: DepartmentTeam DepartmentTeam_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."DepartmentTeam"
    ADD CONSTRAINT "DepartmentTeam_pkey" PRIMARY KEY (id);


--
-- Name: Department Department_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."Department"
    ADD CONSTRAINT "Department_pkey" PRIMARY KEY (id);


--
-- Name: DischargeSheet DischargeSheet_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."DischargeSheet"
    ADD CONSTRAINT "DischargeSheet_pkey" PRIMARY KEY (id);


--
-- Name: DoctorAppAccount DoctorAppAccount_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."DoctorAppAccount"
    ADD CONSTRAINT "DoctorAppAccount_pkey" PRIMARY KEY (id);


--
-- Name: DoctorAppRefreshToken DoctorAppRefreshToken_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."DoctorAppRefreshToken"
    ADD CONSTRAINT "DoctorAppRefreshToken_pkey" PRIMARY KEY (id);


--
-- Name: DoctorAppWhatsappOtp DoctorAppWhatsappOtp_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."DoctorAppWhatsappOtp"
    ADD CONSTRAINT "DoctorAppWhatsappOtp_pkey" PRIMARY KEY (id);


--
-- Name: DoctorCabRequest DoctorCabRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."DoctorCabRequest"
    ADD CONSTRAINT "DoctorCabRequest_pkey" PRIMARY KEY (id);


--
-- Name: DoctorLeaveRequest DoctorLeaveRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."DoctorLeaveRequest"
    ADD CONSTRAINT "DoctorLeaveRequest_pkey" PRIMARY KEY (id);


--
-- Name: DoctorMaster DoctorMaster_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."DoctorMaster"
    ADD CONSTRAINT "DoctorMaster_pkey" PRIMARY KEY (id);


--
-- Name: DoctorPayoffRequestActivity DoctorPayoffRequestActivity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."DoctorPayoffRequestActivity"
    ADD CONSTRAINT "DoctorPayoffRequestActivity_pkey" PRIMARY KEY (id);


--
-- Name: DoctorPayoffRequest DoctorPayoffRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."DoctorPayoffRequest"
    ADD CONSTRAINT "DoctorPayoffRequest_pkey" PRIMARY KEY (id);


--
-- Name: DocumentTemplate DocumentTemplate_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."DocumentTemplate"
    ADD CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY (id);


--
-- Name: EmployeeDocument EmployeeDocument_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."EmployeeDocument"
    ADD CONSTRAINT "EmployeeDocument_pkey" PRIMARY KEY (id);


--
-- Name: EmployeeMasterSeatingCost EmployeeMasterSeatingCost_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."EmployeeMasterSeatingCost"
    ADD CONSTRAINT "EmployeeMasterSeatingCost_pkey" PRIMARY KEY (id);


--
-- Name: EmployeeMonthlyIncentive EmployeeMonthlyIncentive_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."EmployeeMonthlyIncentive"
    ADD CONSTRAINT "EmployeeMonthlyIncentive_pkey" PRIMARY KEY (id);


--
-- Name: EmployeeMonthlySeatingMiscCostHistory EmployeeMonthlySeatingMiscCostHistory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."EmployeeMonthlySeatingMiscCostHistory"
    ADD CONSTRAINT "EmployeeMonthlySeatingMiscCostHistory_pkey" PRIMARY KEY (id);


--
-- Name: EmployeeMonthlySeatingMiscCost EmployeeMonthlySeatingMiscCost_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."EmployeeMonthlySeatingMiscCost"
    ADD CONSTRAINT "EmployeeMonthlySeatingMiscCost_pkey" PRIMARY KEY (id);


--
-- Name: EmployeeProfileActivityLog EmployeeProfileActivityLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."EmployeeProfileActivityLog"
    ADD CONSTRAINT "EmployeeProfileActivityLog_pkey" PRIMARY KEY (id);


--
-- Name: EmployeeSalesTeamSalaryOverrideHistory EmployeeSalesTeamSalaryOverrideHistory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."EmployeeSalesTeamSalaryOverrideHistory"
    ADD CONSTRAINT "EmployeeSalesTeamSalaryOverrideHistory_pkey" PRIMARY KEY (id);


--
-- Name: EmployeeSalesTeamSalaryOverride EmployeeSalesTeamSalaryOverride_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."EmployeeSalesTeamSalaryOverride"
    ADD CONSTRAINT "EmployeeSalesTeamSalaryOverride_pkey" PRIMARY KEY (id);


--
-- Name: Employee Employee_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."Employee"
    ADD CONSTRAINT "Employee_pkey" PRIMARY KEY (id);


--
-- Name: Feedback Feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."Feedback"
    ADD CONSTRAINT "Feedback_pkey" PRIMARY KEY (id);


--
-- Name: FollowUpReasonMaster FollowUpReasonMaster_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."FollowUpReasonMaster"
    ADD CONSTRAINT "FollowUpReasonMaster_pkey" PRIMARY KEY (id);


--
-- Name: HeadMaster HeadMaster_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."HeadMaster"
    ADD CONSTRAINT "HeadMaster_pkey" PRIMARY KEY (id);


--
-- Name: Holiday Holiday_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."Holiday"
    ADD CONSTRAINT "Holiday_pkey" PRIMARY KEY (id);


--
-- Name: HospitalMasterInsurance HospitalMasterInsurance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."HospitalMasterInsurance"
    ADD CONSTRAINT "HospitalMasterInsurance_pkey" PRIMARY KEY ("hospitalId", "insuranceId");


--
-- Name: HospitalMaster HospitalMaster_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."HospitalMaster"
    ADD CONSTRAINT "HospitalMaster_pkey" PRIMARY KEY (id);


--
-- Name: HospitalSuggestion HospitalSuggestion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."HospitalSuggestion"
    ADD CONSTRAINT "HospitalSuggestion_pkey" PRIMARY KEY (id);


--
-- Name: IJPApplication IJPApplication_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."IJPApplication"
    ADD CONSTRAINT "IJPApplication_pkey" PRIMARY KEY (id);


--
-- Name: ITFreelancer ITFreelancer_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."ITFreelancer"
    ADD CONSTRAINT "ITFreelancer_pkey" PRIMARY KEY (id);


--
-- Name: ITProjectBooking ITProjectBooking_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."ITProjectBooking"
    ADD CONSTRAINT "ITProjectBooking_pkey" PRIMARY KEY (id);


--
-- Name: ITProjectResource ITProjectResource_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."ITProjectResource"
    ADD CONSTRAINT "ITProjectResource_pkey" PRIMARY KEY (id);


--
-- Name: ITProject ITProject_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."ITProject"
    ADD CONSTRAINT "ITProject_pkey" PRIMARY KEY (id);


--
-- Name: ImplantMaster ImplantMaster_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."ImplantMaster"
    ADD CONSTRAINT "ImplantMaster_pkey" PRIMARY KEY (id);


--
-- Name: IncomingLead IncomingLead_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."IncomingLead"
    ADD CONSTRAINT "IncomingLead_pkey" PRIMARY KEY (id);


--
-- Name: IncrementRequest IncrementRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."IncrementRequest"
    ADD CONSTRAINT "IncrementRequest_pkey" PRIMARY KEY (id);


--
-- Name: InsuranceCase InsuranceCase_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."InsuranceCase"
    ADD CONSTRAINT "InsuranceCase_pkey" PRIMARY KEY (id);


--
-- Name: InsuranceInitiateForm InsuranceInitiateForm_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."InsuranceInitiateForm"
    ADD CONSTRAINT "InsuranceInitiateForm_pkey" PRIMARY KEY (id);


--
-- Name: InsuranceMaster InsuranceMaster_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."InsuranceMaster"
    ADD CONSTRAINT "InsuranceMaster_pkey" PRIMARY KEY (id);


--
-- Name: InsuranceQuery InsuranceQuery_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."InsuranceQuery"
    ADD CONSTRAINT "InsuranceQuery_pkey" PRIMARY KEY (id);


--
-- Name: InternalJobPosting InternalJobPosting_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."InternalJobPosting"
    ADD CONSTRAINT "InternalJobPosting_pkey" PRIMARY KEY (id);


--
-- Name: InvoiceRequestActivity InvoiceRequestActivity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."InvoiceRequestActivity"
    ADD CONSTRAINT "InvoiceRequestActivity_pkey" PRIMARY KEY (id);


--
-- Name: InvoiceRequest InvoiceRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."InvoiceRequest"
    ADD CONSTRAINT "InvoiceRequest_pkey" PRIMARY KEY (id);


--
-- Name: IssueTransaction IssueTransaction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."IssueTransaction"
    ADD CONSTRAINT "IssueTransaction_pkey" PRIMARY KEY (id);


--
-- Name: ItemMaster ItemMaster_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."ItemMaster"
    ADD CONSTRAINT "ItemMaster_pkey" PRIMARY KEY (id);


--
-- Name: KYPSubmission KYPSubmission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."KYPSubmission"
    ADD CONSTRAINT "KYPSubmission_pkey" PRIMARY KEY (id);


--
-- Name: KnowledgeChunk KnowledgeChunk_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."KnowledgeChunk"
    ADD CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY (id);


--
-- Name: KnowledgeDocumentDepartment KnowledgeDocumentDepartment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."KnowledgeDocumentDepartment"
    ADD CONSTRAINT "KnowledgeDocumentDepartment_pkey" PRIMARY KEY (id);


--
-- Name: KnowledgeDocumentRole KnowledgeDocumentRole_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."KnowledgeDocumentRole"
    ADD CONSTRAINT "KnowledgeDocumentRole_pkey" PRIMARY KEY (id);


--
-- Name: KnowledgeDocumentUser KnowledgeDocumentUser_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."KnowledgeDocumentUser"
    ADD CONSTRAINT "KnowledgeDocumentUser_pkey" PRIMARY KEY (id);


--
-- Name: KnowledgeDocument KnowledgeDocument_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."KnowledgeDocument"
    ADD CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY (id);


--
-- Name: LeadIdMigrationMap LeadIdMigrationMap_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LeadIdMigrationMap"
    ADD CONSTRAINT "LeadIdMigrationMap_pkey" PRIMARY KEY ("tableName", "oldId");


--
-- Name: LeadIdMigrationMap LeadIdMigrationMap_tableName_newId_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LeadIdMigrationMap"
    ADD CONSTRAINT "LeadIdMigrationMap_tableName_newId_key" UNIQUE ("tableName", "newId");


--
-- Name: LeadOpdAppointmentPrescriptionImage LeadOpdAppointmentPrescriptionImage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LeadOpdAppointmentPrescriptionImage"
    ADD CONSTRAINT "LeadOpdAppointmentPrescriptionImage_pkey" PRIMARY KEY (id);


--
-- Name: LeadOpdAppointment LeadOpdAppointment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LeadOpdAppointment"
    ADD CONSTRAINT "LeadOpdAppointment_pkey" PRIMARY KEY (id);


--
-- Name: LeadOpdPrescriptionImage LeadOpdPrescriptionImage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LeadOpdPrescriptionImage"
    ADD CONSTRAINT "LeadOpdPrescriptionImage_pkey" PRIMARY KEY (id);


--
-- Name: LeadQrCallAuditLog LeadQrCallAuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LeadQrCallAuditLog"
    ADD CONSTRAINT "LeadQrCallAuditLog_pkey" PRIMARY KEY (id);


--
-- Name: LeadQrPublicLink LeadQrPublicLink_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LeadQrPublicLink"
    ADD CONSTRAINT "LeadQrPublicLink_pkey" PRIMARY KEY (id);


--
-- Name: LeadQrScanLink LeadQrScanLink_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LeadQrScanLink"
    ADD CONSTRAINT "LeadQrScanLink_pkey" PRIMARY KEY (id);


--
-- Name: LeadRemarkEntry LeadRemarkEntry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LeadRemarkEntry"
    ADD CONSTRAINT "LeadRemarkEntry_pkey" PRIMARY KEY (id);


--
-- Name: LeadRemark LeadRemark_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LeadRemark"
    ADD CONSTRAINT "LeadRemark_pkey" PRIMARY KEY (id);


--
-- Name: LeadStageEvent LeadStageEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LeadStageEvent"
    ADD CONSTRAINT "LeadStageEvent_pkey" PRIMARY KEY (id);


--
-- Name: Lead Lead_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."Lead"
    ADD CONSTRAINT "Lead_pkey" PRIMARY KEY (id);


--
-- Name: LeaveBalanceEditRequest LeaveBalanceEditRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LeaveBalanceEditRequest"
    ADD CONSTRAINT "LeaveBalanceEditRequest_pkey" PRIMARY KEY (id);


--
-- Name: LeaveBalance LeaveBalance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LeaveBalance"
    ADD CONSTRAINT "LeaveBalance_pkey" PRIMARY KEY (id);


--
-- Name: LeaveRequest LeaveRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LeaveRequest"
    ADD CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY (id);


--
-- Name: LeaveTypeMaster LeaveTypeMaster_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LeaveTypeMaster"
    ADD CONSTRAINT "LeaveTypeMaster_pkey" PRIMARY KEY (id);


--
-- Name: LedgerAuditLog LedgerAuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LedgerAuditLog"
    ADD CONSTRAINT "LedgerAuditLog_pkey" PRIMARY KEY (id);


--
-- Name: LedgerEntry LedgerEntry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LedgerEntry"
    ADD CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY (id);


--
-- Name: LoanDematVendor LoanDematVendor_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LoanDematVendor"
    ADD CONSTRAINT "LoanDematVendor_pkey" PRIMARY KEY (id);


--
-- Name: LocationMaster LocationMaster_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LocationMaster"
    ADD CONSTRAINT "LocationMaster_pkey" PRIMARY KEY (id);


--
-- Name: MDAppointment MDAppointment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."MDAppointment"
    ADD CONSTRAINT "MDAppointment_pkey" PRIMARY KEY (id);


--
-- Name: MDApprovalRequest MDApprovalRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."MDApprovalRequest"
    ADD CONSTRAINT "MDApprovalRequest_pkey" PRIMARY KEY (id);


--
-- Name: MDTaskTeamMember MDTaskTeamMember_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."MDTaskTeamMember"
    ADD CONSTRAINT "MDTaskTeamMember_pkey" PRIMARY KEY (id);


--
-- Name: MDTaskTeam MDTaskTeam_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."MDTaskTeam"
    ADD CONSTRAINT "MDTaskTeam_pkey" PRIMARY KEY (id);


--
-- Name: MDWatchlistEmployee MDWatchlistEmployee_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."MDWatchlistEmployee"
    ADD CONSTRAINT "MDWatchlistEmployee_pkey" PRIMARY KEY (id);


--
-- Name: MeetParticipant MeetParticipant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."MeetParticipant"
    ADD CONSTRAINT "MeetParticipant_pkey" PRIMARY KEY (id);


--
-- Name: Meet Meet_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."Meet"
    ADD CONSTRAINT "Meet_pkey" PRIMARY KEY (id);


--
-- Name: MentalHealthRequest MentalHealthRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."MentalHealthRequest"
    ADD CONSTRAINT "MentalHealthRequest_pkey" PRIMARY KEY (id);


--
-- Name: MonthlyPayroll MonthlyPayroll_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."MonthlyPayroll"
    ADD CONSTRAINT "MonthlyPayroll_pkey" PRIMARY KEY (id);


--
-- Name: NoticeRecipient NoticeRecipient_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."NoticeRecipient"
    ADD CONSTRAINT "NoticeRecipient_pkey" PRIMARY KEY (id);


--
-- Name: Notice Notice_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."Notice"
    ADD CONSTRAINT "Notice_pkey" PRIMARY KEY (id);


--
-- Name: Notification Notification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."Notification"
    ADD CONSTRAINT "Notification_pkey" PRIMARY KEY (id);


--
-- Name: OutstandingCase OutstandingCase_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."OutstandingCase"
    ADD CONSTRAINT "OutstandingCase_pkey" PRIMARY KEY (id);


--
-- Name: PLLedgerEntry PLLedgerEntry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."PLLedgerEntry"
    ADD CONSTRAINT "PLLedgerEntry_pkey" PRIMARY KEY (id);


--
-- Name: PLLedgerImport PLLedgerImport_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."PLLedgerImport"
    ADD CONSTRAINT "PLLedgerImport_pkey" PRIMARY KEY (id);


--
-- Name: PLRecord PLRecord_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."PLRecord"
    ADD CONSTRAINT "PLRecord_pkey" PRIMARY KEY (id);


--
-- Name: PartyMaster PartyMaster_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."PartyMaster"
    ADD CONSTRAINT "PartyMaster_pkey" PRIMARY KEY (id);


--
-- Name: PaymentInstallment PaymentInstallment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."PaymentInstallment"
    ADD CONSTRAINT "PaymentInstallment_pkey" PRIMARY KEY (id);


--
-- Name: PaymentModeMaster PaymentModeMaster_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."PaymentModeMaster"
    ADD CONSTRAINT "PaymentModeMaster_pkey" PRIMARY KEY (id);


--
-- Name: PaymentTypeMaster PaymentTypeMaster_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."PaymentTypeMaster"
    ADD CONSTRAINT "PaymentTypeMaster_pkey" PRIMARY KEY (id);


--
-- Name: PayrollComponent PayrollComponent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."PayrollComponent"
    ADD CONSTRAINT "PayrollComponent_pkey" PRIMARY KEY (id);


--
-- Name: PayrollRecord PayrollRecord_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."PayrollRecord"
    ADD CONSTRAINT "PayrollRecord_pkey" PRIMARY KEY (id);


--
-- Name: PermissionAssignment PermissionAssignment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."PermissionAssignment"
    ADD CONSTRAINT "PermissionAssignment_pkey" PRIMARY KEY (id);


--
-- Name: PermissionAuditLog PermissionAuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."PermissionAuditLog"
    ADD CONSTRAINT "PermissionAuditLog_pkey" PRIMARY KEY (id);


--
-- Name: PnLCategory PnLCategory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."PnLCategory"
    ADD CONSTRAINT "PnLCategory_pkey" PRIMARY KEY (id);


--
-- Name: PnLConfig PnLConfig_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."PnLConfig"
    ADD CONSTRAINT "PnLConfig_pkey" PRIMARY KEY (id);


--
-- Name: PnLEntry PnLEntry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."PnLEntry"
    ADD CONSTRAINT "PnLEntry_pkey" PRIMARY KEY (id);


--
-- Name: PreAuthPDF PreAuthPDF_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."PreAuthPDF"
    ADD CONSTRAINT "PreAuthPDF_pkey" PRIMARY KEY (id);


--
-- Name: PreAuthorization PreAuthorization_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."PreAuthorization"
    ADD CONSTRAINT "PreAuthorization_pkey" PRIMARY KEY (id);


--
-- Name: ProjectMaster ProjectMaster_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."ProjectMaster"
    ADD CONSTRAINT "ProjectMaster_pkey" PRIMARY KEY (id);


--
-- Name: PurchaseTransaction PurchaseTransaction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."PurchaseTransaction"
    ADD CONSTRAINT "PurchaseTransaction_pkey" PRIMARY KEY (id);


--
-- Name: PushSubscription PushSubscription_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."PushSubscription"
    ADD CONSTRAINT "PushSubscription_pkey" PRIMARY KEY (id);


--
-- Name: RankSnapshot RankSnapshot_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."RankSnapshot"
    ADD CONSTRAINT "RankSnapshot_pkey" PRIMARY KEY (id);


--
-- Name: ReasonNoSurgeryMaster ReasonNoSurgeryMaster_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."ReasonNoSurgeryMaster"
    ADD CONSTRAINT "ReasonNoSurgeryMaster_pkey" PRIMARY KEY (id);


--
-- Name: RequestLog RequestLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."RequestLog"
    ADD CONSTRAINT "RequestLog_pkey" PRIMARY KEY (id);


--
-- Name: Resource Resource_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."Resource"
    ADD CONSTRAINT "Resource_pkey" PRIMARY KEY (id);


--
-- Name: SalaryStructure SalaryStructure_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."SalaryStructure"
    ADD CONSTRAINT "SalaryStructure_pkey" PRIMARY KEY (id);


--
-- Name: SalesEntry SalesEntry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."SalesEntry"
    ADD CONSTRAINT "SalesEntry_pkey" PRIMARY KEY (id);


--
-- Name: SalesTeamBulkCostEntryHistory SalesTeamBulkCostEntryHistory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."SalesTeamBulkCostEntryHistory"
    ADD CONSTRAINT "SalesTeamBulkCostEntryHistory_pkey" PRIMARY KEY (id);


--
-- Name: SalesTeamBulkCostEntry SalesTeamBulkCostEntry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."SalesTeamBulkCostEntry"
    ADD CONSTRAINT "SalesTeamBulkCostEntry_pkey" PRIMARY KEY (id);


--
-- Name: SalesTeamCostEntry SalesTeamCostEntry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."SalesTeamCostEntry"
    ADD CONSTRAINT "SalesTeamCostEntry_pkey" PRIMARY KEY (id);


--
-- Name: StockMovement StockMovement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."StockMovement"
    ADD CONSTRAINT "StockMovement_pkey" PRIMARY KEY (id);


--
-- Name: SupportTicket SupportTicket_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."SupportTicket"
    ADD CONSTRAINT "SupportTicket_pkey" PRIMARY KEY (id);


--
-- Name: SurgeryLedgerEntry SurgeryLedgerEntry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."SurgeryLedgerEntry"
    ADD CONSTRAINT "SurgeryLedgerEntry_pkey" PRIMARY KEY (id);


--
-- Name: SurgeryLedgerUpload SurgeryLedgerUpload_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."SurgeryLedgerUpload"
    ADD CONSTRAINT "SurgeryLedgerUpload_pkey" PRIMARY KEY (id);


--
-- Name: SurgeryRemarkMaster SurgeryRemarkMaster_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."SurgeryRemarkMaster"
    ADD CONSTRAINT "SurgeryRemarkMaster_pkey" PRIMARY KEY (id);


--
-- Name: SyncState SyncState_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."SyncState"
    ADD CONSTRAINT "SyncState_pkey" PRIMARY KEY (id);


--
-- Name: TPAMaster TPAMaster_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."TPAMaster"
    ADD CONSTRAINT "TPAMaster_pkey" PRIMARY KEY (id);


--
-- Name: TargetPnLEntry TargetPnLEntry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."TargetPnLEntry"
    ADD CONSTRAINT "TargetPnLEntry_pkey" PRIMARY KEY (id);


--
-- Name: Target Target_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."Target"
    ADD CONSTRAINT "Target_pkey" PRIMARY KEY (id);


--
-- Name: TaskActivityLog TaskActivityLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."TaskActivityLog"
    ADD CONSTRAINT "TaskActivityLog_pkey" PRIMARY KEY (id);


--
-- Name: TaskComment TaskComment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."TaskComment"
    ADD CONSTRAINT "TaskComment_pkey" PRIMARY KEY (id);


--
-- Name: TaskDueDateApproval TaskDueDateApproval_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."TaskDueDateApproval"
    ADD CONSTRAINT "TaskDueDateApproval_pkey" PRIMARY KEY (id);


--
-- Name: TaskProject TaskProject_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."TaskProject"
    ADD CONSTRAINT "TaskProject_pkey" PRIMARY KEY (id);


--
-- Name: TaskRating TaskRating_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."TaskRating"
    ADD CONSTRAINT "TaskRating_pkey" PRIMARY KEY (id);


--
-- Name: Task Task_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."Task"
    ADD CONSTRAINT "Task_pkey" PRIMARY KEY (id);


--
-- Name: TierDefinition TierDefinition_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."TierDefinition"
    ADD CONSTRAINT "TierDefinition_pkey" PRIMARY KEY (id);


--
-- Name: TreatmentCategoryMaster TreatmentCategoryMaster_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."TreatmentCategoryMaster"
    ADD CONSTRAINT "TreatmentCategoryMaster_pkey" PRIMARY KEY (id);


--
-- Name: TreatmentMaster TreatmentMaster_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."TreatmentMaster"
    ADD CONSTRAINT "TreatmentMaster_pkey" PRIMARY KEY (id);


--
-- Name: UserCrmPermission UserCrmPermission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."UserCrmPermission"
    ADD CONSTRAINT "UserCrmPermission_pkey" PRIMARY KEY (id);


--
-- Name: UserFeaturePermission UserFeaturePermission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."UserFeaturePermission"
    ADD CONSTRAINT "UserFeaturePermission_pkey" PRIMARY KEY (id);


--
-- Name: UserStatus UserStatus_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."UserStatus"
    ADD CONSTRAINT "UserStatus_pkey" PRIMARY KEY (id);


--
-- Name: UserTaskSeen UserTaskSeen_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."UserTaskSeen"
    ADD CONSTRAINT "UserTaskSeen_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: Warning Warning_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."Warning"
    ADD CONSTRAINT "Warning_pkey" PRIMARY KEY (id);


--
-- Name: WorkLog WorkLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."WorkLog"
    ADD CONSTRAINT "WorkLog_pkey" PRIMARY KEY (id);


--
-- Name: WorkflowResetLog WorkflowResetLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."WorkflowResetLog"
    ADD CONSTRAINT "WorkflowResetLog_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: inventory_attachment_bytes inventory_attachment_bytes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2.inventory_attachment_bytes
    ADD CONSTRAINT inventory_attachment_bytes_pkey PRIMARY KEY (workspace_id, id);


--
-- Name: inventory_attachments inventory_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2.inventory_attachments
    ADD CONSTRAINT inventory_attachments_pkey PRIMARY KEY (workspace_id, id);


--
-- Name: inventory_audit_events inventory_audit_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2.inventory_audit_events
    ADD CONSTRAINT inventory_audit_events_pkey PRIMARY KEY (workspace_id, id);


--
-- Name: inventory_balances inventory_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2.inventory_balances
    ADD CONSTRAINT inventory_balances_pkey PRIMARY KEY (workspace_id, id);


--
-- Name: inventory_command_receipts inventory_command_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2.inventory_command_receipts
    ADD CONSTRAINT inventory_command_receipts_pkey PRIMARY KEY (workspace_id, request_id);


--
-- Name: inventory_deliveries inventory_deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2.inventory_deliveries
    ADD CONSTRAINT inventory_deliveries_pkey PRIMARY KEY (workspace_id, id);


--
-- Name: inventory_locations inventory_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2.inventory_locations
    ADD CONSTRAINT inventory_locations_pkey PRIMARY KEY (workspace_id, id);


--
-- Name: inventory_lots inventory_lots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2.inventory_lots
    ADD CONSTRAINT inventory_lots_pkey PRIMARY KEY (workspace_id, id);


--
-- Name: inventory_payments inventory_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2.inventory_payments
    ADD CONSTRAINT inventory_payments_pkey PRIMARY KEY (workspace_id, id);


--
-- Name: inventory_products inventory_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2.inventory_products
    ADD CONSTRAINT inventory_products_pkey PRIMARY KEY (workspace_id, id);


--
-- Name: inventory_purchases inventory_purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2.inventory_purchases
    ADD CONSTRAINT inventory_purchases_pkey PRIMARY KEY (workspace_id, id);


--
-- Name: inventory_sales inventory_sales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2.inventory_sales
    ADD CONSTRAINT inventory_sales_pkey PRIMARY KEY (workspace_id, id);


--
-- Name: inventory_transfers inventory_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2.inventory_transfers
    ADD CONSTRAINT inventory_transfers_pkey PRIMARY KEY (workspace_id, id);


--
-- Name: inventory_vendors inventory_vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2.inventory_vendors
    ADD CONSTRAINT inventory_vendors_pkey PRIMARY KEY (workspace_id, id);


--
-- Name: inventory_workspaces inventory_workspaces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2.inventory_workspaces
    ADD CONSTRAINT inventory_workspaces_pkey PRIMARY KEY (workspace_id);


--
-- Name: status_category status_category_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2.status_category
    ADD CONSTRAINT status_category_pkey PRIMARY KEY (id);


--
-- Name: status_group status_group_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2.status_group
    ADD CONSTRAINT status_group_pkey PRIMARY KEY (id);


--
-- Name: status status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2.status
    ADD CONSTRAINT status_pkey PRIMARY KEY (id);


--
-- Name: AdmissionRecordImplantUsage_admissionRecordId_sortOrder_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AdmissionRecordImplantUsage_admissionRecordId_sortOrder_idx" ON crm_v2."AdmissionRecordImplantUsage" USING btree ("admissionRecordId", "sortOrder");


--
-- Name: AdmissionRecordImplantUsage_implantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AdmissionRecordImplantUsage_implantId_idx" ON crm_v2."AdmissionRecordImplantUsage" USING btree ("implantId");


--
-- Name: AdmissionRecordPrescriptionImage_admissionRecordId_sortOrde_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AdmissionRecordPrescriptionImage_admissionRecordId_sortOrde_idx" ON crm_v2."AdmissionRecordPrescriptionImage" USING btree ("admissionRecordId", "sortOrder");


--
-- Name: AdmissionRecord_leadId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AdmissionRecord_leadId_idx" ON crm_v2."AdmissionRecord" USING btree ("leadId");


--
-- Name: AdmissionRecord_leadId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AdmissionRecord_leadId_key" ON crm_v2."AdmissionRecord" USING btree ("leadId");


--
-- Name: AiConversation_userId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AiConversation_userId_createdAt_idx" ON crm_v2."AiConversation" USING btree ("userId", "createdAt");


--
-- Name: AiMessage_conversationId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AiMessage_conversationId_createdAt_idx" ON crm_v2."AiMessage" USING btree ("conversationId", "createdAt");


--
-- Name: AiMessage_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AiMessage_userId_idx" ON crm_v2."AiMessage" USING btree ("userId");


--
-- Name: AiToolCall_denied_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AiToolCall_denied_idx" ON crm_v2."AiToolCall" USING btree (denied);


--
-- Name: AiToolCall_toolName_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AiToolCall_toolName_createdAt_idx" ON crm_v2."AiToolCall" USING btree ("toolName", "createdAt");


--
-- Name: AiToolCall_userId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AiToolCall_userId_createdAt_idx" ON crm_v2."AiToolCall" USING btree ("userId", "createdAt");


--
-- Name: AnesthesiaMaster_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnesthesiaMaster_isActive_idx" ON crm_v2."AnesthesiaMaster" USING btree ("isActive");


--
-- Name: AnesthesiaMaster_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnesthesiaMaster_name_idx" ON crm_v2."AnesthesiaMaster" USING btree (name);


--
-- Name: AnesthesiaMaster_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AnesthesiaMaster_name_key" ON crm_v2."AnesthesiaMaster" USING btree (name);


--
-- Name: AnonymousMessage_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnonymousMessage_createdAt_idx" ON crm_v2."AnonymousMessage" USING btree ("createdAt");


--
-- Name: AnonymousMessage_isRead_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnonymousMessage_isRead_idx" ON crm_v2."AnonymousMessage" USING btree ("isRead");


--
-- Name: AttendanceLog_employeeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AttendanceLog_employeeId_idx" ON crm_v2."AttendanceLog" USING btree ("employeeId");


--
-- Name: AttendanceLog_employeeId_logDate_punchDirection_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AttendanceLog_employeeId_logDate_punchDirection_key" ON crm_v2."AttendanceLog" USING btree ("employeeId", "logDate", "punchDirection");


--
-- Name: AttendanceLog_logDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AttendanceLog_logDate_idx" ON crm_v2."AttendanceLog" USING btree ("logDate");


--
-- Name: AttendanceLog_punchDirection_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AttendanceLog_punchDirection_idx" ON crm_v2."AttendanceLog" USING btree ("punchDirection");


--
-- Name: AttendanceNormalization_approvedById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AttendanceNormalization_approvedById_idx" ON crm_v2."AttendanceNormalization" USING btree ("approvedById");


--
-- Name: AttendanceNormalization_employeeId_date_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AttendanceNormalization_employeeId_date_key" ON crm_v2."AttendanceNormalization" USING btree ("employeeId", date);


--
-- Name: AttendanceNormalization_employeeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AttendanceNormalization_employeeId_idx" ON crm_v2."AttendanceNormalization" USING btree ("employeeId");


--
-- Name: AttendanceNormalization_managerApprovedById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AttendanceNormalization_managerApprovedById_idx" ON crm_v2."AttendanceNormalization" USING btree ("managerApprovedById");


--
-- Name: AttendanceNormalization_requestedById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AttendanceNormalization_requestedById_idx" ON crm_v2."AttendanceNormalization" USING btree ("requestedById");


--
-- Name: BonusRule_targetId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BonusRule_targetId_idx" ON crm_v2."BonusRule" USING btree ("targetId");


--
-- Name: BulkLeadReassignmentRun_actorUserId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BulkLeadReassignmentRun_actorUserId_createdAt_idx" ON crm_v2."BulkLeadReassignmentRun" USING btree ("actorUserId", "createdAt");


--
-- Name: BulkLeadReassignmentRun_nextRunAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BulkLeadReassignmentRun_nextRunAt_idx" ON crm_v2."BulkLeadReassignmentRun" USING btree ("nextRunAt");


--
-- Name: BulkLeadReassignmentRun_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BulkLeadReassignmentRun_status_createdAt_idx" ON crm_v2."BulkLeadReassignmentRun" USING btree (status, "createdAt");


--
-- Name: CallNote_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CallNote_createdAt_idx" ON crm_v2."CallNote" USING btree ("createdAt");


--
-- Name: CallNote_leadId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CallNote_leadId_idx" ON crm_v2."CallNote" USING btree ("leadId");


--
-- Name: CampaignCPL_campaignName_month_year_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CampaignCPL_campaignName_month_year_key" ON crm_v2."CampaignCPL" USING btree ("campaignName", month, year);


--
-- Name: CampaignCPL_year_month_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CampaignCPL_year_month_idx" ON crm_v2."CampaignCPL" USING btree (year, month);


--
-- Name: CaseChatMessage_leadId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CaseChatMessage_leadId_createdAt_idx" ON crm_v2."CaseChatMessage" USING btree ("leadId", "createdAt");


--
-- Name: CaseStageHistory_changedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CaseStageHistory_changedAt_idx" ON crm_v2."CaseStageHistory" USING btree ("changedAt");


--
-- Name: CaseStageHistory_leadId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CaseStageHistory_leadId_idx" ON crm_v2."CaseStageHistory" USING btree ("leadId");


--
-- Name: ChatReadReceipt_leadId_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ChatReadReceipt_leadId_userId_key" ON crm_v2."ChatReadReceipt" USING btree ("leadId", "userId");


--
-- Name: ChatReadReceipt_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ChatReadReceipt_userId_idx" ON crm_v2."ChatReadReceipt" USING btree ("userId");


--
-- Name: ComplianceCall_completedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ComplianceCall_completedAt_idx" ON crm_v2."ComplianceCall" USING btree ("completedAt");


--
-- Name: ComplianceCall_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ComplianceCall_createdAt_idx" ON crm_v2."ComplianceCall" USING btree ("createdAt");


--
-- Name: ComplianceCall_leadId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ComplianceCall_leadId_key" ON crm_v2."ComplianceCall" USING btree ("leadId");


--
-- Name: ComplianceCall_rating_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ComplianceCall_rating_idx" ON crm_v2."ComplianceCall" USING btree (rating);


--
-- Name: ComplianceCall_reviewStatus_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ComplianceCall_reviewStatus_idx" ON crm_v2."ComplianceCall" USING btree ("reviewStatus");


--
-- Name: ComplianceCall_satisfaction_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ComplianceCall_satisfaction_idx" ON crm_v2."ComplianceCall" USING btree (satisfaction);


--
-- Name: ComplianceCall_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ComplianceCall_status_idx" ON crm_v2."ComplianceCall" USING btree (status);


--
-- Name: CrmActivityLog_action_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrmActivityLog_action_createdAt_idx" ON crm_v2."CrmActivityLog" USING btree (action, "createdAt");


--
-- Name: CrmActivityLog_actorUserId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrmActivityLog_actorUserId_createdAt_idx" ON crm_v2."CrmActivityLog" USING btree ("actorUserId", "createdAt");


--
-- Name: CrmActivityLog_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrmActivityLog_createdAt_idx" ON crm_v2."CrmActivityLog" USING btree ("createdAt");


--
-- Name: CrmActivityLog_entityType_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrmActivityLog_entityType_createdAt_idx" ON crm_v2."CrmActivityLog" USING btree ("entityType", "createdAt");


--
-- Name: CrmActivityLog_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrmActivityLog_status_createdAt_idx" ON crm_v2."CrmActivityLog" USING btree (status, "createdAt");


--
-- Name: CrmAssignmentPreviewLog_currentBdUserId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrmAssignmentPreviewLog_currentBdUserId_idx" ON crm_v2."CrmAssignmentPreviewLog" USING btree ("currentBdUserId");


--
-- Name: CrmAssignmentPreviewLog_leadId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrmAssignmentPreviewLog_leadId_createdAt_idx" ON crm_v2."CrmAssignmentPreviewLog" USING btree ("leadId", "createdAt");


--
-- Name: CrmAssignmentPreviewLog_leadRef_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrmAssignmentPreviewLog_leadRef_createdAt_idx" ON crm_v2."CrmAssignmentPreviewLog" USING btree ("leadRef", "createdAt");


--
-- Name: CrmAssignmentPreviewLog_proposedBdUserId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrmAssignmentPreviewLog_proposedBdUserId_idx" ON crm_v2."CrmAssignmentPreviewLog" USING btree ("proposedBdUserId");


--
-- Name: CrmAssignmentPreviewLog_syncSource_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrmAssignmentPreviewLog_syncSource_createdAt_idx" ON crm_v2."CrmAssignmentPreviewLog" USING btree ("syncSource", "createdAt");


--
-- Name: CrmAssignmentRuleMember_employeeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrmAssignmentRuleMember_employeeId_idx" ON crm_v2."CrmAssignmentRuleMember" USING btree ("employeeId");


--
-- Name: CrmAssignmentRuleMember_ruleId_employeeId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CrmAssignmentRuleMember_ruleId_employeeId_key" ON crm_v2."CrmAssignmentRuleMember" USING btree ("ruleId", "employeeId");


--
-- Name: CrmAssignmentRuleMember_ruleId_isActive_priority_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrmAssignmentRuleMember_ruleId_isActive_priority_idx" ON crm_v2."CrmAssignmentRuleMember" USING btree ("ruleId", "isActive", priority);


--
-- Name: CrmAssignmentRule_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrmAssignmentRule_category_idx" ON crm_v2."CrmAssignmentRule" USING btree (category);


--
-- Name: CrmAssignmentRule_city_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrmAssignmentRule_city_idx" ON crm_v2."CrmAssignmentRule" USING btree (city);


--
-- Name: CrmAssignmentRule_departmentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrmAssignmentRule_departmentId_idx" ON crm_v2."CrmAssignmentRule" USING btree ("departmentId");


--
-- Name: CrmAssignmentRule_isActive_priority_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrmAssignmentRule_isActive_priority_idx" ON crm_v2."CrmAssignmentRule" USING btree ("isActive", priority);


--
-- Name: CrmCampaignBdDailyLimit_bdEmployeeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrmCampaignBdDailyLimit_bdEmployeeId_idx" ON crm_v2."CrmCampaignBdDailyLimit" USING btree ("bdEmployeeId");


--
-- Name: CrmCampaignBdDailyLimit_bdUserId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrmCampaignBdDailyLimit_bdUserId_idx" ON crm_v2."CrmCampaignBdDailyLimit" USING btree ("bdUserId");


--
-- Name: CrmCampaignBdDailyLimit_campaignId_teamLeadEmployeeId_bdEmp_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CrmCampaignBdDailyLimit_campaignId_teamLeadEmployeeId_bdEmp_key" ON crm_v2."CrmCampaignBdDailyLimit" USING btree ("campaignId", "teamLeadEmployeeId", "bdEmployeeId");


--
-- Name: CrmCampaignBdDailyLimit_campaignId_teamLeadEmployeeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrmCampaignBdDailyLimit_campaignId_teamLeadEmployeeId_idx" ON crm_v2."CrmCampaignBdDailyLimit" USING btree ("campaignId", "teamLeadEmployeeId");


--
-- Name: CrmCampaignCircleSelection_campaignId_circleId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CrmCampaignCircleSelection_campaignId_circleId_key" ON crm_v2."CrmCampaignCircleSelection" USING btree ("campaignId", "circleId");


--
-- Name: CrmCampaignCircleSelection_campaignId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrmCampaignCircleSelection_campaignId_idx" ON crm_v2."CrmCampaignCircleSelection" USING btree ("campaignId");


--
-- Name: CrmCampaignCircleSelection_circleId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrmCampaignCircleSelection_circleId_idx" ON crm_v2."CrmCampaignCircleSelection" USING btree ("circleId");


--
-- Name: CrmCampaignCircle_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrmCampaignCircle_isActive_idx" ON crm_v2."CrmCampaignCircle" USING btree ("isActive");


--
-- Name: CrmCampaignCircle_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrmCampaignCircle_name_idx" ON crm_v2."CrmCampaignCircle" USING btree (name);


--
-- Name: CrmCampaignCircle_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CrmCampaignCircle_name_key" ON crm_v2."CrmCampaignCircle" USING btree (name);


--
-- Name: CrmCampaignCity_circleId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrmCampaignCity_circleId_idx" ON crm_v2."CrmCampaignCity" USING btree ("circleId");


--
-- Name: CrmCampaignCity_circleId_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CrmCampaignCity_circleId_name_key" ON crm_v2."CrmCampaignCity" USING btree ("circleId", name);


--
-- Name: CrmCampaignCity_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrmCampaignCity_isActive_idx" ON crm_v2."CrmCampaignCity" USING btree ("isActive");


--
-- Name: CrmCampaignCity_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrmCampaignCity_name_idx" ON crm_v2."CrmCampaignCity" USING btree (name);


--
-- Name: CrmCampaignLeadSource_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrmCampaignLeadSource_isActive_idx" ON crm_v2."CrmCampaignLeadSource" USING btree ("isActive");


--
-- Name: CrmCampaignLeadSource_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrmCampaignLeadSource_name_idx" ON crm_v2."CrmCampaignLeadSource" USING btree (name);


--
-- Name: CrmCampaignLeadSource_sourceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrmCampaignLeadSource_sourceId_idx" ON crm_v2."CrmCampaignLeadSource" USING btree ("sourceId");


--
-- Name: CrmCampaignLeadSource_sourceId_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CrmCampaignLeadSource_sourceId_name_key" ON crm_v2."CrmCampaignLeadSource" USING btree ("sourceId", name);


--
-- Name: CrmCampaignSource_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrmCampaignSource_isActive_idx" ON crm_v2."CrmCampaignSource" USING btree ("isActive");


--
-- Name: CrmCampaignSource_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrmCampaignSource_name_idx" ON crm_v2."CrmCampaignSource" USING btree (name);


--
-- Name: CrmCampaignSource_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CrmCampaignSource_name_key" ON crm_v2."CrmCampaignSource" USING btree (name);


--
-- Name: CrmCampaignTeamLeadAssignment_campaignId_month_year_isActiv_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrmCampaignTeamLeadAssignment_campaignId_month_year_isActiv_idx" ON crm_v2."CrmCampaignTeamLeadAssignment" USING btree ("campaignId", month, year, "isActive", priority);


--
-- Name: CrmCampaignTeamLeadAssignment_campaignId_teamLeadEmployeeId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CrmCampaignTeamLeadAssignment_campaignId_teamLeadEmployeeId_key" ON crm_v2."CrmCampaignTeamLeadAssignment" USING btree ("campaignId", "teamLeadEmployeeId", month, year);


--
-- Name: CrmCampaignTeamLeadAssignment_teamLeadEmployeeId_month_year_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrmCampaignTeamLeadAssignment_teamLeadEmployeeId_month_year_idx" ON crm_v2."CrmCampaignTeamLeadAssignment" USING btree ("teamLeadEmployeeId", month, year);


--
-- Name: CrmCampaignTeamLeadAssignment_teamLeadUserId_month_year_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrmCampaignTeamLeadAssignment_teamLeadUserId_month_year_idx" ON crm_v2."CrmCampaignTeamLeadAssignment" USING btree ("teamLeadUserId", month, year);


--
-- Name: CrmCampaign_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrmCampaign_category_idx" ON crm_v2."CrmCampaign" USING btree (category);


--
-- Name: CrmCampaign_circleId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrmCampaign_circleId_idx" ON crm_v2."CrmCampaign" USING btree ("circleId");


--
-- Name: CrmCampaign_cityId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrmCampaign_cityId_idx" ON crm_v2."CrmCampaign" USING btree ("cityId");


--
-- Name: CrmCampaign_departmentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrmCampaign_departmentId_idx" ON crm_v2."CrmCampaign" USING btree ("departmentId");


--
-- Name: CrmCampaign_externalCampaignId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CrmCampaign_externalCampaignId_key" ON crm_v2."CrmCampaign" USING btree ("externalCampaignId");


--
-- Name: CrmCampaign_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrmCampaign_isActive_idx" ON crm_v2."CrmCampaign" USING btree ("isActive");


--
-- Name: CrmCampaign_leadSourceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrmCampaign_leadSourceId_idx" ON crm_v2."CrmCampaign" USING btree ("leadSourceId");


--
-- Name: CrmCampaign_sourceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrmCampaign_sourceId_idx" ON crm_v2."CrmCampaign" USING btree ("sourceId");


--
-- Name: CrmCampaign_treatmentMasterId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrmCampaign_treatmentMasterId_idx" ON crm_v2."CrmCampaign" USING btree ("treatmentMasterId");


--
-- Name: CrmCampaign_treatment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrmCampaign_treatment_idx" ON crm_v2."CrmCampaign" USING btree (treatment);


--
-- Name: CrmSubStatusMaster_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrmSubStatusMaster_isActive_idx" ON crm_v2."CrmSubStatusMaster" USING btree ("isActive");


--
-- Name: CrmSubStatusMaster_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrmSubStatusMaster_key_idx" ON crm_v2."CrmSubStatusMaster" USING btree (key);


--
-- Name: CrmSubStatusMaster_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CrmSubStatusMaster_key_key" ON crm_v2."CrmSubStatusMaster" USING btree (key);


--
-- Name: CrmSubStatusMaster_value_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrmSubStatusMaster_value_idx" ON crm_v2."CrmSubStatusMaster" USING btree (value);


--
-- Name: CronJobLog_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CronJobLog_createdAt_idx" ON crm_v2."CronJobLog" USING btree ("createdAt");


--
-- Name: CronJobLog_jobName_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CronJobLog_jobName_createdAt_idx" ON crm_v2."CronJobLog" USING btree ("jobName", "createdAt");


--
-- Name: CumulativeReportManualEntry_updatedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CumulativeReportManualEntry_updatedAt_idx" ON crm_v2."CumulativeReportManualEntry" USING btree ("updatedAt");


--
-- Name: CumulativeReportManualEntry_year_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CumulativeReportManualEntry_year_key" ON crm_v2."CumulativeReportManualEntry" USING btree (year);


--
-- Name: DailyCampaignSpend_campaignName_date_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "DailyCampaignSpend_campaignName_date_key" ON crm_v2."DailyCampaignSpend" USING btree ("campaignName", date);


--
-- Name: DailyCampaignSpend_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DailyCampaignSpend_date_idx" ON crm_v2."DailyCampaignSpend" USING btree (date);


--
-- Name: DepartmentRevenue_department_month_year_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DepartmentRevenue_department_month_year_idx" ON crm_v2."DepartmentRevenue" USING btree (department, month, year);


--
-- Name: DepartmentRevenue_department_vendorId_month_year_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DepartmentRevenue_department_vendorId_month_year_idx" ON crm_v2."DepartmentRevenue" USING btree (department, "vendorId", month, year);


--
-- Name: DepartmentTeam_departmentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DepartmentTeam_departmentId_idx" ON crm_v2."DepartmentTeam" USING btree ("departmentId");


--
-- Name: DepartmentTeam_teamLeadId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DepartmentTeam_teamLeadId_idx" ON crm_v2."DepartmentTeam" USING btree ("teamLeadId");


--
-- Name: DepartmentTeam_teamLeadId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "DepartmentTeam_teamLeadId_key" ON crm_v2."DepartmentTeam" USING btree ("teamLeadId");


--
-- Name: Department_headId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Department_headId_idx" ON crm_v2."Department" USING btree ("headId");


--
-- Name: Department_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Department_name_idx" ON crm_v2."Department" USING btree (name);


--
-- Name: DischargeSheet_isFinalized_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DischargeSheet_isFinalized_idx" ON crm_v2."DischargeSheet" USING btree ("isFinalized");


--
-- Name: DischargeSheet_kypSubmissionId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DischargeSheet_kypSubmissionId_idx" ON crm_v2."DischargeSheet" USING btree ("kypSubmissionId");


--
-- Name: DischargeSheet_kypSubmissionId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "DischargeSheet_kypSubmissionId_key" ON crm_v2."DischargeSheet" USING btree ("kypSubmissionId");


--
-- Name: DischargeSheet_leadId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DischargeSheet_leadId_idx" ON crm_v2."DischargeSheet" USING btree ("leadId");


--
-- Name: DischargeSheet_leadId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "DischargeSheet_leadId_key" ON crm_v2."DischargeSheet" USING btree ("leadId");


--
-- Name: DischargeSheet_month_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DischargeSheet_month_idx" ON crm_v2."DischargeSheet" USING btree (month);


--
-- Name: DischargeSheet_plRecordId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "DischargeSheet_plRecordId_key" ON crm_v2."DischargeSheet" USING btree ("plRecordId");


--
-- Name: DischargeSheet_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DischargeSheet_status_idx" ON crm_v2."DischargeSheet" USING btree (status);


--
-- Name: DischargeSheet_surgeryDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DischargeSheet_surgeryDate_idx" ON crm_v2."DischargeSheet" USING btree ("surgeryDate");


--
-- Name: DoctorAppAccount_doctorId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "DoctorAppAccount_doctorId_key" ON crm_v2."DoctorAppAccount" USING btree ("doctorId");


--
-- Name: DoctorAppAccount_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "DoctorAppAccount_email_key" ON crm_v2."DoctorAppAccount" USING btree (email);


--
-- Name: DoctorAppAccount_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DoctorAppAccount_isActive_idx" ON crm_v2."DoctorAppAccount" USING btree ("isActive");


--
-- Name: DoctorAppAccount_phoneNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "DoctorAppAccount_phoneNumber_key" ON crm_v2."DoctorAppAccount" USING btree ("phoneNumber");


--
-- Name: DoctorAppRefreshToken_accountId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DoctorAppRefreshToken_accountId_idx" ON crm_v2."DoctorAppRefreshToken" USING btree ("accountId");


--
-- Name: DoctorAppRefreshToken_expiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DoctorAppRefreshToken_expiresAt_idx" ON crm_v2."DoctorAppRefreshToken" USING btree ("expiresAt");


--
-- Name: DoctorAppRefreshToken_jti_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "DoctorAppRefreshToken_jti_key" ON crm_v2."DoctorAppRefreshToken" USING btree (jti);


--
-- Name: DoctorAppWhatsappOtp_accountId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DoctorAppWhatsappOtp_accountId_idx" ON crm_v2."DoctorAppWhatsappOtp" USING btree ("accountId");


--
-- Name: DoctorAppWhatsappOtp_expiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DoctorAppWhatsappOtp_expiresAt_idx" ON crm_v2."DoctorAppWhatsappOtp" USING btree ("expiresAt");


--
-- Name: DoctorAppWhatsappOtp_phoneNumber_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DoctorAppWhatsappOtp_phoneNumber_idx" ON crm_v2."DoctorAppWhatsappOtp" USING btree ("phoneNumber");


--
-- Name: DoctorCabRequest_doctorId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DoctorCabRequest_doctorId_createdAt_idx" ON crm_v2."DoctorCabRequest" USING btree ("doctorId", "createdAt");


--
-- Name: DoctorCabRequest_scheduledFor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DoctorCabRequest_scheduledFor_idx" ON crm_v2."DoctorCabRequest" USING btree ("scheduledFor");


--
-- Name: DoctorCabRequest_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DoctorCabRequest_status_idx" ON crm_v2."DoctorCabRequest" USING btree (status);


--
-- Name: DoctorLeaveRequest_doctorId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DoctorLeaveRequest_doctorId_createdAt_idx" ON crm_v2."DoctorLeaveRequest" USING btree ("doctorId", "createdAt");


--
-- Name: DoctorLeaveRequest_startDate_endDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DoctorLeaveRequest_startDate_endDate_idx" ON crm_v2."DoctorLeaveRequest" USING btree ("startDate", "endDate");


--
-- Name: DoctorLeaveRequest_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DoctorLeaveRequest_status_idx" ON crm_v2."DoctorLeaveRequest" USING btree (status);


--
-- Name: DoctorMaster_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DoctorMaster_category_idx" ON crm_v2."DoctorMaster" USING btree (category);


--
-- Name: DoctorMaster_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DoctorMaster_isActive_idx" ON crm_v2."DoctorMaster" USING btree ("isActive");


--
-- Name: DoctorMaster_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DoctorMaster_name_idx" ON crm_v2."DoctorMaster" USING btree (name);


--
-- Name: DoctorMaster_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "DoctorMaster_name_key" ON crm_v2."DoctorMaster" USING btree (name);


--
-- Name: DoctorMaster_phoneNumber_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DoctorMaster_phoneNumber_idx" ON crm_v2."DoctorMaster" USING btree ("phoneNumber");


--
-- Name: DoctorMaster_phoneNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "DoctorMaster_phoneNumber_key" ON crm_v2."DoctorMaster" USING btree ("phoneNumber");


--
-- Name: DoctorPayoffRequestActivity_actorId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DoctorPayoffRequestActivity_actorId_idx" ON crm_v2."DoctorPayoffRequestActivity" USING btree ("actorId");


--
-- Name: DoctorPayoffRequestActivity_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DoctorPayoffRequestActivity_createdAt_idx" ON crm_v2."DoctorPayoffRequestActivity" USING btree ("createdAt");


--
-- Name: DoctorPayoffRequestActivity_requestId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DoctorPayoffRequestActivity_requestId_idx" ON crm_v2."DoctorPayoffRequestActivity" USING btree ("requestId");


--
-- Name: DoctorPayoffRequest_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DoctorPayoffRequest_createdAt_idx" ON crm_v2."DoctorPayoffRequest" USING btree ("createdAt");


--
-- Name: DoctorPayoffRequest_doctorName_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DoctorPayoffRequest_doctorName_idx" ON crm_v2."DoctorPayoffRequest" USING btree ("doctorName");


--
-- Name: DoctorPayoffRequest_hospitalName_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DoctorPayoffRequest_hospitalName_idx" ON crm_v2."DoctorPayoffRequest" USING btree ("hospitalName");


--
-- Name: DoctorPayoffRequest_leadId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DoctorPayoffRequest_leadId_idx" ON crm_v2."DoctorPayoffRequest" USING btree ("leadId");


--
-- Name: DoctorPayoffRequest_requestedById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DoctorPayoffRequest_requestedById_idx" ON crm_v2."DoctorPayoffRequest" USING btree ("requestedById");


--
-- Name: DoctorPayoffRequest_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DoctorPayoffRequest_status_idx" ON crm_v2."DoctorPayoffRequest" USING btree (status);


--
-- Name: DocumentTemplate_documentType_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "DocumentTemplate_documentType_key" ON crm_v2."DocumentTemplate" USING btree ("documentType");


--
-- Name: EmployeeDocument_ackToken_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "EmployeeDocument_ackToken_key" ON crm_v2."EmployeeDocument" USING btree ("ackToken");


--
-- Name: EmployeeDocument_documentType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmployeeDocument_documentType_idx" ON crm_v2."EmployeeDocument" USING btree ("documentType");


--
-- Name: EmployeeDocument_employeeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmployeeDocument_employeeId_idx" ON crm_v2."EmployeeDocument" USING btree ("employeeId");


--
-- Name: EmployeeMasterSeatingCost_employeeId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "EmployeeMasterSeatingCost_employeeId_key" ON crm_v2."EmployeeMasterSeatingCost" USING btree ("employeeId");


--
-- Name: EmployeeMasterSeatingCost_updatedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmployeeMasterSeatingCost_updatedAt_idx" ON crm_v2."EmployeeMasterSeatingCost" USING btree ("updatedAt");


--
-- Name: EmployeeMonthlyIncentive_employeeId_month_year_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "EmployeeMonthlyIncentive_employeeId_month_year_key" ON crm_v2."EmployeeMonthlyIncentive" USING btree ("employeeId", month, year);


--
-- Name: EmployeeMonthlyIncentive_month_year_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmployeeMonthlyIncentive_month_year_idx" ON crm_v2."EmployeeMonthlyIncentive" USING btree (month, year);


--
-- Name: EmployeeMonthlyIncentive_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmployeeMonthlyIncentive_status_idx" ON crm_v2."EmployeeMonthlyIncentive" USING btree (status);


--
-- Name: EmployeeMonthlySeatingMiscCostHistory_recordId_changedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmployeeMonthlySeatingMiscCostHistory_recordId_changedAt_idx" ON crm_v2."EmployeeMonthlySeatingMiscCostHistory" USING btree ("recordId", "changedAt");


--
-- Name: EmployeeMonthlySeatingMiscCost_employeeId_month_year_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "EmployeeMonthlySeatingMiscCost_employeeId_month_year_key" ON crm_v2."EmployeeMonthlySeatingMiscCost" USING btree ("employeeId", month, year);


--
-- Name: EmployeeMonthlySeatingMiscCost_month_year_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmployeeMonthlySeatingMiscCost_month_year_idx" ON crm_v2."EmployeeMonthlySeatingMiscCost" USING btree (month, year);


--
-- Name: EmployeeMonthlySeatingMiscCost_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmployeeMonthlySeatingMiscCost_status_idx" ON crm_v2."EmployeeMonthlySeatingMiscCost" USING btree (status);


--
-- Name: EmployeeProfileActivityLog_actorUserId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmployeeProfileActivityLog_actorUserId_idx" ON crm_v2."EmployeeProfileActivityLog" USING btree ("actorUserId");


--
-- Name: EmployeeProfileActivityLog_employeeId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmployeeProfileActivityLog_employeeId_createdAt_idx" ON crm_v2."EmployeeProfileActivityLog" USING btree ("employeeId", "createdAt");


--
-- Name: EmployeeSalesTeamSalaryOverrideHistory_employeeId_month_yea_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmployeeSalesTeamSalaryOverrideHistory_employeeId_month_yea_idx" ON crm_v2."EmployeeSalesTeamSalaryOverrideHistory" USING btree ("employeeId", month, year, "updatedAt");


--
-- Name: EmployeeSalesTeamSalaryOverrideHistory_updatedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmployeeSalesTeamSalaryOverrideHistory_updatedAt_idx" ON crm_v2."EmployeeSalesTeamSalaryOverrideHistory" USING btree ("updatedAt");


--
-- Name: EmployeeSalesTeamSalaryOverride_employeeId_month_year_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "EmployeeSalesTeamSalaryOverride_employeeId_month_year_key" ON crm_v2."EmployeeSalesTeamSalaryOverride" USING btree ("employeeId", month, year);


--
-- Name: EmployeeSalesTeamSalaryOverride_month_year_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmployeeSalesTeamSalaryOverride_month_year_idx" ON crm_v2."EmployeeSalesTeamSalaryOverride" USING btree (month, year);


--
-- Name: Employee_bdNumber_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Employee_bdNumber_idx" ON crm_v2."Employee" USING btree ("bdNumber");


--
-- Name: Employee_bdNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Employee_bdNumber_key" ON crm_v2."Employee" USING btree ("bdNumber");


--
-- Name: Employee_circle_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Employee_circle_idx" ON crm_v2."Employee" USING btree (circle);


--
-- Name: Employee_departmentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Employee_departmentId_idx" ON crm_v2."Employee" USING btree ("departmentId");


--
-- Name: Employee_employeeCode_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Employee_employeeCode_idx" ON crm_v2."Employee" USING btree ("employeeCode");


--
-- Name: Employee_employeeCode_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Employee_employeeCode_key" ON crm_v2."Employee" USING btree ("employeeCode");


--
-- Name: Employee_managerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Employee_managerId_idx" ON crm_v2."Employee" USING btree ("managerId");


--
-- Name: Employee_onboardingStatus_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Employee_onboardingStatus_idx" ON crm_v2."Employee" USING btree ("onboardingStatus");


--
-- Name: Employee_teamId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Employee_teamId_idx" ON crm_v2."Employee" USING btree ("teamId");


--
-- Name: Employee_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Employee_userId_idx" ON crm_v2."Employee" USING btree ("userId");


--
-- Name: Employee_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Employee_userId_key" ON crm_v2."Employee" USING btree ("userId");


--
-- Name: Feedback_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Feedback_createdAt_idx" ON crm_v2."Feedback" USING btree ("createdAt");


--
-- Name: Feedback_employeeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Feedback_employeeId_idx" ON crm_v2."Feedback" USING btree ("employeeId");


--
-- Name: Feedback_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Feedback_status_idx" ON crm_v2."Feedback" USING btree (status);


--
-- Name: FollowUpReasonMaster_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "FollowUpReasonMaster_code_key" ON crm_v2."FollowUpReasonMaster" USING btree (code);


--
-- Name: FollowUpReasonMaster_displayOrder_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FollowUpReasonMaster_displayOrder_idx" ON crm_v2."FollowUpReasonMaster" USING btree ("displayOrder");


--
-- Name: FollowUpReasonMaster_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FollowUpReasonMaster_isActive_idx" ON crm_v2."FollowUpReasonMaster" USING btree ("isActive");


--
-- Name: HeadMaster_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "HeadMaster_isActive_idx" ON crm_v2."HeadMaster" USING btree ("isActive");


--
-- Name: HeadMaster_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "HeadMaster_name_idx" ON crm_v2."HeadMaster" USING btree (name);


--
-- Name: HeadMaster_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "HeadMaster_name_key" ON crm_v2."HeadMaster" USING btree (name);


--
-- Name: Holiday_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Holiday_date_idx" ON crm_v2."Holiday" USING btree (date);


--
-- Name: Holiday_date_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Holiday_date_key" ON crm_v2."Holiday" USING btree (date);


--
-- Name: HospitalMasterInsurance_insuranceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "HospitalMasterInsurance_insuranceId_idx" ON crm_v2."HospitalMasterInsurance" USING btree ("insuranceId");


--
-- Name: HospitalMaster_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "HospitalMaster_isActive_idx" ON crm_v2."HospitalMaster" USING btree ("isActive");


--
-- Name: HospitalMaster_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "HospitalMaster_name_idx" ON crm_v2."HospitalMaster" USING btree (name);


--
-- Name: HospitalMaster_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "HospitalMaster_name_key" ON crm_v2."HospitalMaster" USING btree (name);


--
-- Name: HospitalSuggestion_preAuthId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "HospitalSuggestion_preAuthId_idx" ON crm_v2."HospitalSuggestion" USING btree ("preAuthId");


--
-- Name: IJPApplication_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IJPApplication_createdAt_idx" ON crm_v2."IJPApplication" USING btree ("createdAt");


--
-- Name: IJPApplication_postingId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IJPApplication_postingId_idx" ON crm_v2."IJPApplication" USING btree ("postingId");


--
-- Name: IJPApplication_referredById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IJPApplication_referredById_idx" ON crm_v2."IJPApplication" USING btree ("referredById");


--
-- Name: IJPApplication_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IJPApplication_status_idx" ON crm_v2."IJPApplication" USING btree (status);


--
-- Name: ITFreelancer_createdById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ITFreelancer_createdById_idx" ON crm_v2."ITFreelancer" USING btree ("createdById");


--
-- Name: ITFreelancer_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ITFreelancer_isActive_idx" ON crm_v2."ITFreelancer" USING btree ("isActive");


--
-- Name: ITProjectBooking_month_year_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ITProjectBooking_month_year_idx" ON crm_v2."ITProjectBooking" USING btree (month, year);


--
-- Name: ITProjectBooking_projectId_month_year_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ITProjectBooking_projectId_month_year_key" ON crm_v2."ITProjectBooking" USING btree ("projectId", month, year);


--
-- Name: ITProjectResource_employeeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ITProjectResource_employeeId_idx" ON crm_v2."ITProjectResource" USING btree ("employeeId");


--
-- Name: ITProjectResource_freelancerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ITProjectResource_freelancerId_idx" ON crm_v2."ITProjectResource" USING btree ("freelancerId");


--
-- Name: ITProjectResource_projectId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ITProjectResource_projectId_idx" ON crm_v2."ITProjectResource" USING btree ("projectId");


--
-- Name: ITProject_createdById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ITProject_createdById_idx" ON crm_v2."ITProject" USING btree ("createdById");


--
-- Name: ITProject_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ITProject_status_idx" ON crm_v2."ITProject" USING btree (status);


--
-- Name: ImplantMaster_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ImplantMaster_code_idx" ON crm_v2."ImplantMaster" USING btree (code);


--
-- Name: ImplantMaster_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ImplantMaster_code_key" ON crm_v2."ImplantMaster" USING btree (code);


--
-- Name: ImplantMaster_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ImplantMaster_isActive_idx" ON crm_v2."ImplantMaster" USING btree ("isActive");


--
-- Name: ImplantMaster_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ImplantMaster_name_idx" ON crm_v2."ImplantMaster" USING btree (name);


--
-- Name: ImplantMaster_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ImplantMaster_name_key" ON crm_v2."ImplantMaster" USING btree (name);


--
-- Name: IncomingLead_externalCampaignId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IncomingLead_externalCampaignId_idx" ON crm_v2."IncomingLead" USING btree ("externalCampaignId");


--
-- Name: IncomingLead_legacyId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IncomingLead_legacyId_key" ON crm_v2."IncomingLead" USING btree ("legacyId");


--
-- Name: IncomingLead_normalizedPhone_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IncomingLead_normalizedPhone_idx" ON crm_v2."IncomingLead" USING btree ("normalizedPhone");


--
-- Name: IncomingLead_receivedAt_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IncomingLead_receivedAt_id_idx" ON crm_v2."IncomingLead" USING btree ("receivedAt", id);


--
-- Name: IncomingLead_receivedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IncomingLead_receivedAt_idx" ON crm_v2."IncomingLead" USING btree ("receivedAt");


--
-- Name: IncomingLead_selectedBdUserId_receivedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IncomingLead_selectedBdUserId_receivedAt_idx" ON crm_v2."IncomingLead" USING btree ("selectedBdUserId", "receivedAt");


--
-- Name: IncomingLead_selectedTeamLeadEmployeeId_receivedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IncomingLead_selectedTeamLeadEmployeeId_receivedAt_idx" ON crm_v2."IncomingLead" USING btree ("selectedTeamLeadEmployeeId", "receivedAt");


--
-- Name: IncomingLead_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IncomingLead_status_idx" ON crm_v2."IncomingLead" USING btree (status);


--
-- Name: IncrementRequest_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IncrementRequest_createdAt_idx" ON crm_v2."IncrementRequest" USING btree ("createdAt");


--
-- Name: IncrementRequest_employeeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IncrementRequest_employeeId_idx" ON crm_v2."IncrementRequest" USING btree ("employeeId");


--
-- Name: IncrementRequest_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IncrementRequest_status_idx" ON crm_v2."IncrementRequest" USING btree (status);


--
-- Name: InsuranceCase_caseStatus_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InsuranceCase_caseStatus_idx" ON crm_v2."InsuranceCase" USING btree ("caseStatus");


--
-- Name: InsuranceCase_leadId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InsuranceCase_leadId_idx" ON crm_v2."InsuranceCase" USING btree ("leadId");


--
-- Name: InsuranceCase_leadId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "InsuranceCase_leadId_key" ON crm_v2."InsuranceCase" USING btree ("leadId");


--
-- Name: InsuranceCase_submittedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InsuranceCase_submittedAt_idx" ON crm_v2."InsuranceCase" USING btree ("submittedAt");


--
-- Name: InsuranceInitiateForm_leadId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InsuranceInitiateForm_leadId_idx" ON crm_v2."InsuranceInitiateForm" USING btree ("leadId");


--
-- Name: InsuranceInitiateForm_leadId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "InsuranceInitiateForm_leadId_key" ON crm_v2."InsuranceInitiateForm" USING btree ("leadId");


--
-- Name: InsuranceMaster_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InsuranceMaster_isActive_idx" ON crm_v2."InsuranceMaster" USING btree ("isActive");


--
-- Name: InsuranceMaster_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InsuranceMaster_name_idx" ON crm_v2."InsuranceMaster" USING btree (name);


--
-- Name: InsuranceMaster_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "InsuranceMaster_name_key" ON crm_v2."InsuranceMaster" USING btree (name);


--
-- Name: InsuranceQuery_preAuthorizationId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InsuranceQuery_preAuthorizationId_idx" ON crm_v2."InsuranceQuery" USING btree ("preAuthorizationId");


--
-- Name: InsuranceQuery_raisedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InsuranceQuery_raisedAt_idx" ON crm_v2."InsuranceQuery" USING btree ("raisedAt");


--
-- Name: InsuranceQuery_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InsuranceQuery_status_idx" ON crm_v2."InsuranceQuery" USING btree (status);


--
-- Name: InternalJobPosting_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InternalJobPosting_createdAt_idx" ON crm_v2."InternalJobPosting" USING btree ("createdAt");


--
-- Name: InternalJobPosting_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InternalJobPosting_isActive_idx" ON crm_v2."InternalJobPosting" USING btree ("isActive");


--
-- Name: InvoiceRequestActivity_actorId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InvoiceRequestActivity_actorId_idx" ON crm_v2."InvoiceRequestActivity" USING btree ("actorId");


--
-- Name: InvoiceRequestActivity_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InvoiceRequestActivity_createdAt_idx" ON crm_v2."InvoiceRequestActivity" USING btree ("createdAt");


--
-- Name: InvoiceRequestActivity_requestId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InvoiceRequestActivity_requestId_idx" ON crm_v2."InvoiceRequestActivity" USING btree ("requestId");


--
-- Name: InvoiceRequest_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InvoiceRequest_createdAt_idx" ON crm_v2."InvoiceRequest" USING btree ("createdAt");


--
-- Name: InvoiceRequest_leadId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InvoiceRequest_leadId_idx" ON crm_v2."InvoiceRequest" USING btree ("leadId");


--
-- Name: InvoiceRequest_requestedById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InvoiceRequest_requestedById_idx" ON crm_v2."InvoiceRequest" USING btree ("requestedById");


--
-- Name: InvoiceRequest_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InvoiceRequest_status_idx" ON crm_v2."InvoiceRequest" USING btree (status);


--
-- Name: IssueTransaction_issueDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IssueTransaction_issueDate_idx" ON crm_v2."IssueTransaction" USING btree ("issueDate");


--
-- Name: IssueTransaction_issueNumber_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IssueTransaction_issueNumber_idx" ON crm_v2."IssueTransaction" USING btree ("issueNumber");


--
-- Name: IssueTransaction_issueNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IssueTransaction_issueNumber_key" ON crm_v2."IssueTransaction" USING btree ("issueNumber");


--
-- Name: IssueTransaction_issuedToId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IssueTransaction_issuedToId_idx" ON crm_v2."IssueTransaction" USING btree ("issuedToId");


--
-- Name: IssueTransaction_itemId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IssueTransaction_itemId_idx" ON crm_v2."IssueTransaction" USING btree ("itemId");


--
-- Name: IssueTransaction_locationId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IssueTransaction_locationId_idx" ON crm_v2."IssueTransaction" USING btree ("locationId");


--
-- Name: IssueTransaction_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IssueTransaction_status_idx" ON crm_v2."IssueTransaction" USING btree (status);


--
-- Name: ItemMaster_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ItemMaster_isActive_idx" ON crm_v2."ItemMaster" USING btree ("isActive");


--
-- Name: ItemMaster_itemCode_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ItemMaster_itemCode_idx" ON crm_v2."ItemMaster" USING btree ("itemCode");


--
-- Name: ItemMaster_itemCode_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ItemMaster_itemCode_key" ON crm_v2."ItemMaster" USING btree ("itemCode");


--
-- Name: ItemMaster_locationId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ItemMaster_locationId_idx" ON crm_v2."ItemMaster" USING btree ("locationId");


--
-- Name: ItemMaster_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ItemMaster_name_idx" ON crm_v2."ItemMaster" USING btree (name);


--
-- Name: ItemMaster_supplierId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ItemMaster_supplierId_idx" ON crm_v2."ItemMaster" USING btree ("supplierId");


--
-- Name: KYPSubmission_leadId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "KYPSubmission_leadId_idx" ON crm_v2."KYPSubmission" USING btree ("leadId");


--
-- Name: KYPSubmission_leadId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "KYPSubmission_leadId_key" ON crm_v2."KYPSubmission" USING btree ("leadId");


--
-- Name: KYPSubmission_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "KYPSubmission_status_idx" ON crm_v2."KYPSubmission" USING btree (status);


--
-- Name: KYPSubmission_submittedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "KYPSubmission_submittedAt_idx" ON crm_v2."KYPSubmission" USING btree ("submittedAt");


--
-- Name: KnowledgeChunk_documentId_chunkIndex_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "KnowledgeChunk_documentId_chunkIndex_key" ON crm_v2."KnowledgeChunk" USING btree ("documentId", "chunkIndex");


--
-- Name: KnowledgeChunk_documentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "KnowledgeChunk_documentId_idx" ON crm_v2."KnowledgeChunk" USING btree ("documentId");


--
-- Name: KnowledgeDocumentDepartment_departmentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "KnowledgeDocumentDepartment_departmentId_idx" ON crm_v2."KnowledgeDocumentDepartment" USING btree ("departmentId");


--
-- Name: KnowledgeDocumentDepartment_documentId_departmentId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "KnowledgeDocumentDepartment_documentId_departmentId_key" ON crm_v2."KnowledgeDocumentDepartment" USING btree ("documentId", "departmentId");


--
-- Name: KnowledgeDocumentRole_documentId_role_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "KnowledgeDocumentRole_documentId_role_key" ON crm_v2."KnowledgeDocumentRole" USING btree ("documentId", role);


--
-- Name: KnowledgeDocumentRole_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "KnowledgeDocumentRole_role_idx" ON crm_v2."KnowledgeDocumentRole" USING btree (role);


--
-- Name: KnowledgeDocumentUser_documentId_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "KnowledgeDocumentUser_documentId_userId_key" ON crm_v2."KnowledgeDocumentUser" USING btree ("documentId", "userId");


--
-- Name: KnowledgeDocumentUser_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "KnowledgeDocumentUser_userId_idx" ON crm_v2."KnowledgeDocumentUser" USING btree ("userId");


--
-- Name: KnowledgeDocument_isActive_visibility_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "KnowledgeDocument_isActive_visibility_idx" ON crm_v2."KnowledgeDocument" USING btree ("isActive", visibility);


--
-- Name: KnowledgeDocument_uploadedById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "KnowledgeDocument_uploadedById_idx" ON crm_v2."KnowledgeDocument" USING btree ("uploadedById");


--
-- Name: LeadOpdAppointmentPrescriptionImage_opdAppointmentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeadOpdAppointmentPrescriptionImage_opdAppointmentId_idx" ON crm_v2."LeadOpdAppointmentPrescriptionImage" USING btree ("opdAppointmentId");


--
-- Name: LeadOpdAppointment_followUpReasonCode_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeadOpdAppointment_followUpReasonCode_idx" ON crm_v2."LeadOpdAppointment" USING btree ("followUpReasonCode");


--
-- Name: LeadOpdAppointment_leadId_phase_slot_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeadOpdAppointment_leadId_phase_slot_idx" ON crm_v2."LeadOpdAppointment" USING btree ("leadId", phase, slot);


--
-- Name: LeadOpdAppointment_leadId_phase_slot_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "LeadOpdAppointment_leadId_phase_slot_key" ON crm_v2."LeadOpdAppointment" USING btree ("leadId", phase, slot);


--
-- Name: LeadOpdAppointment_reasonNoSurgeryCode_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeadOpdAppointment_reasonNoSurgeryCode_idx" ON crm_v2."LeadOpdAppointment" USING btree ("reasonNoSurgeryCode");


--
-- Name: LeadOpdAppointment_scheduleDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeadOpdAppointment_scheduleDate_idx" ON crm_v2."LeadOpdAppointment" USING btree ("scheduleDate");


--
-- Name: LeadOpdAppointment_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeadOpdAppointment_status_idx" ON crm_v2."LeadOpdAppointment" USING btree (status);


--
-- Name: LeadOpdAppointment_surgeryRemarkCode_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeadOpdAppointment_surgeryRemarkCode_idx" ON crm_v2."LeadOpdAppointment" USING btree ("surgeryRemarkCode");


--
-- Name: LeadOpdPrescriptionImage_leadId_sortOrder_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeadOpdPrescriptionImage_leadId_sortOrder_idx" ON crm_v2."LeadOpdPrescriptionImage" USING btree ("leadId", "sortOrder");


--
-- Name: LeadQrCallAuditLog_action_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeadQrCallAuditLog_action_createdAt_idx" ON crm_v2."LeadQrCallAuditLog" USING btree (action, "createdAt");


--
-- Name: LeadQrCallAuditLog_leadId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeadQrCallAuditLog_leadId_createdAt_idx" ON crm_v2."LeadQrCallAuditLog" USING btree ("leadId", "createdAt");


--
-- Name: LeadQrCallAuditLog_userId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeadQrCallAuditLog_userId_createdAt_idx" ON crm_v2."LeadQrCallAuditLog" USING btree ("userId", "createdAt");


--
-- Name: LeadQrPublicLink_actorUserId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeadQrPublicLink_actorUserId_createdAt_idx" ON crm_v2."LeadQrPublicLink" USING btree ("actorUserId", "createdAt");


--
-- Name: LeadQrPublicLink_expiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeadQrPublicLink_expiresAt_idx" ON crm_v2."LeadQrPublicLink" USING btree ("expiresAt");


--
-- Name: LeadQrPublicLink_leadId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeadQrPublicLink_leadId_createdAt_idx" ON crm_v2."LeadQrPublicLink" USING btree ("leadId", "createdAt");


--
-- Name: LeadQrPublicLink_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "LeadQrPublicLink_token_key" ON crm_v2."LeadQrPublicLink" USING btree (token);


--
-- Name: LeadQrScanLink_actorUserId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeadQrScanLink_actorUserId_createdAt_idx" ON crm_v2."LeadQrScanLink" USING btree ("actorUserId", "createdAt");


--
-- Name: LeadQrScanLink_leadId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeadQrScanLink_leadId_createdAt_idx" ON crm_v2."LeadQrScanLink" USING btree ("leadId", "createdAt");


--
-- Name: LeadQrScanLink_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "LeadQrScanLink_token_key" ON crm_v2."LeadQrScanLink" USING btree (token);


--
-- Name: LeadRemarkEntry_createdById_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeadRemarkEntry_createdById_createdAt_idx" ON crm_v2."LeadRemarkEntry" USING btree ("createdById", "createdAt");


--
-- Name: LeadRemarkEntry_leadId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeadRemarkEntry_leadId_createdAt_idx" ON crm_v2."LeadRemarkEntry" USING btree ("leadId", "createdAt");


--
-- Name: LeadRemark_leadRef_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeadRemark_leadRef_idx" ON crm_v2."LeadRemark" USING btree ("leadRef");


--
-- Name: LeadRemark_updateDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeadRemark_updateDate_idx" ON crm_v2."LeadRemark" USING btree ("updateDate");


--
-- Name: LeadStageEvent_changedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeadStageEvent_changedAt_idx" ON crm_v2."LeadStageEvent" USING btree ("changedAt");


--
-- Name: LeadStageEvent_leadId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeadStageEvent_leadId_idx" ON crm_v2."LeadStageEvent" USING btree ("leadId");


--
-- Name: Lead_assignedDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Lead_assignedDate_idx" ON crm_v2."Lead" USING btree ("assignedDate");


--
-- Name: Lead_bdId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Lead_bdId_idx" ON crm_v2."Lead" USING btree ("bdId");


--
-- Name: Lead_caseStage_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Lead_caseStage_idx" ON crm_v2."Lead" USING btree ("caseStage");


--
-- Name: Lead_category_trgm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Lead_category_trgm_idx" ON crm_v2."Lead" USING gin (category public.gin_trgm_ops);


--
-- Name: Lead_circle_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Lead_circle_idx" ON crm_v2."Lead" USING btree (circle);


--
-- Name: Lead_conversionDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Lead_conversionDate_idx" ON crm_v2."Lead" USING btree ("conversionDate");


--
-- Name: Lead_createdDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Lead_createdDate_idx" ON crm_v2."Lead" USING btree ("createdDate");


--
-- Name: Lead_followUpDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Lead_followUpDate_idx" ON crm_v2."Lead" USING btree ("followUpDate");


--
-- Name: Lead_hospitalName_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Lead_hospitalName_idx" ON crm_v2."Lead" USING btree ("hospitalName");


--
-- Name: Lead_leadEntryDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Lead_leadEntryDate_idx" ON crm_v2."Lead" USING btree ("leadEntryDate");


--
-- Name: Lead_leadRef_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Lead_leadRef_key" ON crm_v2."Lead" USING btree ("leadRef");


--
-- Name: Lead_leadRef_trgm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Lead_leadRef_trgm_idx" ON crm_v2."Lead" USING gin ("leadRef" public.gin_trgm_ops);


--
-- Name: Lead_legacyId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Lead_legacyId_key" ON crm_v2."Lead" USING btree ("legacyId");


--
-- Name: Lead_opdFollowUpReasonCode_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Lead_opdFollowUpReasonCode_idx" ON crm_v2."Lead" USING btree ("opdFollowUpReasonCode");


--
-- Name: Lead_opdReasonNoSurgeryCode_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Lead_opdReasonNoSurgeryCode_idx" ON crm_v2."Lead" USING btree ("opdReasonNoSurgeryCode");


--
-- Name: Lead_opdSurgeryRemarkCode_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Lead_opdSurgeryRemarkCode_idx" ON crm_v2."Lead" USING btree ("opdSurgeryRemarkCode");


--
-- Name: Lead_openedInCrmAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Lead_openedInCrmAt_idx" ON crm_v2."Lead" USING btree ("openedInCrmAt");


--
-- Name: Lead_patientName_trgm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Lead_patientName_trgm_idx" ON crm_v2."Lead" USING gin ("patientName" public.gin_trgm_ops);


--
-- Name: Lead_pipelineStage_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Lead_pipelineStage_idx" ON crm_v2."Lead" USING btree ("pipelineStage");


--
-- Name: Lead_source_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Lead_source_idx" ON crm_v2."Lead" USING btree (source);


--
-- Name: Lead_statusId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Lead_statusId_idx" ON crm_v2."Lead" USING btree ("statusId");


--
-- Name: Lead_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Lead_status_idx" ON crm_v2."Lead" USING btree (status);


--
-- Name: Lead_surgeryDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Lead_surgeryDate_idx" ON crm_v2."Lead" USING btree ("surgeryDate");


--
-- Name: Lead_treatment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Lead_treatment_idx" ON crm_v2."Lead" USING btree (treatment);


--
-- Name: Lead_treatment_trgm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Lead_treatment_trgm_idx" ON crm_v2."Lead" USING gin (treatment public.gin_trgm_ops);


--
-- Name: LeaveBalanceEditRequest_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeaveBalanceEditRequest_createdAt_idx" ON crm_v2."LeaveBalanceEditRequest" USING btree ("createdAt");


--
-- Name: LeaveBalanceEditRequest_employeeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeaveBalanceEditRequest_employeeId_idx" ON crm_v2."LeaveBalanceEditRequest" USING btree ("employeeId");


--
-- Name: LeaveBalanceEditRequest_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeaveBalanceEditRequest_status_idx" ON crm_v2."LeaveBalanceEditRequest" USING btree (status);


--
-- Name: LeaveBalance_employeeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeaveBalance_employeeId_idx" ON crm_v2."LeaveBalance" USING btree ("employeeId");


--
-- Name: LeaveBalance_employeeId_leaveTypeId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "LeaveBalance_employeeId_leaveTypeId_key" ON crm_v2."LeaveBalance" USING btree ("employeeId", "leaveTypeId");


--
-- Name: LeaveBalance_leaveTypeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeaveBalance_leaveTypeId_idx" ON crm_v2."LeaveBalance" USING btree ("leaveTypeId");


--
-- Name: LeaveRequest_employeeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeaveRequest_employeeId_idx" ON crm_v2."LeaveRequest" USING btree ("employeeId");


--
-- Name: LeaveRequest_leaveTypeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeaveRequest_leaveTypeId_idx" ON crm_v2."LeaveRequest" USING btree ("leaveTypeId");


--
-- Name: LeaveRequest_startDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeaveRequest_startDate_idx" ON crm_v2."LeaveRequest" USING btree ("startDate");


--
-- Name: LeaveRequest_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeaveRequest_status_idx" ON crm_v2."LeaveRequest" USING btree (status);


--
-- Name: LeaveRequest_targetApproverId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeaveRequest_targetApproverId_idx" ON crm_v2."LeaveRequest" USING btree ("targetApproverId");


--
-- Name: LeaveTypeMaster_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeaveTypeMaster_code_idx" ON crm_v2."LeaveTypeMaster" USING btree (code);


--
-- Name: LeaveTypeMaster_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "LeaveTypeMaster_code_key" ON crm_v2."LeaveTypeMaster" USING btree (code);


--
-- Name: LeaveTypeMaster_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeaveTypeMaster_isActive_idx" ON crm_v2."LeaveTypeMaster" USING btree ("isActive");


--
-- Name: LeaveTypeMaster_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeaveTypeMaster_name_idx" ON crm_v2."LeaveTypeMaster" USING btree (name);


--
-- Name: LeaveTypeMaster_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "LeaveTypeMaster_name_key" ON crm_v2."LeaveTypeMaster" USING btree (name);


--
-- Name: LedgerAuditLog_action_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LedgerAuditLog_action_idx" ON crm_v2."LedgerAuditLog" USING btree (action);


--
-- Name: LedgerAuditLog_ledgerEntryId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LedgerAuditLog_ledgerEntryId_idx" ON crm_v2."LedgerAuditLog" USING btree ("ledgerEntryId");


--
-- Name: LedgerAuditLog_performedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LedgerAuditLog_performedAt_idx" ON crm_v2."LedgerAuditLog" USING btree ("performedAt");


--
-- Name: LedgerEntry_createdById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LedgerEntry_createdById_idx" ON crm_v2."LedgerEntry" USING btree ("createdById");


--
-- Name: LedgerEntry_deleteRequestStatus_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LedgerEntry_deleteRequestStatus_idx" ON crm_v2."LedgerEntry" USING btree ("deleteRequestStatus");


--
-- Name: LedgerEntry_editRequestStatus_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LedgerEntry_editRequestStatus_idx" ON crm_v2."LedgerEntry" USING btree ("editRequestStatus");


--
-- Name: LedgerEntry_fromPaymentModeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LedgerEntry_fromPaymentModeId_idx" ON crm_v2."LedgerEntry" USING btree ("fromPaymentModeId");


--
-- Name: LedgerEntry_headId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LedgerEntry_headId_idx" ON crm_v2."LedgerEntry" USING btree ("headId");


--
-- Name: LedgerEntry_isDeleted_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LedgerEntry_isDeleted_idx" ON crm_v2."LedgerEntry" USING btree ("isDeleted");


--
-- Name: LedgerEntry_partyId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LedgerEntry_partyId_idx" ON crm_v2."LedgerEntry" USING btree ("partyId");


--
-- Name: LedgerEntry_paymentModeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LedgerEntry_paymentModeId_idx" ON crm_v2."LedgerEntry" USING btree ("paymentModeId");


--
-- Name: LedgerEntry_serialNumber_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LedgerEntry_serialNumber_idx" ON crm_v2."LedgerEntry" USING btree ("serialNumber");


--
-- Name: LedgerEntry_serialNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "LedgerEntry_serialNumber_key" ON crm_v2."LedgerEntry" USING btree ("serialNumber");


--
-- Name: LedgerEntry_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LedgerEntry_status_idx" ON crm_v2."LedgerEntry" USING btree (status);


--
-- Name: LedgerEntry_toPaymentModeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LedgerEntry_toPaymentModeId_idx" ON crm_v2."LedgerEntry" USING btree ("toPaymentModeId");


--
-- Name: LedgerEntry_transactionDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LedgerEntry_transactionDate_idx" ON crm_v2."LedgerEntry" USING btree ("transactionDate");


--
-- Name: LedgerEntry_transactionType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LedgerEntry_transactionType_idx" ON crm_v2."LedgerEntry" USING btree ("transactionType");


--
-- Name: LoanDematVendor_isActive_sortOrder_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LoanDematVendor_isActive_sortOrder_name_idx" ON crm_v2."LoanDematVendor" USING btree ("isActive", "sortOrder", name);


--
-- Name: LocationMaster_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LocationMaster_code_idx" ON crm_v2."LocationMaster" USING btree (code);


--
-- Name: LocationMaster_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "LocationMaster_code_key" ON crm_v2."LocationMaster" USING btree (code);


--
-- Name: LocationMaster_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LocationMaster_isActive_idx" ON crm_v2."LocationMaster" USING btree ("isActive");


--
-- Name: LocationMaster_parentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LocationMaster_parentId_idx" ON crm_v2."LocationMaster" USING btree ("parentId");


--
-- Name: LocationMaster_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LocationMaster_type_idx" ON crm_v2."LocationMaster" USING btree (type);


--
-- Name: MDAppointment_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MDAppointment_createdAt_idx" ON crm_v2."MDAppointment" USING btree ("createdAt");


--
-- Name: MDAppointment_employeeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MDAppointment_employeeId_idx" ON crm_v2."MDAppointment" USING btree ("employeeId");


--
-- Name: MDAppointment_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MDAppointment_status_idx" ON crm_v2."MDAppointment" USING btree (status);


--
-- Name: MDApprovalRequest_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MDApprovalRequest_createdAt_idx" ON crm_v2."MDApprovalRequest" USING btree ("createdAt");


--
-- Name: MDApprovalRequest_requestedById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MDApprovalRequest_requestedById_idx" ON crm_v2."MDApprovalRequest" USING btree ("requestedById");


--
-- Name: MDApprovalRequest_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MDApprovalRequest_status_idx" ON crm_v2."MDApprovalRequest" USING btree (status);


--
-- Name: MDTaskTeamMember_employeeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MDTaskTeamMember_employeeId_idx" ON crm_v2."MDTaskTeamMember" USING btree ("employeeId");


--
-- Name: MDTaskTeamMember_teamId_employeeId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "MDTaskTeamMember_teamId_employeeId_key" ON crm_v2."MDTaskTeamMember" USING btree ("teamId", "employeeId");


--
-- Name: MDTaskTeamMember_teamId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MDTaskTeamMember_teamId_idx" ON crm_v2."MDTaskTeamMember" USING btree ("teamId");


--
-- Name: MDTaskTeam_ownerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MDTaskTeam_ownerId_idx" ON crm_v2."MDTaskTeam" USING btree ("ownerId");


--
-- Name: MDWatchlistEmployee_employeeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MDWatchlistEmployee_employeeId_idx" ON crm_v2."MDWatchlistEmployee" USING btree ("employeeId");


--
-- Name: MDWatchlistEmployee_ownerId_employeeId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "MDWatchlistEmployee_ownerId_employeeId_key" ON crm_v2."MDWatchlistEmployee" USING btree ("ownerId", "employeeId");


--
-- Name: MDWatchlistEmployee_ownerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MDWatchlistEmployee_ownerId_idx" ON crm_v2."MDWatchlistEmployee" USING btree ("ownerId");


--
-- Name: MeetParticipant_meetId_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "MeetParticipant_meetId_userId_key" ON crm_v2."MeetParticipant" USING btree ("meetId", "userId");


--
-- Name: MeetParticipant_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MeetParticipant_userId_idx" ON crm_v2."MeetParticipant" USING btree ("userId");


--
-- Name: Meet_createdById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Meet_createdById_idx" ON crm_v2."Meet" USING btree ("createdById");


--
-- Name: Meet_mdAppointmentId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Meet_mdAppointmentId_key" ON crm_v2."Meet" USING btree ("mdAppointmentId");


--
-- Name: Meet_module_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Meet_module_idx" ON crm_v2."Meet" USING btree (module);


--
-- Name: Meet_scheduledAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Meet_scheduledAt_idx" ON crm_v2."Meet" USING btree ("scheduledAt");


--
-- Name: MentalHealthRequest_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MentalHealthRequest_createdAt_idx" ON crm_v2."MentalHealthRequest" USING btree ("createdAt");


--
-- Name: MentalHealthRequest_employeeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MentalHealthRequest_employeeId_idx" ON crm_v2."MentalHealthRequest" USING btree ("employeeId");


--
-- Name: MentalHealthRequest_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MentalHealthRequest_status_idx" ON crm_v2."MentalHealthRequest" USING btree (status);


--
-- Name: MonthlyPayroll_employeeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MonthlyPayroll_employeeId_idx" ON crm_v2."MonthlyPayroll" USING btree ("employeeId");


--
-- Name: MonthlyPayroll_employeeId_month_year_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "MonthlyPayroll_employeeId_month_year_key" ON crm_v2."MonthlyPayroll" USING btree ("employeeId", month, year);


--
-- Name: MonthlyPayroll_month_year_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MonthlyPayroll_month_year_idx" ON crm_v2."MonthlyPayroll" USING btree (month, year);


--
-- Name: MonthlyPayroll_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MonthlyPayroll_status_idx" ON crm_v2."MonthlyPayroll" USING btree (status);


--
-- Name: NoticeRecipient_acknowledgedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "NoticeRecipient_acknowledgedAt_idx" ON crm_v2."NoticeRecipient" USING btree ("acknowledgedAt");


--
-- Name: NoticeRecipient_noticeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "NoticeRecipient_noticeId_idx" ON crm_v2."NoticeRecipient" USING btree ("noticeId");


--
-- Name: NoticeRecipient_noticeId_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "NoticeRecipient_noticeId_userId_key" ON crm_v2."NoticeRecipient" USING btree ("noticeId", "userId");


--
-- Name: NoticeRecipient_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "NoticeRecipient_userId_idx" ON crm_v2."NoticeRecipient" USING btree ("userId");


--
-- Name: Notice_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Notice_createdAt_idx" ON crm_v2."Notice" USING btree ("createdAt");


--
-- Name: Notice_createdById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Notice_createdById_idx" ON crm_v2."Notice" USING btree ("createdById");


--
-- Name: Notification_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Notification_createdAt_idx" ON crm_v2."Notification" USING btree ("createdAt");


--
-- Name: Notification_isRead_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Notification_isRead_idx" ON crm_v2."Notification" USING btree ("isRead");


--
-- Name: Notification_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Notification_userId_idx" ON crm_v2."Notification" USING btree ("userId");


--
-- Name: OutstandingCase_dos_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OutstandingCase_dos_idx" ON crm_v2."OutstandingCase" USING btree (dos);


--
-- Name: OutstandingCase_leadId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OutstandingCase_leadId_idx" ON crm_v2."OutstandingCase" USING btree ("leadId");


--
-- Name: OutstandingCase_leadId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "OutstandingCase_leadId_key" ON crm_v2."OutstandingCase" USING btree ("leadId");


--
-- Name: OutstandingCase_month_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OutstandingCase_month_idx" ON crm_v2."OutstandingCase" USING btree (month);


--
-- Name: OutstandingCase_paymentReceived_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OutstandingCase_paymentReceived_idx" ON crm_v2."OutstandingCase" USING btree ("paymentReceived");


--
-- Name: OutstandingCase_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OutstandingCase_status_idx" ON crm_v2."OutstandingCase" USING btree (status);


--
-- Name: PLLedgerEntry_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PLLedgerEntry_createdAt_idx" ON crm_v2."PLLedgerEntry" USING btree ("createdAt");


--
-- Name: PLLedgerEntry_importId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PLLedgerEntry_importId_idx" ON crm_v2."PLLedgerEntry" USING btree ("importId");


--
-- Name: PLLedgerEntry_leadRef_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PLLedgerEntry_leadRef_idx" ON crm_v2."PLLedgerEntry" USING btree ("leadRef");


--
-- Name: PLLedgerEntry_month_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PLLedgerEntry_month_idx" ON crm_v2."PLLedgerEntry" USING btree (month);


--
-- Name: PLLedgerEntry_surgeryDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PLLedgerEntry_surgeryDate_idx" ON crm_v2."PLLedgerEntry" USING btree ("surgeryDate");


--
-- Name: PLLedgerImport_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PLLedgerImport_createdAt_idx" ON crm_v2."PLLedgerImport" USING btree ("createdAt");


--
-- Name: PLLedgerImport_uploadedById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PLLedgerImport_uploadedById_idx" ON crm_v2."PLLedgerImport" USING btree ("uploadedById");


--
-- Name: PLRecord_closedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PLRecord_closedAt_idx" ON crm_v2."PLRecord" USING btree ("closedAt");


--
-- Name: PLRecord_leadId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PLRecord_leadId_idx" ON crm_v2."PLRecord" USING btree ("leadId");


--
-- Name: PLRecord_leadId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PLRecord_leadId_key" ON crm_v2."PLRecord" USING btree ("leadId");


--
-- Name: PLRecord_leadRef_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PLRecord_leadRef_key" ON crm_v2."PLRecord" USING btree ("leadRef") WHERE ("leadRef" IS NOT NULL);


--
-- Name: PLRecord_month_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PLRecord_month_idx" ON crm_v2."PLRecord" USING btree (month);


--
-- Name: PLRecord_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PLRecord_status_idx" ON crm_v2."PLRecord" USING btree (status);


--
-- Name: PLRecord_surgeryDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PLRecord_surgeryDate_idx" ON crm_v2."PLRecord" USING btree ("surgeryDate");


--
-- Name: PartyMaster_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PartyMaster_isActive_idx" ON crm_v2."PartyMaster" USING btree ("isActive");


--
-- Name: PartyMaster_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PartyMaster_name_idx" ON crm_v2."PartyMaster" USING btree (name);


--
-- Name: PartyMaster_partyType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PartyMaster_partyType_idx" ON crm_v2."PartyMaster" USING btree ("partyType");


--
-- Name: PaymentInstallment_hospitalName_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PaymentInstallment_hospitalName_idx" ON crm_v2."PaymentInstallment" USING btree ("hospitalName");


--
-- Name: PaymentInstallment_leadId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PaymentInstallment_leadId_idx" ON crm_v2."PaymentInstallment" USING btree ("leadId");


--
-- Name: PaymentInstallment_paidOn_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PaymentInstallment_paidOn_idx" ON crm_v2."PaymentInstallment" USING btree ("paidOn");


--
-- Name: PaymentInstallment_recipient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PaymentInstallment_recipient_idx" ON crm_v2."PaymentInstallment" USING btree (recipient);


--
-- Name: PaymentInstallment_verificationStatus_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PaymentInstallment_verificationStatus_idx" ON crm_v2."PaymentInstallment" USING btree ("verificationStatus");


--
-- Name: PaymentModeMaster_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PaymentModeMaster_isActive_idx" ON crm_v2."PaymentModeMaster" USING btree ("isActive");


--
-- Name: PaymentModeMaster_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PaymentModeMaster_name_idx" ON crm_v2."PaymentModeMaster" USING btree (name);


--
-- Name: PaymentModeMaster_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PaymentModeMaster_name_key" ON crm_v2."PaymentModeMaster" USING btree (name);


--
-- Name: PaymentTypeMaster_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PaymentTypeMaster_isActive_idx" ON crm_v2."PaymentTypeMaster" USING btree ("isActive");


--
-- Name: PaymentTypeMaster_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PaymentTypeMaster_name_key" ON crm_v2."PaymentTypeMaster" USING btree (name);


--
-- Name: PaymentTypeMaster_paymentType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PaymentTypeMaster_paymentType_idx" ON crm_v2."PaymentTypeMaster" USING btree ("paymentType");


--
-- Name: PayrollComponent_componentType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PayrollComponent_componentType_idx" ON crm_v2."PayrollComponent" USING btree ("componentType");


--
-- Name: PayrollComponent_payrollRecordId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PayrollComponent_payrollRecordId_idx" ON crm_v2."PayrollComponent" USING btree ("payrollRecordId");


--
-- Name: PayrollRecord_employeeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PayrollRecord_employeeId_idx" ON crm_v2."PayrollRecord" USING btree ("employeeId");


--
-- Name: PayrollRecord_employeeId_month_year_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PayrollRecord_employeeId_month_year_key" ON crm_v2."PayrollRecord" USING btree ("employeeId", month, year);


--
-- Name: PayrollRecord_month_year_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PayrollRecord_month_year_idx" ON crm_v2."PayrollRecord" USING btree (month, year);


--
-- Name: PermissionAssignment_resourceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PermissionAssignment_resourceId_idx" ON crm_v2."PermissionAssignment" USING btree ("resourceId");


--
-- Name: PermissionAssignment_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PermissionAssignment_role_idx" ON crm_v2."PermissionAssignment" USING btree (role);


--
-- Name: PermissionAssignment_userId_resourceId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PermissionAssignment_userId_resourceId_key" ON crm_v2."PermissionAssignment" USING btree ("userId", "resourceId");


--
-- Name: PnLCategory_departmentKey_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PnLCategory_departmentKey_idx" ON crm_v2."PnLCategory" USING btree ("departmentKey");


--
-- Name: PnLCategory_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PnLCategory_isActive_idx" ON crm_v2."PnLCategory" USING btree ("isActive");


--
-- Name: PnLCategory_sourceKey_departmentKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PnLCategory_sourceKey_departmentKey_key" ON crm_v2."PnLCategory" USING btree ("sourceKey", "departmentKey");


--
-- Name: PnLCategory_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PnLCategory_type_idx" ON crm_v2."PnLCategory" USING btree (type);


--
-- Name: PnLConfig_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PnLConfig_key_key" ON crm_v2."PnLConfig" USING btree (key);


--
-- Name: PnLEntry_categoryId_month_year_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PnLEntry_categoryId_month_year_key" ON crm_v2."PnLEntry" USING btree ("categoryId", month, year);


--
-- Name: PnLEntry_month_year_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PnLEntry_month_year_idx" ON crm_v2."PnLEntry" USING btree (month, year);


--
-- Name: PreAuthPDF_preAuthorizationId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PreAuthPDF_preAuthorizationId_idx" ON crm_v2."PreAuthPDF" USING btree ("preAuthorizationId");


--
-- Name: PreAuthorization_kypSubmissionId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PreAuthorization_kypSubmissionId_idx" ON crm_v2."PreAuthorization" USING btree ("kypSubmissionId");


--
-- Name: PreAuthorization_kypSubmissionId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PreAuthorization_kypSubmissionId_key" ON crm_v2."PreAuthorization" USING btree ("kypSubmissionId");


--
-- Name: PreAuthorization_preAuthRaisedById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PreAuthorization_preAuthRaisedById_idx" ON crm_v2."PreAuthorization" USING btree ("preAuthRaisedById");


--
-- Name: ProjectMaster_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProjectMaster_isActive_idx" ON crm_v2."ProjectMaster" USING btree ("isActive");


--
-- Name: ProjectMaster_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProjectMaster_name_idx" ON crm_v2."ProjectMaster" USING btree (name);


--
-- Name: ProjectMaster_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ProjectMaster_name_key" ON crm_v2."ProjectMaster" USING btree (name);


--
-- Name: PurchaseTransaction_itemId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PurchaseTransaction_itemId_idx" ON crm_v2."PurchaseTransaction" USING btree ("itemId");


--
-- Name: PurchaseTransaction_locationId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PurchaseTransaction_locationId_idx" ON crm_v2."PurchaseTransaction" USING btree ("locationId");


--
-- Name: PurchaseTransaction_purchaseDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PurchaseTransaction_purchaseDate_idx" ON crm_v2."PurchaseTransaction" USING btree ("purchaseDate");


--
-- Name: PurchaseTransaction_purchaseNumber_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PurchaseTransaction_purchaseNumber_idx" ON crm_v2."PurchaseTransaction" USING btree ("purchaseNumber");


--
-- Name: PurchaseTransaction_purchaseNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PurchaseTransaction_purchaseNumber_key" ON crm_v2."PurchaseTransaction" USING btree ("purchaseNumber");


--
-- Name: PurchaseTransaction_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PurchaseTransaction_status_idx" ON crm_v2."PurchaseTransaction" USING btree (status);


--
-- Name: PurchaseTransaction_supplierId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PurchaseTransaction_supplierId_idx" ON crm_v2."PurchaseTransaction" USING btree ("supplierId");


--
-- Name: PushSubscription_userId_endpoint_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PushSubscription_userId_endpoint_key" ON crm_v2."PushSubscription" USING btree ("userId", endpoint);


--
-- Name: PushSubscription_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PushSubscription_userId_idx" ON crm_v2."PushSubscription" USING btree ("userId");


--
-- Name: RankSnapshot_entityType_entityId_metric_month_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "RankSnapshot_entityType_entityId_metric_month_key" ON crm_v2."RankSnapshot" USING btree ("entityType", "entityId", metric, month);


--
-- Name: RankSnapshot_entityType_month_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RankSnapshot_entityType_month_idx" ON crm_v2."RankSnapshot" USING btree ("entityType", month);


--
-- Name: ReasonNoSurgeryMaster_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ReasonNoSurgeryMaster_code_key" ON crm_v2."ReasonNoSurgeryMaster" USING btree (code);


--
-- Name: ReasonNoSurgeryMaster_displayOrder_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ReasonNoSurgeryMaster_displayOrder_idx" ON crm_v2."ReasonNoSurgeryMaster" USING btree ("displayOrder");


--
-- Name: ReasonNoSurgeryMaster_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ReasonNoSurgeryMaster_isActive_idx" ON crm_v2."ReasonNoSurgeryMaster" USING btree ("isActive");


--
-- Name: RequestLog_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RequestLog_createdAt_idx" ON crm_v2."RequestLog" USING btree ("createdAt");


--
-- Name: RequestLog_path_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RequestLog_path_createdAt_idx" ON crm_v2."RequestLog" USING btree (path, "createdAt");


--
-- Name: RequestLog_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RequestLog_status_createdAt_idx" ON crm_v2."RequestLog" USING btree (status, "createdAt");


--
-- Name: Resource_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Resource_key_key" ON crm_v2."Resource" USING btree (key);


--
-- Name: SalaryStructure_effectiveFrom_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SalaryStructure_effectiveFrom_idx" ON crm_v2."SalaryStructure" USING btree ("effectiveFrom");


--
-- Name: SalaryStructure_employeeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SalaryStructure_employeeId_idx" ON crm_v2."SalaryStructure" USING btree ("employeeId");


--
-- Name: SalesEntry_isDeleted_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SalesEntry_isDeleted_idx" ON crm_v2."SalesEntry" USING btree ("isDeleted");


--
-- Name: SalesEntry_projectId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SalesEntry_projectId_idx" ON crm_v2."SalesEntry" USING btree ("projectId");


--
-- Name: SalesEntry_serialNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "SalesEntry_serialNumber_key" ON crm_v2."SalesEntry" USING btree ("serialNumber");


--
-- Name: SalesEntry_transactionDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SalesEntry_transactionDate_idx" ON crm_v2."SalesEntry" USING btree ("transactionDate");


--
-- Name: SalesTeamBulkCostEntryHistory_costType_changedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SalesTeamBulkCostEntryHistory_costType_changedAt_idx" ON crm_v2."SalesTeamBulkCostEntryHistory" USING btree ("costType", "changedAt");


--
-- Name: SalesTeamBulkCostEntryHistory_entryId_changedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SalesTeamBulkCostEntryHistory_entryId_changedAt_idx" ON crm_v2."SalesTeamBulkCostEntryHistory" USING btree ("entryId", "changedAt");


--
-- Name: SalesTeamBulkCostEntryHistory_month_year_costType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SalesTeamBulkCostEntryHistory_month_year_costType_idx" ON crm_v2."SalesTeamBulkCostEntryHistory" USING btree (month, year, "costType");


--
-- Name: SalesTeamBulkCostEntry_costType_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SalesTeamBulkCostEntry_costType_createdAt_idx" ON crm_v2."SalesTeamBulkCostEntry" USING btree ("costType", "createdAt");


--
-- Name: SalesTeamBulkCostEntry_employeeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SalesTeamBulkCostEntry_employeeId_idx" ON crm_v2."SalesTeamBulkCostEntry" USING btree ("employeeId");


--
-- Name: SalesTeamBulkCostEntry_month_year_costType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SalesTeamBulkCostEntry_month_year_costType_idx" ON crm_v2."SalesTeamBulkCostEntry" USING btree (month, year, "costType");


--
-- Name: SalesTeamCostEntry_employeeId_entryType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SalesTeamCostEntry_employeeId_entryType_idx" ON crm_v2."SalesTeamCostEntry" USING btree ("employeeId", "entryType");


--
-- Name: SalesTeamCostEntry_entryDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SalesTeamCostEntry_entryDate_idx" ON crm_v2."SalesTeamCostEntry" USING btree ("entryDate");


--
-- Name: StockMovement_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StockMovement_createdAt_idx" ON crm_v2."StockMovement" USING btree ("createdAt");


--
-- Name: StockMovement_itemId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StockMovement_itemId_idx" ON crm_v2."StockMovement" USING btree ("itemId");


--
-- Name: StockMovement_locationId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StockMovement_locationId_idx" ON crm_v2."StockMovement" USING btree ("locationId");


--
-- Name: StockMovement_referenceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StockMovement_referenceId_idx" ON crm_v2."StockMovement" USING btree ("referenceId");


--
-- Name: SupportTicket_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupportTicket_createdAt_idx" ON crm_v2."SupportTicket" USING btree ("createdAt");


--
-- Name: SupportTicket_departmentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupportTicket_departmentId_idx" ON crm_v2."SupportTicket" USING btree ("departmentId");


--
-- Name: SupportTicket_employeeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupportTicket_employeeId_idx" ON crm_v2."SupportTicket" USING btree ("employeeId");


--
-- Name: SupportTicket_priority_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupportTicket_priority_idx" ON crm_v2."SupportTicket" USING btree (priority);


--
-- Name: SupportTicket_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupportTicket_status_idx" ON crm_v2."SupportTicket" USING btree (status);


--
-- Name: SupportTicket_targetHeadRole_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupportTicket_targetHeadRole_idx" ON crm_v2."SupportTicket" USING btree ("targetHeadRole");


--
-- Name: SurgeryLedgerEntry_appointmentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SurgeryLedgerEntry_appointmentId_idx" ON crm_v2."SurgeryLedgerEntry" USING btree ("appointmentId");


--
-- Name: SurgeryLedgerEntry_circle_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SurgeryLedgerEntry_circle_idx" ON crm_v2."SurgeryLedgerEntry" USING btree (circle);


--
-- Name: SurgeryLedgerEntry_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SurgeryLedgerEntry_createdAt_idx" ON crm_v2."SurgeryLedgerEntry" USING btree ("createdAt");


--
-- Name: SurgeryLedgerEntry_month_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SurgeryLedgerEntry_month_idx" ON crm_v2."SurgeryLedgerEntry" USING btree (month);


--
-- Name: SurgeryLedgerEntry_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SurgeryLedgerEntry_status_idx" ON crm_v2."SurgeryLedgerEntry" USING btree (status);


--
-- Name: SurgeryLedgerEntry_surgeryDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SurgeryLedgerEntry_surgeryDate_idx" ON crm_v2."SurgeryLedgerEntry" USING btree ("surgeryDate");


--
-- Name: SurgeryLedgerEntry_uploadId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SurgeryLedgerEntry_uploadId_idx" ON crm_v2."SurgeryLedgerEntry" USING btree ("uploadId");


--
-- Name: SurgeryLedgerUpload_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SurgeryLedgerUpload_createdAt_idx" ON crm_v2."SurgeryLedgerUpload" USING btree ("createdAt");


--
-- Name: SurgeryLedgerUpload_uploadedById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SurgeryLedgerUpload_uploadedById_idx" ON crm_v2."SurgeryLedgerUpload" USING btree ("uploadedById");


--
-- Name: SurgeryRemarkMaster_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "SurgeryRemarkMaster_code_key" ON crm_v2."SurgeryRemarkMaster" USING btree (code);


--
-- Name: SurgeryRemarkMaster_displayOrder_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SurgeryRemarkMaster_displayOrder_idx" ON crm_v2."SurgeryRemarkMaster" USING btree ("displayOrder");


--
-- Name: SurgeryRemarkMaster_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SurgeryRemarkMaster_isActive_idx" ON crm_v2."SurgeryRemarkMaster" USING btree ("isActive");


--
-- Name: SyncState_sourceType_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "SyncState_sourceType_key" ON crm_v2."SyncState" USING btree ("sourceType");


--
-- Name: TPAMaster_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TPAMaster_isActive_idx" ON crm_v2."TPAMaster" USING btree ("isActive");


--
-- Name: TPAMaster_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TPAMaster_name_idx" ON crm_v2."TPAMaster" USING btree (name);


--
-- Name: TPAMaster_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TPAMaster_name_key" ON crm_v2."TPAMaster" USING btree (name);


--
-- Name: TargetPnLEntry_departmentKey_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TargetPnLEntry_departmentKey_idx" ON crm_v2."TargetPnLEntry" USING btree ("departmentKey");


--
-- Name: TargetPnLEntry_departmentKey_sourceKey_month_year_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TargetPnLEntry_departmentKey_sourceKey_month_year_key" ON crm_v2."TargetPnLEntry" USING btree ("departmentKey", "sourceKey", month, year);


--
-- Name: TargetPnLEntry_month_year_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TargetPnLEntry_month_year_idx" ON crm_v2."TargetPnLEntry" USING btree (month, year);


--
-- Name: Target_periodStartDate_periodEndDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Target_periodStartDate_periodEndDate_idx" ON crm_v2."Target" USING btree ("periodStartDate", "periodEndDate");


--
-- Name: Target_targetType_targetForId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Target_targetType_targetForId_idx" ON crm_v2."Target" USING btree ("targetType", "targetForId");


--
-- Name: TaskActivityLog_taskId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TaskActivityLog_taskId_idx" ON crm_v2."TaskActivityLog" USING btree ("taskId");


--
-- Name: TaskActivityLog_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TaskActivityLog_userId_idx" ON crm_v2."TaskActivityLog" USING btree ("userId");


--
-- Name: TaskComment_parentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TaskComment_parentId_idx" ON crm_v2."TaskComment" USING btree ("parentId");


--
-- Name: TaskComment_taskId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TaskComment_taskId_idx" ON crm_v2."TaskComment" USING btree ("taskId");


--
-- Name: TaskComment_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TaskComment_userId_idx" ON crm_v2."TaskComment" USING btree ("userId");


--
-- Name: TaskDueDateApproval_requestedById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TaskDueDateApproval_requestedById_idx" ON crm_v2."TaskDueDateApproval" USING btree ("requestedById");


--
-- Name: TaskDueDateApproval_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TaskDueDateApproval_status_idx" ON crm_v2."TaskDueDateApproval" USING btree (status);


--
-- Name: TaskDueDateApproval_taskId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TaskDueDateApproval_taskId_idx" ON crm_v2."TaskDueDateApproval" USING btree ("taskId");


--
-- Name: TaskProject_createdById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TaskProject_createdById_idx" ON crm_v2."TaskProject" USING btree ("createdById");


--
-- Name: TaskProject_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TaskProject_name_key" ON crm_v2."TaskProject" USING btree (name);


--
-- Name: TaskRating_employeeId_month_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TaskRating_employeeId_month_idx" ON crm_v2."TaskRating" USING btree ("employeeId", month);


--
-- Name: TaskRating_taskId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TaskRating_taskId_idx" ON crm_v2."TaskRating" USING btree ("taskId");


--
-- Name: Task_assigneeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Task_assigneeId_idx" ON crm_v2."Task" USING btree ("assigneeId");


--
-- Name: Task_completedById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Task_completedById_idx" ON crm_v2."Task" USING btree ("completedById");


--
-- Name: Task_createdById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Task_createdById_idx" ON crm_v2."Task" USING btree ("createdById");


--
-- Name: Task_dueDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Task_dueDate_idx" ON crm_v2."Task" USING btree ("dueDate");


--
-- Name: Task_projectId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Task_projectId_idx" ON crm_v2."Task" USING btree ("projectId");


--
-- Name: Task_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Task_status_idx" ON crm_v2."Task" USING btree (status);


--
-- Name: TierDefinition_metric_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TierDefinition_metric_order_idx" ON crm_v2."TierDefinition" USING btree (metric, "order");


--
-- Name: TreatmentCategoryMaster_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TreatmentCategoryMaster_isActive_idx" ON crm_v2."TreatmentCategoryMaster" USING btree ("isActive");


--
-- Name: TreatmentCategoryMaster_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TreatmentCategoryMaster_name_idx" ON crm_v2."TreatmentCategoryMaster" USING btree (name);


--
-- Name: TreatmentCategoryMaster_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TreatmentCategoryMaster_name_key" ON crm_v2."TreatmentCategoryMaster" USING btree (name);


--
-- Name: TreatmentMaster_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TreatmentMaster_category_idx" ON crm_v2."TreatmentMaster" USING btree (category);


--
-- Name: TreatmentMaster_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TreatmentMaster_isActive_idx" ON crm_v2."TreatmentMaster" USING btree ("isActive");


--
-- Name: TreatmentMaster_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TreatmentMaster_name_idx" ON crm_v2."TreatmentMaster" USING btree (name);


--
-- Name: TreatmentMaster_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TreatmentMaster_name_key" ON crm_v2."TreatmentMaster" USING btree (name);


--
-- Name: UserCrmPermission_permissionKey_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UserCrmPermission_permissionKey_idx" ON crm_v2."UserCrmPermission" USING btree ("permissionKey");


--
-- Name: UserCrmPermission_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UserCrmPermission_userId_idx" ON crm_v2."UserCrmPermission" USING btree ("userId");


--
-- Name: UserCrmPermission_userId_permissionKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UserCrmPermission_userId_permissionKey_key" ON crm_v2."UserCrmPermission" USING btree ("userId", "permissionKey");


--
-- Name: UserFeaturePermission_featureKey_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UserFeaturePermission_featureKey_idx" ON crm_v2."UserFeaturePermission" USING btree ("featureKey");


--
-- Name: UserFeaturePermission_userId_featureKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UserFeaturePermission_userId_featureKey_key" ON crm_v2."UserFeaturePermission" USING btree ("userId", "featureKey");


--
-- Name: UserFeaturePermission_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UserFeaturePermission_userId_idx" ON crm_v2."UserFeaturePermission" USING btree ("userId");


--
-- Name: UserStatus_startsAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UserStatus_startsAt_idx" ON crm_v2."UserStatus" USING btree ("startsAt");


--
-- Name: UserStatus_userId_startsAt_endsAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UserStatus_userId_startsAt_endsAt_idx" ON crm_v2."UserStatus" USING btree ("userId", "startsAt", "endsAt");


--
-- Name: UserTaskSeen_taskId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UserTaskSeen_taskId_idx" ON crm_v2."UserTaskSeen" USING btree ("taskId");


--
-- Name: UserTaskSeen_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UserTaskSeen_userId_idx" ON crm_v2."UserTaskSeen" USING btree ("userId");


--
-- Name: UserTaskSeen_userId_taskId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UserTaskSeen_userId_taskId_key" ON crm_v2."UserTaskSeen" USING btree ("userId", "taskId");


--
-- Name: User_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_email_idx" ON crm_v2."User" USING btree (email);


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON crm_v2."User" USING btree (email);


--
-- Name: User_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_role_idx" ON crm_v2."User" USING btree (role);


--
-- Name: Warning_employeeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Warning_employeeId_idx" ON crm_v2."Warning" USING btree ("employeeId");


--
-- Name: Warning_issuedById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Warning_issuedById_idx" ON crm_v2."Warning" USING btree ("issuedById");


--
-- Name: Warning_taskId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Warning_taskId_idx" ON crm_v2."Warning" USING btree ("taskId");


--
-- Name: WorkLog_employeeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkLog_employeeId_idx" ON crm_v2."WorkLog" USING btree ("employeeId");


--
-- Name: WorkLog_employeeId_logDate_intervalStart_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "WorkLog_employeeId_logDate_intervalStart_key" ON crm_v2."WorkLog" USING btree ("employeeId", "logDate", "intervalStart");


--
-- Name: WorkLog_logDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkLog_logDate_idx" ON crm_v2."WorkLog" USING btree ("logDate");


--
-- Name: WorkflowResetLog_leadId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkflowResetLog_leadId_idx" ON crm_v2."WorkflowResetLog" USING btree ("leadId");


--
-- Name: WorkflowResetLog_resetAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkflowResetLog_resetAt_idx" ON crm_v2."WorkflowResetLog" USING btree ("resetAt");


--
-- Name: WorkflowResetLog_resetById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkflowResetLog_resetById_idx" ON crm_v2."WorkflowResetLog" USING btree ("resetById");


--
-- Name: inventory_audit_events_workspace_id_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_audit_events_workspace_id_at_idx ON crm_v2.inventory_audit_events USING btree (workspace_id, at);


--
-- Name: knowledge_chunk_search_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX knowledge_chunk_search_idx ON crm_v2."KnowledgeChunk" USING gin (search_vector);


--
-- Name: status_categoryId_groupId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "status_categoryId_groupId_idx" ON crm_v2.status USING btree ("categoryId", "groupId");


--
-- Name: status_category_category_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX status_category_category_key ON crm_v2.status_category USING btree (category);


--
-- Name: status_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX status_code_key ON crm_v2.status USING btree (code);


--
-- Name: status_groupId_status_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "status_groupId_status_key" ON crm_v2.status USING btree ("groupId", status);


--
-- Name: status_group_categoryId_group_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "status_group_categoryId_group_key" ON crm_v2.status_group USING btree ("categoryId", "group");


--
-- Name: status_group_categoryId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "status_group_categoryId_idx" ON crm_v2.status_group USING btree ("categoryId");


--
-- Name: Lead Lead_status_sync; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "Lead_status_sync" BEFORE INSERT OR UPDATE OF status, "statusId" ON crm_v2."Lead" FOR EACH ROW EXECUTE FUNCTION crm_v2.sync_lead_status();


--
-- Name: AdmissionRecordImplantUsage AdmissionRecordImplantUsage_admissionRecordId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."AdmissionRecordImplantUsage"
    ADD CONSTRAINT "AdmissionRecordImplantUsage_admissionRecordId_fkey" FOREIGN KEY ("admissionRecordId") REFERENCES crm_v2."AdmissionRecord"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AdmissionRecordImplantUsage AdmissionRecordImplantUsage_implantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."AdmissionRecordImplantUsage"
    ADD CONSTRAINT "AdmissionRecordImplantUsage_implantId_fkey" FOREIGN KEY ("implantId") REFERENCES crm_v2."ImplantMaster"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AdmissionRecordPrescriptionImage AdmissionRecordPrescriptionImage_admissionRecordId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."AdmissionRecordPrescriptionImage"
    ADD CONSTRAINT "AdmissionRecordPrescriptionImage_admissionRecordId_fkey" FOREIGN KEY ("admissionRecordId") REFERENCES crm_v2."AdmissionRecord"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AdmissionRecord AdmissionRecord_initiatedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."AdmissionRecord"
    ADD CONSTRAINT "AdmissionRecord_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AdmissionRecord AdmissionRecord_leadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."AdmissionRecord"
    ADD CONSTRAINT "AdmissionRecord_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES crm_v2."Lead"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AiConversation AiConversation_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."AiConversation"
    ADD CONSTRAINT "AiConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AiMessage AiMessage_conversationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."AiMessage"
    ADD CONSTRAINT "AiMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES crm_v2."AiConversation"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AiMessage AiMessage_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."AiMessage"
    ADD CONSTRAINT "AiMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AiToolCall AiToolCall_conversationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."AiToolCall"
    ADD CONSTRAINT "AiToolCall_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES crm_v2."AiConversation"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: AiToolCall AiToolCall_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."AiToolCall"
    ADD CONSTRAINT "AiToolCall_userId_fkey" FOREIGN KEY ("userId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AttendanceLog AttendanceLog_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."AttendanceLog"
    ADD CONSTRAINT "AttendanceLog_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES crm_v2."Employee"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AttendanceNormalization AttendanceNormalization_approvedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."AttendanceNormalization"
    ADD CONSTRAINT "AttendanceNormalization_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES crm_v2."Employee"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: AttendanceNormalization AttendanceNormalization_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."AttendanceNormalization"
    ADD CONSTRAINT "AttendanceNormalization_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES crm_v2."Employee"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AttendanceNormalization AttendanceNormalization_managerApprovedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."AttendanceNormalization"
    ADD CONSTRAINT "AttendanceNormalization_managerApprovedById_fkey" FOREIGN KEY ("managerApprovedById") REFERENCES crm_v2."Employee"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: AttendanceNormalization AttendanceNormalization_requestedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."AttendanceNormalization"
    ADD CONSTRAINT "AttendanceNormalization_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES crm_v2."Employee"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BonusRule BonusRule_targetId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."BonusRule"
    ADD CONSTRAINT "BonusRule_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES crm_v2."Target"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BulkLeadReassignmentRun BulkLeadReassignmentRun_actorUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."BulkLeadReassignmentRun"
    ADD CONSTRAINT "BulkLeadReassignmentRun_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CallNote CallNote_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CallNote"
    ADD CONSTRAINT "CallNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CallNote CallNote_leadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CallNote"
    ADD CONSTRAINT "CallNote_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES crm_v2."Lead"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CampaignCPL CampaignCPL_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CampaignCPL"
    ADD CONSTRAINT "CampaignCPL_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CaseChatMessage CaseChatMessage_leadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CaseChatMessage"
    ADD CONSTRAINT "CaseChatMessage_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES crm_v2."Lead"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CaseChatMessage CaseChatMessage_senderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CaseChatMessage"
    ADD CONSTRAINT "CaseChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CaseStageHistory CaseStageHistory_changedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CaseStageHistory"
    ADD CONSTRAINT "CaseStageHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CaseStageHistory CaseStageHistory_leadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CaseStageHistory"
    ADD CONSTRAINT "CaseStageHistory_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES crm_v2."Lead"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ChatReadReceipt ChatReadReceipt_leadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."ChatReadReceipt"
    ADD CONSTRAINT "ChatReadReceipt_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES crm_v2."Lead"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ChatReadReceipt ChatReadReceipt_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."ChatReadReceipt"
    ADD CONSTRAINT "ChatReadReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ComplianceCall ComplianceCall_calledByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."ComplianceCall"
    ADD CONSTRAINT "ComplianceCall_calledByUserId_fkey" FOREIGN KEY ("calledByUserId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ComplianceCall ComplianceCall_leadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."ComplianceCall"
    ADD CONSTRAINT "ComplianceCall_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES crm_v2."Lead"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CrmActivityLog CrmActivityLog_actorUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CrmActivityLog"
    ADD CONSTRAINT "CrmActivityLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CrmAssignmentPreviewLog CrmAssignmentPreviewLog_leadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CrmAssignmentPreviewLog"
    ADD CONSTRAINT "CrmAssignmentPreviewLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES crm_v2."Lead"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CrmAssignmentRuleMember CrmAssignmentRuleMember_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CrmAssignmentRuleMember"
    ADD CONSTRAINT "CrmAssignmentRuleMember_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES crm_v2."Employee"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CrmAssignmentRuleMember CrmAssignmentRuleMember_ruleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CrmAssignmentRuleMember"
    ADD CONSTRAINT "CrmAssignmentRuleMember_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES crm_v2."CrmAssignmentRule"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CrmAssignmentRule CrmAssignmentRule_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CrmAssignmentRule"
    ADD CONSTRAINT "CrmAssignmentRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CrmAssignmentRule CrmAssignmentRule_departmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CrmAssignmentRule"
    ADD CONSTRAINT "CrmAssignmentRule_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES crm_v2."Department"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CrmAssignmentRule CrmAssignmentRule_updatedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CrmAssignmentRule"
    ADD CONSTRAINT "CrmAssignmentRule_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CrmCampaignBdDailyLimit CrmCampaignBdDailyLimit_bdEmployeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CrmCampaignBdDailyLimit"
    ADD CONSTRAINT "CrmCampaignBdDailyLimit_bdEmployeeId_fkey" FOREIGN KEY ("bdEmployeeId") REFERENCES crm_v2."Employee"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CrmCampaignBdDailyLimit CrmCampaignBdDailyLimit_bdUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CrmCampaignBdDailyLimit"
    ADD CONSTRAINT "CrmCampaignBdDailyLimit_bdUserId_fkey" FOREIGN KEY ("bdUserId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CrmCampaignBdDailyLimit CrmCampaignBdDailyLimit_campaignId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CrmCampaignBdDailyLimit"
    ADD CONSTRAINT "CrmCampaignBdDailyLimit_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES crm_v2."CrmCampaign"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CrmCampaignBdDailyLimit CrmCampaignBdDailyLimit_teamLeadEmployeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CrmCampaignBdDailyLimit"
    ADD CONSTRAINT "CrmCampaignBdDailyLimit_teamLeadEmployeeId_fkey" FOREIGN KEY ("teamLeadEmployeeId") REFERENCES crm_v2."Employee"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CrmCampaignCircleSelection CrmCampaignCircleSelection_campaignId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CrmCampaignCircleSelection"
    ADD CONSTRAINT "CrmCampaignCircleSelection_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES crm_v2."CrmCampaign"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CrmCampaignCircleSelection CrmCampaignCircleSelection_circleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CrmCampaignCircleSelection"
    ADD CONSTRAINT "CrmCampaignCircleSelection_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES crm_v2."CrmCampaignCircle"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CrmCampaignCity CrmCampaignCity_circleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CrmCampaignCity"
    ADD CONSTRAINT "CrmCampaignCity_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES crm_v2."CrmCampaignCircle"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CrmCampaignLeadSource CrmCampaignLeadSource_sourceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CrmCampaignLeadSource"
    ADD CONSTRAINT "CrmCampaignLeadSource_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES crm_v2."CrmCampaignSource"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CrmCampaignTeamLeadAssignment CrmCampaignTeamLeadAssignment_campaignId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CrmCampaignTeamLeadAssignment"
    ADD CONSTRAINT "CrmCampaignTeamLeadAssignment_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES crm_v2."CrmCampaign"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CrmCampaignTeamLeadAssignment CrmCampaignTeamLeadAssignment_teamLeadEmployeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CrmCampaignTeamLeadAssignment"
    ADD CONSTRAINT "CrmCampaignTeamLeadAssignment_teamLeadEmployeeId_fkey" FOREIGN KEY ("teamLeadEmployeeId") REFERENCES crm_v2."Employee"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CrmCampaignTeamLeadAssignment CrmCampaignTeamLeadAssignment_teamLeadUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CrmCampaignTeamLeadAssignment"
    ADD CONSTRAINT "CrmCampaignTeamLeadAssignment_teamLeadUserId_fkey" FOREIGN KEY ("teamLeadUserId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CrmCampaign CrmCampaign_circleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CrmCampaign"
    ADD CONSTRAINT "CrmCampaign_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES crm_v2."CrmCampaignCircle"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CrmCampaign CrmCampaign_cityId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CrmCampaign"
    ADD CONSTRAINT "CrmCampaign_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES crm_v2."CrmCampaignCity"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CrmCampaign CrmCampaign_departmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CrmCampaign"
    ADD CONSTRAINT "CrmCampaign_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES crm_v2."Department"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CrmCampaign CrmCampaign_leadSourceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CrmCampaign"
    ADD CONSTRAINT "CrmCampaign_leadSourceId_fkey" FOREIGN KEY ("leadSourceId") REFERENCES crm_v2."CrmCampaignLeadSource"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CrmCampaign CrmCampaign_sourceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CrmCampaign"
    ADD CONSTRAINT "CrmCampaign_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES crm_v2."CrmCampaignSource"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CrmCampaign CrmCampaign_treatmentMasterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CrmCampaign"
    ADD CONSTRAINT "CrmCampaign_treatmentMasterId_fkey" FOREIGN KEY ("treatmentMasterId") REFERENCES crm_v2."TreatmentMaster"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CumulativeReportManualEntry CumulativeReportManualEntry_updatedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."CumulativeReportManualEntry"
    ADD CONSTRAINT "CumulativeReportManualEntry_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: DailyCampaignSpend DailyCampaignSpend_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."DailyCampaignSpend"
    ADD CONSTRAINT "DailyCampaignSpend_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DepartmentRevenue DepartmentRevenue_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."DepartmentRevenue"
    ADD CONSTRAINT "DepartmentRevenue_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DepartmentRevenue DepartmentRevenue_vendorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."DepartmentRevenue"
    ADD CONSTRAINT "DepartmentRevenue_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES crm_v2."LoanDematVendor"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: DepartmentTeam DepartmentTeam_departmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."DepartmentTeam"
    ADD CONSTRAINT "DepartmentTeam_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES crm_v2."Department"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DepartmentTeam DepartmentTeam_teamLeadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."DepartmentTeam"
    ADD CONSTRAINT "DepartmentTeam_teamLeadId_fkey" FOREIGN KEY ("teamLeadId") REFERENCES crm_v2."Employee"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Department Department_headId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."Department"
    ADD CONSTRAINT "Department_headId_fkey" FOREIGN KEY ("headId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: DischargeSheet DischargeSheet_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."DischargeSheet"
    ADD CONSTRAINT "DischargeSheet_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DischargeSheet DischargeSheet_finalizedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."DischargeSheet"
    ADD CONSTRAINT "DischargeSheet_finalizedById_fkey" FOREIGN KEY ("finalizedById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: DischargeSheet DischargeSheet_kypSubmissionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."DischargeSheet"
    ADD CONSTRAINT "DischargeSheet_kypSubmissionId_fkey" FOREIGN KEY ("kypSubmissionId") REFERENCES crm_v2."KYPSubmission"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: DischargeSheet DischargeSheet_leadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."DischargeSheet"
    ADD CONSTRAINT "DischargeSheet_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES crm_v2."Lead"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DischargeSheet DischargeSheet_markedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."DischargeSheet"
    ADD CONSTRAINT "DischargeSheet_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: DischargeSheet DischargeSheet_plRecordId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."DischargeSheet"
    ADD CONSTRAINT "DischargeSheet_plRecordId_fkey" FOREIGN KEY ("plRecordId") REFERENCES crm_v2."PLRecord"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: DoctorAppAccount DoctorAppAccount_doctorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."DoctorAppAccount"
    ADD CONSTRAINT "DoctorAppAccount_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES crm_v2."DoctorMaster"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DoctorAppRefreshToken DoctorAppRefreshToken_accountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."DoctorAppRefreshToken"
    ADD CONSTRAINT "DoctorAppRefreshToken_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES crm_v2."DoctorAppAccount"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DoctorAppWhatsappOtp DoctorAppWhatsappOtp_accountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."DoctorAppWhatsappOtp"
    ADD CONSTRAINT "DoctorAppWhatsappOtp_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES crm_v2."DoctorAppAccount"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DoctorCabRequest DoctorCabRequest_assignedVendorById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."DoctorCabRequest"
    ADD CONSTRAINT "DoctorCabRequest_assignedVendorById_fkey" FOREIGN KEY ("assignedVendorById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: DoctorCabRequest DoctorCabRequest_doctorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."DoctorCabRequest"
    ADD CONSTRAINT "DoctorCabRequest_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES crm_v2."DoctorMaster"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DoctorCabRequest DoctorCabRequest_reviewedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."DoctorCabRequest"
    ADD CONSTRAINT "DoctorCabRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: DoctorLeaveRequest DoctorLeaveRequest_doctorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."DoctorLeaveRequest"
    ADD CONSTRAINT "DoctorLeaveRequest_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES crm_v2."DoctorMaster"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DoctorLeaveRequest DoctorLeaveRequest_reviewedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."DoctorLeaveRequest"
    ADD CONSTRAINT "DoctorLeaveRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: DoctorPayoffRequestActivity DoctorPayoffRequestActivity_actorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."DoctorPayoffRequestActivity"
    ADD CONSTRAINT "DoctorPayoffRequestActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DoctorPayoffRequestActivity DoctorPayoffRequestActivity_requestId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."DoctorPayoffRequestActivity"
    ADD CONSTRAINT "DoctorPayoffRequestActivity_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES crm_v2."DoctorPayoffRequest"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DoctorPayoffRequest DoctorPayoffRequest_leadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."DoctorPayoffRequest"
    ADD CONSTRAINT "DoctorPayoffRequest_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES crm_v2."Lead"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: DoctorPayoffRequest DoctorPayoffRequest_requestedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."DoctorPayoffRequest"
    ADD CONSTRAINT "DoctorPayoffRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DoctorPayoffRequest DoctorPayoffRequest_reviewedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."DoctorPayoffRequest"
    ADD CONSTRAINT "DoctorPayoffRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: EmployeeDocument EmployeeDocument_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."EmployeeDocument"
    ADD CONSTRAINT "EmployeeDocument_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES crm_v2."Employee"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: EmployeeMasterSeatingCost EmployeeMasterSeatingCost_createdByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."EmployeeMasterSeatingCost"
    ADD CONSTRAINT "EmployeeMasterSeatingCost_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: EmployeeMasterSeatingCost EmployeeMasterSeatingCost_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."EmployeeMasterSeatingCost"
    ADD CONSTRAINT "EmployeeMasterSeatingCost_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES crm_v2."Employee"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: EmployeeMasterSeatingCost EmployeeMasterSeatingCost_updatedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."EmployeeMasterSeatingCost"
    ADD CONSTRAINT "EmployeeMasterSeatingCost_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: EmployeeMonthlyIncentive EmployeeMonthlyIncentive_createdByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."EmployeeMonthlyIncentive"
    ADD CONSTRAINT "EmployeeMonthlyIncentive_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: EmployeeMonthlyIncentive EmployeeMonthlyIncentive_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."EmployeeMonthlyIncentive"
    ADD CONSTRAINT "EmployeeMonthlyIncentive_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES crm_v2."Employee"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: EmployeeMonthlyIncentive EmployeeMonthlyIncentive_updatedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."EmployeeMonthlyIncentive"
    ADD CONSTRAINT "EmployeeMonthlyIncentive_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: EmployeeMonthlySeatingMiscCostHistory EmployeeMonthlySeatingMiscCostHistory_changedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."EmployeeMonthlySeatingMiscCostHistory"
    ADD CONSTRAINT "EmployeeMonthlySeatingMiscCostHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: EmployeeMonthlySeatingMiscCostHistory EmployeeMonthlySeatingMiscCostHistory_recordId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."EmployeeMonthlySeatingMiscCostHistory"
    ADD CONSTRAINT "EmployeeMonthlySeatingMiscCostHistory_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES crm_v2."EmployeeMonthlySeatingMiscCost"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: EmployeeMonthlySeatingMiscCost EmployeeMonthlySeatingMiscCost_createdByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."EmployeeMonthlySeatingMiscCost"
    ADD CONSTRAINT "EmployeeMonthlySeatingMiscCost_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: EmployeeMonthlySeatingMiscCost EmployeeMonthlySeatingMiscCost_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."EmployeeMonthlySeatingMiscCost"
    ADD CONSTRAINT "EmployeeMonthlySeatingMiscCost_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES crm_v2."Employee"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: EmployeeMonthlySeatingMiscCost EmployeeMonthlySeatingMiscCost_masterSeatingCostId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."EmployeeMonthlySeatingMiscCost"
    ADD CONSTRAINT "EmployeeMonthlySeatingMiscCost_masterSeatingCostId_fkey" FOREIGN KEY ("masterSeatingCostId") REFERENCES crm_v2."EmployeeMasterSeatingCost"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: EmployeeMonthlySeatingMiscCost EmployeeMonthlySeatingMiscCost_updatedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."EmployeeMonthlySeatingMiscCost"
    ADD CONSTRAINT "EmployeeMonthlySeatingMiscCost_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: EmployeeProfileActivityLog EmployeeProfileActivityLog_actorUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."EmployeeProfileActivityLog"
    ADD CONSTRAINT "EmployeeProfileActivityLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: EmployeeProfileActivityLog EmployeeProfileActivityLog_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."EmployeeProfileActivityLog"
    ADD CONSTRAINT "EmployeeProfileActivityLog_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES crm_v2."Employee"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: EmployeeSalesTeamSalaryOverrideHistory EmployeeSalesTeamSalaryOverrideHistory_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."EmployeeSalesTeamSalaryOverrideHistory"
    ADD CONSTRAINT "EmployeeSalesTeamSalaryOverrideHistory_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES crm_v2."Employee"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: EmployeeSalesTeamSalaryOverrideHistory EmployeeSalesTeamSalaryOverrideHistory_updatedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."EmployeeSalesTeamSalaryOverrideHistory"
    ADD CONSTRAINT "EmployeeSalesTeamSalaryOverrideHistory_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: EmployeeSalesTeamSalaryOverride EmployeeSalesTeamSalaryOverride_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."EmployeeSalesTeamSalaryOverride"
    ADD CONSTRAINT "EmployeeSalesTeamSalaryOverride_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES crm_v2."Employee"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: EmployeeSalesTeamSalaryOverride EmployeeSalesTeamSalaryOverride_updatedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."EmployeeSalesTeamSalaryOverride"
    ADD CONSTRAINT "EmployeeSalesTeamSalaryOverride_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Employee Employee_departmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."Employee"
    ADD CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES crm_v2."Department"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Employee Employee_fnfCompletedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."Employee"
    ADD CONSTRAINT "Employee_fnfCompletedById_fkey" FOREIGN KEY ("fnfCompletedById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Employee Employee_managerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."Employee"
    ADD CONSTRAINT "Employee_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES crm_v2."Employee"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Employee Employee_onboardingApprovedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."Employee"
    ADD CONSTRAINT "Employee_onboardingApprovedById_fkey" FOREIGN KEY ("onboardingApprovedById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Employee Employee_teamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."Employee"
    ADD CONSTRAINT "Employee_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES crm_v2."DepartmentTeam"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Employee Employee_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."Employee"
    ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Feedback Feedback_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."Feedback"
    ADD CONSTRAINT "Feedback_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES crm_v2."Employee"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: HospitalMasterInsurance HospitalMasterInsurance_hospitalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."HospitalMasterInsurance"
    ADD CONSTRAINT "HospitalMasterInsurance_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES crm_v2."HospitalMaster"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: HospitalMasterInsurance HospitalMasterInsurance_insuranceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."HospitalMasterInsurance"
    ADD CONSTRAINT "HospitalMasterInsurance_insuranceId_fkey" FOREIGN KEY ("insuranceId") REFERENCES crm_v2."InsuranceMaster"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: HospitalSuggestion HospitalSuggestion_preAuthId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."HospitalSuggestion"
    ADD CONSTRAINT "HospitalSuggestion_preAuthId_fkey" FOREIGN KEY ("preAuthId") REFERENCES crm_v2."PreAuthorization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: IJPApplication IJPApplication_postingId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."IJPApplication"
    ADD CONSTRAINT "IJPApplication_postingId_fkey" FOREIGN KEY ("postingId") REFERENCES crm_v2."InternalJobPosting"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: IJPApplication IJPApplication_referredById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."IJPApplication"
    ADD CONSTRAINT "IJPApplication_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES crm_v2."Employee"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ITFreelancer ITFreelancer_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."ITFreelancer"
    ADD CONSTRAINT "ITFreelancer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ITProjectBooking ITProjectBooking_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."ITProjectBooking"
    ADD CONSTRAINT "ITProjectBooking_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ITProjectBooking ITProjectBooking_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."ITProjectBooking"
    ADD CONSTRAINT "ITProjectBooking_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES crm_v2."ITProject"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ITProjectResource ITProjectResource_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."ITProjectResource"
    ADD CONSTRAINT "ITProjectResource_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES crm_v2."Employee"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ITProjectResource ITProjectResource_freelancerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."ITProjectResource"
    ADD CONSTRAINT "ITProjectResource_freelancerId_fkey" FOREIGN KEY ("freelancerId") REFERENCES crm_v2."ITFreelancer"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ITProjectResource ITProjectResource_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."ITProjectResource"
    ADD CONSTRAINT "ITProjectResource_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES crm_v2."ITProject"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ITProject ITProject_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."ITProject"
    ADD CONSTRAINT "ITProject_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: IncrementRequest IncrementRequest_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."IncrementRequest"
    ADD CONSTRAINT "IncrementRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES crm_v2."Employee"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: InsuranceCase InsuranceCase_handledById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."InsuranceCase"
    ADD CONSTRAINT "InsuranceCase_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: InsuranceCase InsuranceCase_leadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."InsuranceCase"
    ADD CONSTRAINT "InsuranceCase_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES crm_v2."Lead"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: InsuranceInitiateForm InsuranceInitiateForm_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."InsuranceInitiateForm"
    ADD CONSTRAINT "InsuranceInitiateForm_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: InsuranceInitiateForm InsuranceInitiateForm_leadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."InsuranceInitiateForm"
    ADD CONSTRAINT "InsuranceInitiateForm_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES crm_v2."Lead"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: InsuranceQuery InsuranceQuery_answeredById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."InsuranceQuery"
    ADD CONSTRAINT "InsuranceQuery_answeredById_fkey" FOREIGN KEY ("answeredById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: InsuranceQuery InsuranceQuery_preAuthorizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."InsuranceQuery"
    ADD CONSTRAINT "InsuranceQuery_preAuthorizationId_fkey" FOREIGN KEY ("preAuthorizationId") REFERENCES crm_v2."PreAuthorization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: InsuranceQuery InsuranceQuery_raisedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."InsuranceQuery"
    ADD CONSTRAINT "InsuranceQuery_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: InvoiceRequestActivity InvoiceRequestActivity_actorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."InvoiceRequestActivity"
    ADD CONSTRAINT "InvoiceRequestActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: InvoiceRequestActivity InvoiceRequestActivity_requestId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."InvoiceRequestActivity"
    ADD CONSTRAINT "InvoiceRequestActivity_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES crm_v2."InvoiceRequest"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: InvoiceRequest InvoiceRequest_leadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."InvoiceRequest"
    ADD CONSTRAINT "InvoiceRequest_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES crm_v2."Lead"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: InvoiceRequest InvoiceRequest_requestedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."InvoiceRequest"
    ADD CONSTRAINT "InvoiceRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: InvoiceRequest InvoiceRequest_reviewedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."InvoiceRequest"
    ADD CONSTRAINT "InvoiceRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: IssueTransaction IssueTransaction_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."IssueTransaction"
    ADD CONSTRAINT "IssueTransaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: IssueTransaction IssueTransaction_issuedToId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."IssueTransaction"
    ADD CONSTRAINT "IssueTransaction_issuedToId_fkey" FOREIGN KEY ("issuedToId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: IssueTransaction IssueTransaction_itemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."IssueTransaction"
    ADD CONSTRAINT "IssueTransaction_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES crm_v2."ItemMaster"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: IssueTransaction IssueTransaction_locationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."IssueTransaction"
    ADD CONSTRAINT "IssueTransaction_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES crm_v2."LocationMaster"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ItemMaster ItemMaster_locationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."ItemMaster"
    ADD CONSTRAINT "ItemMaster_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES crm_v2."LocationMaster"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ItemMaster ItemMaster_supplierId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."ItemMaster"
    ADD CONSTRAINT "ItemMaster_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES crm_v2."PartyMaster"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: KYPSubmission KYPSubmission_leadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."KYPSubmission"
    ADD CONSTRAINT "KYPSubmission_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES crm_v2."Lead"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: KYPSubmission KYPSubmission_submittedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."KYPSubmission"
    ADD CONSTRAINT "KYPSubmission_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: KnowledgeChunk KnowledgeChunk_documentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."KnowledgeChunk"
    ADD CONSTRAINT "KnowledgeChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES crm_v2."KnowledgeDocument"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: KnowledgeDocumentDepartment KnowledgeDocumentDepartment_departmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."KnowledgeDocumentDepartment"
    ADD CONSTRAINT "KnowledgeDocumentDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES crm_v2."Department"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: KnowledgeDocumentDepartment KnowledgeDocumentDepartment_documentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."KnowledgeDocumentDepartment"
    ADD CONSTRAINT "KnowledgeDocumentDepartment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES crm_v2."KnowledgeDocument"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: KnowledgeDocumentRole KnowledgeDocumentRole_documentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."KnowledgeDocumentRole"
    ADD CONSTRAINT "KnowledgeDocumentRole_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES crm_v2."KnowledgeDocument"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: KnowledgeDocumentUser KnowledgeDocumentUser_documentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."KnowledgeDocumentUser"
    ADD CONSTRAINT "KnowledgeDocumentUser_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES crm_v2."KnowledgeDocument"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: KnowledgeDocumentUser KnowledgeDocumentUser_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."KnowledgeDocumentUser"
    ADD CONSTRAINT "KnowledgeDocumentUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: KnowledgeDocument KnowledgeDocument_uploadedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."KnowledgeDocument"
    ADD CONSTRAINT "KnowledgeDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LeadOpdAppointmentPrescriptionImage LeadOpdAppointmentPrescriptionImage_opdAppointmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LeadOpdAppointmentPrescriptionImage"
    ADD CONSTRAINT "LeadOpdAppointmentPrescriptionImage_opdAppointmentId_fkey" FOREIGN KEY ("opdAppointmentId") REFERENCES crm_v2."LeadOpdAppointment"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LeadOpdAppointment LeadOpdAppointment_followUpReasonCode_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LeadOpdAppointment"
    ADD CONSTRAINT "LeadOpdAppointment_followUpReasonCode_fkey" FOREIGN KEY ("followUpReasonCode") REFERENCES crm_v2."FollowUpReasonMaster"(code) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: LeadOpdAppointment LeadOpdAppointment_leadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LeadOpdAppointment"
    ADD CONSTRAINT "LeadOpdAppointment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES crm_v2."Lead"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LeadOpdAppointment LeadOpdAppointment_reasonNoSurgeryCode_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LeadOpdAppointment"
    ADD CONSTRAINT "LeadOpdAppointment_reasonNoSurgeryCode_fkey" FOREIGN KEY ("reasonNoSurgeryCode") REFERENCES crm_v2."ReasonNoSurgeryMaster"(code) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: LeadOpdAppointment LeadOpdAppointment_surgeryRemarkCode_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LeadOpdAppointment"
    ADD CONSTRAINT "LeadOpdAppointment_surgeryRemarkCode_fkey" FOREIGN KEY ("surgeryRemarkCode") REFERENCES crm_v2."SurgeryRemarkMaster"(code) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: LeadOpdPrescriptionImage LeadOpdPrescriptionImage_leadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LeadOpdPrescriptionImage"
    ADD CONSTRAINT "LeadOpdPrescriptionImage_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES crm_v2."Lead"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LeadQrCallAuditLog LeadQrCallAuditLog_leadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LeadQrCallAuditLog"
    ADD CONSTRAINT "LeadQrCallAuditLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES crm_v2."Lead"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LeadQrCallAuditLog LeadQrCallAuditLog_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LeadQrCallAuditLog"
    ADD CONSTRAINT "LeadQrCallAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LeadQrPublicLink LeadQrPublicLink_actorUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LeadQrPublicLink"
    ADD CONSTRAINT "LeadQrPublicLink_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LeadQrPublicLink LeadQrPublicLink_leadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LeadQrPublicLink"
    ADD CONSTRAINT "LeadQrPublicLink_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES crm_v2."Lead"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LeadQrScanLink LeadQrScanLink_actorUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LeadQrScanLink"
    ADD CONSTRAINT "LeadQrScanLink_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LeadQrScanLink LeadQrScanLink_leadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LeadQrScanLink"
    ADD CONSTRAINT "LeadQrScanLink_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES crm_v2."Lead"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LeadRemarkEntry LeadRemarkEntry_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LeadRemarkEntry"
    ADD CONSTRAINT "LeadRemarkEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LeadRemarkEntry LeadRemarkEntry_leadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LeadRemarkEntry"
    ADD CONSTRAINT "LeadRemarkEntry_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES crm_v2."Lead"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LeadStageEvent LeadStageEvent_changedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LeadStageEvent"
    ADD CONSTRAINT "LeadStageEvent_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LeadStageEvent LeadStageEvent_leadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LeadStageEvent"
    ADD CONSTRAINT "LeadStageEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES crm_v2."Lead"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Lead Lead_bdId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."Lead"
    ADD CONSTRAINT "Lead_bdId_fkey" FOREIGN KEY ("bdId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Lead Lead_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."Lead"
    ADD CONSTRAINT "Lead_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Lead Lead_opdFollowUpReasonCode_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."Lead"
    ADD CONSTRAINT "Lead_opdFollowUpReasonCode_fkey" FOREIGN KEY ("opdFollowUpReasonCode") REFERENCES crm_v2."FollowUpReasonMaster"(code) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Lead Lead_opdReasonNoSurgeryCode_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."Lead"
    ADD CONSTRAINT "Lead_opdReasonNoSurgeryCode_fkey" FOREIGN KEY ("opdReasonNoSurgeryCode") REFERENCES crm_v2."ReasonNoSurgeryMaster"(code) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Lead Lead_opdSurgeryRemarkCode_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."Lead"
    ADD CONSTRAINT "Lead_opdSurgeryRemarkCode_fkey" FOREIGN KEY ("opdSurgeryRemarkCode") REFERENCES crm_v2."SurgeryRemarkMaster"(code) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Lead Lead_statusId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."Lead"
    ADD CONSTRAINT "Lead_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES crm_v2.status(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Lead Lead_treatmentMasterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."Lead"
    ADD CONSTRAINT "Lead_treatmentMasterId_fkey" FOREIGN KEY ("treatmentMasterId") REFERENCES crm_v2."TreatmentMaster"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Lead Lead_updatedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."Lead"
    ADD CONSTRAINT "Lead_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LeaveBalanceEditRequest LeaveBalanceEditRequest_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LeaveBalanceEditRequest"
    ADD CONSTRAINT "LeaveBalanceEditRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES crm_v2."Employee"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LeaveBalanceEditRequest LeaveBalanceEditRequest_requestedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LeaveBalanceEditRequest"
    ADD CONSTRAINT "LeaveBalanceEditRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LeaveBalanceEditRequest LeaveBalanceEditRequest_reviewedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LeaveBalanceEditRequest"
    ADD CONSTRAINT "LeaveBalanceEditRequest_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: LeaveBalance LeaveBalance_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LeaveBalance"
    ADD CONSTRAINT "LeaveBalance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES crm_v2."Employee"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LeaveBalance LeaveBalance_leaveTypeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LeaveBalance"
    ADD CONSTRAINT "LeaveBalance_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES crm_v2."LeaveTypeMaster"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LeaveRequest LeaveRequest_approvedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LeaveRequest"
    ADD CONSTRAINT "LeaveRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: LeaveRequest LeaveRequest_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LeaveRequest"
    ADD CONSTRAINT "LeaveRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES crm_v2."Employee"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LeaveRequest LeaveRequest_leaveTypeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LeaveRequest"
    ADD CONSTRAINT "LeaveRequest_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES crm_v2."LeaveTypeMaster"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LeaveRequest LeaveRequest_targetApproverId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LeaveRequest"
    ADD CONSTRAINT "LeaveRequest_targetApproverId_fkey" FOREIGN KEY ("targetApproverId") REFERENCES crm_v2."Employee"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: LedgerAuditLog LedgerAuditLog_ledgerEntryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LedgerAuditLog"
    ADD CONSTRAINT "LedgerAuditLog_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES crm_v2."LedgerEntry"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LedgerAuditLog LedgerAuditLog_performedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LedgerAuditLog"
    ADD CONSTRAINT "LedgerAuditLog_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LedgerEntry LedgerEntry_approvedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LedgerEntry"
    ADD CONSTRAINT "LedgerEntry_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: LedgerEntry LedgerEntry_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LedgerEntry"
    ADD CONSTRAINT "LedgerEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LedgerEntry LedgerEntry_deleteApprovedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LedgerEntry"
    ADD CONSTRAINT "LedgerEntry_deleteApprovedById_fkey" FOREIGN KEY ("deleteApprovedById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: LedgerEntry LedgerEntry_deleteRequestedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LedgerEntry"
    ADD CONSTRAINT "LedgerEntry_deleteRequestedById_fkey" FOREIGN KEY ("deleteRequestedById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: LedgerEntry LedgerEntry_deletedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LedgerEntry"
    ADD CONSTRAINT "LedgerEntry_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: LedgerEntry LedgerEntry_editApprovedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LedgerEntry"
    ADD CONSTRAINT "LedgerEntry_editApprovedById_fkey" FOREIGN KEY ("editApprovedById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: LedgerEntry LedgerEntry_editRequestedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LedgerEntry"
    ADD CONSTRAINT "LedgerEntry_editRequestedById_fkey" FOREIGN KEY ("editRequestedById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: LedgerEntry LedgerEntry_fromPaymentModeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LedgerEntry"
    ADD CONSTRAINT "LedgerEntry_fromPaymentModeId_fkey" FOREIGN KEY ("fromPaymentModeId") REFERENCES crm_v2."PaymentModeMaster"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: LedgerEntry LedgerEntry_headId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LedgerEntry"
    ADD CONSTRAINT "LedgerEntry_headId_fkey" FOREIGN KEY ("headId") REFERENCES crm_v2."HeadMaster"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: LedgerEntry LedgerEntry_partyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LedgerEntry"
    ADD CONSTRAINT "LedgerEntry_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES crm_v2."PartyMaster"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: LedgerEntry LedgerEntry_paymentModeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LedgerEntry"
    ADD CONSTRAINT "LedgerEntry_paymentModeId_fkey" FOREIGN KEY ("paymentModeId") REFERENCES crm_v2."PaymentModeMaster"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: LedgerEntry LedgerEntry_paymentTypeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LedgerEntry"
    ADD CONSTRAINT "LedgerEntry_paymentTypeId_fkey" FOREIGN KEY ("paymentTypeId") REFERENCES crm_v2."PaymentTypeMaster"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: LedgerEntry LedgerEntry_toPaymentModeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LedgerEntry"
    ADD CONSTRAINT "LedgerEntry_toPaymentModeId_fkey" FOREIGN KEY ("toPaymentModeId") REFERENCES crm_v2."PaymentModeMaster"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: LocationMaster LocationMaster_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."LocationMaster"
    ADD CONSTRAINT "LocationMaster_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES crm_v2."LocationMaster"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MDAppointment MDAppointment_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."MDAppointment"
    ADD CONSTRAINT "MDAppointment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES crm_v2."Employee"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MDApprovalRequest MDApprovalRequest_financeAcknowledgedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."MDApprovalRequest"
    ADD CONSTRAINT "MDApprovalRequest_financeAcknowledgedById_fkey" FOREIGN KEY ("financeAcknowledgedById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MDApprovalRequest MDApprovalRequest_requestedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."MDApprovalRequest"
    ADD CONSTRAINT "MDApprovalRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MDApprovalRequest MDApprovalRequest_respondedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."MDApprovalRequest"
    ADD CONSTRAINT "MDApprovalRequest_respondedById_fkey" FOREIGN KEY ("respondedById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MDTaskTeamMember MDTaskTeamMember_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."MDTaskTeamMember"
    ADD CONSTRAINT "MDTaskTeamMember_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES crm_v2."Employee"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MDTaskTeamMember MDTaskTeamMember_teamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."MDTaskTeamMember"
    ADD CONSTRAINT "MDTaskTeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES crm_v2."MDTaskTeam"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MDTaskTeam MDTaskTeam_ownerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."MDTaskTeam"
    ADD CONSTRAINT "MDTaskTeam_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MDWatchlistEmployee MDWatchlistEmployee_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."MDWatchlistEmployee"
    ADD CONSTRAINT "MDWatchlistEmployee_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES crm_v2."Employee"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MDWatchlistEmployee MDWatchlistEmployee_ownerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."MDWatchlistEmployee"
    ADD CONSTRAINT "MDWatchlistEmployee_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MeetParticipant MeetParticipant_meetId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."MeetParticipant"
    ADD CONSTRAINT "MeetParticipant_meetId_fkey" FOREIGN KEY ("meetId") REFERENCES crm_v2."Meet"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MeetParticipant MeetParticipant_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."MeetParticipant"
    ADD CONSTRAINT "MeetParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Meet Meet_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."Meet"
    ADD CONSTRAINT "Meet_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Meet Meet_departmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."Meet"
    ADD CONSTRAINT "Meet_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES crm_v2."Department"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Meet Meet_mdAppointmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."Meet"
    ADD CONSTRAINT "Meet_mdAppointmentId_fkey" FOREIGN KEY ("mdAppointmentId") REFERENCES crm_v2."MDAppointment"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MentalHealthRequest MentalHealthRequest_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."MentalHealthRequest"
    ADD CONSTRAINT "MentalHealthRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES crm_v2."Employee"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MonthlyPayroll MonthlyPayroll_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."MonthlyPayroll"
    ADD CONSTRAINT "MonthlyPayroll_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES crm_v2."Employee"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: NoticeRecipient NoticeRecipient_noticeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."NoticeRecipient"
    ADD CONSTRAINT "NoticeRecipient_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES crm_v2."Notice"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: NoticeRecipient NoticeRecipient_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."NoticeRecipient"
    ADD CONSTRAINT "NoticeRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Notice Notice_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."Notice"
    ADD CONSTRAINT "Notice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Notice Notice_targetDepartmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."Notice"
    ADD CONSTRAINT "Notice_targetDepartmentId_fkey" FOREIGN KEY ("targetDepartmentId") REFERENCES crm_v2."Department"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Notification Notification_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."Notification"
    ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OutstandingCase OutstandingCase_handledById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."OutstandingCase"
    ADD CONSTRAINT "OutstandingCase_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: OutstandingCase OutstandingCase_leadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."OutstandingCase"
    ADD CONSTRAINT "OutstandingCase_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES crm_v2."Lead"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PLLedgerEntry PLLedgerEntry_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."PLLedgerEntry"
    ADD CONSTRAINT "PLLedgerEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PLLedgerEntry PLLedgerEntry_importId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."PLLedgerEntry"
    ADD CONSTRAINT "PLLedgerEntry_importId_fkey" FOREIGN KEY ("importId") REFERENCES crm_v2."PLLedgerImport"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PLLedgerEntry PLLedgerEntry_updatedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."PLLedgerEntry"
    ADD CONSTRAINT "PLLedgerEntry_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PLLedgerImport PLLedgerImport_uploadedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."PLLedgerImport"
    ADD CONSTRAINT "PLLedgerImport_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PLRecord PLRecord_handledById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."PLRecord"
    ADD CONSTRAINT "PLRecord_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PLRecord PLRecord_leadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."PLRecord"
    ADD CONSTRAINT "PLRecord_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES crm_v2."Lead"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PaymentInstallment PaymentInstallment_leadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."PaymentInstallment"
    ADD CONSTRAINT "PaymentInstallment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES crm_v2."Lead"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PaymentInstallment PaymentInstallment_recordedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."PaymentInstallment"
    ADD CONSTRAINT "PaymentInstallment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PaymentInstallment PaymentInstallment_verifiedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."PaymentInstallment"
    ADD CONSTRAINT "PaymentInstallment_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PayrollComponent PayrollComponent_payrollRecordId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."PayrollComponent"
    ADD CONSTRAINT "PayrollComponent_payrollRecordId_fkey" FOREIGN KEY ("payrollRecordId") REFERENCES crm_v2."PayrollRecord"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PayrollRecord PayrollRecord_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."PayrollRecord"
    ADD CONSTRAINT "PayrollRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES crm_v2."Employee"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PermissionAssignment PermissionAssignment_grantedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."PermissionAssignment"
    ADD CONSTRAINT "PermissionAssignment_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PermissionAssignment PermissionAssignment_resourceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."PermissionAssignment"
    ADD CONSTRAINT "PermissionAssignment_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES crm_v2."Resource"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PermissionAssignment PermissionAssignment_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."PermissionAssignment"
    ADD CONSTRAINT "PermissionAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PnLCategory PnLCategory_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."PnLCategory"
    ADD CONSTRAINT "PnLCategory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PnLEntry PnLEntry_categoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."PnLEntry"
    ADD CONSTRAINT "PnLEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES crm_v2."PnLCategory"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PnLEntry PnLEntry_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."PnLEntry"
    ADD CONSTRAINT "PnLEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PreAuthPDF PreAuthPDF_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."PreAuthPDF"
    ADD CONSTRAINT "PreAuthPDF_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PreAuthPDF PreAuthPDF_preAuthorizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."PreAuthPDF"
    ADD CONSTRAINT "PreAuthPDF_preAuthorizationId_fkey" FOREIGN KEY ("preAuthorizationId") REFERENCES crm_v2."PreAuthorization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PreAuthorization PreAuthorization_handledById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."PreAuthorization"
    ADD CONSTRAINT "PreAuthorization_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PreAuthorization PreAuthorization_heldById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."PreAuthorization"
    ADD CONSTRAINT "PreAuthorization_heldById_fkey" FOREIGN KEY ("heldById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PreAuthorization PreAuthorization_kypSubmissionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."PreAuthorization"
    ADD CONSTRAINT "PreAuthorization_kypSubmissionId_fkey" FOREIGN KEY ("kypSubmissionId") REFERENCES crm_v2."KYPSubmission"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PreAuthorization PreAuthorization_preAuthRaisedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."PreAuthorization"
    ADD CONSTRAINT "PreAuthorization_preAuthRaisedById_fkey" FOREIGN KEY ("preAuthRaisedById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PurchaseTransaction PurchaseTransaction_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."PurchaseTransaction"
    ADD CONSTRAINT "PurchaseTransaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PurchaseTransaction PurchaseTransaction_itemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."PurchaseTransaction"
    ADD CONSTRAINT "PurchaseTransaction_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES crm_v2."ItemMaster"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PurchaseTransaction PurchaseTransaction_locationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."PurchaseTransaction"
    ADD CONSTRAINT "PurchaseTransaction_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES crm_v2."LocationMaster"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PurchaseTransaction PurchaseTransaction_supplierId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."PurchaseTransaction"
    ADD CONSTRAINT "PurchaseTransaction_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES crm_v2."PartyMaster"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PushSubscription PushSubscription_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."PushSubscription"
    ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Resource Resource_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."Resource"
    ADD CONSTRAINT "Resource_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES crm_v2."Resource"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SalaryStructure SalaryStructure_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."SalaryStructure"
    ADD CONSTRAINT "SalaryStructure_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES crm_v2."Employee"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SalesEntry SalesEntry_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."SalesEntry"
    ADD CONSTRAINT "SalesEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SalesEntry SalesEntry_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."SalesEntry"
    ADD CONSTRAINT "SalesEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES crm_v2."ProjectMaster"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SalesTeamBulkCostEntryHistory SalesTeamBulkCostEntryHistory_changedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."SalesTeamBulkCostEntryHistory"
    ADD CONSTRAINT "SalesTeamBulkCostEntryHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SalesTeamBulkCostEntryHistory SalesTeamBulkCostEntryHistory_entryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."SalesTeamBulkCostEntryHistory"
    ADD CONSTRAINT "SalesTeamBulkCostEntryHistory_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES crm_v2."SalesTeamBulkCostEntry"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SalesTeamBulkCostEntry SalesTeamBulkCostEntry_createdByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."SalesTeamBulkCostEntry"
    ADD CONSTRAINT "SalesTeamBulkCostEntry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SalesTeamBulkCostEntry SalesTeamBulkCostEntry_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."SalesTeamBulkCostEntry"
    ADD CONSTRAINT "SalesTeamBulkCostEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES crm_v2."Employee"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SalesTeamBulkCostEntry SalesTeamBulkCostEntry_updatedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."SalesTeamBulkCostEntry"
    ADD CONSTRAINT "SalesTeamBulkCostEntry_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SalesTeamCostEntry SalesTeamCostEntry_addedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."SalesTeamCostEntry"
    ADD CONSTRAINT "SalesTeamCostEntry_addedByUserId_fkey" FOREIGN KEY ("addedByUserId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SalesTeamCostEntry SalesTeamCostEntry_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."SalesTeamCostEntry"
    ADD CONSTRAINT "SalesTeamCostEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES crm_v2."Employee"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: StockMovement StockMovement_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."StockMovement"
    ADD CONSTRAINT "StockMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: StockMovement StockMovement_itemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."StockMovement"
    ADD CONSTRAINT "StockMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES crm_v2."ItemMaster"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: StockMovement StockMovement_locationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."StockMovement"
    ADD CONSTRAINT "StockMovement_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES crm_v2."LocationMaster"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SupportTicket SupportTicket_departmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."SupportTicket"
    ADD CONSTRAINT "SupportTicket_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES crm_v2."Department"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SupportTicket SupportTicket_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."SupportTicket"
    ADD CONSTRAINT "SupportTicket_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES crm_v2."Employee"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SurgeryLedgerEntry SurgeryLedgerEntry_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."SurgeryLedgerEntry"
    ADD CONSTRAINT "SurgeryLedgerEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SurgeryLedgerEntry SurgeryLedgerEntry_updatedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."SurgeryLedgerEntry"
    ADD CONSTRAINT "SurgeryLedgerEntry_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SurgeryLedgerEntry SurgeryLedgerEntry_uploadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."SurgeryLedgerEntry"
    ADD CONSTRAINT "SurgeryLedgerEntry_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES crm_v2."SurgeryLedgerUpload"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SurgeryLedgerUpload SurgeryLedgerUpload_uploadedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."SurgeryLedgerUpload"
    ADD CONSTRAINT "SurgeryLedgerUpload_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TargetPnLEntry TargetPnLEntry_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."TargetPnLEntry"
    ADD CONSTRAINT "TargetPnLEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Target Target_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."Target"
    ADD CONSTRAINT "Target_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TaskActivityLog TaskActivityLog_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."TaskActivityLog"
    ADD CONSTRAINT "TaskActivityLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES crm_v2."Task"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TaskActivityLog TaskActivityLog_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."TaskActivityLog"
    ADD CONSTRAINT "TaskActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TaskComment TaskComment_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."TaskComment"
    ADD CONSTRAINT "TaskComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES crm_v2."TaskComment"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TaskComment TaskComment_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."TaskComment"
    ADD CONSTRAINT "TaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES crm_v2."Task"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TaskComment TaskComment_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."TaskComment"
    ADD CONSTRAINT "TaskComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TaskDueDateApproval TaskDueDateApproval_requestedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."TaskDueDateApproval"
    ADD CONSTRAINT "TaskDueDateApproval_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TaskDueDateApproval TaskDueDateApproval_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."TaskDueDateApproval"
    ADD CONSTRAINT "TaskDueDateApproval_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES crm_v2."Task"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TaskProject TaskProject_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."TaskProject"
    ADD CONSTRAINT "TaskProject_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TaskRating TaskRating_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."TaskRating"
    ADD CONSTRAINT "TaskRating_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TaskRating TaskRating_ratedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."TaskRating"
    ADD CONSTRAINT "TaskRating_ratedById_fkey" FOREIGN KEY ("ratedById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TaskRating TaskRating_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."TaskRating"
    ADD CONSTRAINT "TaskRating_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES crm_v2."Task"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Task Task_assigneeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."Task"
    ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Task Task_completedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."Task"
    ADD CONSTRAINT "Task_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Task Task_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."Task"
    ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Task Task_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."Task"
    ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES crm_v2."TaskProject"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TierDefinition TierDefinition_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."TierDefinition"
    ADD CONSTRAINT "TierDefinition_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: UserCrmPermission UserCrmPermission_grantedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."UserCrmPermission"
    ADD CONSTRAINT "UserCrmPermission_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: UserCrmPermission UserCrmPermission_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."UserCrmPermission"
    ADD CONSTRAINT "UserCrmPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UserFeaturePermission UserFeaturePermission_grantedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."UserFeaturePermission"
    ADD CONSTRAINT "UserFeaturePermission_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: UserFeaturePermission UserFeaturePermission_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."UserFeaturePermission"
    ADD CONSTRAINT "UserFeaturePermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UserStatus UserStatus_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."UserStatus"
    ADD CONSTRAINT "UserStatus_userId_fkey" FOREIGN KEY ("userId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UserTaskSeen UserTaskSeen_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."UserTaskSeen"
    ADD CONSTRAINT "UserTaskSeen_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES crm_v2."Task"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UserTaskSeen UserTaskSeen_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."UserTaskSeen"
    ADD CONSTRAINT "UserTaskSeen_userId_fkey" FOREIGN KEY ("userId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Warning Warning_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."Warning"
    ADD CONSTRAINT "Warning_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Warning Warning_issuedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."Warning"
    ADD CONSTRAINT "Warning_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Warning Warning_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."Warning"
    ADD CONSTRAINT "Warning_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES crm_v2."Task"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: WorkLog WorkLog_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."WorkLog"
    ADD CONSTRAINT "WorkLog_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: WorkflowResetLog WorkflowResetLog_leadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."WorkflowResetLog"
    ADD CONSTRAINT "WorkflowResetLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES crm_v2."Lead"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: WorkflowResetLog WorkflowResetLog_resetById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2."WorkflowResetLog"
    ADD CONSTRAINT "WorkflowResetLog_resetById_fkey" FOREIGN KEY ("resetById") REFERENCES crm_v2."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: status status_categoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2.status
    ADD CONSTRAINT "status_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES crm_v2.status_category(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: status status_groupId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2.status
    ADD CONSTRAINT "status_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES crm_v2.status_group(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: status_group status_group_categoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY crm_v2.status_group
    ADD CONSTRAINT "status_group_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES crm_v2.status_category(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict g9iUXlLJLZgbWHs5pabY8S5ghk6EWSyqeyuzwFzk1W2ekiqGInknatlgHc2zyZS




