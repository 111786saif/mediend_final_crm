import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { logCrmActivity } from '@/lib/crm-activity'
import { canUserRemoveLeadRemarks, canUserViewLeadOwner } from '@/lib/lead-ownership'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; remarkId: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (user.role !== 'SUPER_ADMIN' && !hasPermission(user, 'leads:write')) {
      return errorResponse('Forbidden', 403)
    }

    const { id, remarkId } = await params
    const [lead, remark] = await Promise.all([
      prisma.lead.findUnique({
        where: { id },
        select: {
          id: true,
          bdId: true,
          leadRef: true,
          patientName: true,
        },
      }),
      prisma.leadRemarkEntry.findUnique({
        where: { id: remarkId },
        select: {
          id: true,
          leadId: true,
          content: true,
          createdAt: true,
          createdById: true,
        },
      }),
    ])

    if (!lead) {
      return errorResponse('Lead not found', 404)
    }

    if (!remark || remark.leadId !== lead.id) {
      return errorResponse('Lead remark not found', 404)
    }

    if (!(await canUserViewLeadOwner(user, lead.bdId))) {
      return errorResponse('Forbidden', 403)
    }

    if (!(await canUserRemoveLeadRemarks(user, lead.bdId))) {
      return errorResponse('You do not have permission to remove remarks for this lead', 403)
    }

    await prisma.leadRemarkEntry.delete({
      where: { id: remark.id },
    })

    await logCrmActivity({
      action: 'CRM_LEAD_REMARK_REMOVED',
      entityType: 'CRM_LEAD_REMARK',
      entityId: lead.id,
      entityLabel: `${lead.leadRef} · ${lead.patientName}`,
      actorUserId: user.id,
      actorRole: user.role,
      request,
      summary: `Removed a lead remark for ${lead.leadRef} · ${lead.patientName}`,
      metadata: {
        leadId: lead.id,
        leadRef: lead.leadRef,
        patientName: lead.patientName,
        remarkId: remark.id,
        remarkContent: remark.content,
        remarkCreatedAt: remark.createdAt,
        remarkCreatedById: remark.createdById,
      },
    })

    return successResponse({ id: remark.id }, 'Remark removed')
  } catch (error) {
    console.error('DELETE /api/leads/[id]/remarks/[remarkId]', error)
    return errorResponse('Failed to remove lead remark', 500)
  }
}
