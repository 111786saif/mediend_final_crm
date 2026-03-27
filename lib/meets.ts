import { Prisma } from '@/generated/prisma/client'

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
