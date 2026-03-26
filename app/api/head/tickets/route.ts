import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { TicketStatus } from '@/generated/prisma/client'

const HEAD_ROLES = ['HR_HEAD', 'FINANCE_HEAD', 'SALES_HEAD', 'INSURANCE_HEAD', 'PL_HEAD', 'OUTSTANDING_HEAD', 'DIGITAL_MARKETING_HEAD', 'IT_HEAD', 'ADMIN']

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()

    if (!HEAD_ROLES.includes(user.role)) {
      return errorResponse('Forbidden', 403)
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as TicketStatus | null

    const where =
      user.role === 'FINANCE_HEAD'
        ? {
            targetHeadRole: { in: ['FINANCE_HEAD', 'ADMIN'] },
            ...(status ? { status } : {}),
          }
        : {
            targetHeadRole: user.role,
            ...(status ? { status } : {}),
          }

    const tickets = await prisma.supportTicket.findMany({
      where,
      include: {
        employee: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
            department: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    })

    const ticketsWithSLA = tickets.map((ticket) => {
      const createdAt = new Date(ticket.createdAt)
      const deadline = new Date(createdAt.getTime() + 48 * 60 * 60 * 1000)
      const now = new Date()
      const hoursRemaining = Math.max(0, (deadline.getTime() - now.getTime()) / (1000 * 60 * 60))
      const isOverdue = now > deadline && ticket.status === 'OPEN'

      return {
        ...ticket,
        deadline,
        hoursRemaining: Math.round(hoursRemaining),
        isOverdue,
      }
    })

    return successResponse(ticketsWithSLA)
  } catch (error) {
    console.error('Error fetching head tickets:', error)
    return errorResponse('Failed to fetch tickets', 500)
  }
}
