export const OPD_SCHEDULED_STATUS = 'OPD Schedule'
export const OPD_SCHEDULED_LABEL = 'OPD Schedule'

const OPD_SCHEDULED_VALUES = new Set([
  OPD_SCHEDULED_STATUS.toLowerCase(),
  'opd_scheduled',
  'opd schedule',
  'opd scheduled',
])

function normalizeStatusValue(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase()
}

export function isOpdScheduledStatus(value: string | null | undefined) {
  return OPD_SCHEDULED_VALUES.has(normalizeStatusValue(value))
}

export function hasLeadOpdScheduled(lead: {
  status?: string | null
  opdScheduleDate?: string | Date | null
}) {
  return isOpdScheduledStatus(lead.status) || Boolean(lead.opdScheduleDate)
}
