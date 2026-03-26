import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { z } from 'zod'

const HEAD_ROLES = ['HR_HEAD', 'FINANCE_HEAD', 'SALES_HEAD', 'INSURANCE_HEAD', 'PL_HEAD', 'OUTSTANDING_HEAD', 'DIGITAL_MARKETING_HEAD', 'IT_HEAD', 'ADMIN'] as const

const createTicketSchema = z.object({
  targetHeadRole: z.enum(HEAD_ROLES),
  subject: z.string().min(5, 'Subject must be at least 5 characters'),
  description: z.string().min(20, 'Description must be at least 20 characters'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
})

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    const employee = await prisma.employee.findUnique({
      where: { userId: user.id },
      include: { user: { select: { name: true } } },
    })

    if (!employee) {
      return errorResponse('Employee record not found', 404)
    }

    const body = await request.json()
    const { targetHeadRole, subject, description, priority } = createTicketSchema.parse(body)

    const ticket = await prisma.supportTicket.create({
      data: {
        employeeId: employee.id,
        targetHeadRole,
        subject,
        description,
        priority,
      },
      include: {
        department: {
          select: {
            name: true,
          },
        },
      },
    })

    // Notify all users with the target head role
    const headUsers = await prisma.user.findMany({
      where: { role: targetHeadRole },
      select: { id: true },
    })
    const empName = employee.user?.name ?? user.name ?? 'An employee'
    if (headUsers.length > 0) {
      await prisma.notification.createMany({
        data: headUsers.map((h) => ({
          userId: h.id,
          type: 'TICKET_CREATED',
          title: 'New Support Ticket',
          message: `${empName}: ${subject}`,
          link: '/employee/dashboard/support-services',
          relatedId: ticket.id,
        })),
      })
    }

    return successResponse(ticket, 'Ticket raised successfully')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.errors[0].message, 400)
    }
    console.error('Error creating ticket:', error)
    return errorResponse('Failed to create ticket', 500)
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    const employee = await prisma.employee.findUnique({
      where: { userId: user.id },
    })

    if (!employee) {
      return errorResponse('Employee record not found', 404)
    }

    const tickets = await prisma.supportTicket.findMany({
      where: { employeeId: employee.id },
      include: {
        department: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return successResponse(tickets)
  } catch (error) {
    console.error('Error fetching tickets:', error)
    return errorResponse('Failed to fetch tickets', 500)
  }
}

