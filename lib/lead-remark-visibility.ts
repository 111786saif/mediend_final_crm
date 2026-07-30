type LeadRemarkVisibilityLead = {
  removeRemarks?: boolean | null
  assignedDate?: Date | string | null
  remarksClearedAt?: Date | string | null
  updatedDate?: Date | string | null
  createdDate?: Date | string | null
}

type LeadRemarkLike = {
  createdAt?: Date | string | null
}

function parseDateValue(value: Date | string | null | undefined) {
  if (!value) return null

  const parsed = value instanceof Date ? value : new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function normalizeLeadRemarkContent(value: string | null | undefined) {
  return typeof value === 'string' ? value.replace(/\x00/g, '').trim() : ''
}

export function getLeadRemarkVisibilityCutoff(lead: LeadRemarkVisibilityLead) {
  const clearedAt = parseDateValue(lead.remarksClearedAt)
  if (clearedAt) return clearedAt

  if (!lead.removeRemarks) return null
  return parseDateValue(lead.assignedDate)
}

export function isLeadRemarkVisible(
  lead: LeadRemarkVisibilityLead,
  remarkDate: Date | string | null | undefined
) {
  const cutoff = getLeadRemarkVisibilityCutoff(lead)
  if (!cutoff) return true

  const parsedRemarkDate = parseDateValue(remarkDate)
  if (!parsedRemarkDate) return false

  return parsedRemarkDate.getTime() > cutoff.getTime()
}

export function getVisibleLatestLeadRemark<T extends LeadRemarkLike>(
  lead: LeadRemarkVisibilityLead,
  remarks: readonly T[] | null | undefined
) {
  for (const remark of remarks ?? []) {
    if (isLeadRemarkVisible(lead, remark.createdAt)) {
      return remark
    }
  }

  return null
}

export function getVisibleLeadRemarksFallbackContent(
  lead: LeadRemarkVisibilityLead,
  remarks: string | null | undefined
) {
  const normalized = normalizeLeadRemarkContent(remarks)
  if (!normalized) return null

  const fallbackDate = parseDateValue(lead.updatedDate) ?? parseDateValue(lead.createdDate)
  return isLeadRemarkVisible(lead, fallbackDate) ? normalized : null
}
