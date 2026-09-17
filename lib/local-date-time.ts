function pad(value: number) {
  return String(value).padStart(2, '0')
}

/** Converts date/time fields entered in the current browser timezone into a UTC instant. */
export function localDateTimeToUtcIso(date: string, time: string = '00:00') {
  const value = new Date(`${date}T${time || '00:00'}:00`)
  return Number.isNaN(value.getTime()) ? null : value.toISOString()
}

/** Formats an instant for a native date input in the current browser timezone. */
export function localDateInputValue(value: Date | string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Formats an instant for a native time input in the current browser timezone. */
export function localTimeInputValue(value: Date | string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function localTodayInputValue(now = new Date()) {
  return localDateInputValue(now)
}
