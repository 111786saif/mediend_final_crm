import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { z } from 'zod'
import { AppointmentStatus, MeetType } from '@/generated/prisma/client'
import { format } from 'date-fns'
import { meetWithRelationsInclude } from '@/lib/meets'

const updateAppointmentSchema = z
  .object({
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED']),
    remarks: z.string().optional().nullable(),
    scheduledAt: z
      .string()
      .optional()
      .transform((s) => (s ? new Date(s) : undefined)),
    type: z.enum(['VIRTUAL', 'OFFLINE']).optional(),
    meetLink: z.string().url().optional().nullable().or(z.literal('')),
    location: z.string().max(500).optional().nullable().or(z.literal('')),
  })
  .superRefine((data, ctx) => {
    if (data.status === 'APPROVED' && !data.scheduledAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'scheduledAt is required when approving',
        path: ['scheduledAt'],
      })
    }
  })

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (user.role !== 'MD' && user.role !== 'ADMIN') {
      return errorResponse('Forbidden', 403)
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as AppointmentStatus | null

    const where = status ? { status } : {}

    const appointments = await prisma.mDAppointment.findMany({
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
        meet: {
          include: meetWithRelationsInclude,
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return successResponse(appointments)
  } catch (error) {
    console.error('Error fetching appointments:', error)
    return errorResponse('Failed to fetch appointments', 500)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (user.role !== 'MD' && user.role !== 'ADMIN') {
      return errorResponse('Forbidden', 403)
    }

    const { searchParams } = new URL(request.url)
    const appointmentId = searchParams.get('id')

    if (!appointmentId) {
      return errorResponse('Appointment ID required', 400)
    }

    const body = await request.json()
    const data = updateAppointmentSchema.parse(body)

    const existing = await prisma.mDAppointment.findUnique({
      where: { id: appointmentId },
      include: {
        employee: { include: { user: { select: { id: true, name: true, email: true } } } },
        meet: true,
      },
    })

    if (!existing) {
      return errorResponse('Appointment not found', 404)
    }

    if (data.status === 'APPROVED') {
      if (existing.status !== 'PENDING') {
        return errorResponse('Only pending requests can be approved', 400)
      }
      if (existing.meet) {
        return errorResponse('This appointment already has a scheduled meet', 400)
      }
      if (!data.scheduledAt) {
        return errorResponse('scheduledAt is required when approving', 400)
      }

      const meetType = (data.type ?? 'OFFLINE') as MeetType
      const location =
        meetType === 'OFFLINE'
          ? (data.location?.trim() || "MD's Office")
          : null
      const meetLink =
        meetType === 'VIRTUAL' && data.meetLink?.trim()
          ? data.meetLink.trim()
          : null

      const empUserId = existing.employee.user.id

      const result = await prisma.$transaction(async (tx) => {
        const meet = await tx.meet.create({
          data: {
            title: existing.reason,
            type: meetType,
            meetLink,
            location,
            scheduledAt: data.scheduledAt!,
            module: 'MD_APPOINTMENT',
            mdAppointmentId: existing.id,
            createdById: user.id,
            participants: {
              create: [{ userId: empUserId }],
            },
          },
          include: meetWithRelationsInclude,
        })

        const appointment = await tx.mDAppointment.update({
          where: { id: appointmentId },
          data: {
            status: 'APPROVED',
            remarks: data.remarks?.trim() || undefined,
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
                department: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            meet: {
              include: meetWithRelationsInclude,
            },
          },
        })

        return { meet, appointment }
      })

      const when = format(data.scheduledAt!, 'MMM d, yyyy h:mm a')
      await prisma.notification.create({
        data: {
          userId: empUserId,
          type: 'MEET_SCHEDULED',
          title: 'MD appointment confirmed',
          message: `Your meeting with MD is scheduled: ${existing.reason.slice(0, 80)}${existing.reason.length > 80 ? '…' : ''} — ${when}`,
          link: '/meets',
          relatedId: result.meet.id,
        },
      })

      return successResponse(result.appointment, 'Appointment approved and meet scheduled')
    }

    const appointment = await prisma.mDAppointment.update({
      where: { id: appointmentId },
      data: {
        status: data.status,
        remarks: data.remarks?.trim() || undefined,
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
            department: {
              select: {
                name: true,
              },
            },
          },
        },
        meet: {
          include: meetWithRelationsInclude,
        },
      },
    })

    return successResponse(appointment, 'Appointment updated successfully')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.errors[0]?.message || 'Invalid request', 400)
    }
    console.error('Error updating appointment:', error)
    return errorResponse('Failed to update appointment', 500)
  }
}
