import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { logCrmActivity } from '@/lib/crm-activity'

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    const body = await request.json()
    const { leadId, phone, content } = body as { leadId?: string; phone?: string; content?: string }

    const trimmedContent = typeof content === 'string' ? content.trim() : ''
    if (!trimmedContent) {
      return errorResponse('Remark content is required', 400)
    }

    if (leadId) {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { id: true, leadRef: true, patientName: true },
      })

      if (lead) {
        const remark = await prisma.leadRemarkEntry.create({
          data: {
            leadId: lead.id,
            content: `[Call Remark] ${trimmedContent}`,
            createdById: user.id,
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
          summary: `Added a call remark for ${lead.leadRef} · ${lead.patientName}`,
          metadata: {
            leadId: lead.id,
            remarkId: remark.id,
            content: remark.content,
          },
        })

        return successResponse(remark, 'Call remark saved to lead')
      }
    }

    await logCrmActivity({
      action: 'CRM_TELEPHONY_CALL_REMARK_ADDED',
      entityType: 'TELEPHONY_CALL',
      entityId: phone || 'unknown',
      entityLabel: `Call Remark: ${phone || 'Unknown'}`,
      actorUserId: user.id,
      actorRole: user.role,
      request,
      summary: `Logged call remark for phone ${phone || 'Unknown'}`,
      metadata: {
        phone,
        content: trimmedContent,
      },
    })

    return successResponse({ logged: true }, 'Call remark saved')
  } catch (error) {
    console.error('POST /api/telephony/remarks error:', error)
    return errorResponse('Failed to save call remark', 500)
  }
}
