import { isValid, parse } from 'date-fns'

function padDatePart(value: number) {
  return String(value).padStart(2, '0')
}

function normalizeYear(year: number) {
  if (year >= 100) return year
  return year >= 70 ? 1900 + year : 2000 + year
}

function normalizeMeridiem(value: string | undefined) {
  if (!value) return null
  const normalized = value.replace(/\./g, '').trim().toUpperCase()
  return normalized === 'AM' || normalized === 'PM' ? normalized : null
}

function buildLocalDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number
) {
  if (month < 1 || month > 12) return null
  if (day < 1 || day > 31) return null
  if (hour < 0 || hour > 23) return null
  if (minute < 0 || minute > 59) return null
  if (second < 0 || second > 59) return null

  const date = new Date(year, month - 1, day, hour, minute, second, 0)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute ||
    date.getSeconds() !== second
  ) {
    return null
  }

  return date
}

function to24HourTime(hourText: string | undefined, meridiemText: string | undefined) {
  const hour = Number.parseInt(hourText ?? '0', 10)
  const minute = 0
  const second = 0
  const meridiem = normalizeMeridiem(meridiemText)

  if (!meridiem) {
    if (hour < 0 || hour > 23) return null
    return { hour, minute, second }
  }

  if (hour < 1 || hour > 12) return null

  if (meridiem === 'AM') {
    return { hour: hour === 12 ? 0 : hour, minute, second }
  }

  return { hour: hour === 12 ? 12 : hour + 12, minute, second }
}

function parseTimeParts(
  hourText: string | undefined,
  minuteText: string | undefined,
  secondText: string | undefined,
  meridiemText: string | undefined
) {
  const rawHour = Number.parseInt(hourText ?? '0', 10)
  const minute = Number.parseInt(minuteText ?? '0', 10)
  const second = Number.parseInt(secondText ?? '0', 10)
  const meridiem = normalizeMeridiem(meridiemText)

  if (Number.isNaN(rawHour) || Number.isNaN(minute) || Number.isNaN(second)) {
    return null
  }

  if (!meridiem) {
    if (rawHour < 0 || rawHour > 23) return null
    if (minute < 0 || minute > 59) return null
    if (second < 0 || second > 59) return null
    return { hour: rawHour, minute, second }
  }

  if (rawHour < 1 || rawHour > 12) return null
  if (minute < 0 || minute > 59) return null
  if (second < 0 || second > 59) return null

  if (meridiem === 'AM') {
    return { hour: rawHour === 12 ? 0 : rawHour, minute, second }
  }

  return { hour: rawHour === 12 ? 12 : rawHour + 12, minute, second }
}

function parseExcelSerialDate(value: number) {
  if (!Number.isFinite(value) || value <= 0) return null

  const excelEpoch = new Date(1899, 11, 30, 0, 0, 0, 0)
  const millisecondsPerDay = 24 * 60 * 60 * 1000
  const totalMilliseconds = Math.round(value * millisecondsPerDay)
  const parsed = new Date(excelEpoch.getTime() + totalMilliseconds)

  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const TEXTUAL_DATE_PATTERNS = [
  'd MMM yyyy',
  'd MMM yyyy h:mm a',
  'd MMM yyyy hh:mm a',
  'd MMM yyyy H:mm',
  'd MMM yyyy HH:mm',
  'd MMM yyyy H:mm:ss',
  'd MMM yyyy HH:mm:ss',
  'd MMMM yyyy',
  'd MMMM yyyy h:mm a',
  'd MMMM yyyy hh:mm a',
  'd MMMM yyyy H:mm',
  'd MMMM yyyy HH:mm',
  'd MMMM yyyy H:mm:ss',
  'd MMMM yyyy HH:mm:ss',
  'MMM d yyyy',
  'MMM d yyyy h:mm a',
  'MMM d yyyy hh:mm a',
  'MMM d yyyy H:mm',
  'MMM d yyyy HH:mm',
  'MMM d yyyy H:mm:ss',
  'MMM d yyyy HH:mm:ss',
  'MMMM d yyyy',
  'MMMM d yyyy h:mm a',
  'MMMM d yyyy hh:mm a',
  'MMMM d yyyy H:mm',
  'MMMM d yyyy HH:mm',
  'MMMM d yyyy H:mm:ss',
  'MMMM d yyyy HH:mm:ss',
]

function parseTextualDateInput(value: string) {
  for (const pattern of TEXTUAL_DATE_PATTERNS) {
    const parsed = parse(value, pattern, new Date())
    if (isValid(parsed)) {
      return parsed
    }
  }

  return null
}

function normalizeInputString(value: string) {
  return value
    .trim()
    .replace(/\u00A0/g, ' ')
    .replace(/,\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b([ap])\.?m\.?\b/gi, (_, half: string) => `${half.toUpperCase()}M`)
}

export function formatLocalDateTimeValue(date: Date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}T${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}:${padDatePart(date.getSeconds())}`
}

export function formatLocalDateTimeInputValue(date: Date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}T${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`
}

