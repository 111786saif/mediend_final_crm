export const LEAD_BULK_REASSIGN_QUEUE_NAME = 'lead-bulk-reassign'

export const LEAD_BULK_REASSIGN_STATUSES = [
  'queued',
  'running',
  'waiting',
  'completed',
  'failed',
] as const

export type LeadBulkReassignRunStatus =
  (typeof LEAD_BULK_REASSIGN_STATUSES)[number]

export type BulkLeadReassignmentRunResponse = {
  id: string
  jobId: string
  status: LeadBulkReassignRunStatus
  totalLeads: number
  totalBds: number
  pauseSeconds: number
  processedCount: number
  currentLeadIndex: number
  currentBdIndex: number
  currentCycleNumber: number
  removePreviousRemarks: boolean
  removePreviousFollowUpDate?: boolean
  subStatus: string | null
  nextRunAt: string | null
  startedAt: string | null
  completedAt: string | null
  failedAt: string | null
  errorMessage: string | null
}

export type CreateBulkLeadReassignmentRunInput = {
  leadIds: number[]
  bdUserIds: string[]
  pauseSeconds: number
  removePreviousRemarks: boolean
  removePreviousFollowUpDate?: boolean
  leadStatus?: string
  followUpDate?: string
  modeOfPayment?: string
  subStatus?: string
}

export type BulkLeadReassignCycleJobData = {
  runId: string
  cycleNumber: number
}

export function isActiveBulkLeadReassignStatus(
  status: LeadBulkReassignRunStatus | string
) {
  return status === 'queued' || status === 'running' || status === 'waiting'
}
