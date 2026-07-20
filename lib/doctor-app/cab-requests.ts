import { AppointmentStatus, Prisma } from '@/generated/prisma/client'
import { DoctorAppSessionUser } from '@/lib/doctor-app/auth'
import { getDoctorAppContext, parseOptionalDate } from '@/lib/doctor-app/context'
import { prisma } from '@/lib/prisma'

export class DoctorAppCabError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'DoctorAppCabError'
    this.status = status
  }
}

export interface CreateDoctorCabRequestInput {
  pickup: string
  drop: string
  pickupLat?: number | null
  pickupLng?: number | null
  dropLat?: number | null
  dropLng?: number | null
  scheduledFor: string
}

function mapCabStatus(status: AppointmentStatus) {
  return status.toLowerCase()
}

function mapCab(cab: Prisma.DoctorCabRequestGetPayload<{
  include: {
    doctor: { select: { id: true; name: true } }
    reviewedBy: { select: { id: true; name: true; email: true } }
    assignedVendorBy: { select: { id: true; name: true; email: true } }
  }
}>) {
  return {
    id: cab.id,
    doctor: cab.doctor,
    pickup: cab.pickup,
    drop: cab.drop,
    pickupLat: cab.pickupLat,
    pickupLng: cab.pickupLng,
    dropLat: cab.dropLat,
    dropLng: cab.dropLng,
    scheduledFor: cab.scheduledFor,
    status: mapCabStatus(cab.status),
    reviewNotes: cab.reviewNotes,
    reviewedBy: cab.reviewedBy,
    reviewedAt: cab.reviewedAt,
    vendorName: cab.vendorName,
    vendorPhone: cab.vendorPhone,
    assignedVendorBy: cab.assignedVendorBy,
    assignedVendorAt: cab.assignedVendorAt,
    createdAt: cab.createdAt,
    updatedAt: cab.updatedAt,
  }
}

export async function createDoctorCabRequest(
  user: DoctorAppSessionUser,
  input: CreateDoctorCabRequestInput
) {
  const context = await getDoctorAppContext(user)
  const scheduledFor = parseOptionalDate(input.scheduledFor, 'scheduledFor')

  if (!scheduledFor) {
    throw new DoctorAppCabError('scheduledFor is required', 400)
  }

  const cab = await prisma.doctorCabRequest.create({
    data: {
      doctorId: context.doctorId,
      pickup: input.pickup.trim(),
      drop: input.drop.trim(),
      pickupLat: input.pickupLat ?? null,
      pickupLng: input.pickupLng ?? null,
      dropLat: input.dropLat ?? null,
      dropLng: input.dropLng ?? null,
      scheduledFor,
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
      assignedVendorBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })

  return mapCab(cab)
}

export async function listDoctorCabRequests(
  user: DoctorAppSessionUser,
  page: number,
  limit: number,
  status?: string
) {
  const context = await getDoctorAppContext(user)
  const normalizedStatus = status?.trim().toUpperCase()

  const where: Prisma.DoctorCabRequestWhereInput = {
    doctorId: context.doctorId,
    ...(normalizedStatus &&
    ['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'].includes(normalizedStatus)
      ? { status: normalizedStatus as AppointmentStatus }
      : {}),
  }

  const [items, total] = await Promise.all([
    prisma.doctorCabRequest.findMany({
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
        assignedVendorBy: {
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
    prisma.doctorCabRequest.count({ where }),
  ])

  return {
    items: items.map(mapCab),
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
  }
}

export async function getDoctorCabRequestById(user: DoctorAppSessionUser, id: string) {
  const context = await getDoctorAppContext(user)
  const cab = await prisma.doctorCabRequest.findFirst({
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
      assignedVendorBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })

  if (!cab) {
    throw new DoctorAppCabError('Cab request not found', 404)
  }

  return mapCab(cab)
}
