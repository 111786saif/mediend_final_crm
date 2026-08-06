'use client'

import React, { useMemo, useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'

import { useLeads, LeadFilters, Lead } from '@/hooks/use-leads'
import { KanbanColumn } from './kanban-column'
import { LeadCard } from './lead-card'
import { normalizeLeadStatus } from '@/lib/pipeline-lead-buckets'

// All available statuses
export const ALL_LEAD_STATUSES = [
  'New Lead',
  'Hot Lead',
  'Follow-up 1',
  'Follow-up 2',
  'Follow-up 3',
  'Call Back (SD)',
  'Call Back (T)',
  'OPD Done',
  'OPD Schedule',
  'IPD Schedule',
  'IPD Done',
  'IPD Lost',
  'Fund Issues',
  'DNP-1',
  'DNP-2',
  'DNP-3',
  'DNP-4',
  'DNP-5',
  'DNP Exhausted',
  'Call Done',
  'Closed',
  'Out of Station',
  'Out of Station follow-up',
  'Supply Gap',
  'SX Not Suggested',
  'Language Barrier',
  'Junk',
  'Duplicate lead',
  'Not Interested',
  'Nurture',
  'Nuture 1',
  'Nuture 2',
  'Nuture 3',
  'Nuture 4',
  'Nuture 5',
  'Interested',
  'Follow-up 4',
  'Follow-up 5',
  'Follow-up',
  'Call Back Next Week',
  'Call Back Next Month',
  'Converted',
  'Lost',
  'DNP',
  'DNP (1-5, Exhausted)',
  'Churned',
  'Invalid Number',
  'C/W Done',
  'WA Done',
  'Scan Done',
  'Order Booked',
  'Policy Booked',
  'Policy Issued',
  'Already Insured',
] as const

// Status buckets for kanban view (grouped visually)
export const STATUS_BUCKETS = [
  {
    id: 'new-hot',
    name: 'New & Hot',
    statuses: ['New Lead', 'Hot Lead', 'Interested', 'Nurture', 'Nuture 1', 'Nuture 2', 'Nuture 3', 'Nuture 4', 'Nuture 5'],
    color: 'bg-red-50 border-red-200',
  },
  {
    id: 'follow-ups',
    name: 'Follow-ups',
    statuses: [
      'Follow-up 1',
      'Follow-up 2',
      'Follow-up 3',
      'Follow-up 4',
      'Follow-up 5',
      'Follow-up',
      'Call Back (SD)',
      'Call Back (T)',
      'Call Back Next Week',
      'Call Back Next Month',
      'Out of Station',
      'Out of Station follow-up',
      'Supply Gap',
      'OPD Schedule',
      'OPD Done',
      'IPD Schedule',
    ],
    color: 'bg-blue-50 border-blue-200',
  },
  {
    id: 'completed',
    name: 'Completed',
    statuses: ['IPD Done', 'Closed', 'Call Done', 'C/W Done', 'WA Done', 'Scan Done', 'Converted', 'Order Booked', 'Policy Booked', 'Policy Issued'],
    color: 'bg-green-50 border-green-200',
  },
  {
    id: 'lost-inactive',
    name: 'Lost/Inactive',
    statuses: [
      'Lost',
      'IPD Lost',
      'Fund Issues',
      'DNP',
      'DNP-1',
      'DNP-2',
      'DNP-3',
      'DNP-4',
      'DNP-5',
      'DNP Exhausted',
      'DNP (1-5, Exhausted)',
      'SX Not Suggested',
      'Language Barrier',
      'Junk',
      'Duplicate lead',
      'Not Interested',
      'Churned',
      'Invalid Number',
      'Already Insured',
    ],
    color: 'bg-gray-50 border-gray-200',
  },
] as const

interface KanbanBoardProps {
  filters?: LeadFilters
  showBDColumn?: boolean
  onLeadClick?: (lead: Lead) => void
}

export function KanbanBoard({ filters = {}, showBDColumn = false, onLeadClick }: KanbanBoardProps) {
  const { leads, updateLead } = useLeads(filters)
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  // Group leads by bucket
  const leadsByBucket = useMemo(() => {
    const grouped: Record<string, Lead[]> = {}
    
    STATUS_BUCKETS.forEach((bucket) => {
      grouped[bucket.id] = []
    })

    // Also track unknown statuses
    grouped['other'] = []

    leads.forEach((lead) => {
      // Normalize status to handle variations like "New Lead" -> "New"
      const normalizedStatus = normalizeLeadStatus(lead.status)
      let found = false
      
      // Find which bucket this status belongs to
      for (const bucket of STATUS_BUCKETS) {
        if ((bucket.statuses as readonly string[]).includes(normalizedStatus)) {
          grouped[bucket.id].push(lead)
          found = true
          break
        }
      }
      
      if (!found) {
        grouped['other'].push(lead)
      }
    })

    return grouped
  }, [leads])

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const leadId = active.id as string
    const targetBucketId = over.id as string

    // If dropped on another lead card, find that lead's bucket
    if (targetBucketId.startsWith('lead-')) {
      const targetLeadId = targetBucketId.replace('lead-', '')
      const targetLead = leads.find((l) => l.id === targetLeadId)
      if (targetLead && targetLead.status) {
        // Find which bucket this status belongs to
        for (const bucket of STATUS_BUCKETS) {
          if ((bucket.statuses as readonly string[]).includes(targetLead.status)) {
            const currentLead = leads.find((l) => l.id === leadId)
            if (currentLead && currentLead.status !== targetLead.status) {
              updateLead({ id: leadId, data: { status: targetLead.status } })
            }
            return
          }
        }
      }
      return
    }

    // Find the target bucket
    const targetBucket = STATUS_BUCKETS.find((b) => b.id === targetBucketId)
    if (!targetBucket) return

    const currentLead = leads.find((l) => l.id === leadId)
    if (!currentLead) return

    // If dropped on a bucket, use the first status of that bucket
    // Or keep current status if it's already in that bucket
    const currentStatus = currentLead.status || ''
    const isAlreadyInBucket = (targetBucket.statuses as readonly string[]).includes(currentStatus)
    
    if (!isAlreadyInBucket) {
      // Move to first status of the target bucket
      const newStatus = targetBucket.statuses[0]
      updateLead({ id: leadId, data: { status: newStatus } })
    }
  }

  const activeLead = useMemo(() => {
    if (!activeId) return null
    return leads.find((lead) => lead.id === activeId)
  }, [activeId, leads])

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STATUS_BUCKETS.map((bucket) => {
          const bucketLeads = leadsByBucket[bucket.id] || []

          // Count by status within bucket
          const statusCounts: Record<string, number> = {}
          bucket.statuses.forEach((status) => {
            statusCounts[status] = bucketLeads.filter((l) => l.status === status).length
          })

          return (
            <KanbanColumn
              key={bucket.id}
              status={bucket.name}
              bucketId={bucket.id}
              leads={bucketLeads}
              onLeadClick={onLeadClick}
              showBD={showBDColumn}
              statusCounts={statusCounts}
              bucketStatuses={[...bucket.statuses]}
            />
          )
        })}
        {leadsByBucket['other'] && leadsByBucket['other'].length > 0 && (
          <KanbanColumn
            status="Other"
            bucketId="other"
            leads={leadsByBucket['other']}
            onLeadClick={onLeadClick}
            showBD={showBDColumn}
            statusCounts={{}}
            bucketStatuses={[]}
          />
        )}
      </div>

      <DragOverlay>
        {activeLead ? (
          <div className="opacity-90">
            <LeadCard lead={activeLead} showBD={showBDColumn} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
