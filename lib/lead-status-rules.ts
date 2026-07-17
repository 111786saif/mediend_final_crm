const FOLLOW_UP_AGE_SEX_STATUSES = new Set([
  'follow-up',
  'follow-up 1',
  'follow-up 2',
  'follow-up 3',
  'follow-up 4',
  'follow-up 5',
  'call back (sd)',
  'call back (t)',
  'call back next week',
  'call back next month',
  'out of station follow-up',
])

export function normalizeLeadStatusRuleValue(status: string | null | undefined) {
  return String(status ?? '').trim().toLowerCase()
}

export function isStatusRequiringFollowUpDate(status: string | null | undefined) {
  const normalized = normalizeLeadStatusRuleValue(status)
  return normalized.includes('follow-up') || normalized.startsWith('dnp')
}

export function isStatusRequiringAgeSex(status: string | null | undefined) {
  const normalized = normalizeLeadStatusRuleValue(status)
  return FOLLOW_UP_AGE_SEX_STATUSES.has(normalized) || normalized.startsWith('dnp')
}
