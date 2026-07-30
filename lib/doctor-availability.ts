import { LeaveRequestStatus } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'

type DoctorAvailabilityDb = Pick<typeof prisma, 'doctorMaster' | 'doctorLeaveRequest'>

export class DoctorAvailabilityError extends Error {
  status: number

  constructor(message: string, status: number = 400) {
    super(message)
    this.name = 'DoctorAvailabilityError'
    this.status = status
  }
}

export function normalizeDoctorName(value: string | null | undefined) {
  const trimmed = value?.trim() || ''
  return trimmed || null
}

export function parseDoctorAvailabilityDate(
  value: Date | string | null | undefined,
  fieldName: string = 'Date'
) {
  if (value === undefined || value === null) return null

  const parsed =
    value instanceof Date
      ? new Date(value)
      : /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
        ? new Date(`${value.trim()}T00:00:00`)
        : new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    throw new DoctorAvailabilityError(`${fieldName} must be a valid date`, 400)
  }

  return parsed
}

function getDayRange(date: Date) {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)

  const end = new Date(date)
  end.setHours(23, 59, 59, 999)

  return { start, end }
}

async function findDoctorByName(db: DoctorAvailabilityDb, doctorName: string) {
  return db.doctorMaster.findFirst({
    where: {
      name: {
        equals: doctorName,
        mode: 'insensitive',
      },
    },
    select: {
      id: true,
      name: true,
      isActive: true,
    },
  })
}

export async function listDoctorIdsOnApprovedLeaveForDate(
  db: DoctorAvailabilityDb,
  date: Date | string | null | undefined
) {
  const parsedDate = parseDoctorAvailabilityDate(date, 'availabilityDate')
  if (!parsedDate) return []

  const { start, end } = getDayRange(parsedDate)
  const leaveRows = await db.doctorLeaveRequest.findMany({
    where: {
      status: LeaveRequestStatus.APPROVED,
      startDate: { lte: end },
      endDate: { gte: start },
    },
    select: {
      doctorId: true,
    },
    distinct: ['doctorId'],
  })

  return leaveRows.map((row) => row.doctorId)
}

export async function isDoctorOnApprovedLeaveForDate(
  db: DoctorAvailabilityDb,
  doctorName: string | null | undefined,
  date: Date | string | null | undefined
) {
  const normalizedDoctorName = normalizeDoctorName(doctorName)
  const parsedDate = parseDoctorAvailabilityDate(date, 'Doctor assignment date')

  if (!normalizedDoctorName || !parsedDate) {
    return false
  }

  const doctor = await findDoctorByName(db, normalizedDoctorName)
  if (!doctor) {
    return false
  }

  const { start, end } = getDayRange(parsedDate)
  const leave = await db.doctorLeaveRequest.findFirst({
    where: {
      doctorId: doctor.id,
      status: LeaveRequestStatus.APPROVED,
      startDate: { lte: end },
      endDate: { gte: start },
    },
    select: {
      id: true,
    },
  })

  return Boolean(leave)
}

export async function assertDoctorAvailableOnDate(
  db: DoctorAvailabilityDb,
  doctorName: string | null | undefined,
  date: Date | string | null | undefined,
  message: string = 'Selected doctor is on approved leave for this date.'
) {
  const isOnLeave = await isDoctorOnApprovedLeaveForDate(db, doctorName, date)
  if (isOnLeave) {
    throw new DoctorAvailabilityError(message, 400)
  }
}
