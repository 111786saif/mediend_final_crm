import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import {
  errorResponse,
  fieldErrorResponse,
  successResponse,
  unauthorizedResponse,
  zodErrorResponse,
} from '@/lib/api-utils'
import { z } from 'zod'
import { MeetModule, MeetType } from '@/generated/prisma/client'
import { meetWithRelationsInclude, userMeetAccessWhere } from '@/lib/meets'
import { getMeetInviteableUserIds } from '@/lib/hierarchy'
import { canUserCreateMeet } from '@/lib/permissions'
import { format } from 'date-fns'

const createMeetSchema = z.object({
  title: z.string({ required_error: 'Title is required' }).min(1, 'Title is required').max(500, 'Title is too long'),
  description: z.string().max(5000, 'Agenda is too long (max 5000 chars)').optional().nullable(),
  type: z.enum(['VIRTUAL', 'OFFLINE']).default('OFFLINE'),
  meetLink: z
    .string()
    .url('Meet link must be a valid URL starting with http:// or https://')
    .optional()
    .nullable()
    .or(z.literal('')),
  location: z.string().max(500, 'Venue is too long').optional().nullable(),
  scheduledAt: z
    .string({ required_error: 'Date and time is required' })
    .transform((s) => new Date(s)),
  endTime: z.string().transform((s) => new Date(s)).optional().nullable(),
  module: z.enum(['INTERVIEW', 'MD_APPOINTMENT', 'GENERAL']).default('GENERAL'),
  participantUserIds: z.array(z.string()).default([]),
  /** Optional single external guest contact (for GENERAL meets). Stored on the same
   *  candidateName / candidatePhone columns that interviews use. */
  candidateName: z.string().max(200, 'Guest name is too long').optional().nullable(),
  candidatePhone: z
    .string()
    .regex(/^\d{10}$/, 'Guest phone must be exactly 10 digits')
    .optional()
    .nullable()
    .or(z.literal('')),
})

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()

    const { searchParams } = new URL(request.url)
    const today = searchParams.get('today') === 'true'
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')
    const moduleFilter = searchParams.get('module') as MeetModule | null

    const baseWhere = userMeetAccessWhere(user.id)

    const moduleWhere: { module?: MeetModule } = {}
    if (moduleFilter && ['INTERVIEW', 'MD_APPOINTMENT', 'GENERAL'].includes(moduleFilter)) {
      moduleWhere.module = moduleFilter
    }

    let dateWhere: { scheduledAt?: { gte?: Date; lte?: Date } } = {}
    if (today) {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
      dateWhere = { scheduledAt: { gte: start, lte: end } }
    } else if (fromParam || toParam) {
      const gte = fromParam ? new Date(fromParam) : undefined
      const lte = toParam ? new Date(toParam) : undefined
      if (gte || lte) {
        dateWhere = { scheduledAt: { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) } }
      }
    }

    const meets = await prisma.meet.findMany({
      where: {
        AND: [baseWhere, moduleWhere, dateWhere],
      },
      include: meetWithRelationsInclude,
      orderBy: { scheduledAt: 'asc' },
      take: 300,
    })

    return successResponse(meets)
  } catch (error) {
    console.error('Error fetching meets:', error)
    return errorResponse('Failed to fetch meets', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()

    if (!(await canUserCreateMeet(user))) {
      return errorResponse('Forbidden', 403)
    }

    const body = await request.json()
    const data = createMeetSchema.parse(body)

    const participantUserIds = [...new Set(data.participantUserIds)].filter((id) => id !== user.id)

    const inviteable = await getMeetInviteableUserIds(user)
    for (const pid of participantUserIds) {
      if (!inviteable.has(pid)) {
        return errorResponse('Invalid participant', 400)
      }
    }

    if (data.type === 'OFFLINE' && !data.location?.trim()) {
      return fieldErrorResponse('Venue is required for offline meets', 'location', 400)
    }

    const guestName = data.candidateName?.trim() || null
    const guestPhone = data.candidatePhone?.trim() || null
    if (guestPhone && !guestName) {
      return fieldErrorResponse('Guest name is required when a phone is provided', 'candidateName', 400)
    }

    const meet = await prisma.meet.create({
      data: {
        title: data.title.trim(),
        description: data.description?.trim() || null,
        type: data.type as MeetType,
        meetLink: data.type === 'VIRTUAL' && data.meetLink ? data.meetLink.trim() : null,
        location: data.type === 'OFFLINE' && data.location ? data.location.trim() : null,
        scheduledAt: data.scheduledAt,
        endTime: data.endTime ?? null,
        module: data.module as MeetModule,
        candidateName: guestName,
        candidatePhone: guestPhone,
        createdById: user.id,
        participants: {
          create: participantUserIds.map((userId) => ({ userId })),
        },
      },
      include: meetWithRelationsInclude,
    })

    const when = format(data.scheduledAt, 'MMM d, yyyy h:mm a')
    if (participantUserIds.length > 0) {
      await prisma.notification.createMany({
        data: participantUserIds.map((userId) => ({
          userId,
          type: 'MEET_SCHEDULED',
          title: 'New meeting scheduled',
          message: `${user.name} scheduled "${data.title.trim()}" on ${when}`,
          link: '/meets',
          relatedId: meet.id,
        })),
      })
    }

    return successResponse(meet, 'Meet created')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return zodErrorResponse(error)
    }
    console.error('Error creating meet:', error)
    return errorResponse('Failed to create meet', 500)
  }
}
