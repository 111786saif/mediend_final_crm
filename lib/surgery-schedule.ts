type DateValue = Date | string | null | undefined

type AdmissionSurgeryFields = {
  ipdStatus?: string | null
  surgeryDate?: DateValue
  newSurgeryDate?: DateValue
  surgeryTime?: string | null
} | null | undefined

function isUtcMidnight(date: Date) {
  return (
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0
  )
}

function formatStoredTime24(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) return null

  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i)
  if (!match) return trimmed

  let hour = Number.parseInt(match[1], 10)
  const minute = Number.parseInt(match[2], 10)
  const period = match[3]?.toUpperCase()
  if (minute > 59 || hour > 23 || hour < 0) return trimmed

  if (period === 'AM' && hour === 12) hour = 0
  if (period === 'PM' && hour < 12) hour += 12

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

/**
 * Resolves surgery data consistently across the pipeline and patient screens.
 * Older records stored a date marker and a separate time, while newer records
 * store the complete UTC instant in surgeryDate.
 */
export function resolveSurgerySchedule(
  leadSurgeryDate: DateValue,
  admissionRecord: AdmissionSurgeryFields
) {
  const isPostponed = admissionRecord?.ipdStatus === 'POSTPONED'
  const value =
    isPostponed && admissionRecord?.newSurgeryDate
      ? admissionRecord.newSurgeryDate
      : admissionRecord?.surgeryDate ?? leadSurgeryDate
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  const storedTime = !isPostponed ? formatStoredTime24(admissionRecord?.surgeryTime) : null
  const legacyDateOnly = Boolean(storedTime && isUtcMidnight(date))

  return {
    date,
    isPostponed,
    legacyTime: legacyDateOnly ? storedTime : null,
    hasTime: Boolean(storedTime) && !isPostponed,
  }
}
