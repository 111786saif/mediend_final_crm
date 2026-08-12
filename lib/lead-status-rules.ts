export function normalizeLeadStatusRuleValue(status: string | null | undefined) {
  const normalized = String(status ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')

  if (normalized === 'hot lead' || /^follow[\s-]*up(\s*\d+)?$/.test(normalized)) {
    return 'follow-up'
  }

  if (normalized === 'out of station follow up' || normalized === 'out of station follow-up') {
    return 'out of station follow up'
  }

  if (normalized === 'out of station') {
    return 'out of station'
  }

  if (normalized === 'dnp exhausted') {
    return 'dnp exhausted'
  }

  if (/^dnp/.test(normalized)) {
    return 'dnp'
  }

  if (normalized.startsWith('call back') || normalized.startsWith('callback')) {
    return 'call back'
  }

  if (normalized.startsWith('nurture') || normalized.startsWith('nuture')) {
    return 'nurture'
  }

  return normalized
}

export function isStatusRequiringFollowUpDate(status: string | null | undefined) {
  const normalized = normalizeLeadStatusRuleValue(status)
  return (
    normalized === 'follow-up' ||
    normalized === 'out of station follow up' ||
    normalized === 'dnp' ||
    normalized === 'call back' ||
    normalized === 'nurture'
  )
}

export function isStatusRequiringAgeSex(status: string | null | undefined) {
  const normalized = normalizeLeadStatusRuleValue(status)
  return normalized === 'follow-up' || normalized === 'out of station follow up'
}

export function isStatusRequiringCity(status: string | null | undefined) {
  const normalized = normalizeLeadStatusRuleValue(status)
  return (
    normalized === 'follow-up' ||
    normalized === 'out of station' ||
    normalized === 'out of station follow up'
  )
}

export function isStatusRequiringModeOfPayment(status: string | null | undefined) {
  const normalized = normalizeLeadStatusRuleValue(status)
  return normalized === 'follow-up' || normalized === 'out of station follow up'
}

export function isStatusRequiringRemark(status: string | null | undefined) {
  return true
}
