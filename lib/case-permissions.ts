import { CaseStage, UserRole, FlowType } from '@/generated/prisma/enums'
import { hasLeadOpdDone, hasLeadOpdScheduled } from '@/lib/lead-opd-workflow'
import { hasPermission } from '@/lib/rbac'
import type { SessionUser } from '@/lib/auth'
import { isSalesLeadWorkerRole } from '@/lib/sales-hierarchy-roles'

function isBdTlAcmCmOrAdmin(role: UserRole | string): boolean {
  return isSalesLeadWorkerRole(role) || role === 'ADMIN'
}

interface User {
  id: string
  name: string
  email: string
  role: UserRole
}

interface Lead {
  id: string
  caseStage: CaseStage
  pipelineStage: string
  flowType?: FlowType | null
  status?: string | null
  opdScheduleDate?: string | Date | null
  kypSubmission?: {
    id: string
    status: string
  } | null
  dischargeSheet?: {
    id: string
    isFinalized?: boolean
  } | null
  insuranceInitiateForm?: {
    id: string
  } | null
}

// BD / TL / ACM / CM can raise pre-auth when case is in HOSPITALS_SUGGESTED stage
export function canRaisePreAuth(user: User, lead: Lead): boolean {
  if (!user || !lead) return false

  const canRaiseStage = lead.caseStage === CaseStage.HOSPITALS_SUGGESTED
  return isBdTlAcmCmOrAdmin(user.role) && canRaiseStage
}

// Insurance can add KYP details when case is in basic complete stage
export function canAddKYPDetails(user: User, lead: Lead): boolean {
  if (!user || !lead) return false
  
  const isInsurance = ['INSURANCE', 'INSURANCE_HEAD', 'ADMIN', 'TESTER'].includes(user.role)
  const isKYPBasicComplete = lead.caseStage === CaseStage.KYP_BASIC_COMPLETE
  
  return isInsurance && isKYPBasicComplete
}

// Insurance can complete pre-auth when it's raised
export function canCompletePreAuth(user: User, lead: Lead): boolean {
  if (!user || !lead) return false
  
  const isInsurance = ['INSURANCE', 'INSURANCE_HEAD', 'ADMIN', 'TESTER'].includes(user.role)
  const isPreAuthRaised = lead.caseStage === CaseStage.PREAUTH_RAISED
  
  return isInsurance && isPreAuthRaised
}

// BD / TL / ACM / CM can edit KYP when it's in basic complete or hospitals suggested states
export function canEditKYP(user: User, lead: Lead): boolean {
  if (!user || !lead) return false

  const canEditStages: CaseStage[] = [
    CaseStage.KYP_BASIC_COMPLETE,
    CaseStage.HOSPITALS_SUGGESTED
  ]

  return isBdTlAcmCmOrAdmin(user.role) && canEditStages.includes(lead.caseStage)
}

// BD / TL / ACM / CM can mark admitted when pre-auth is complete
export function canInitiate(user: User, lead: Lead): boolean {
  if (!user || !lead) return false

  const isPreAuthComplete = lead.caseStage === CaseStage.PREAUTH_COMPLETE
  return isBdTlAcmCmOrAdmin(user.role) && isPreAuthComplete
}

// BD / TL / ACM / CM can edit the (insurance) IPD details after marking admitted, until
// IPD Done is marked. Manager-of-the-BD scoping is enforced server-side via
// canMutateLead; this is the client-side role + stage gate.
export function canEditIPDDetails(user: User, lead: Lead): boolean {
  if (!user || !lead) return false

  // Editable while admitted but before IPD Done is marked (INITIATED / ADMITTED).
  const editableStages: CaseStage[] = [CaseStage.INITIATED, CaseStage.ADMITTED]
  return isBdTlAcmCmOrAdmin(user.role) && editableStages.includes(lead.caseStage)
}

