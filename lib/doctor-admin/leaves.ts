import { LeaveRequestStatus, Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'

export class DoctorAdminLeaveError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'DoctorAdminLeaveError'
    this.status = status
  }
}

type LeaveWithRelations = Prisma.DoctorLeaveRequestGetPayload<{
  include: {
    doctor: {
      select: {
        id: true
        name: true
        category: true
      }
    }
    reviewedBy: {
      select: {
        id: true
        name: true
        email: true
      }
    }
  }
}>

export interface DoctorAdminLeaveFilters {
  page: number
  limit: number
  status?: string
  doctorId?: string
}

export interface CreateDoctorAdminLeaveInput {
  doctorId: string
  startDate: string
  endDate: string
  reason?: string | null
}

export interface ReviewDoctorAdminLeaveInput {
  status: string
  reviewNotes?: string | null
}

function parseDateInput(value: string, fieldName: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    throw new DoctorAdminLeaveError(`${fieldName} is required`, 400)
  }

  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T00:00:00`)
    : new Date(trimmed)

  if (Number.isNaN(parsed.getTime())) {
    throw new DoctorAdminLeaveError(`${fieldName} must be a valid date`, 400)
  }

  return parsed
}

function mapLeaveStatus(status: LeaveRequestStatus) {
  return status.toLowerCase()
}

function mapLeave(item: LeaveWithRelations) {
  return {
    id: item.id,
    doctor: item.doctor,
    startDate: item.startDate,
    endDate: item.endDate,
    reason: item.reason,
    status: mapLeaveStatus(item.status),
    reviewedBy: item.reviewedBy,
    reviewedAt: item.reviewedAt,
    reviewNotes: item.reviewNotes,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

function normalizeRequestedLeaveStatus(status?: string) {
  const normalized = status?.trim().toUpperCase()
  if (!normalized) return undefined
  if (!['PENDING', 'APPROVED', 'REJECTED'].includes(normalized)) {
    throw new DoctorAdminLeaveError('Invalid leave status', 400)
  }
  return normalized as LeaveRequestStatus
}

export async function listDoctorAdminLeaves(filters: DoctorAdminLeaveFilters) {
  const where: Prisma.DoctorLeaveRequestWhereInput = {
    ...(filters.doctorId ? { doctorId: filters.doctorId } : {}),
    ...(filters.status ? { status: normalizeRequestedLeaveStatus(filters.status) } : {}),
  }

  const [items, total] = await Promise.all([
    prisma.doctorLeaveRequest.findMany({
      where,
      include: {
        doctor: {
          select: {
            id: true,
            name: true,
            category: true,
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
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.doctorLeaveRequest.count({ where }),
  ])

  return {
    items: items.map(mapLeave),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      pages: Math.max(1, Math.ceil(total / filters.limit)),
    },
  }
}

export async function createDoctorAdminLeave(input: CreateDoctorAdminLeaveInput) {
  const doctorId = input.doctorId.trim()
  if (!doctorId) {
    throw new DoctorAdminLeaveError('doctorId is required', 400)
  }

  const [doctor, startDate, endDate] = await Promise.all([
    prisma.doctorMaster.findUnique({
      where: { id: doctorId },
      select: { id: true, isActive: true },
    }),
    Promise.resolve(parseDateInput(input.startDate, 'startDate')),
    Promise.resolve(parseDateInput(input.endDate, 'endDate')),
  ])

  if (!doctor || !doctor.isActive) {
    throw new DoctorAdminLeaveError('Doctor not found', 404)
  }

  if (endDate.getTime() < startDate.getTime()) {
    throw new DoctorAdminLeaveError('endDate must be on or after startDate', 400)
  }

  const created = await prisma.doctorLeaveRequest.create({
    data: {
      doctorId,
      startDate,
      endDate,
      reason: input.reason?.trim() || null,
    },
    include: {
      doctor: {
        select: {
          id: true,
          name: true,
          category: true,
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

  return mapLeave(created)
}

export async function reviewDoctorAdminLeave(
  id: string,
  actorUserId: string,
  input: ReviewDoctorAdminLeaveInput
) {
  const status = normalizeRequestedLeaveStatus(input.status)
  if (!status || status === LeaveRequestStatus.PENDING) {
    throw new DoctorAdminLeaveError('Leave review status must be approved or rejected', 400)
  }

  try {
    const updated = await prisma.doctorLeaveRequest.update({
      where: { id },
      data: {
        status,
        reviewNotes: input.reviewNotes?.trim() || null,
        reviewedById: actorUserId,
        reviewedAt: new Date(),
      },
      include: {
        doctor: {
          select: {
            id: true,
            name: true,
            category: true,
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

    return mapLeave(updated)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw new DoctorAdminLeaveError('Leave request not found', 404)
    }
    throw error
  }
}
