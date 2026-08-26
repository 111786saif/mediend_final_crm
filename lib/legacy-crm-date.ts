const INDIA_OFFSET_MINUTES = 5 * 60 + 30

const LEGACY_WALL_CLOCK_PATTERN =
  /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?(?:\.(\d{1,3}))?)?$/

/**
 * Legacy CRM timestamps without an offset represent India wall-clock time.
 * Convert them explicitly so parsing does not depend on the application server timezone.
 */
export function parseLegacyCrmDate(
  value: Date | string | null | undefined
): Date | null {
  if (!value) return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  const normalized = value.trim()
  if (!normalized) return null

  const wallClockMatch = normalized.match(LEGACY_WALL_CLOCK_PATTERN)
  if (wallClockMatch) {
    const [, yearText, monthText, dayText, hourText, minuteText, secondText, millisecondText] =
      wallClockMatch
    const year = Number.parseInt(yearText, 10)
    const month = Number.parseInt(monthText, 10)
    const day = Number.parseInt(dayText, 10)
    const hour = Number.parseInt(hourText ?? '0', 10)
    const minute = Number.parseInt(minuteText ?? '0', 10)
    const second = Number.parseInt(secondText ?? '0', 10)
    const millisecond = Number.parseInt((millisecondText ?? '0').padEnd(3, '0'), 10)
    const wallClockUtc = Date.UTC(year, month - 1, day, hour, minute, second, millisecond)
    const validationDate = new Date(wallClockUtc)

    if (
      validationDate.getUTCFullYear() !== year ||
      validationDate.getUTCMonth() !== month - 1 ||
      validationDate.getUTCDate() !== day ||
      validationDate.getUTCHours() !== hour ||
      validationDate.getUTCMinutes() !== minute ||
      validationDate.getUTCSeconds() !== second
    ) {
      return null
    }

    return new Date(wallClockUtc - INDIA_OFFSET_MINUTES * 60 * 1000)
  }

  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}
