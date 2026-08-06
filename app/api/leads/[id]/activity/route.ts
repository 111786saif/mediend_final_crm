import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { canUserViewLeadOwner } from '@/lib/lead-ownership'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

const LEAD_ACTIVITY_ENTITY_TYPES = ['CRM_LEAD', 'CRM_LEAD_REMARK', 'CRM_LEAD_QR'] as const

type ActivityActor = {
  id: string
  name: string | null
  email: string | null
}

type ActivityLogItem = {
  id: string
  action: string
  summary: string
  actorRole: string | null
  createdAt: Date
  ipAddress?: string | null
  userAgent?: string | null
  metadata?: unknown
  actorUser: ActivityActor | null
}

function isLeadCreatedActivity(log: Pick<ActivityLogItem, 'action' | 'summary'>) {
  const action = log.action.trim().toUpperCase()
  const summary = log.summary.trim().toLowerCase()

  if (summary === 'lead created') {
    return true
  }

  return action.includes('LEAD') && action.includes('CREATED')
}

function getActivitySortPriority(log: Pick<ActivityLogItem, 'action' | 'summary'>) {
  if (isLeadCreatedActivity(log)) {
    return 1
  }

  return 0
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (user.role !== 'SUPER_ADMIN' && !hasPermission(user, 'leads:read')) {
      return errorResponse('Forbidden', 403)
    }

    const { id } = await params
    const lead = await prisma.lead.findUnique({
      where: { id },
      select: {
        id: true,
        bdId: true,
        leadRef: true,
        patientName: true,
        createdDate: true,
        assignedDate: true,
        bd: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    })

    if (!lead) {
      return errorResponse('Lead not found', 404)
    }

    if (!(await canUserViewLeadOwner(user, lead.bdId))) {
      return errorResponse('Forbidden', 403)
    }

    const [crmLogs, callNotes] = await Promise.all([
      prisma.crmActivityLog.findMany({
        where: {
          entityId: lead.id,
          entityType: {
            in: [...LEAD_ACTIVITY_ENTITY_TYPES],
          },
        },
        include: {
          actorUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      prisma.callNote.findMany({
        where: { leadId: lead.id },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ])

    const logs: ActivityLogItem[] = crmLogs.map((log) => ({
      id: log.id,
      action: log.action,
      summary: log.summary,
      actorRole: log.actorRole,
      createdAt: log.createdAt,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      metadata: log.metadata,
      actorUser: log.actorUser,
    }))

    const hasCreatedLog = crmLogs.some((log) => log.action.toUpperCase().includes('CREATED'))
    const hasAssignmentLog = crmLogs.some((log) => log.action.toUpperCase().includes('ASSIGN'))

    if (lead.createdDate && !hasCreatedLog) {
      logs.push({
        id: `lead-created-${lead.id}`,
        action: 'CRM_LEAD_CREATED',
        summary: 'Lead created',
        actorRole: lead.createdBy.role,
        createdAt: lead.createdDate,
        ipAddress: null,
        userAgent: null,
        metadata: null,
        actorUser: {
          id: lead.createdBy.id,
          name: lead.createdBy.name,
          email: lead.createdBy.email,
        },
      })
    }

    if (lead.assignedDate && lead.bd && !hasAssignmentLog) {
      logs.push({
        id: `lead-assigned-${lead.id}`,
        action: 'CRM_LEAD_ASSIGNED',
        summary: `Lead assigned to ${lead.bd.name}`,
        actorRole: null,
        createdAt: lead.assignedDate,
        ipAddress: null,
        userAgent: null,
        metadata: null,
        actorUser: null,
      })
    }

    logs.push(
      ...callNotes.map((note) => ({
        id: `call-note-${note.id}`,
        action: 'CRM_LEAD_CALL_NOTE_ADDED',
        summary: 'Logged call with patient',
        actorRole: note.createdBy.role,
        createdAt: note.createdAt,
        ipAddress: null,
        userAgent: null,
        metadata: null,
        actorUser: {
          id: note.createdBy.id,
          name: note.createdBy.name,
          email: note.createdBy.email,
        },
      }))
    )

    logs.sort((a, b) => {
      const createdAtDelta = b.createdAt.getTime() - a.createdAt.getTime()
      if (createdAtDelta !== 0) {
        return createdAtDelta
      }

      const priorityDelta = getActivitySortPriority(a) - getActivitySortPriority(b)
      if (priorityDelta !== 0) {
        return priorityDelta
      }

      return a.summary.localeCompare(b.summary)
    })

    const timeline = logs.slice(0, 30)

    return successResponse({
      lead: {
        id: lead.id,
        leadRef: lead.leadRef,
        patientName: lead.patientName,
      },
      logs: timeline,
    })
  } catch (error) {
    console.error('GET /api/leads/[id]/activity', error)
    return errorResponse('Failed to fetch lead activity logs', 500)
  }
}
