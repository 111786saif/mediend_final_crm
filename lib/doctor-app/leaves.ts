import { LeaveRequestStatus, Prisma } from '@/generated/prisma/client'
import { DoctorAppSessionUser } from '@/lib/doctor-app/auth'
import { getDoctorAppContext, parseOptionalDate } from '@/lib/doctor-app/context'
import { prisma } from '@/lib/prisma'

export class DoctorAppLeaveError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'DoctorAppLeaveError'
    this.status = status
  }
}

export interface CreateDoctorLeaveInput {
  startDate: string
  endDate: string
  reason?: string | null
}

function mapLeaveStatus(status: LeaveRequestStatus) {
  return status.toLowerCase()
}

function mapLeave(leave: Prisma.DoctorLeaveRequestGetPayload<{
  include: {
    doctor: { select: { id: true; name: true } }
    reviewedBy: { select: { id: true; name: true; email: true } }
  }
}>) {
  return {
    id: leave.id,
    doctor: leave.doctor,
    startDate: leave.startDate,
    endDate: leave.endDate,
    reason: leave.reason,
    status: mapLeaveStatus(leave.status),
    reviewedBy: leave.reviewedBy,
    reviewedAt: leave.reviewedAt,
    reviewNotes: leave.reviewNotes,
    createdAt: leave.createdAt,
    updatedAt: leave.updatedAt,
  }
}

export async function createDoctorLeaveRequest(
  user: DoctorAppSessionUser,
  input: CreateDoctorLeaveInput
) {
  const context = await getDoctorAppContext(user)
  const startDate = parseOptionalDate(input.startDate, 'startDate')
  const endDate = parseOptionalDate(input.endDate, 'endDate')

  if (!startDate || !endDate) {
    throw new DoctorAppLeaveError('startDate and endDate are required', 400)
  }

  if (endDate.getTime() < startDate.getTime()) {
    throw new DoctorAppLeaveError('endDate must be on or after startDate', 400)
  }

  const leave = await prisma.doctorLeaveRequest.create({
    data: {
      doctorId: context.doctorId,
      startDate,
      endDate,
      reason: input.reason?.trim() || null,
    },
    include: {
      doctor: {
        select: {
          id: true,
          name: true,
        },
      },
      reviewedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })

  return mapLeave(leave)
}

export async function listDoctorLeaveRequests(
  user: DoctorAppSessionUser,
  page: number,
  limit: number,
  status?: string
) {
  const context = await getDoctorAppContext(user)
  const normalizedStatus = status?.trim().toUpperCase()

  const where: Prisma.DoctorLeaveRequestWhereInput = {
    doctorId: context.doctorId,
    ...(normalizedStatus &&
    ['PENDING', 'APPROVED', 'REJECTED'].includes(normalizedStatus)
      ? { status: normalizedStatus as LeaveRequestStatus }
      : {}),
  }

  const [items, total] = await Promise.all([
    prisma.doctorLeaveRequest.findMany({
      where,
      include: {
        doctor: {
          select: {
            id: true,
            name: true,
          },
        },
        reviewedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.doctorLeaveRequest.count({ where }),
  ])

  return {
    items: items.map(mapLeave),
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
  }
}

export async function getDoctorLeaveRequestById(user: DoctorAppSessionUser, id: string) {
  const context = await getDoctorAppContext(user)
  const leave = await prisma.doctorLeaveRequest.findFirst({
    where: {
      id,
      doctorId: context.doctorId,
    },
    include: {
      doctor: {
        select: {
          id: true,
          name: true,
        },
      },
      reviewedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })

  if (!leave) {
    throw new DoctorAppLeaveError('Leave request not found', 404)
  }

  return mapLeave(leave)
}
