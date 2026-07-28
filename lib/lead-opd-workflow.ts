import { CaseStage, FlowType } from '@/generated/prisma/enums'

export const OPD_SCHEDULED_STATUS = 'OPD Schedule'
export const OPD_SCHEDULED_LABEL = 'OPD Schedule'
export const OPD_DONE_STATUS = 'OPD Done'
export const OPD_DONE_LABEL = 'OPD Done'

const OPD_SCHEDULED_VALUES = new Set([
  OPD_SCHEDULED_STATUS.toLowerCase(),
  'opd_scheduled',
  'opd schedule',
  'opd scheduled',
])

const OPD_DONE_VALUES = new Set([
  OPD_DONE_STATUS.toLowerCase(),
  'opd_done',
  'opd done',
])

function normalizeStatusValue(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase()
}

export function isOpdScheduledStatus(value: string | null | undefined) {
  return OPD_SCHEDULED_VALUES.has(normalizeStatusValue(value))
}

export function isOpdDoneStatus(value: string | null | undefined) {
  return OPD_DONE_VALUES.has(normalizeStatusValue(value))
}

const INSURANCE_OPD_SCHEDULED_STAGES = new Set<CaseStage>([
  CaseStage.OPD_SCHEDULED,
  CaseStage.OPD_DONE,
  CaseStage.KYP_BASIC_PENDING,
  CaseStage.KYP_BASIC_COMPLETE,
  CaseStage.KYP_PENDING,
  CaseStage.KYP_COMPLETE,
  CaseStage.KYP_DETAILED_PENDING,
  CaseStage.KYP_DETAILED_COMPLETE,
  CaseStage.HOSPITALS_SUGGESTED,
  CaseStage.PREAUTH_RAISED,
  CaseStage.PREAUTH_COMPLETE,
  CaseStage.INITIATED,
  CaseStage.ADMITTED,
  CaseStage.IPD_DONE,
  CaseStage.DISCHARGED,
  CaseStage.PL_PENDING,
  CaseStage.OUTSTANDING,
])

const INSURANCE_OPD_DONE_STAGES = new Set<CaseStage>([
  CaseStage.OPD_DONE,
  CaseStage.KYP_BASIC_PENDING,
  CaseStage.KYP_BASIC_COMPLETE,
  CaseStage.KYP_PENDING,
  CaseStage.KYP_COMPLETE,
  CaseStage.KYP_DETAILED_PENDING,
  CaseStage.KYP_DETAILED_COMPLETE,
  CaseStage.HOSPITALS_SUGGESTED,
  CaseStage.PREAUTH_RAISED,
  CaseStage.PREAUTH_COMPLETE,
  CaseStage.INITIATED,
  CaseStage.ADMITTED,
  CaseStage.IPD_DONE,
  CaseStage.DISCHARGED,
  CaseStage.PL_PENDING,
  CaseStage.OUTSTANDING,
])

const CASH_OPD_SCHEDULED_STAGES = new Set<CaseStage>([
  CaseStage.CASH_OPD_SCHEDULED,
  CaseStage.CASH_OPD_DONE,
  CaseStage.CASH_IPD_SUBMITTED,
  CaseStage.CASH_ON_HOLD,
  CaseStage.CASH_APPROVED,
  CaseStage.CASH_IPD_DONE,
  CaseStage.CASH_DISCHARGED,
])

const CASH_OPD_DONE_STAGES = new Set<CaseStage>([
  CaseStage.CASH_OPD_DONE,
  CaseStage.CASH_IPD_SUBMITTED,
  CaseStage.CASH_ON_HOLD,
  CaseStage.CASH_APPROVED,
  CaseStage.CASH_IPD_DONE,
  CaseStage.CASH_DISCHARGED,
])

export function hasReachedOpdStage(stage: CaseStage | null | undefined, flowType?: FlowType | null) {
  if (!stage) return false

  if (flowType === FlowType.CASH) {
    return CASH_OPD_SCHEDULED_STAGES.has(stage)
  }

  if (flowType === FlowType.INSURANCE) {
    return INSURANCE_OPD_SCHEDULED_STAGES.has(stage)
  }

  return (
    INSURANCE_OPD_SCHEDULED_STAGES.has(stage) ||
    CASH_OPD_SCHEDULED_STAGES.has(stage)
  )
}

export function hasReachedOpdDoneStage(stage: CaseStage | null | undefined, flowType?: FlowType | null) {
  if (!stage) return false

  if (flowType === FlowType.CASH) {
    return CASH_OPD_DONE_STAGES.has(stage)
  }

  if (flowType === FlowType.INSURANCE) {
    return INSURANCE_OPD_DONE_STAGES.has(stage)
  }

  return (
    INSURANCE_OPD_DONE_STAGES.has(stage) ||
    CASH_OPD_DONE_STAGES.has(stage)
  )
}

export function hasLeadOpdScheduled(lead: {
  caseStage?: CaseStage | null
  flowType?: FlowType | null
  status?: string | null
  opdScheduleDate?: string | Date | null
}) {
  return (
    hasReachedOpdStage(lead.caseStage, lead.flowType) ||
    isOpdScheduledStatus(lead.status) ||
    isOpdDoneStatus(lead.status) ||
    Boolean(lead.opdScheduleDate)
  )
}

export function hasLeadOpdDone(lead: {
  caseStage?: CaseStage | null
  flowType?: FlowType | null
  status?: string | null
}) {
  return hasReachedOpdDoneStage(lead.caseStage, lead.flowType) || isOpdDoneStatus(lead.status)
}

export function getNextStageAfterOpdSchedule(lead: {
  caseStage?: CaseStage | null
  flowType?: FlowType | null
}) {
  if (lead.flowType === FlowType.CASH) {
    return lead.caseStage === CaseStage.CASH_IPD_PENDING
      ? CaseStage.CASH_OPD_SCHEDULED
      : null
  }

  return lead.caseStage === CaseStage.NEW_LEAD ? CaseStage.OPD_SCHEDULED : null
}

export function getNextStageAfterOpdDone(lead: {
  caseStage?: CaseStage | null
  flowType?: FlowType | null
  status?: string | null
  opdScheduleDate?: string | Date | null
}) {
  if (lead.flowType === FlowType.CASH) {
    if (lead.caseStage === CaseStage.CASH_OPD_SCHEDULED) {
      return CaseStage.CASH_OPD_DONE
    }

    if (lead.caseStage === CaseStage.CASH_IPD_PENDING && hasLeadOpdScheduled(lead)) {
      return CaseStage.CASH_OPD_DONE
    }

    return null
  }

  if (lead.caseStage === CaseStage.OPD_SCHEDULED) {
    return CaseStage.OPD_DONE
  }

  if (lead.caseStage === CaseStage.NEW_LEAD && hasLeadOpdScheduled(lead)) {
    return CaseStage.OPD_DONE
  }

  return null
}
