'use client'

import { useSortable } from '@dnd-kit/sortable'
import { Lead } from '@/hooks/use-leads'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Building2, User } from 'lucide-react'
import { getStatusColor } from '@/lib/lead-status-colors'
import { normalizeLeadStatus } from '@/lib/pipeline-lead-buckets'

interface LeadCardProps {
  lead: Lead
  onClick?: () => void
  showBD?: boolean
}

export function LeadCard({ lead, onClick, showBD = false }: LeadCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id })

  const normalizedStatus = normalizeLeadStatus(lead.status)
  const statusColor = getStatusColor(normalizedStatus)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    borderLeftColor: statusColor.borderColor,
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="mb-2 cursor-pointer border-l-4 transition-shadow hover:shadow-md"
    >
      <CardContent className="p-4">
        <div className="space-y-2">
          <div className="flex items-start justify-between">
            <h4 className="font-semibold text-sm">{lead.patientName}</h4>
            <Badge variant="outline" className="text-xs">
              {lead.leadRef}
            </Badge>
          </div>

          <div>
            <Badge
              variant="secondary"
              className="border text-xs"
              style={{
                backgroundColor: statusColor.backgroundColor,
                borderColor: statusColor.borderColor,
                color: statusColor.textColor,
              }}
            >
              {normalizedStatus}
            </Badge>
          </div>

          {showBD && lead.bd && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              <span>{lead.bd.name}</span>
            </div>
          )}

          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Building2 className="h-3 w-3" />
            <span className="truncate">{lead.hospitalName}</span>
          </div>

          <div className="text-xs font-medium">{lead.treatment}</div>
        </div>
      </CardContent>
    </Card>
  )
}