// BD / TL / ACM / CM / EA can mark IPD when initiated (insurance) or approved/submitted (cash).
// Also allowed while ADMITTED - Admitted/Postponed/Cancelled never lock the case;
// only Surgery Done (IPD_DONE) advances the case stage past this point.
export function canMarkIPD(user: User, lead: Lead): boolean {
  if (!user || !lead) return false

  const canMark =
    isSalesLeadWorkerRole(user.role) ||
    user.role === 'EXECUTIVE_ASSISTANT' ||
    user.role === 'ADMIN'
  const isInitiated = lead.caseStage === CaseStage.INITIATED || lead.caseStage === CaseStage.ADMITTED
  const isCashReady = lead.caseStage === CaseStage.CASH_APPROVED || lead.caseStage === CaseStage.CASH_IPD_SUBMITTED

  return canMark && (isInitiated || isCashReady)
}

// Insurance can generate/download PDF after pre-auth is raised
export function canGeneratePDF(user: User, lead: Lead): boolean {
  if (!user || !lead) return false

  const isInsurance = ['INSURANCE', 'INSURANCE_HEAD', 'ADMIN', 'TESTER'].includes(user.role)
  const afterPreAuthRaised =
    lead.caseStage === CaseStage.PREAUTH_RAISED || lead.caseStage === CaseStage.PREAUTH_COMPLETE

  return isInsurance && afterPreAuthRaised
}

// Insurance can mark patient discharged once BD has marked IPD Done and the
// initiate form is filled. Creates a minimal DischargeSheet with just the date;
// the full sheet is filled later via canEditDischargeSheet.
export function canMarkDischarged(user: User, lead: Lead): boolean {
  if (!user || !lead) return false
  const isInsurance = ['INSURANCE', 'INSURANCE_HEAD', 'ADMIN', 'TESTER'].includes(user.role)
  const isIpdDone = lead.caseStage === CaseStage.IPD_DONE
  const hasInitiateForm = !!lead.insuranceInitiateForm?.id
  const notAlreadyMarked = !lead.dischargeSheet?.id
  return isInsurance && isIpdDone && hasInitiateForm && notAlreadyMarked
}

// Insurance or PL can fill / edit the discharge sheet once the patient has
// been marked discharged (a minimal sheet exists), or for legacy IPD_DONE
// leads created before the two-step flow shipped.
export function canEditDischargeSheet(user: User, lead: Lead): boolean {
  if (!user || !lead) return false

  const isInsuranceOrPL = ['INSURANCE', 'INSURANCE_HEAD', 'EXECUTIVE_ASSISTANT', 'PL_HEAD', 'PL_ENTRY', 'ADMIN'].includes(user.role)
  const stageOk = lead.caseStage === CaseStage.DISCHARGED || lead.caseStage === CaseStage.IPD_DONE
  const hasInitiateForm = !!lead.insuranceInitiateForm?.id

  return isInsuranceOrPL && stageOk && hasInitiateForm
}

// BD / TL / EA can mark case as lost only after KYP1 and up until Mark Admitted (not before KYP1, not after admitted)
export function canMarkLost(user: User, lead: Lead): boolean {
  if (!user || !lead) return false

  const isBDOrTL = ['BD', 'TEAM_LEAD', 'EXECUTIVE_ASSISTANT', 'ADMIN'].includes(user.role)
  if (!isBDOrTL) return false

  // Not allowed: before KYP1 (basic complete) or after admission
  const beforeKYP1: CaseStage[] = [CaseStage.NEW_LEAD]
  const afterAdmission: CaseStage[] = [
    CaseStage.INITIATED,
    CaseStage.ADMITTED,
    CaseStage.DISCHARGED,
    CaseStage.IPD_DONE,
    CaseStage.PL_PENDING,
    CaseStage.OUTSTANDING,
  ]
  if (beforeKYP1.includes(lead.caseStage) || afterAdmission.includes(lead.caseStage)) {
    return false
  }

  // Allowed: after KYP1 up until (and including) pre-auth complete, before Mark Admitted
  const allowedStages: CaseStage[] = [
    CaseStage.KYP_BASIC_COMPLETE,
    CaseStage.HOSPITALS_SUGGESTED,
    CaseStage.PREAUTH_RAISED,
    CaseStage.PREAUTH_COMPLETE,
    CaseStage.KYP_PENDING,
    CaseStage.KYP_COMPLETE,
  ]
  return allowedStages.includes(lead.caseStage)
}

