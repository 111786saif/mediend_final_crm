export const PIPELINE_MONTH_FILTER_OPTIONS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

export function normalizePipelineMonthValue(value: unknown, fallback = '—') {
  if (typeof value !== 'string') return fallback

  const normalized = value.trim().toLowerCase().replace(/\./g, '')
  if (!normalized) return fallback

  const monthMap: Record<string, string> = {
    jan: 'Jan',
    january: 'Jan',
    feb: 'Feb',
    february: 'Feb',
    mar: 'Mar',
    march: 'Mar',
    apr: 'Apr',
    april: 'Apr',
    may: 'May',
    jun: 'Jun',
    june: 'Jun',
    jul: 'Jul',
    july: 'Jul',
    aug: 'Aug',
    august: 'Aug',
    sep: 'Sep',
    sept: 'Sep',
    september: 'Sep',
    oct: 'Oct',
    october: 'Oct',
    nov: 'Nov',
    november: 'Nov',
    dec: 'Dec',
    december: 'Dec',
  }

  return monthMap[normalized] ?? fallback
}

export function resolvePipelineMonthValue(
  monthValue: unknown,
  dateValue?: Date | string | null,
  fallback = '—',
): string {
  const fromMonth = normalizePipelineMonthValue(monthValue, '')
  if (fromMonth) return fromMonth

  if (dateValue) {
    const parsed = new Date(String(dateValue))
    if (!Number.isNaN(parsed.getTime())) {
      // In IST (UTC+5:30)
      const istDate = new Date(parsed.getTime() + 5.5 * 60 * 60 * 1000)
      const monthIdx = istDate.getUTCMonth()
      return PIPELINE_MONTH_FILTER_OPTIONS[monthIdx] ?? fallback
    }
  }

  return fallback
}

export function normalizePipelineSexValue(value: unknown, fallback = '—') {
  if (typeof value !== 'string') return fallback

  const normalized = value.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!normalized) return fallback

  if (normalized === 'male' || normalized === 'm') {
    return 'Male'
  }

  if (normalized === 'female' || normalized === 'f') {
    return 'Female'
  }

  if (normalized === 'other' || normalized === 'o') {
    return 'Other'
  }

  if (
    normalized === 'not specified' ||
    normalized === 'not_specified' ||
    normalized === 'n/a' ||
    normalized === 'na' ||
    normalized === 'unspecified' ||
    normalized === 'unknown'
  ) {
    return 'Not Specified'
  }

  return normalized
    .split(' ')
    .filter((part) => part.length > 0)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(' ')
}
