import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { logCrmActivity } from '@/lib/crm-activity'
import {
  getVisibleLeadRemarksFallbackContent,
  isLeadRemarkVisible,
  normalizeLeadRemarkContent,
} from '@/lib/lead-remark-visibility'
import {
  canUserAddLeadRemarks,
  canUserRemoveLeadRemarks,
  canUserViewLeadOwner,
} from '@/lib/lead-ownership'

type MergedLeadRemark = {
  id: string
  content: string
  createdAt: Date
  createdBy: {
    id: string
    name: string | null
  }
  source: 'workspace' | 'legacy' | 'lead'
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
        remarks: true,
        removeRemarks: true,
        remarksClearedAt: true,
        assignedDate: true,
        createdDate: true,
        updatedDate: true,
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
        updatedBy: {
          select: {
            id: true,
            name: true,
          },
        },
        leadRemarkEntries: {
          orderBy: { createdAt: 'desc' },
          include: {
            createdBy: {
              select: {
                id: true,
                name: true,
              },
            },
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

    const legacyRemarks = await prisma.leadRemark.findMany({
      where: {
        leadRef: lead.leadRef,
      },
      orderBy: { updateDate: 'desc' },
    })

    const [canAddRemarks, canRemoveRemarks] = await Promise.all([
      canUserAddLeadRemarks(user, lead.bdId),
      canUserRemoveLeadRemarks(user, lead.bdId),
    ])

    const legacyUpdateByIds = Array.from(
      new Set(
        legacyRemarks
          .map((remark) => remark.updateBy)
          .filter((value): value is number => typeof value === 'number')
      )
    )

    const legacyUsers = legacyUpdateByIds.length
      ? await prisma.employee.findMany({
          where: {
            bdNumber: {
              in: legacyUpdateByIds,
            },
          },
          select: {
            bdNumber: true,
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        })
      : []

    const legacyUserMap = new Map(
      legacyUsers
        .filter((employee): employee is typeof employee & { bdNumber: number } => employee.bdNumber != null)
        .map((employee) => [employee.bdNumber, employee.user] as const)
    )

    const mergedRemarks: MergedLeadRemark[] = [
      ...lead.leadRemarkEntries
        .map((remark) => {
          const content = normalizeLeadRemarkContent(remark.content)
          if (!content || !isLeadRemarkVisible(lead, remark.createdAt, user.role)) return null

          return {
            id: remark.id,
            content,
            createdAt: remark.createdAt,
            createdBy: {
              id: remark.createdBy.id,
              name: remark.createdBy.name,
            },
            source: 'workspace' as const,
          }
        })
        .filter((remark): remark is MergedLeadRemark => remark !== null),
      ...legacyRemarks
        .map((remark) => {
          const content = normalizeLeadRemarkContent(remark.remarks)
          if (!content || !isLeadRemarkVisible(lead, remark.updateDate, user.role)) return null

          const mappedUser = remark.updateBy != null ? legacyUserMap.get(remark.updateBy) : null

          return {
            id: `legacy-${remark.id}`,
            content,
            createdAt: remark.updateDate,
            createdBy: {
              id: mappedUser?.id ?? `legacy-user-${remark.updateBy ?? 'unknown'}`,
              name: mappedUser?.name ?? 'Unknown user',
            },
            source: 'legacy' as const,
          }
        })
        .filter((remark): remark is MergedLeadRemark => remark !== null),
    ]

    const normalizedExistingContents = new Set(
      mergedRemarks.map((remark) => normalizeLeadRemarkContent(remark.content))
    )
    const leadRemarksFallback = getVisibleLeadRemarksFallbackContent(lead, lead.remarks, user.role)

    if (leadRemarksFallback && !normalizedExistingContents.has(leadRemarksFallback)) {
      const fallbackAuthor = lead.updatedBy ?? lead.createdBy
      mergedRemarks.push({
        id: `lead-remarks-${lead.id}`,
        content: leadRemarksFallback,
        createdAt: lead.updatedDate ?? lead.createdDate,
        createdBy: {
          id: fallbackAuthor?.id ?? 'lead-remarks-legacy',
          name: fallbackAuthor?.name ?? 'Unknown user',
        },
        source: 'lead',
      })
    }

    mergedRemarks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

    return successResponse({
      lead: {
        id: lead.id,
        leadRef: lead.leadRef,
        patientName: lead.patientName,
      },
      canEditRemarks: canAddRemarks,
      canAddRemarks,
      canRemoveRemarks,
      latestRemark: mergedRemarks[0] ?? null,
      remarks: mergedRemarks,
    })
  } catch (error) {
    console.error('GET /api/leads/[id]/remarks', error)
    return errorResponse('Failed to fetch lead remarks', 500)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (user.role !== 'SUPER_ADMIN' && !hasPermission(user, 'leads:write')) {
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
      },
    })

    if (!lead) {
      return errorResponse('Lead not found', 404)
    }

    if (!(await canUserViewLeadOwner(user, lead.bdId))) {
      return errorResponse('Forbidden', 403)
    }

    if (!(await canUserAddLeadRemarks(user, lead.bdId))) {
      return errorResponse('You do not have permission to add remarks for this lead', 403)
    }

    const body = await request.json()
    const content = typeof body?.content === 'string' ? body.content.trim() : ''

    if (!content) {
      return errorResponse('Remark content is required', 400)
    }

    const remark = await prisma.leadRemarkEntry.create({
      data: {
        leadId: lead.id,
        content,
        createdById: user.id,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    await logCrmActivity({
      action: 'CRM_LEAD_REMARK_ADDED',
      entityType: 'CRM_LEAD_REMARK',
      entityId: lead.id,
      entityLabel: `${lead.leadRef} · ${lead.patientName}`,
      actorUserId: user.id,
      actorRole: user.role,
      request,
      summary: `Added a lead remark for ${lead.leadRef} · ${lead.patientName}`,
      metadata: {
        leadId: lead.id,
        leadRef: lead.leadRef,
        patientName: lead.patientName,
        remarkId: remark.id,
        remarkContent: remark.content,
      },
    })

    return successResponse(remark, 'Remark added')
  } catch (error) {
    console.error('POST /api/leads/[id]/remarks', error)
    return errorResponse('Failed to create lead remark', 500)
  }
}