// Insurance can reset a patient back to HOSPITALS_SUGGESTED. Destructive: clears
// the BD-raised pre-auth fields, approval state, initiate form, admission record,
// and documents uploaded after KYP basic. Blocked once the patient is actually
// admitted (ADMITTED or beyond).
export function canResetPatient(user: User, lead: Lead): boolean {
  if (!user || !lead) return false
  if (lead.flowType === FlowType.CASH) return false

  const isInsurance = ['INSURANCE', 'INSURANCE_HEAD', 'ADMIN'].includes(user.role)
  const allowedStages: CaseStage[] = [
    CaseStage.PREAUTH_RAISED,
    CaseStage.PREAUTH_COMPLETE,
    CaseStage.INITIATED,
  ]
  return isInsurance && allowedStages.includes(lead.caseStage)
}

/** Executive Assistant only — can reset the patient workflow stepper to a prior completed step. */
export function canResetStepper(user: User): boolean {
  if (!user) return false
  return user.role === UserRole.EXECUTIVE_ASSISTANT
}

// Insurance can suggest hospitals when BD has submitted KYP Basic (KYP_BASIC_COMPLETE)
export function canSuggestHospitals(user: User, lead: Lead): boolean {
  if (!user || !lead) return false
  const isInsurance = ['INSURANCE', 'INSURANCE_HEAD', 'ADMIN', 'TESTER'].includes(user.role)
  return isInsurance && lead.caseStage === CaseStage.KYP_BASIC_COMPLETE
}

// Insurance can modify hospital suggestions after they've been suggested until pre-auth is complete
export function canModifyHospitals(user: User, lead: Lead): boolean {
  if (!user || !lead) return false
  const isInsurance = ['INSURANCE', 'INSURANCE_HEAD', 'ADMIN', 'TESTER'].includes(user.role)
  const canModifyStages: CaseStage[] = [
    CaseStage.HOSPITALS_SUGGESTED,
    CaseStage.PREAUTH_RAISED,
  ]
  return isInsurance && canModifyStages.includes(lead.caseStage)
}

// Insurance can access insurance actions (pre-auth page) after KYP basic is submitted (pending or later)
export function canShowInsuranceActions(user: User, lead: Lead): boolean {
  if (!user || !lead) return false
  const isInsurance = ['INSURANCE', 'INSURANCE_HEAD', 'ADMIN', 'TESTER'].includes(user.role)
  const canAccessStages: CaseStage[] = [
    CaseStage.KYP_BASIC_COMPLETE,
    CaseStage.HOSPITALS_SUGGESTED,
    CaseStage.PREAUTH_RAISED,
    CaseStage.PREAUTH_COMPLETE,
    CaseStage.INITIATED,
    CaseStage.ADMITTED,
    CaseStage.DISCHARGED,
    CaseStage.IPD_DONE,
    CaseStage.PL_PENDING,
    CaseStage.OUTSTANDING,
    CaseStage.KYP_PENDING,
    CaseStage.KYP_COMPLETE,
  ]
  return isInsurance && canAccessStages.includes(lead.caseStage)
}

// P/L (pl:write) can edit payout statuses and pending amounts only when discharge sheet exists
export function canEditOutstanding(user: User, lead: Lead): boolean {
  if (!user || !lead) return false
  const sessionLike = user as SessionUser
  const hasDischargeSheet = !!lead.dischargeSheet
  return hasPermission(sessionLike, 'pl:write') && hasDischargeSheet
}

