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

    const { id: leadId } = await params

    await prisma.chatReadReceipt.upsert({
      where: { leadId_userId: { leadId, userId: user.id } },
      update: { lastReadAt: new Date() },
      create: { leadId, userId: user.id, lastReadAt: new Date() },
    })

    return successResponse({ ok: true })
  } catch (error) {
    console.error('Error marking chat as read:', error)
    return errorResponse('Failed to mark as read', 500)
  }
}
