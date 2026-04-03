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
    const projectId = searchParams.get('projectId')
    const month = searchParams.get('month')
    const year = searchParams.get('year')
    const startMonth = searchParams.get('startMonth')
    const startYear = searchParams.get('startYear')
    const endMonth = searchParams.get('endMonth')
    const endYear = searchParams.get('endYear')

    const where: Prisma.ITProjectBookingWhereInput = {}
    if (projectId) where.projectId = projectId
    if (month && year) {
      where.month = parseInt(month, 10)
      where.year = parseInt(year, 10)
    }
    if (startYear && endYear) {
      const sy = parseInt(startYear, 10)
      const ey = parseInt(endYear, 10)
      const sm = startMonth ? parseInt(startMonth, 10) : 1
      const em = endMonth ? parseInt(endMonth, 10) : 12
      where.AND = [
        {
          OR: [
            { year: { gt: sy } },
            { AND: [{ year: sy }, { month: { gte: sm } }] },
          ],
        },
        {
          OR: [
            { year: { lt: ey } },
            { AND: [{ year: ey }, { month: { lte: em } }] },
          ],
        },
      ]
    }

    const data = await prisma.iTProjectBooking.findMany({
      where,
      include: { project: { select: { id: true, name: true, clientName: true } } },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
    })

    return successResponse({ data })
  } catch (error) {
    console.error('Error fetching bookings:', error)
    return errorResponse('Failed to fetch bookings', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!canWriteItPnl(user)) return errorResponse('Forbidden', 403)

    const body = await request.json()
    const { projectId, month, year, amount, notes } = body
    if (!projectId) return errorResponse('projectId is required', 400)
    const m = Number(month)
    const y = Number(year)
    if (!m || m < 1 || m > 12) return errorResponse('Invalid month', 400)
    if (!y || y < 2000) return errorResponse('Invalid year', 400)

    const booking = await prisma.iTProjectBooking.upsert({
      where: {
        projectId_month_year: { projectId, month: m, year: y },
      },
      create: {
        projectId,
        month: m,
        year: y,
        amount: Number(amount) || 0,
        notes: notes || null,
        createdById: user.id,
      },
      update: {
        amount: Number(amount) || 0,
        notes: notes || null,
      },
      include: { project: { select: { id: true, name: true } } },
    })

    return successResponse(booking)
  } catch (error) {
    console.error('Error saving booking:', error)
    return errorResponse('Failed to save booking', 500)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!canWriteItPnl(user)) return errorResponse('Forbidden', 403)

    const body = await request.json()
    const { id, amount, notes } = body
    if (!id) return errorResponse('id is required', 400)

    const booking = await prisma.iTProjectBooking.update({
      where: { id },
      data: {
        ...(amount !== undefined ? { amount: Number(amount) || 0 } : {}),
        ...(notes !== undefined ? { notes: notes || null } : {}),
      },
    })

    return successResponse(booking)
  } catch (error) {
    console.error('Error updating booking:', error)
    return errorResponse('Failed to update booking', 500)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!canWriteItPnl(user)) return errorResponse('Forbidden', 403)

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return errorResponse('id is required', 400)

    await prisma.iTProjectBooking.delete({ where: { id } })
    return successResponse({ ok: true })
  } catch (error) {
    console.error('Error deleting booking:', error)
    return errorResponse('Failed to delete booking', 500)
  }
}
