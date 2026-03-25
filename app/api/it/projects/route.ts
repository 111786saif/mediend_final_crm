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
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    const where: Prisma.ITProjectWhereInput = {}
    if (status && status !== 'all') {
      where.status = status as 'ACTIVE' | 'COMPLETED' | 'ON_HOLD' | 'CANCELLED'
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { clientName: { contains: search, mode: 'insensitive' } },
      ]
    }

    const projects = await prisma.iTProject.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { resources: true, bookings: true } },
      },
    })

    return successResponse(projects)
  } catch (error) {
    console.error('Error fetching IT projects:', error)
    return errorResponse('Failed to fetch IT projects', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!canWriteItPnl(user)) return errorResponse('Forbidden', 403)

    const body = await request.json()
    const {
      name,
      clientName,
      description,
      projectValue,
      billingType,
      monthlyBilling,
      startDate,
      endDate,
      status,
    } = body

    if (!name || typeof name !== 'string') {
      return errorResponse('Name is required', 400)
    }

    const project = await prisma.iTProject.create({
      data: {
        name: name.trim(),
        clientName: clientName?.trim() || null,
        description: description || null,
        projectValue: Number(projectValue) || 0,
        billingType: billingType || 'MONTHLY',
        monthlyBilling: monthlyBilling != null ? Number(monthlyBilling) : null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        status: status || 'ACTIVE',
        createdById: user.id,
      },
    })

    return successResponse(project)
  } catch (error) {
    console.error('Error creating IT project:', error)
    return errorResponse('Failed to create IT project', 500)
  }
}
