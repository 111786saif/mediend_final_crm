import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { z } from 'zod'
import { TicketStatus } from '@/generated/prisma/client'

const updateTicketSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
  response: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (!hasPermission(user, 'hrms:employees:read')) {
      return errorResponse('Forbidden', 403)
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as TicketStatus | null
    const departmentId = searchParams.get('departmentId')

    // ADMIN and MD can see all tickets; every other role only sees tickets raised to them
    const isGlobalViewer = user.role === 'ADMIN' || user.role === 'MD'

    const where: Record<string, unknown> = {}
    if (!isGlobalViewer) where.targetHeadRole = user.role
    if (status) where.status = status
    if (departmentId) where.departmentId = departmentId

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
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    })

    // Add SLA status (48 hour deadline)
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
    console.error('Error fetching tickets:', error)
    return errorResponse('Failed to fetch tickets', 500)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (!hasPermission(user, 'hrms:employees:write')) {
      return errorResponse('Forbidden', 403)
    }

    const { searchParams } = new URL(request.url)
    const ticketId = searchParams.get('id')

    if (!ticketId) {
      return errorResponse('Ticket ID required', 400)
    }

    const body = await request.json()
    const { status, response } = updateTicketSchema.parse(body)

    const existingTicket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: { employee: { select: { userId: true } } },
    })

    // Only ADMIN/MD can update any ticket; everyone else can only update tickets raised to their role
    const isGlobalEditor = user.role === 'ADMIN' || user.role === 'MD'
    if (!isGlobalEditor && existingTicket?.targetHeadRole !== user.role) {
      return errorResponse('Forbidden', 403)
    }

    const ticket = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status,
        response: response || undefined,
        respondedAt: status !== 'OPEN' ? new Date() : undefined,
      },
      include: {
        employee: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
        department: {
          select: {
            name: true,
          },
        },
      },
    })

    // Notify the employee when ticket is responded to
    if (status !== 'OPEN' && existingTicket?.employee.userId) {
      await prisma.notification.create({
        data: {
          userId: existingTicket.employee.userId,
          type: 'TICKET_RESPONDED',
          title: 'Ticket Response',
          message: `Your support ticket "${ticket.subject}" has been ${status.toLowerCase()}`,
          link: '/employee/dashboard/support-services',
          relatedId: ticketId,
        },
      })
    }

    return successResponse(ticket, 'Ticket updated successfully')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Invalid data', 400)
    }
    console.error('Error updating ticket:', error)
    return errorResponse('Failed to update ticket', 500)
  }
}

