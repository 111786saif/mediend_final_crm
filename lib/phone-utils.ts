/**
 * Masks a phone number completely for unauthorized users
 * Returns '—' instead of showing any digits
 */
export function maskPhoneNumber(phone?: string | null): string {
  // return '—'
  const fallback = '-'
  if (typeof phone !== 'string') return fallback
  const trimmed = phone.trim()
  if (!trimmed) return fallback

  const visiblePrefixLength = trimmed.length > 6 ? 2 : 0
  const visibleSuffixLength = Math.min(2, trimmed.length)
  const prefix = visiblePrefixLength > 0 ? trimmed.slice(0, visiblePrefixLength) : ''
  const suffix = trimmed.slice(-visibleSuffixLength)
  const maskLength = Math.max(trimmed.length - prefix.length - suffix.length, 0)
  const masked = `${prefix}${'*'.repeat(maskLength)}${suffix}`
  return masked || fallback
}

/**
 * Returns the appropriate phone display based on user permissions
 * @param phone - The phone number to display
 * @param canView - Whether the user has permission to view the full phone number
 * @returns The phone number (if allowed) or a masked value (if not allowed)
 */
export function getPhoneDisplay(phone: string | undefined | null, canView: boolean): string {
  if (canView) return phone || '—'
  return maskPhoneNumber(phone)
}
