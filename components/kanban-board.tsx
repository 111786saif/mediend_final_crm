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
  'Follow-up',
  'Call Back Next Week',
  'Call Back Next Month',
  'Invalid Number',
  'Order Booked',
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
    statuses: ['IPD Done', 'Closed', 'Order Booked'],
    color: 'bg-green-50 border-green-200',
  },
  {
    id: 'lost-inactive',
    name: 'Lost/Inactive',
    statuses: [
      'IPD Lost',
      'Fund Issues',
      'DNP-1',
      'DNP-2',
      'DNP-3',
      'DNP-4',
      'DNP-5',
      'DNP Exhausted',
      'SX Not Suggested',
      'Language Barrier',
      'Junk',
      'Duplicate lead',
      'Not Interested',
      'Invalid Number',
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
        distance: 8, // 8px drag before activation
      },
    })
  )

  // Group leads by bucket
  const bucketedLeads = useMemo(() => {
    const map = new Map<string, Lead[]>()
    STATUS_BUCKETS.forEach((b) => map.set(b.id, []))

    leads.forEach((lead) => {
      const normalized = normalizeLeadStatus(lead.status)
      const bucket = STATUS_BUCKETS.find((b) =>
        b.statuses.some((s) => s.toLowerCase() === normalized.toLowerCase())
      )
      if (bucket) {
        map.get(bucket.id)?.push(lead)
      } else {
        // Fallback: put unmapped into first bucket
        map.get(STATUS_BUCKETS[0].id)?.push(lead)
      }
    })

    return map
  }, [leads])

  const activeLead = useMemo(() => {
    if (!activeId) return null
    return leads.find((l) => l.id === activeId) || null
  }, [activeId, leads])

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const leadId = String(active.id)
    const targetBucketId = String(over.id)

    const targetBucket = STATUS_BUCKETS.find((b) => b.id === targetBucketId)
    if (!targetBucket) return

    // Pick first status in target bucket as the default target status
    const newStatus = targetBucket.statuses[0]

    const lead = leads.find((l) => l.id === leadId)
    if (!lead || lead.status === newStatus) return

    try {
      await updateLead(leadId, { status: newStatus })
    } catch {
      // Revert handle handled by react query
    }
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {STATUS_BUCKETS.map((bucket) => {
          const columnLeads = bucketedLeads.get(bucket.id) || []
          return (
            <KanbanColumn
              key={bucket.id}
              id={bucket.id}
              name={bucket.name}
              color={bucket.color}
              count={columnLeads.length}
            >
              {columnLeads.map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  showBD={showBDColumn}
                  onClick={() => onLeadClick?.(lead)}
                />
              ))}
            </KanbanColumn>
          )
        })}
      </div>

      <DragOverlay>
        {activeLead ? (
          <div className="rotate-2 opacity-80">
            <LeadCard lead={activeLead} showBD={showBDColumn} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
