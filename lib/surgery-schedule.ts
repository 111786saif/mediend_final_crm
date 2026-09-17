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

  const storedTime = !isPostponed ? admissionRecord?.surgeryTime?.trim() || null : null
  const legacyDateOnly = Boolean(storedTime && isUtcMidnight(date))

  return {
    date,
    isPostponed,
    legacyTime: legacyDateOnly ? storedTime : null,
    hasTime: Boolean(storedTime) && !isPostponed,
  }
}
