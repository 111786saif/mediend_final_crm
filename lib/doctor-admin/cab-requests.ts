import { AppointmentStatus, Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'

export class DoctorAdminCabError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'DoctorAdminCabError'
    this.status = status
  }
}

type CabWithRelations = Prisma.DoctorCabRequestGetPayload<{
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
    assignedVendorBy: {
      select: {
        id: true
        name: true
        email: true
      }
    }
  }
}>

export interface DoctorAdminCabFilters {
  page: number
  limit: number
  status?: string
  doctorId?: string
}

export interface ReviewDoctorAdminCabInput {
  status: string
  reviewNotes?: string | null
}

export interface AssignDoctorAdminCabVendorInput {
  vendorName: string
  vendorPhone?: string | null
}

function normalizeCabStatus(status?: string) {
  const normalized = status?.trim().toUpperCase()
  if (!normalized) return undefined
  if (!['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'].includes(normalized)) {
    throw new DoctorAdminCabError('Invalid cab status', 400)
  }
  return normalized as AppointmentStatus
}

function mapCabStatus(status: AppointmentStatus) {
  return status.toLowerCase()
}

function mapCab(item: CabWithRelations) {
  return {
    id: item.id,
    doctor: item.doctor,
    pickup: item.pickup,
    drop: item.drop,
    pickupLat: item.pickupLat,
    pickupLng: item.pickupLng,
    dropLat: item.dropLat,
    dropLng: item.dropLng,
    scheduledFor: item.scheduledFor,
    status: mapCabStatus(item.status),
    reviewNotes: item.reviewNotes,
    reviewedBy: item.reviewedBy,
    reviewedAt: item.reviewedAt,
    vendorName: item.vendorName,
    vendorPhone: item.vendorPhone,
    assignedVendorBy: item.assignedVendorBy,
    assignedVendorAt: item.assignedVendorAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

export async function listDoctorAdminCabRequests(filters: DoctorAdminCabFilters) {
  const where: Prisma.DoctorCabRequestWhereInput = {
    ...(filters.doctorId ? { doctorId: filters.doctorId } : {}),
    ...(filters.status ? { status: normalizeCabStatus(filters.status) } : {}),
  }

  const [items, total] = await Promise.all([
    prisma.doctorCabRequest.findMany({
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
        assignedVendorBy: {
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
    prisma.doctorCabRequest.count({ where }),
  ])

  return {
    items: items.map(mapCab),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      pages: Math.max(1, Math.ceil(total / filters.limit)),
    },
  }
}

export async function reviewDoctorAdminCabRequest(
  id: string,
  actorUserId: string,
  input: ReviewDoctorAdminCabInput
) {
  const status = normalizeCabStatus(input.status)
  if (!status || status === AppointmentStatus.PENDING) {
    throw new DoctorAdminCabError('Cab review status must be approved, rejected, or completed', 400)
  }

  try {
    const updated = await prisma.doctorCabRequest.update({
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
        assignedVendorBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return mapCab(updated)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw new DoctorAdminCabError('Cab request not found', 404)
    }
    throw error
  }
}

export async function assignDoctorAdminCabVendor(
  id: string,
  actorUserId: string,
  input: AssignDoctorAdminCabVendorInput
) {
  const vendorName = input.vendorName.trim()
  if (!vendorName) {
    throw new DoctorAdminCabError('vendorName is required', 400)
  }

  const existing = await prisma.doctorCabRequest.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
    },
  })

  if (!existing) {
    throw new DoctorAdminCabError('Cab request not found', 404)
  }

  if (existing.status === AppointmentStatus.REJECTED) {
    throw new DoctorAdminCabError('Rejected cab requests cannot have a vendor assigned', 400)
  }

  const updated = await prisma.doctorCabRequest.update({
    where: { id },
    data: {
      vendorName,
      vendorPhone: input.vendorPhone?.trim() || null,
      assignedVendorById: actorUserId,
      assignedVendorAt: new Date(),
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
      assignedVendorBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })

  return mapCab(updated)
}
