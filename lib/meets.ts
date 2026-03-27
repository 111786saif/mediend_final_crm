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
