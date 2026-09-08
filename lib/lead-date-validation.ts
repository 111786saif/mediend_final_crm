export const LEAD_DATE_FUTURE_ERROR = 'Lead date cannot be in the future'

function padDatePart(value: number) {
  return String(value).padStart(2, '0')
}

export function formatDateTimeLocalValue(date: Date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}T${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`
}

export function formatDateTimeLocalValueInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const values = new Map(parts.map((part) => [part.type, part.value]))

  return `${values.get('year')}-${values.get('month')}-${values.get('day')}T${values.get('hour')}:${values.get('minute')}`
}

export function getLeadDateInputMaxValue(now = new Date()) {
  const endOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    0,
    0
  )

  return formatDateTimeLocalValue(endOfToday)
}

export function isLeadDateAfterToday(date: Date, now = new Date()) {
  const inputDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return inputDay > today
}
