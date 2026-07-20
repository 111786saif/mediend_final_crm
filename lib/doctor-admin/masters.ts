import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'

export type DoctorAdminMasterType =
  | 'implants'
  | 'surgery-remarks'
  | 'reason-no-surgery'
  | 'follow-up-reasons'

export type DoctorAdminMasterRecord = {
  id: string
  code?: string | null
  name?: string | null
  label?: string | null
  category?: string | null
  manufacturer?: string | null
  unitCost?: number | null
  description?: string | null
  usageCount?: number
  displayOrder?: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export class DoctorAdminMasterError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'DoctorAdminMasterError'
    this.status = status
  }
}

type MasterHandlers = {
  list: (search: string, includeInactive: boolean) => Promise<DoctorAdminMasterRecord[]>
  create: (data: Record<string, unknown>) => Promise<DoctorAdminMasterRecord>
  update: (id: string, data: Record<string, unknown>) => Promise<DoctorAdminMasterRecord>
}

function normalizeText(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function normalizeCode(value: unknown) {
  const text = normalizeText(value)
  return text ? text.replace(/\s+/g, '_') : null
}

function normalizeNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function mapImplant(item: {
  id: string
  name: string
  code: string | null
  category: string | null
  manufacturer: string | null
  unitCost: number | null
  description: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: item.id,
    name: item.name,
    code: item.code,
    category: item.category,
    manufacturer: item.manufacturer,
    unitCost: item.unitCost,
    description: item.description,
    usageCount: 0,
    isActive: item.isActive,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

function mapOptionMaster(item: {
  id: string
  code: string
  label: string
  displayOrder: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: item.id,
    code: item.code,
    label: item.label,
    displayOrder: item.displayOrder,
    isActive: item.isActive,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

const handlers: Record<DoctorAdminMasterType, MasterHandlers> = {
  implants: {
    list: async (search, includeInactive) => {
      const items = await prisma.implantMaster.findMany({
        where: {
          ...(includeInactive ? {} : { isActive: true }),
          ...(search
            ? {
                OR: [
                  { name: { contains: search, mode: 'insensitive' } },
                  { code: { contains: search, mode: 'insensitive' } },
                  { category: { contains: search, mode: 'insensitive' } },
                  { manufacturer: { contains: search, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
        take: 300,
      })

      return items.map(mapImplant)
    },
    create: async (data) => {
      const name = normalizeText(data.name)
      if (!name) throw new DoctorAdminMasterError('Implant name is required', 400)

      try {
        const created = await prisma.implantMaster.create({
          data: {
            name,
            code: normalizeText(data.code),
            category: normalizeText(data.category),
            manufacturer: normalizeText(data.manufacturer),
            unitCost: normalizeNumber(data.unitCost),
            description: normalizeText(data.description),
            isActive: data.isActive === undefined ? true : Boolean(data.isActive),
          },
        })

        return mapImplant(created)
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new DoctorAdminMasterError('Implant name or code already exists', 409)
        }
        throw error
      }
    },
    update: async (id, data) => {
      try {
        const updated = await prisma.implantMaster.update({
          where: { id },
          data: {
            ...(data.name !== undefined ? { name: normalizeText(data.name) || undefined } : {}),
            ...(data.code !== undefined ? { code: normalizeText(data.code) } : {}),
            ...(data.category !== undefined ? { category: normalizeText(data.category) } : {}),
            ...(data.manufacturer !== undefined ? { manufacturer: normalizeText(data.manufacturer) } : {}),
            ...(data.unitCost !== undefined ? { unitCost: normalizeNumber(data.unitCost) } : {}),
            ...(data.description !== undefined ? { description: normalizeText(data.description) } : {}),
            ...(data.isActive !== undefined ? { isActive: Boolean(data.isActive) } : {}),
          },
        })

        return mapImplant(updated)
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          throw new DoctorAdminMasterError('Implant not found', 404)
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new DoctorAdminMasterError('Implant name or code already exists', 409)
        }
        throw error
      }
    },
  },
  'surgery-remarks': {
    list: async (search, includeInactive) => {
      const items = await prisma.surgeryRemarkMaster.findMany({
        where: {
          ...(includeInactive ? {} : { isActive: true }),
          ...(search
            ? {
                OR: [
                  { code: { contains: search, mode: 'insensitive' } },
                  { label: { contains: search, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        orderBy: [{ isActive: 'desc' }, { displayOrder: 'asc' }, { label: 'asc' }],
        take: 300,
      })

      return items.map(mapOptionMaster)
    },
    create: async (data) => {
      const code = normalizeCode(data.code)
      const label = normalizeText(data.label)
      if (!code || !label) throw new DoctorAdminMasterError('Code and label are required', 400)

      try {
        const created = await prisma.surgeryRemarkMaster.create({
          data: {
            code,
            label,
            displayOrder: normalizeNumber(data.displayOrder) ?? 0,
            isActive: data.isActive === undefined ? true : Boolean(data.isActive),
          },
        })
        return mapOptionMaster(created)
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new DoctorAdminMasterError('Code already exists', 409)
        }
        throw error
      }
    },
    update: async (id, data) => {
      try {
        const updated = await prisma.surgeryRemarkMaster.update({
          where: { id },
          data: {
            ...(data.code !== undefined ? { code: normalizeCode(data.code) || undefined } : {}),
            ...(data.label !== undefined ? { label: normalizeText(data.label) || undefined } : {}),
            ...(data.displayOrder !== undefined
              ? { displayOrder: normalizeNumber(data.displayOrder) ?? 0 }
              : {}),
            ...(data.isActive !== undefined ? { isActive: Boolean(data.isActive) } : {}),
          },
        })
        return mapOptionMaster(updated)
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          throw new DoctorAdminMasterError('Record not found', 404)
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new DoctorAdminMasterError('Code already exists', 409)
        }
        throw error
      }
    },
  },
  'reason-no-surgery': {
    list: async (search, includeInactive) => {
      const items = await prisma.reasonNoSurgeryMaster.findMany({
        where: {
          ...(includeInactive ? {} : { isActive: true }),
          ...(search
            ? {
                OR: [
                  { code: { contains: search, mode: 'insensitive' } },
                  { label: { contains: search, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        orderBy: [{ isActive: 'desc' }, { displayOrder: 'asc' }, { label: 'asc' }],
        take: 300,
      })

      return items.map(mapOptionMaster)
    },
    create: async (data) => {
      const code = normalizeCode(data.code)
      const label = normalizeText(data.label)
      if (!code || !label) throw new DoctorAdminMasterError('Code and label are required', 400)

      try {
        const created = await prisma.reasonNoSurgeryMaster.create({
          data: {
            code,
            label,
            displayOrder: normalizeNumber(data.displayOrder) ?? 0,
            isActive: data.isActive === undefined ? true : Boolean(data.isActive),
          },
        })
        return mapOptionMaster(created)
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new DoctorAdminMasterError('Code already exists', 409)
        }
        throw error
      }
    },
    update: async (id, data) => {
      try {
        const updated = await prisma.reasonNoSurgeryMaster.update({
          where: { id },
          data: {
            ...(data.code !== undefined ? { code: normalizeCode(data.code) || undefined } : {}),
            ...(data.label !== undefined ? { label: normalizeText(data.label) || undefined } : {}),
            ...(data.displayOrder !== undefined
              ? { displayOrder: normalizeNumber(data.displayOrder) ?? 0 }
              : {}),
            ...(data.isActive !== undefined ? { isActive: Boolean(data.isActive) } : {}),
          },
        })
        return mapOptionMaster(updated)
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          throw new DoctorAdminMasterError('Record not found', 404)
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new DoctorAdminMasterError('Code already exists', 409)
        }
        throw error
      }
    },
  },
  'follow-up-reasons': {
    list: async (search, includeInactive) => {
      const items = await prisma.followUpReasonMaster.findMany({
        where: {
          ...(includeInactive ? {} : { isActive: true }),
          ...(search
            ? {
                OR: [
                  { code: { contains: search, mode: 'insensitive' } },
                  { label: { contains: search, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        orderBy: [{ isActive: 'desc' }, { displayOrder: 'asc' }, { label: 'asc' }],
        take: 300,
      })

      return items.map(mapOptionMaster)
    },
    create: async (data) => {
      const code = normalizeCode(data.code)
      const label = normalizeText(data.label)
      if (!code || !label) throw new DoctorAdminMasterError('Code and label are required', 400)

      try {
        const created = await prisma.followUpReasonMaster.create({
          data: {
            code,
            label,
            displayOrder: normalizeNumber(data.displayOrder) ?? 0,
            isActive: data.isActive === undefined ? true : Boolean(data.isActive),
          },
        })
        return mapOptionMaster(created)
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new DoctorAdminMasterError('Code already exists', 409)
        }
        throw error
      }
    },
    update: async (id, data) => {
      try {
        const updated = await prisma.followUpReasonMaster.update({
          where: { id },
          data: {
            ...(data.code !== undefined ? { code: normalizeCode(data.code) || undefined } : {}),
            ...(data.label !== undefined ? { label: normalizeText(data.label) || undefined } : {}),
            ...(data.displayOrder !== undefined
              ? { displayOrder: normalizeNumber(data.displayOrder) ?? 0 }
              : {}),
            ...(data.isActive !== undefined ? { isActive: Boolean(data.isActive) } : {}),
          },
        })
        return mapOptionMaster(updated)
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          throw new DoctorAdminMasterError('Record not found', 404)
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new DoctorAdminMasterError('Code already exists', 409)
        }
        throw error
      }
    },
  },
}

export function isDoctorAdminMasterType(type: string): type is DoctorAdminMasterType {
  return type in handlers
}

export async function listDoctorAdminMasters(
  type: DoctorAdminMasterType,
  search: string,
  includeInactive: boolean
) {
  return handlers[type].list(search.trim(), includeInactive)
}

export async function createDoctorAdminMaster(type: DoctorAdminMasterType, data: Record<string, unknown>) {
  return handlers[type].create(data)
}

export async function updateDoctorAdminMaster(
  type: DoctorAdminMasterType,
  id: string,
  data: Record<string, unknown>
) {
  return handlers[type].update(id, data)
}
