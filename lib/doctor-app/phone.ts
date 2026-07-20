export function normalizeIndianPhone(phone: string | null | undefined) {
  if (phone == null) {
    return null
  }

  const digits = phone.replace(/\D/g, '')
  if (!digits) {
    return null
  }
  if (digits.length === 10) return digits
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2)
  return digits
}
