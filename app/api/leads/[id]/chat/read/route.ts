import { leadIdSchema } from '@/lib/lead-id'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

/**
 * POST /api/leads/[id]/chat/read
 * Marks the chat as read for the current user by upserting a ChatReadReceipt.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()

    const { id: rawLeadId } = await params
    const parsedLeadId = leadIdSchema.safeParse(rawLeadId)
    if (!parsedLeadId.success) return errorResponse('Invalid lead ID', 400)
    const leadId = parsedLeadId.data

    await Promise.all([
      prisma.chatReadReceipt.upsert({
        where: { leadId_userId: { leadId, userId: user.id } },
        update: { lastReadAt: new Date() },
        create: { leadId, userId: user.id, lastReadAt: new Date() },
      }),
      prisma.notification.updateMany({
        where: {
          userId: user.id,
          type: 'CASE_CHAT_MESSAGE',
          relatedId: String(leadId),
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      }),
    ])

    return successResponse({ ok: true })
  } catch (error) {
    console.error('Error marking chat as read:', error)
    return errorResponse('Failed to mark as read', 500)
  }
}
