import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { canAccessLead } from '@/lib/rbac'
import { getLeadAccessSubordinateIds } from '@/lib/lead-access-api'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { isSubtreeScopedSalesRole } from '@/lib/sales-hierarchy-roles'
import { Prisma } from '@/generated/prisma/client'
import { maskPhoneNumber } from '@/lib/phone-utils'

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    // Build where clause based on role
    const where: Prisma.LeadWhereInput = {}

    // Role-based filtering
    if (user.role === 'BD') {
      where.bdId = user.id
    } else if (isSubtreeScopedSalesRole(user.role)) {
      const accessBdIds = (await getLeadAccessSubordinateIds(user)) ?? []
      where.bdId = { in: [user.id, ...accessBdIds] }
    }
    // Insurance users see leads with KYP submissions
    if (user.role === 'INSURANCE_HEAD') {
      where.kypSubmission = { isNot: null }
    }
    // PL users see leads in PL pipeline stage
    if (user.role === 'PL_HEAD') {
      where.pipelineStage = 'PL'
    }
    // Outstanding users see leads with OUTSTANDING case stage
    if (user.role === 'OUTSTANDING_HEAD') {
      where.caseStage = 'OUTSTANDING'
    }

    // Find leads with chat activity, ordered by most recent message
    const latestPerLead = await prisma.caseChatMessage.groupBy({
      by: ['leadId'],
      _max: { createdAt: true },
      orderBy: { _max: { createdAt: 'desc' } },
      take: 200,
    })
    const candidateLeadIds = latestPerLead.map((r) => r.leadId)

    if (candidateLeadIds.length === 0) {
      return successResponse([])
    }

    where.id = { in: candidateLeadIds }

    // Get leads with their latest chat message (access-filtered)
    const leadsRaw = await prisma.lead.findMany({
      where,
      include: {
        bd: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        kypSubmission: {
          select: {
            id: true,
            status: true,
          },
        },
        caseChatMessages: {
          take: 1,
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            sender: {
              select: {
                id: true,
                name: true,
                role: true,
              },
            },
          },
        },
        _count: {
          select: {
            caseChatMessages: true,
          },
        },
      },
    })

    // Preserve groupBy ordering (latest message first), cap to 100
    const orderIndex = new Map(candidateLeadIds.map((id, i) => [id, i]))
    const leads = leadsRaw
      .sort((a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0))
      .slice(0, 100)

    // Batch-fetch read receipts for the current user
    const leadIds = leads.map((l) => l.id)
    const readReceipts = leadIds.length > 0
      ? await prisma.chatReadReceipt.findMany({
          where: { userId: user.id, leadId: { in: leadIds } },
          select: { leadId: true, lastReadAt: true },
        })
      : []
    const readReceiptMap = new Map(readReceipts.map((r) => [r.leadId, r.lastReadAt]))

    // Filter leads based on access control and get unread counts
    const subordinateIds = await getLeadAccessSubordinateIds(user)
    const conversations = await Promise.all(
      leads
        .filter((lead) => canAccessLead(user, lead.bdId, subordinateIds))
        .map(async (lead) => {
          // Count messages from others that arrived after the user's last read
          const lastRead = readReceiptMap.get(lead.id)
          const unreadWhere: Prisma.CaseChatMessageWhereInput = {
            leadId: lead.id,
            senderId: { not: user.id },
            ...(lastRead ? { createdAt: { gt: lastRead } } : {}),
          }
          const unreadCount = await prisma.caseChatMessage.count({ where: unreadWhere })

          const latestMessage = lead.caseChatMessages[0] || null

          // Mask phone number if user is not INSURANCE_HEAD or ADMIN
          const canViewPhone = user.role === 'ADMIN'
          return {
            leadId: lead.id,
            leadRef: lead.leadRef,
            patientName: lead.patientName,
            phoneNumber: canViewPhone ? lead.phoneNumber : (lead.phoneNumber ? maskPhoneNumber(lead.phoneNumber) : null),
            circle: lead.circle,
            caseStage: lead.caseStage,
            createdDate: lead.createdDate,
            bd: lead.bd ? { id: lead.bd.id, name: lead.bd.name } : null,
            latestMessage: latestMessage
              ? {
                  id: latestMessage.id,
                  content: latestMessage.content,
                  type: latestMessage.type,
                  createdAt: latestMessage.createdAt,
                  sender: latestMessage.sender
                    ? {
                        id: latestMessage.sender.id,
                        name: latestMessage.sender.name,
                        role: latestMessage.sender.role,
                      }
                    : null,
                }
              : null,
            unreadCount,
            totalMessages: lead._count.caseChatMessages,
            updatedAt: lead.updatedDate,
          }
        })
    )

    // Sort by latest message time or updated date
    conversations.sort((a, b) => {
      const aTime = a.latestMessage?.createdAt || a.updatedAt
      const bTime = b.latestMessage?.createdAt || b.updatedAt
      return bTime.getTime() - aTime.getTime()
    })

    return successResponse(conversations)
  } catch (error) {
    console.error('Error fetching chat conversations:', error)
    return errorResponse('Failed to fetch conversations', 500)
  }
}

