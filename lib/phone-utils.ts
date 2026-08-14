const PHONE_MASK_CHAR = 'x'

/**
 * Masks a phone number for unauthorized users, revealing only the last 4 digits.
 */
export function maskPhoneNumber(phone?: string | null): string {
  const fallback = '-'
  if (typeof phone !== 'string') return fallback
  const trimmed = phone.trim()
  if (!trimmed) return fallback

  const visibleSuffixLength = Math.min(4, trimmed.length)
  const suffix = trimmed.slice(-visibleSuffixLength)
  const maskLength = Math.max(trimmed.length - visibleSuffixLength, 0)
  const masked = `${PHONE_MASK_CHAR.repeat(maskLength)}${suffix}`
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
