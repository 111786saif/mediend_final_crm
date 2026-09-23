import { LEAD_STATUS_OPTIONS as STATUS_OPTIONS } from '@/lib/lead-status-hierarchy'

export const LEAD_STATUS_OPTIONS = STATUS_OPTIONS

export const CRM_LEAD_STATUS_OPTIONS = Array.from(
  new Set([...LEAD_STATUS_OPTIONS])
)

export const WORKFLOW_MANAGED_LEAD_STATUSES = [
  'OPD Schedule',
  'OPD Done',
  'IPD Schedule',
  'IPD Done',
] as const

export function isWorkflowManagedLeadStatus(value: string | null | undefined) {
  const normalized = String(value ?? '').trim().toLowerCase()
  return WORKFLOW_MANAGED_LEAD_STATUSES.some(
    (status) => status.toLowerCase() === normalized
  )
}

export const CRM_MODE_OF_PAYMENT_OPTIONS = [
  'Cash',
  'Cashless',
  'EMI',
  'Reimbursement',
  'Not Yet Confirmed',
] as const
