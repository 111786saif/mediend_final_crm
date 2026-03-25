import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { canAccessLead } from '@/lib/rbac'
import { getTeamLeadLeadAccessBdUserIds } from '@/lib/hierarchy'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
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
    } else if (user.role === 'TEAM_LEAD') {
      const accessBdIds = await getTeamLeadLeadAccessBdUserIds(user.id, user.teamId)
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

    // Get leads with their latest chat message
    const leads = await prisma.lead.findMany({
      where,
      include: {
        bd: {
          select: {
            id: true,
            name: true,
            email: true,
            teamId: true,
            team: {
              select: {
                id: true,
              },
            },
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
      orderBy: {
        updatedDate: 'desc',
      },
      take: 100,
    })

    // Filter leads based on access control and get unread counts
    const subordinateIds =
      user.role === 'TEAM_LEAD' ? await getTeamLeadLeadAccessBdUserIds(user.id, user.teamId) : undefined
    const conversations = await Promise.all(
      leads
        .filter((lead) => canAccessLead(user, lead.bdId, lead.bd?.team?.id, subordinateIds))
        .map(async (lead) => {
          // Get unread message count (messages after user's last read or all if never read)
          // For now, we'll count all messages as potential unread
          // In production, you'd track read receipts
          const unreadCount = await prisma.caseChatMessage.count({
            where: {
              leadId: lead.id,
              senderId: { not: user.id }, // Messages not sent by current user
            },
          })

          const latestMessage = lead.caseChatMessages[0] || null

          // Mask phone number if user is not INSURANCE_HEAD or ADMIN
          const canViewPhone = user.role === 'INSURANCE_HEAD' || user.role === 'ADMIN'
          return {
            leadId: lead.id,
            leadRef: lead.leadRef,
            patientName: lead.patientName,
            phoneNumber: canViewPhone ? lead.phoneNumber : (lead.phoneNumber ? maskPhoneNumber(lead.phoneNumber) : null),
            circle: lead.circle,
            caseStage: lead.caseStage,
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
