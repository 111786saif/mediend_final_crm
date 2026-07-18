const FOLLOW_UP_DETAIL_STATUSES = new Set([
  'follow-up',
  'follow-up 1',
  'follow-up 2',
  'follow-up 3',
  'follow-up 4',
  'follow-up 5',
])

const DNP_FOLLOW_UP_STATUSES = new Set([
  'dnp',
  'dnp-1',
  'dnp-2',
  'dnp-3',
  'dnp-4',
  'dnp-5',
  'dnp exhausted',
  'dnp (1-5, exhausted)',
])

export function normalizeLeadStatusRuleValue(status: string | null | undefined) {
  const normalized = String(status ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')

  if (/^follow[\s-]*up\s*\d+$/.test(normalized)) {
    const suffix = normalized.match(/\d+$/)?.[0]
    return suffix ? `follow-up ${suffix}` : 'follow-up'
  }

  if (/^follow[\s-]*up$/.test(normalized)) {
    return 'follow-up'
  }

  if (/^dnp\s*-?\s*\d+$/.test(normalized)) {
    const suffix = normalized.match(/\d+$/)?.[0]
    return suffix ? `dnp-${suffix}` : 'dnp'
  }

  if (/^dnp\s*exhausted$/.test(normalized)) {
    return 'dnp exhausted'
  }

  return normalized
}

export function isStatusRequiringFollowUpDate(status: string | null | undefined) {
  const normalized = normalizeLeadStatusRuleValue(status)
  return FOLLOW_UP_DETAIL_STATUSES.has(normalized) || DNP_FOLLOW_UP_STATUSES.has(normalized)
}

export function isStatusRequiringAgeSex(status: string | null | undefined) {
  const normalized = normalizeLeadStatusRuleValue(status)
  return FOLLOW_UP_DETAIL_STATUSES.has(normalized)
}

export function isStatusRequiringModeOfPayment(status: string | null | undefined) {
  const normalized = normalizeLeadStatusRuleValue(status)
  return FOLLOW_UP_DETAIL_STATUSES.has(normalized)
}
