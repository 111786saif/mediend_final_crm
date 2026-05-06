'use client'

import { Badge } from '@/components/ui/badge'
import { getLeadAgeInfo } from '@/lib/pipeline-lead-buckets'

export function LeadAgeBadge({ lead }: { lead: { leadEntryDate?: string | Date | null; createdDate?: string | Date | null } }) {
  const { label, className } = getLeadAgeInfo(lead)
  return (
    <Badge variant="secondary" className={`text-[11px] font-medium ${className}`}>
      {label}
    </Badge>
  )
}
