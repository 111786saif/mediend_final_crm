/**
 * Normalization deadline rules:
 * - From May 20, 2026: normalization must be applied within the same ISO week (Monday-Sunday)
 * - Before May 20, 2026: deadline is end of 5th of next month
 */

/** Minimum characters for employee normalization reason (request to manager / self-normalize). */
export const NORMALIZATION_REASON_MIN_CHARS = 15

const WEEK_RULE_START = new Date(Date.UTC(2026, 4, 20, 0, 0, 0, 0)) // May 20, 2026 UTC

function toDayStart(d: Date): Date {
  const [y, m, day] = d.toISOString().split('T')[0].split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, day, 0, 0, 0, 0))
}

/** Get the end of the ISO week (Sunday 23:59:59.999) for a given date. */
function getWeekEnd(date: Date): Date {
  const d = new Date(date)
  const day = d.getUTCDay() // 0 = Sunday, 1 = Monday, ...
  const daysToSunday = day === 0 ? 0 : 7 - day
  d.setUTCDate(d.getUTCDate() + daysToSunday)
  d.setUTCHours(23, 59, 59, 999)
  return d
}

/** Deadline for applying normalization for a given month (legacy rule): end of 5th of next month. */
function getMonthBasedDeadline(monthDate: Date): Date {
  const y = monthDate.getUTCFullYear()
  const m = monthDate.getUTCMonth()
  return new Date(Date.UTC(y, m + 1, 5, 23, 59, 59, 999))
}

/**
 * Returns the deadline for applying normalization for a given date.
 * - For dates >= May 20, 2026: end of that date's ISO week (Sunday)
 * - For dates before May 20, 2026: end of 5th of next month
 */
export function getNormalizationDeadline(date: Date): Date {
  const dayStart = toDayStart(date)
  if (dayStart >= WEEK_RULE_START) {
    return getWeekEnd(dayStart)
  }
  const monthStart = new Date(Date.UTC(dayStart.getUTCFullYear(), dayStart.getUTCMonth(), 1, 0, 0, 0, 0))
  return getMonthBasedDeadline(monthStart)
}

/**
 * Check if a date is within the application window (can still apply for normalization).
 */
export function isWithinNormalizationWindow(date: Date, now: Date = new Date()): boolean {
  const deadline = getNormalizationDeadline(date)
  return now <= deadline
}

/**
 * Get disabled date keys for the frontend (dates that are past the normalization deadline).
 * Use for date ranges from `fromDate` to `toDate` (YYYY-MM-DD strings).
 */
export function getDisabledNormalizationDateKeys(
  fromDate: string,
  toDate: string
): Set<string> {
  const [sy, sm, sd] = fromDate.split('-').map(Number)
  const [ey, em, ed] = toDate.split('-').map(Number)
  const start = new Date(sy, sm - 1, sd)
  const end = new Date(ey, em - 1, ed)
  const now = new Date()
  const disabled = new Set<string>()

  let current = new Date(start.getTime())
  const endTime = end.getTime()
  while (current.getTime() <= endTime) {
    const y = current.getFullYear()
    const m = current.getMonth()
    const d = current.getDate()
    const dateKey = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const dayStartUtc = new Date(Date.UTC(y, m, d, 0, 0, 0, 0))
    if (!isWithinNormalizationWindow(dayStartUtc, now)) {
      disabled.add(dateKey)
    }
    current.setDate(current.getDate() + 1)
  }
  return disabled
}
