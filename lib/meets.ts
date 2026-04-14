import { Prisma } from '@/generated/prisma/client'

/** Employee code whose linked user is always inviteable as a meet participant (org MD). */
export const MEET_MD_INVITE_EMPLOYEE_CODE = '1000'

export const meetWithRelationsInclude = {
  createdBy: { select: { id: true, name: true, email: true } },
  department: { select: { id: true, name: true } },
  participants: {
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  },
  mdAppointment: {
    select: {
      id: true,
      status: true,
      employeeId: true,
      employee: {
        select: {
          user: { select: { name: true } },
        },
      },
    },
  },
} satisfies Prisma.MeetInclude

export type MeetWithRelations = Prisma.MeetGetPayload<{
  include: typeof meetWithRelationsInclude
}>

export function userMeetAccessWhere(userId: string): Prisma.MeetWhereInput {
  return {
    OR: [{ createdById: userId }, { participants: { some: { userId } } }],
  }
}

/** Meets where the given target user is creator OR participant.
 *  Used by the team calendar so any viewer can see existence of a user's meets,
 *  with sensitive fields redacted in the route layer unless the viewer is also
 *  a participant. */
export function visibleMeetsForUserWhere(targetUserId: string): Prisma.MeetWhereInput {
  return {
    OR: [
      { createdById: targetUserId },
      { participants: { some: { userId: targetUserId } } },
    ],
  }
}

/** Redact sensitive fields from a meet unless the viewer is the target user
 *  or is among the meet's participants (which implies they already had access). */
export function redactMeetForViewer<
  T extends {
    description: string | null
    meetLink: string | null
    notes: string | null
    candidatePhone: string | null
    createdById: string
    participants?: { userId: string }[]
  }
>(meet: T, viewerId: string): T {
  const viewerIsInsider =
    meet.createdById === viewerId ||
    (meet.participants ?? []).some((p) => p.userId === viewerId)
  if (viewerIsInsider) return meet
  return {
    ...meet,
    description: null,
    meetLink: null,
    notes: null,
    candidatePhone: null,
  }
}
