import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { z } from 'zod'

const HEAD_ROLES = ['HR_HEAD', 'FINANCE_HEAD', 'SALES_HEAD', 'INSURANCE_HEAD', 'PL_HEAD', 'OUTSTANDING_HEAD', 'DIGITAL_MARKETING_HEAD', 'IT_HEAD', 'ADMIN']

const updateTicketSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
  response: z.string().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()

    if (!HEAD_ROLES.includes(user.role)) {
      return errorResponse('Forbidden', 403)
    }

    const { id: ticketId } = await params

    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        employee: { select: { userId: true } },
      },
    })

    if (!ticket) {
      return errorResponse('Ticket not found', 404)
    }

    const canRespond =
      ticket.targetHeadRole === user.role ||
      (user.role === 'FINANCE_HEAD' && ticket.targetHeadRole === 'ADMIN')
    if (!canRespond) {
      return errorResponse('You can only respond to tickets targeted at you', 403)
    }

    const body = await request.json()
    const { status, response } = updateTicketSchema.parse(body)

    const updated = await prisma.supportTicket.update({
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
      },
    })

    // Notify the employee when ticket is responded to
    if (status !== 'OPEN' && ticket.employee.userId) {
      await prisma.notification.create({
        data: {
          userId: ticket.employee.userId,
          type: 'TICKET_RESPONDED',
          title: 'Ticket Response',
          message: `Your support ticket "${ticket.subject}" has been ${status.toLowerCase()}`,
          link: '/employee/dashboard/support-services',
          relatedId: ticketId,
        },
      })
    }

    return successResponse(updated, 'Ticket updated successfully')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Invalid data', 400)
    }
    console.error('Error updating ticket:', error)
    return errorResponse('Failed to update ticket', 500)
  }
}
