import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { canUserEditLeadRemarks, canUserViewLeadOwner } from '@/lib/lead-ownership'

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

    return successResponse({
      lead: {
        id: lead.id,
        leadRef: lead.leadRef,
        patientName: lead.patientName,
      },
      canEditRemarks: await canUserEditLeadRemarks(user, lead.bdId),
      latestRemark: lead.leadRemarkEntries[0] ?? null,
      remarks: lead.leadRemarkEntries,
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
      },
    })

    if (!lead) {
      return errorResponse('Lead not found', 404)
    }

    if (!(await canUserViewLeadOwner(user, lead.bdId))) {
      return errorResponse('Forbidden', 403)
    }

    if (!(await canUserEditLeadRemarks(user, lead.bdId))) {
      return errorResponse('You do not have permission to add remarks for this lead', 403)
    }

    const body = await request.json()
    const content = typeof body?.content === 'string' ? body.content.trim() : ''

    if (!content) {
      return errorResponse('Remark content is required', 400)
    }

    if (content.length > 4000) {
      return errorResponse('Remark must be 4000 characters or less', 400)
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

    return successResponse(remark, 'Remark added')
  } catch (error) {
    console.error('POST /api/leads/[id]/remarks', error)
    return errorResponse('Failed to create lead remark', 500)
  }
}
