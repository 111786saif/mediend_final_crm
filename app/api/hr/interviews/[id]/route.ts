import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { MeetType } from '@/generated/prisma/client'
import { meetWithRelationsInclude } from '@/lib/meets'
import { canUserCreateMeet } from '@/lib/permissions'
import { getMeetInviteableUserIds } from '@/lib/hierarchy'
import { format } from 'date-fns'
import { z } from 'zod'
import { interviewCreateSchema, interviewTitleFromBody } from '@/lib/hr-interview-request'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()

    if (!hasPermission(user, 'hrms:recruitment:write')) {
      return errorResponse('Forbidden', 403)
    }

    if (!(await canUserCreateMeet(user))) {
      return errorResponse('You do not have permission to update meets', 403)
    }

    const { id } = await context.params

    const existing = await prisma.meet.findFirst({
      where: { id, module: 'INTERVIEW' },
      include: { participants: { select: { userId: true } } },
    })

    if (!existing) {
      return errorResponse('Interview not found', 404)
    }

    const body = await request.json()
    const data = interviewCreateSchema.parse(body)

    if (data.type === 'OFFLINE' && !data.location?.trim()) {
      return errorResponse('Location is required for walk-in / offline interviews', 400)
    }

    const participantUserIds = [...new Set(data.participantUserIds)].filter((pid) => pid !== user.id)

    const inviteable = await getMeetInviteableUserIds(user)
    for (const pid of participantUserIds) {
      if (!inviteable.has(pid)) {
        return errorResponse('Invalid participant', 400)
      }
    }

    const title = interviewTitleFromBody(data)
    const prevIds = new Set(existing.participants.map((p) => p.userId))
    const nextIds = new Set(participantUserIds)
    const added = participantUserIds.filter((pid) => !prevIds.has(pid))

    const meet = await prisma.$transaction(async (tx) => {
      const toRemove = [...prevIds].filter((pid) => !nextIds.has(pid))
      const toAdd = [...nextIds].filter((pid) => !prevIds.has(pid))

      if (toRemove.length > 0) {
        await tx.meetParticipant.deleteMany({
          where: { meetId: id, userId: { in: toRemove } },
        })
      }

      for (const userId of toAdd) {
        await tx.meetParticipant.create({
          data: { meetId: id, userId },
        })
      }

      return tx.meet.update({
        where: { id },
        data: {
          title,
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
          interviewRound: data.interviewRound,
          candidateName: data.candidateName.trim(),
          candidateRole: data.candidateRole.trim(),
          candidatePhone: data.candidatePhone.trim(),
          departmentId: data.departmentId?.trim() || null,
          notes: data.notes?.trim() || null,
          resumeUrl: data.resumeUrl?.trim() || null,
          isRecorded: data.isRecorded,
        },
        include: meetWithRelationsInclude,
      })
    })

    if (added.length > 0) {
      const when = format(data.scheduledAt, 'MMM d, yyyy h:mm a')
      await prisma.notification.createMany({
        data: added.map((uid) => ({
          userId: uid,
          type: 'MEET_SCHEDULED',
          title: 'Added to interview panel',
          message: `${user.name} added you to "${title}" — ${when}`,
          link: '/meets',
          relatedId: meet.id,
        })),
      })
    }

    return successResponse(meet, 'Interview updated')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.errors[0]?.message || 'Invalid input', 400)
    }
    console.error('Error updating interview:', error)
    return errorResponse('Failed to update interview', 500)
  }
}
