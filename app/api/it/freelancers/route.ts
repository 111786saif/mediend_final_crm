import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { Prisma } from '@/generated/prisma/client'
import { canReadItPnl, canWriteItPnl } from '@/lib/pnl/auth-it-pnl'

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!canReadItPnl(user)) return errorResponse('Forbidden', 403)

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const isActive = searchParams.get('isActive')

    const where: Prisma.ITFreelancerWhereInput = {}
    if (isActive === 'true') where.isActive = true
    if (isActive === 'false') where.isActive = false
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { skill: { contains: search, mode: 'insensitive' } },
      ]
    }

    const data = await prisma.iTFreelancer.findMany({
      where,
      orderBy: { name: 'asc' },
    })

    return successResponse(data)
  } catch (error) {
    console.error('Error fetching freelancers:', error)
    return errorResponse('Failed to fetch freelancers', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!canWriteItPnl(user)) return errorResponse('Forbidden', 403)

    const body = await request.json()
    const { name, email, phone, skill, isActive } = body
    if (!name || typeof name !== 'string') return errorResponse('Name is required', 400)

    const row = await prisma.iTFreelancer.create({
      data: {
        name: name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        skill: skill?.trim() || null,
        isActive: isActive !== false,
        createdById: user.id,
      },
    })

    return successResponse(row)
  } catch (error) {
    console.error('Error creating freelancer:', error)
    return errorResponse('Failed to create freelancer', 500)
  }
}
