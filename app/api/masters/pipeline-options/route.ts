import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

let cachedMasters: CacheEntry<{
  treatments: string[]
  treatmentCategories: string[]
  hospitals: string[]
  doctors: string[]
  insurance: string[]
}> | null = null

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()

    const now = Date.now()
    if (cachedMasters && now < cachedMasters.expiresAt) {
      return successResponse(cachedMasters.data)
    }

    const [treatments, treatmentCategories, hospitals, doctors, insurance] = await Promise.all([
      prisma.treatmentMaster.findMany({
        select: { name: true },
        orderBy: { name: 'asc' },
        take: 1000,
      }),
      prisma.treatmentCategoryMaster.findMany({
        select: { name: true },
        orderBy: { name: 'asc' },
        take: 500,
      }),
      prisma.hospitalMaster.findMany({
        select: { name: true },
        orderBy: { name: 'asc' },
        take: 1000,
      }),
      prisma.doctorMaster.findMany({
        select: { name: true },
        orderBy: { name: 'asc' },
        take: 1000,
      }),
      prisma.insuranceMaster.findMany({
        select: { name: true },
        orderBy: { name: 'asc' },
        take: 500,
      }),
    ])

    const data = {
      treatments: treatments.map((t) => t.name.trim()).filter(Boolean),
      treatmentCategories: treatmentCategories.map((tc) => tc.name.trim()).filter(Boolean),
      hospitals: hospitals.map((h) => h.name.trim()).filter(Boolean),
      doctors: doctors.map((d) => d.name.trim()).filter(Boolean),
      insurance: insurance.map((i) => i.name.trim()).filter(Boolean),
    }

    // Cache for 5 minutes
    cachedMasters = { data, expiresAt: now + 300_000 }

    return successResponse(data)
  } catch (error) {
    console.error('Error fetching pipeline master options:', error)
    return errorResponse('Failed to fetch pipeline master options', 500)
  }
}
