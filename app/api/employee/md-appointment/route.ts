import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { z } from 'zod'

const appointmentSchema = z.object({
  preferredDate: z
    .string()
    .optional()
    .transform((s) => {
      if (!s?.trim()) return undefined
      const t = s.trim()
      if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return new Date(`${t}T12:00:00.000Z`)
      return new Date(t)
    }),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
})

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { preferredDate, reason } = appointmentSchema.parse(body)

    // Check if there's already a pending appointment
    const pendingAppointment = await prisma.mDAppointment.findFirst({
      where: {
        employeeId: employee.id,
        status: 'PENDING',
      },
    })

    if (pendingAppointment) {
      return errorResponse('You already have a pending appointment request', 400)
    }

    const appointment = await prisma.mDAppointment.create({
      data: {
        employeeId: employee.id,
        preferredDate: preferredDate || null,
        reason,
      },
    })

    return successResponse(appointment, 'Appointment request submitted successfully')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.errors[0].message, 400)
    }
    console.error('Error creating appointment request:', error)
    return errorResponse('Failed to submit appointment request', 500)
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

    const appointments = await prisma.mDAppointment.findMany({
      where: { employeeId: employee.id },
      orderBy: { createdAt: 'desc' },
      include: {
        meet: {
          select: {
            id: true,
            title: true,
            scheduledAt: true,
            type: true,
            meetLink: true,
            location: true,
            module: true,
          },
        },
      },
    })

    return successResponse(appointments)
  } catch (error) {
    console.error('Error fetching appointments:', error)
    return errorResponse('Failed to fetch appointments', 500)
  }
}

