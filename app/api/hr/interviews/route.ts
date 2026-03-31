import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { z } from 'zod'
import { MeetType } from '@/generated/prisma/client'
import { meetWithRelationsInclude } from '@/lib/meets'
import { canUserCreateMeet } from '@/lib/permissions'
import { getMeetInviteableUserIds } from '@/lib/hierarchy'
import { format } from 'date-fns'
import { interviewCreateSchema, interviewTitleFromBody } from '@/lib/hr-interview-request'

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()

    if (!hasPermission(user, 'hrms:recruitment:read')) {
      return errorResponse('Forbidden', 403)
    }

    const { searchParams } = new URL(request.url)
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')
    const departmentId = searchParams.get('departmentId')

    const where: {
      module: 'INTERVIEW'
      departmentId?: string
      scheduledAt?: { gte?: Date; lte?: Date }
    } = { module: 'INTERVIEW' }

    if (departmentId) {
      where.departmentId = departmentId
    }
    if (fromParam || toParam) {
      where.scheduledAt = {
        ...(fromParam ? { gte: new Date(fromParam) } : {}),
        ...(toParam ? { lte: new Date(toParam) } : {}),
      }
    }

    const interviews = await prisma.meet.findMany({
      where,
      include: meetWithRelationsInclude,
      orderBy: { scheduledAt: 'desc' },
      take: 500,
    })

    return successResponse(interviews)
  } catch (error) {
    console.error('Error listing interviews:', error)
    return errorResponse('Failed to list interviews', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()

    if (!hasPermission(user, 'hrms:recruitment:write')) {
      return errorResponse('Forbidden', 403)
    }

    if (!(await canUserCreateMeet(user))) {
      return errorResponse('You do not have permission to create meets', 403)
    }

    const body = await request.json()
    const data = interviewCreateSchema.parse(body)

    if (data.type === 'OFFLINE' && !data.location?.trim()) {
      return errorResponse('Location is required for walk-in / offline interviews', 400)
    }

    const participantUserIds = [...new Set(data.participantUserIds)].filter((id) => id !== user.id)

    const inviteable = await getMeetInviteableUserIds(user)
    for (const pid of participantUserIds) {
      if (!inviteable.has(pid)) {
        return errorResponse('Invalid participant', 400)
      }
    }

    const title = interviewTitleFromBody(data)

    const meet = await prisma.meet.create({
      data: {
        title,
        description: null,
        type: data.type as MeetType,
        meetLink:
          data.type === 'VIRTUAL' && data.meetLink?.trim()
            ? data.meetLink.trim()
            : null,
        location:
          data.type === 'OFFLINE' && data.location?.trim()
            ? data.location.trim()
            : null,
        scheduledAt: data.scheduledAt,
        endTime: data.endTime ?? null,
        module: 'INTERVIEW',
        interviewRound: data.interviewRound,
        candidateName: data.candidateName.trim(),
        candidateRole: data.candidateRole.trim(),
        candidatePhone: data.candidatePhone.trim(),
        departmentId: data.departmentId?.trim() || null,
        notes: data.notes?.trim() || null,
        resumeUrl: data.resumeUrl?.trim() || null,
        isRecorded: data.isRecorded,
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
        data: participantUserIds.map((uid) => ({
          userId: uid,
          type: 'MEET_SCHEDULED',
          title: 'Interview scheduled',
          message: `${user.name} scheduled ${title} on ${when}`,
          link: '/meets',
          relatedId: meet.id,
        })),
      })
    }

    return successResponse(meet, data.isRecorded ? 'Interview recorded' : 'Interview scheduled')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.errors[0]?.message || 'Invalid input', 400)
    }
    console.error('Error creating interview:', error)
    return errorResponse('Failed to create interview', 500)
  }
}
