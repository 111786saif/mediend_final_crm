import type { UserRole } from '@/generated/prisma/client'
import { canRoleViewLeadExecutiveHistory } from '@/lib/lead-ownership'

type LeadFollowUpVisibilityLead = {
  removeFollowUpDate?: boolean | null
  assignedDate?: Date | string | null
  followUpDateClearedAt?: Date | string | null
  updatedDate?: Date | string | null
  createdDate?: Date | string | null
  followUpDate?: Date | string | null
}

function parseDateValue(value: Date | string | null | undefined) {
  if (!value) return null

  const parsed = value instanceof Date ? value : new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function getLeadFollowUpDateVisibilityCutoff(lead: LeadFollowUpVisibilityLead) {
  const clearedAt = parseDateValue(lead.followUpDateClearedAt)
  if (clearedAt) return clearedAt

  if (!lead.removeFollowUpDate) return null
  return parseDateValue(lead.assignedDate)
}

export function isLeadFollowUpDateVisible(
  lead: LeadFollowUpVisibilityLead,
  viewerRole?: UserRole | string | null
) {
  if (canRoleViewLeadExecutiveHistory(viewerRole)) {
    return true
  }

  const cutoff = getLeadFollowUpDateVisibilityCutoff(lead)
  if (!cutoff) return true

  if (!lead.followUpDate) return false

  const updatedDate = parseDateValue(lead.updatedDate)
  if (!updatedDate) return false

  return updatedDate.getTime() > cutoff.getTime()
}

export function getVisibleLeadFollowUpDate<T extends Date | string | null | undefined>(
  lead: LeadFollowUpVisibilityLead,
  viewerRole?: UserRole | string | null
): T | null {
  if (!lead.followUpDate) return null
  if (!isLeadFollowUpDateVisible(lead, viewerRole)) return null
  return lead.followUpDate as T
}
