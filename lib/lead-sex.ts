const CANONICAL_LEAD_SEX_VALUES = {
  male: 'Male',
  m: 'Male',
  female: 'Female',
  f: 'Female',
  other: 'Other',
  o: 'Other',
} as const

export function normalizeLeadSexValue(value: string | null | undefined) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()

  if (!normalized || normalized === 'not specified' || normalized === 'na' || normalized === 'n/a') {
    return ''
  }

  return CANONICAL_LEAD_SEX_VALUES[normalized as keyof typeof CANONICAL_LEAD_SEX_VALUES] ?? ''
}
