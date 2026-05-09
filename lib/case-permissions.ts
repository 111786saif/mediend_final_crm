import { CaseStage, UserRole, FlowType } from '@/generated/prisma/enums'
import { hasPermission } from '@/lib/rbac'
import type { SessionUser } from '@/lib/auth'

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
  kypSubmission?: {
    id: string
    status: string
  } | null
  dischargeSheet?: {
    id: string
  } | null
  insuranceInitiateForm?: {
    id: string
  } | null
}

// BD (or Team Lead) can raise pre-auth when case is in HOSPITALS_SUGGESTED stage
export function canRaisePreAuth(user: User, lead: Lead): boolean {
  if (!user || !lead) return false

  const isBDOrTeamLead = user.role === 'BD' || user.role === 'TEAM_LEAD' || user.role === 'ADMIN'
  const canRaiseStage = lead.caseStage === CaseStage.HOSPITALS_SUGGESTED

  return isBDOrTeamLead && canRaiseStage
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

// BD / TL can edit KYP when it's in basic complete or hospitals suggested states
export function canEditKYP(user: User, lead: Lead): boolean {
  if (!user || !lead) return false
  
  const isBDOrTL = user.role === 'BD' || user.role === 'TEAM_LEAD' || user.role === 'ADMIN'
  const canEditStages: CaseStage[] = [
    CaseStage.KYP_BASIC_COMPLETE,
    CaseStage.HOSPITALS_SUGGESTED
  ]
  
  return isBDOrTL && canEditStages.includes(lead.caseStage)
}

// BD / TL can mark admitted when pre-auth is complete
export function canInitiate(user: User, lead: Lead): boolean {
  if (!user || !lead) return false
  
  const isBDOrTL = user.role === 'BD' || user.role === 'TEAM_LEAD' || user.role === 'ADMIN'
  const isPreAuthComplete = lead.caseStage === CaseStage.PREAUTH_COMPLETE
  
  return isBDOrTL && isPreAuthComplete
}

// BD / TL can mark IPD when initiated (insurance) or approved/submitted (cash)
export function canMarkIPD(user: User, lead: Lead): boolean {
  if (!user || !lead) return false

  const isBDOrTL = user.role === 'BD' || user.role === 'TEAM_LEAD' || user.role === 'ADMIN'
  const isInitiated = lead.caseStage === CaseStage.INITIATED
  const isCashReady = lead.caseStage === CaseStage.CASH_APPROVED || lead.caseStage === CaseStage.CASH_IPD_SUBMITTED

  return isBDOrTL && (isInitiated || isCashReady)
}

// Insurance can generate/download PDF after pre-auth is raised
export function canGeneratePDF(user: User, lead: Lead): boolean {
  if (!user || !lead) return false

  const isInsurance = ['INSURANCE', 'INSURANCE_HEAD', 'ADMIN', 'TESTER'].includes(user.role)
  const afterPreAuthRaised =
    lead.caseStage === CaseStage.PREAUTH_RAISED || lead.caseStage === CaseStage.PREAUTH_COMPLETE

  return isInsurance && afterPreAuthRaised
}

// Insurance or PL can edit discharge sheet when discharged AND initial form is filled
export function canEditDischargeSheet(user: User, lead: Lead): boolean {
  if (!user || !lead) return false
  
  const isInsuranceOrPL = ['INSURANCE', 'INSURANCE_HEAD', 'PL_HEAD', 'PL_ENTRY', 'ADMIN'].includes(user.role)
  const isDischarged = lead.caseStage === CaseStage.DISCHARGED
  const hasInitiateForm = !!lead.insuranceInitiateForm?.id
  
  return isInsuranceOrPL && isDischarged && hasInitiateForm
}

// BD / TL can mark case as lost only after KYP1 and up until Mark Admitted (not before KYP1, not after admitted)
export function canMarkLost(user: User, lead: Lead): boolean {
  if (!user || !lead) return false

  const isBDOrTL = user.role === 'BD' || user.role === 'TEAM_LEAD' || user.role === 'ADMIN'
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
  const isValidStage = lead.caseStage === CaseStage.PREAUTH_RAISED || lead.caseStage === CaseStage.PREAUTH_COMPLETE
  
  return isInsurance && isValidStage
}

// True when discharge is blocked because the initiate form has not been filled yet
export function isDischargeBlockedByInitiateForm(user: User, lead: Lead): boolean {
  if (!user || !lead) return false
  const isInsuranceOrPL = ['INSURANCE', 'INSURANCE_HEAD', 'PL_HEAD', 'PL_ENTRY', 'ADMIN'].includes(user.role)
  const isDischarged = lead.caseStage === CaseStage.DISCHARGED
  return isInsuranceOrPL && isDischarged && !lead.insuranceInitiateForm?.id
}

// Insurance, PL, Outstanding, BD, Admin can view initiate form details
export function canViewInitiateForm(user: User, lead: Lead): boolean {
  if (!user || !lead) return false
  const allowedRoles = ['INSURANCE', 'INSURANCE_HEAD', 'PL_HEAD', 'PL_ENTRY', 'ADMIN', 'FINANCE_HEAD', 'BD', 'TEAM_LEAD']
  return allowedRoles.includes(user.role)
}

// ─── Cash Flow Permissions ──────────────────────────────────────────────────

// BD can start cash mode if not already in cash mode and in early stages
export function canStartCashMode(user: User, lead: Lead): boolean {
  if (!user || !lead) return false
  
  const isBD = user.role === 'BD' || user.role === 'TEAM_LEAD' || user.role === 'ADMIN'
  const isNotCash = lead.flowType !== FlowType.CASH
  
  // Allowed stages to switch to cash:
  // NEW_LEAD, KYP_BASIC_COMPLETE, HOSPITALS_SUGGESTED, PREAUTH_RAISED, PREAUTH_COMPLETE
  // Basically before admission in insurance flow
  const allowedStages: CaseStage[] = [
    CaseStage.NEW_LEAD,
    CaseStage.KYP_BASIC_COMPLETE,
    CaseStage.HOSPITALS_SUGGESTED,
    CaseStage.PREAUTH_RAISED,
    CaseStage.PREAUTH_COMPLETE,
    CaseStage.KYP_PENDING,
    CaseStage.KYP_COMPLETE,
  ]
  
  return isBD && isNotCash && allowedStages.includes(lead.caseStage)
}

// BD can revert to insurance flow if they haven't submitted the IPD cash form yet
export function canRevertCashMode(user: User, lead: Lead): boolean {
  if (!user || !lead) return false
  
  const isBD = user.role === 'BD' || user.role === 'TEAM_LEAD' || user.role === 'ADMIN'
  const isCash = lead.flowType === FlowType.CASH
  const isPending = lead.caseStage === CaseStage.CASH_IPD_PENDING
  
  return isBD && isCash && isPending
}

// BD can fill IPD Cash Form when pending or on hold
export function canFillIPDCashForm(user: User, lead: Lead): boolean {
  if (!user || !lead) return false
  
  const isBD = user.role === 'BD' || user.role === 'TEAM_LEAD' || user.role === 'ADMIN'
  const isCash = lead.flowType === FlowType.CASH
  // If pending or on hold, they can fill/edit
  const allowedStages: CaseStage[] = [CaseStage.CASH_IPD_PENDING, CaseStage.CASH_ON_HOLD]
  
  return isBD && isCash && allowedStages.includes(lead.caseStage)
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
  const isApproved = lead.caseStage === CaseStage.CASH_APPROVED
  
  return isInsurance && isCash && isApproved
}
