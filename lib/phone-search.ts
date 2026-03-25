/**
 * Parses a search box value for strict phone search.
 * Only matches when the whole trimmed input is digits/separators (no letters).
 * - Exactly 10 digits: Indian mobile without country code
 * - Exactly 12 digits starting with 91: full number with country code
 * Shorter/longer digit runs (e.g. 9 or 11 digits) do not trigger phone search.
 */
export function parsePhoneSearchQuery(input: string): { last10: string } | null {
  const t = input.trim()
  if (!t) return null
  if (!/^[\d\s+\-().]+$/.test(t)) return null
  const digits = t.replace(/\D/g, '')
  if (digits.length === 10) return { last10: digits }
  if (digits.length === 12 && digits.startsWith('91')) return { last10: digits.slice(-10) }
  return null
}

export function last10DigitsFromStored(raw: string | null | undefined): string | null {
  if (!raw) return null
  const d = raw.replace(/\D/g, '')
  if (d.length < 10) return null
  return d.slice(-10)
}