export function parseFlexibleDateInput(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  if (typeof value === 'number') {
    return parseExcelSerialDate(value)
  }

  const raw = String(value ?? '').trim()
  if (!raw) return null

  if (/^\d+(?:\.\d+)?$/.test(raw)) {
    const serialDate = parseExcelSerialDate(Number.parseFloat(raw))
    if (serialDate) {
      return serialDate
    }
  }

  const normalized = normalizeInputString(raw)

  const yearFirstMatch = normalized.match(
    /^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})(?:[ T](\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?\s*(AM|PM)?)?$/
  )

  if (yearFirstMatch) {
    const [, yearText, monthText, dayText, hourText, minuteText, secondText, meridiemText] =
      yearFirstMatch
    const timeParts = parseTimeParts(hourText, minuteText, secondText, meridiemText)
    if (!timeParts) return null

    return buildLocalDate(
      Number.parseInt(yearText, 10),
      Number.parseInt(monthText, 10),
      Number.parseInt(dayText, 10),
      timeParts.hour,
      timeParts.minute,
      timeParts.second
    )
  }

  const dayFirstMatch = normalized.match(
    /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})(?:[ T](\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?\s*(AM|PM)?)?$/
  )

  if (dayFirstMatch) {
    const [, dayText, monthText, yearText, hourText, minuteText, secondText, meridiemText] =
      dayFirstMatch
    const timeParts = parseTimeParts(hourText, minuteText, secondText, meridiemText)
    if (!timeParts) return null

    return buildLocalDate(
      normalizeYear(Number.parseInt(yearText, 10)),
      Number.parseInt(monthText, 10),
      Number.parseInt(dayText, 10),
      timeParts.hour,
      timeParts.minute,
      timeParts.second
    )
  }

  const textualDate = parseTextualDateInput(normalized)
  if (textualDate) {
    return textualDate
  }

  if (/[A-Za-z]/.test(normalized) || /Z$|[+-]\d{2}:?\d{2}$/.test(normalized)) {
    const parsed = new Date(normalized)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }

  const timeOnlyMatch = normalized.match(/^(\d{1,2})(?::(\d{1,2}))?\s*(AM|PM)$/i)
  if (timeOnlyMatch) {
    const timeParts = to24HourTime(timeOnlyMatch[1], timeOnlyMatch[3])
    if (!timeParts) return null
    const now = new Date()
    return buildLocalDate(
      now.getFullYear(),
      now.getMonth() + 1,
      now.getDate(),
      timeParts.hour,
      Number.parseInt(timeOnlyMatch[2] ?? '0', 10),
      0
    )
  }

  return null
}

export function normalizeFlexibleDateInput(value: unknown) {
  const parsed = parseFlexibleDateInput(value)
  return parsed ? formatLocalDateTimeValue(parsed) : null
}

export function toDateTimeLocalInputValue(value: unknown) {
  const parsed = parseFlexibleDateInput(value)
  return parsed ? formatLocalDateTimeInputValue(parsed) : ''
}
