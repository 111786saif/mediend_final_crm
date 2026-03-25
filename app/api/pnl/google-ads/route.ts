import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { canReadPnl, canWritePnl } from '@/lib/pnl/auth-pnl'

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!canReadPnl(user)) return errorResponse('Forbidden', 403)

    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')

    const where: { department: 'GOOGLE_ADS'; year?: number } = { department: 'GOOGLE_ADS' }
    if (year) where.year = parseInt(year, 10)

    const data = await prisma.departmentRevenue.findMany({
      where,
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    })

    return successResponse(data)
  } catch (error) {
    console.error('Error fetching Google Ads revenue:', error)
    return errorResponse('Failed to fetch revenue', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!canWritePnl(user)) return errorResponse('Forbidden', 403)

    const body = await request.json()
    const { month, year, amount, description, notes } = body
    const m = Number(month)
    const y = Number(year)
    if (!m || m < 1 || m > 12) return errorResponse('Invalid month', 400)
    if (!y || y < 2000) return errorResponse('Invalid year', 400)

    const row = await prisma.departmentRevenue.create({
      data: {
        department: 'GOOGLE_ADS',
        month: m,
        year: y,
        amount: Number(amount) || 0,
        description: description?.trim() || null,
        notes: notes || null,
        createdById: user.id,
      },
    })

    return successResponse(row)
  } catch (error) {
    console.error('Error creating Google Ads revenue:', error)
    return errorResponse('Failed to create revenue', 500)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!canWritePnl(user)) return errorResponse('Forbidden', 403)

    const body = await request.json()
    const { id, amount, description, notes } = body
    if (!id) return errorResponse('id is required', 400)

    const existing = await prisma.departmentRevenue.findFirst({
      where: { id, department: 'GOOGLE_ADS' },
    })
    if (!existing) return errorResponse('Not found', 404)

    const row = await prisma.departmentRevenue.update({
      where: { id },
      data: {
        ...(amount !== undefined ? { amount: Number(amount) || 0 } : {}),
        ...(description !== undefined ? { description: description?.trim() || null } : {}),
        ...(notes !== undefined ? { notes: notes || null } : {}),
      },
    })

    return successResponse(row)
  } catch (error) {
    console.error('Error updating Google Ads revenue:', error)
    return errorResponse('Failed to update revenue', 500)
  }
}