// Only INSURANCE_HEAD and ADMIN can view patient phone numbers
export function canViewPhoneNumber(user: { role: string } | null | undefined): boolean {
  if (!user) return false
  return ['INSURANCE_HEAD', 'ADMIN', 'COMPLIANCE_HEAD'].includes(user.role)
}

// Compliance Head sees the patient page in a fully read-only mode —
// no action buttons, no form submissions. Every gated action should be
// additionally wrapped with `&& !isReadOnlyPatientRole(user)`.
export function isReadOnlyPatientRole(user: { role: string } | null | undefined): boolean {
  if (!user) return false
  return user.role === 'COMPLIANCE_HEAD'
}

// Insurance can fill initiate form after pre-auth is raised or complete
export function canFillInitiateForm(user: User, lead: Lead): boolean {
  if (!user || !lead) return false
  
  const isInsurance = ['INSURANCE', 'INSURANCE_HEAD', 'ADMIN', 'TESTER'].includes(user.role)
  const isValidStage: boolean = ([CaseStage.PREAUTH_RAISED, CaseStage.PREAUTH_COMPLETE, CaseStage.INITIATED, CaseStage.ADMITTED, CaseStage.DISCHARGED, CaseStage.IPD_DONE] as CaseStage[]).includes(lead.caseStage)
  
  return isInsurance && isValidStage
}

// True when discharge is blocked because the initiate form has not been filled yet
export function isDischargeBlockedByInitiateForm(user: User, lead: Lead): boolean {
  if (!user || !lead) return false
  const isInsuranceOrPL = ['INSURANCE', 'INSURANCE_HEAD', 'PL_HEAD', 'PL_ENTRY', 'ADMIN'].includes(user.role)
  const isReadyForDischarge = lead.caseStage === CaseStage.IPD_DONE || lead.caseStage === CaseStage.DISCHARGED
  return isInsuranceOrPL && isReadyForDischarge && !lead.insuranceInitiateForm?.id
}

// True when Insurance has marked the patient discharged but the full sheet
// hasn't been filled yet. UI gate for showing the fill-sheet form.
export function isDischargeSheetUnfinalized(lead: Lead): boolean {
  if (!lead?.dischargeSheet) return false
  return lead.dischargeSheet.isFinalized === false
}

// Insurance, PL, Outstanding, BD, TL/ACM/CM, Admin can view initiate form details
export function canViewInitiateForm(user: User, lead: Lead): boolean {
  if (!user || !lead) return false
  const allowedRoles = [
    'INSURANCE',
    'INSURANCE_HEAD',
    'PL_HEAD',
    'PL_ENTRY',
    'ADMIN',
    'FINANCE_HEAD',
    'BD',
    'TEAM_LEAD',
    'ASSISTANT_CATEGORY_MANAGER',
    'CATEGORY_MANAGER',
  ]
  return allowedRoles.includes(user.role)
}

// ─── Cash Flow Permissions ──────────────────────────────────────────────────

// BD / TL / ACM / CM can start cash mode if not already in cash mode and in early stages
export function canStartCashMode(user: User, lead: Lead): boolean {
  if (!user || !lead) return false

  const isNotCash = lead.flowType !== FlowType.CASH

  // Allowed stages to switch to cash:
  // NEW_LEAD, OPD_SCHEDULED, KYP_BASIC_COMPLETE, HOSPITALS_SUGGESTED, PREAUTH_RAISED, PREAUTH_COMPLETE
  // Basically before admission in insurance flow
  const allowedStages: CaseStage[] = [
    CaseStage.NEW_LEAD,
    CaseStage.OPD_SCHEDULED,
    CaseStage.OPD_DONE,
    CaseStage.KYP_BASIC_COMPLETE,
    CaseStage.HOSPITALS_SUGGESTED,
    CaseStage.PREAUTH_RAISED,
    CaseStage.PREAUTH_COMPLETE,
    CaseStage.KYP_PENDING,
    CaseStage.KYP_COMPLETE,
  ]

  return isBdTlAcmCmOrAdmin(user.role) && isNotCash && allowedStages.includes(lead.caseStage)
}

