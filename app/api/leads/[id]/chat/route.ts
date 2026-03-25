import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { canAccessLead } from '@/lib/rbac'
import { getTeamLeadLeadAccessBdUserIds } from '@/lib/hierarchy'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { z } from 'zod'
import { ChatMessageType } from '@/generated/prisma/client'

const sendMessageSchema = z.object({
  type: z.enum([ChatMessageType.TEXT, ChatMessageType.FILE]),
  content: z.string().min(1).max(10000),
  fileUrl: z.string().url().optional(),
  fileName: z.string().max(500).optional(),
}).refine(
  (data) => data.type !== ChatMessageType.FILE || (data.fileUrl && data.fileName),
  { message: 'File messages require fileUrl and fileName', path: ['fileUrl'] }
)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()

    const { id: leadId } = await params
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, bdId: true, bd: { select: { teamId: true } } },
    })
    if (!lead) return errorResponse('Lead not found', 404)
    const subordinateIds =
      user.role === 'TEAM_LEAD' ? await getTeamLeadLeadAccessBdUserIds(user.id, user.teamId) : undefined
    if (!canAccessLead(user, lead.bdId, lead.bd?.teamId, subordinateIds))
      return errorResponse('Forbidden', 403)

    const { searchParams } = new URL(request.url)
    const cursor = searchParams.get('cursor')
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 100)

    const messages = await prisma.caseChatMessage.findMany({
      where: { leadId },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: { id: true, name: true, role: true } },
      },
    })

    const nextCursor = messages.length > limit ? messages[limit - 1]?.id : null
    const list = messages.slice(0, limit).reverse()

    return successResponse({
      messages: list,
      nextCursor,
    })
  } catch (e) {
    console.error(e)
    return errorResponse('Failed to fetch messages', 500)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()

    const { id: leadId } = await params
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, bdId: true, bd: { select: { teamId: true } } },
    })
    if (!lead) return errorResponse('Lead not found', 404)
    const subordinateIds =
      user.role === 'TEAM_LEAD' ? await getTeamLeadLeadAccessBdUserIds(user.id, user.teamId) : undefined
    if (!canAccessLead(user, lead.bdId, lead.bd?.teamId, subordinateIds))
      return errorResponse('Forbidden', 403)

    const body = await request.json()
    const data = sendMessageSchema.parse(body)

    const type = data.type as ChatMessageType
    const message = await prisma.caseChatMessage.create({
      data: {
        leadId,
        senderId: user.id,
        type,
        content: data.content,
        fileUrl: data.fileUrl ?? null,
        fileName: data.fileName ?? null,
      },
      include: {
        sender: { select: { id: true, name: true, role: true } },
      },
    })

    // Create notifications for the other party
    // If BD sent message, notify Insurance users
    // If Insurance sent message, notify BD
    const leadWithBD = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { bdId: true, patientName: true, leadRef: true },
    })

    if (leadWithBD) {
      const notificationUsers: string[] = []
      
      if (user.role === 'BD' || user.role === 'TEAM_LEAD') {
        // BD sent message, notify Insurance users
        const insuranceUsers = await prisma.user.findMany({
          where: {
            role: { in: ['INSURANCE_HEAD'] },
          },
          select: { id: true },
        })
        notificationUsers.push(...insuranceUsers.map(u => u.id))
      } else if (user.role === 'INSURANCE_HEAD') {
        // Insurance sent message, notify BD
        if (leadWithBD.bdId && leadWithBD.bdId !== user.id) {
          notificationUsers.push(leadWithBD.bdId)
        }
      }

      // Create notifications
      if (notificationUsers.length > 0) {
        await prisma.notification.createMany({
          data: notificationUsers.map((userId) => ({
            userId,
            type: 'CASE_CHAT_MESSAGE',
            title: 'New Chat Message',
            message: `${user.name} sent a message in ${leadWithBD.patientName} (${leadWithBD.leadRef})`,
            link: `/chat/${leadId}`,
            relatedId: leadId,
          })),
        })
      }
    }

    return successResponse(message)
  } catch (e) {
    if (e instanceof z.ZodError) {
      return errorResponse(e.errors.map((x) => x.message).join(', '), 400)
    }
    console.error(e)
    return errorResponse('Failed to send message', 500)
  }
}
