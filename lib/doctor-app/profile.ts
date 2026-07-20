import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { uploadFileToS3 } from '@/lib/s3-client'
import { DoctorAppSessionUser } from '@/lib/doctor-app/auth'
import { normalizeIndianPhone } from '@/lib/doctor-app/phone'

type DoctorAccountWithProfile = Prisma.DoctorAppAccountGetPayload<{
  include: {
    doctor: true
  }
}>

type DoctorDocumentEntry = {
  name?: string
  url?: string
  type?: string
}

export class DoctorAppProfileError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'DoctorAppProfileError'
    this.status = status
  }
}

export interface UpdateDoctorProfileInput {
  name?: string
  email?: string
  phoneNumber?: string | null
  category?: string | null
  treatment?: string | null
  specialty?: string | null
  age?: number | null
  sex?: string | null
  gender?: string | null
  aadhaarNumber?: string | null
  panNumber?: string | null
  experienceYears?: number | null
  experienceNotes?: string | null
  feeStructure?: string | null
}

function normalizeText(value: string | null | undefined) {
  if (value === undefined) {
    return undefined
  }

  if (value === null) {
    return null
  }

  const trimmed = value.trim()
  return trimmed || null
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

function parseDoctorDocuments(value: Prisma.JsonValue | null): DoctorDocumentEntry[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return null
      }

      const record = item as Record<string, unknown>
      return {
        name: typeof record.name === 'string' ? record.name : undefined,
        url: typeof record.url === 'string' ? record.url : undefined,
        type: typeof record.type === 'string' ? record.type : undefined,
      }
    })
    .filter((item): item is DoctorDocumentEntry => Boolean(item?.url))
}

function getDoctorPhotoUrl(documents: DoctorDocumentEntry[]) {
  const profilePhoto =
    documents.find(document => document.type === 'PROFILE_PHOTO') ||
    documents.find(document => document.type === 'PHOTO') ||
    null

  return profilePhoto?.url || null
}

function mapDoctorProfile(account: DoctorAccountWithProfile) {
  const documents = parseDoctorDocuments(account.doctor.documents)
  const photoUrl = getDoctorPhotoUrl(documents)

  return {
    id: account.doctor.id,
    accountId: account.id,
    name: account.doctor.name,
    email: account.email,
    phoneNumber: account.phoneNumber,
    age: account.doctor.age,
    sex: account.doctor.sex,
    gender: account.doctor.sex,
    category: account.doctor.category,
    treatment: account.doctor.treatment,
    specialty: account.doctor.treatment || account.doctor.category,
    aadhaarNumber: account.doctor.aadhaarNumber,
    panNumber: account.doctor.panNumber,
    experienceYears: account.doctor.experienceYears,
    experienceNotes: account.doctor.experienceNotes,
    feeStructure: account.doctor.feeStructure,
    ratingAverage: account.doctor.ratingAverage,
    ratingCount: account.doctor.ratingCount,
    photoUrl,
    registrationNumber: null,
    assignedHospitals: [],
    documents,
    isActive: account.isActive && account.doctor.isActive,
    lastLoginAt: account.lastLoginAt,
    createdAt: account.doctor.createdAt,
    updatedAt: account.doctor.updatedAt,
  }
}

async function getDoctorAccount(user: DoctorAppSessionUser) {
  const account = await prisma.doctorAppAccount.findUnique({
    where: { id: user.accountId },
    include: {
      doctor: true,
    },
  })

  if (!account || !account.isActive || !account.doctor.isActive) {
    throw new DoctorAppProfileError('Doctor profile not found', 404)
  }

  return account
}

function isDuplicateError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  )
}

export async function getDoctorMyProfile(user: DoctorAppSessionUser) {
  const account = await getDoctorAccount(user)
  return mapDoctorProfile(account)
}

export async function updateDoctorMyProfile(
  user: DoctorAppSessionUser,
  input: UpdateDoctorProfileInput
) {
  const account = await getDoctorAccount(user)

  const doctorName = input.name?.trim()
  const normalizedEmail = input.email?.trim().toLowerCase()
  const normalizedPhone =
    input.phoneNumber === undefined ? undefined : normalizeIndianPhone(input.phoneNumber)
  const normalizedSex = normalizeText(input.sex ?? input.gender)
  const normalizedTreatment = normalizeText(input.treatment ?? input.specialty)

  try {
    const updatedAccount = await prisma.$transaction(async tx => {
      if (normalizedEmail !== undefined || normalizedPhone !== undefined) {
        await tx.doctorAppAccount.update({
          where: { id: account.id },
          data: {
            ...(normalizedEmail !== undefined ? { email: normalizedEmail } : {}),
            ...(normalizedPhone !== undefined ? { phoneNumber: normalizedPhone } : {}),
          },
        })
      }

      await tx.doctorMaster.update({
        where: { id: account.doctorId },
        data: {
          ...(doctorName !== undefined ? { name: doctorName } : {}),
          ...(input.category !== undefined ? { category: normalizeText(input.category) } : {}),
          ...(input.treatment !== undefined || input.specialty !== undefined
            ? { treatment: normalizedTreatment }
            : {}),
          ...(input.age !== undefined ? { age: input.age } : {}),
          ...(input.sex !== undefined || input.gender !== undefined ? { sex: normalizedSex } : {}),
          ...(input.aadhaarNumber !== undefined
            ? { aadhaarNumber: normalizeText(input.aadhaarNumber) }
            : {}),
          ...(input.panNumber !== undefined ? { panNumber: normalizeText(input.panNumber) } : {}),
          ...(input.experienceYears !== undefined ? { experienceYears: input.experienceYears } : {}),
          ...(input.experienceNotes !== undefined
            ? { experienceNotes: normalizeText(input.experienceNotes) }
            : {}),
          ...(input.feeStructure !== undefined
            ? { feeStructure: normalizeText(input.feeStructure) }
            : {}),
        },
      })

      const refreshed = await tx.doctorAppAccount.findUnique({
        where: { id: account.id },
        include: {
          doctor: true,
        },
      })

      if (!refreshed) {
        throw new DoctorAppProfileError('Doctor profile not found', 404)
      }

      return refreshed
    })

    return mapDoctorProfile(updatedAccount)
  } catch (error) {
    if (isDuplicateError(error)) {
      throw new DoctorAppProfileError('A doctor with this name, email, or phone number already exists', 409)
    }

    throw error
  }
}

export async function uploadDoctorMyPhoto(
  user: DoctorAppSessionUser,
  file: File
) {
  if (!file) {
    throw new DoctorAppProfileError('No file provided', 400)
  }

  const account = await getDoctorAccount(user)
  const currentDocuments = parseDoctorDocuments(account.doctor.documents)

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const upload = await uploadFileToS3(buffer, file.name, 'doctor-app/profile-photos')

  const nextDocuments = [
    ...currentDocuments.filter(document => document.type !== 'PROFILE_PHOTO'),
    {
      name: file.name,
      url: upload.url,
      type: 'PROFILE_PHOTO',
    },
  ]

  const updatedDoctor = await prisma.doctorMaster.update({
    where: { id: account.doctorId },
    data: {
      documents: toJsonValue(nextDocuments),
    },
  })

  return {
    photoUrl: upload.url,
    documents: parseDoctorDocuments(updatedDoctor.documents),
  }
}
