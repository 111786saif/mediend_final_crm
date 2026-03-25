import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { canReadPnl, canWritePnl } from '@/lib/pnl/auth-pnl'
import { expandMonthRange } from '@/lib/pnl/aggregate-revenue'

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!canReadPnl(user)) return errorResponse('Forbidden', 403)

    const { searchParams } = new URL(request.url)
    const startMonth = parseInt(searchParams.get('startMonth') || '1', 10)
    const startYear = parseInt(searchParams.get('startYear') || String(new Date().getFullYear()), 10)
    const endMonth = parseInt(searchParams.get('endMonth') || String(startMonth), 10)
    const endYear = parseInt(searchParams.get('endYear') || String(startYear), 10)

    const months = expandMonthRange(startMonth, startYear, endMonth, endYear)

    const entries = await prisma.pnLEntry.findMany({
      where: {
        OR: months.map((my) => ({ AND: [{ month: my.month }, { year: my.year }] })),
      },
      include: { category: true },
    })

    return successResponse({
      entries,
      months,
    })
  } catch (error) {
    console.error('Error fetching PnL entries:', error)
    return errorResponse('Failed to fetch entries', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!canWritePnl(user)) return errorResponse('Forbidden', 403)

    const body = await request.json()
    const { categoryId, month, year, amount, notes, isAutoFilled } = body
    if (!categoryId) return errorResponse('categoryId required', 400)
    const m = Number(month)
    const y = Number(year)
    if (!m || m < 1 || m > 12) return errorResponse('Invalid month', 400)

    const row = await prisma.pnLEntry.upsert({
      where: {
        categoryId_month_year: { categoryId, month: m, year: y },
      },
      create: {
        categoryId,
        month: m,
        year: y,
        amount: Number(amount) || 0,
        notes: notes || null,
        isAutoFilled: Boolean(isAutoFilled),
        createdById: user.id,
      },
      update: {
        amount: Number(amount) || 0,
        notes: notes || null,
        ...(isAutoFilled !== undefined ? { isAutoFilled: Boolean(isAutoFilled) } : {}),
      },
      include: { category: true },
    })

    return successResponse(row)
  } catch (error) {
    console.error('Error saving PnL entry:', error)
    return errorResponse('Failed to save entry', 500)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!canWritePnl(user)) return errorResponse('Forbidden', 403)

    const body = await request.json()
    const { id, amount, notes } = body
    if (!id) return errorResponse('id required', 400)

    const row = await prisma.pnLEntry.update({
      where: { id },
      data: {
        ...(amount !== undefined ? { amount: Number(amount) || 0, isAutoFilled: false } : {}),
        ...(notes !== undefined ? { notes: notes || null } : {}),
      },
      include: { category: true },
    })

    return successResponse(row)
  } catch (error) {
    console.error('Error updating PnL entry:', error)
    return errorResponse('Failed to update entry', 500)
  }
}