// BD / TL / ACM / CM can revert to insurance flow if they haven't submitted the IPD cash form yet
export function canRevertCashMode(user: User, lead: Lead): boolean {
  if (!user || !lead) return false

  const isCash = lead.flowType === FlowType.CASH
  const isPending =
    lead.caseStage === CaseStage.CASH_IPD_PENDING ||
    lead.caseStage === CaseStage.CASH_OPD_SCHEDULED ||
    lead.caseStage === CaseStage.CASH_OPD_DONE

  return isBdTlAcmCmOrAdmin(user.role) && isCash && isPending
}

export function canMarkOpdDone(user: User, lead: Lead): boolean {
  if (!user || !lead) return false
  if (!isBdTlAcmCmOrAdmin(user.role)) return false
  if (hasLeadOpdDone(lead)) return false

  if (lead.flowType === FlowType.CASH) {
    return (
      lead.caseStage === CaseStage.CASH_OPD_SCHEDULED ||
      (lead.caseStage === CaseStage.CASH_IPD_PENDING && hasLeadOpdScheduled(lead))
    )
  }

  return (
    lead.caseStage === CaseStage.OPD_SCHEDULED ||
    (lead.caseStage === CaseStage.NEW_LEAD && hasLeadOpdScheduled(lead))
  )
}

// BD / TL / ACM / CM can fill IPD Cash Form when pending or on hold
export function canFillIPDCashForm(user: User, lead: Lead): boolean {
  if (!user || !lead) return false

  const isCash = lead.flowType === FlowType.CASH
  // Allow first fill while pending, and edits after submission/approval until
  // the case moves into the post-IPD/discharge stages.
  const allowedStages: CaseStage[] = [
    CaseStage.CASH_IPD_PENDING,
    CaseStage.CASH_OPD_DONE,
    CaseStage.CASH_OPD_SCHEDULED,
    CaseStage.CASH_IPD_SUBMITTED,
    CaseStage.CASH_ON_HOLD,
    CaseStage.CASH_APPROVED,
  ]

  if (!isBdTlAcmCmOrAdmin(user.role) || !isCash || !allowedStages.includes(lead.caseStage)) {
    return false
  }

  if (lead.caseStage === CaseStage.CASH_IPD_PENDING) {
    return hasLeadOpdDone(lead)
  }

  return lead.caseStage !== CaseStage.CASH_OPD_SCHEDULED || hasLeadOpdDone(lead)
}

// Insurance can review cash case when submitted
export function canReviewCashCase(user: User, lead: Lead): boolean {
  if (!user || !lead) return false
  
  const isInsurance = ['INSURANCE', 'INSURANCE_HEAD', 'ADMIN', 'TESTER'].includes(user.role)
  const isCash = lead.flowType === FlowType.CASH
  // Can review if submitted or on hold (to re-review or change decision)
  const allowedStages: CaseStage[] = [CaseStage.CASH_IPD_SUBMITTED, CaseStage.CASH_ON_HOLD]
  
  return isInsurance && isCash && allowedStages.includes(lead.caseStage)
}

// Insurance can fill discharge form when approved
export function canFillCashDischarge(user: User, lead: Lead): boolean {
  if (!user || !lead) return false
  
  const isInsurance = ['INSURANCE', 'INSURANCE_HEAD', 'ADMIN', 'TESTER'].includes(user.role)
  const isCash = lead.flowType === FlowType.CASH
  const isApprovedOrDone = lead.caseStage === CaseStage.CASH_APPROVED || lead.caseStage === CaseStage.CASH_IPD_DONE

  return isInsurance && isCash && isApprovedOrDone
}
