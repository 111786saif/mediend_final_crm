import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { canReadLoanDemat, canWriteLoanDemat } from '@/lib/pnl/auth-pnl'

const vendorInclude = {
  vendor: { select: { id: true, name: true, isActive: true, sortOrder: true } },
} as const

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!canReadLoanDemat(user)) return errorResponse('Forbidden', 403)

    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')
    const month = searchParams.get('month')

    const where: {
      department: 'LOAN_DEMAT'
      year?: number
      month?: number
    } = { department: 'LOAN_DEMAT' }
    if (year) where.year = parseInt(year, 10)
    if (month) where.month = parseInt(month, 10)

    const data = await prisma.departmentRevenue.findMany({
      where,
      include: vendorInclude,
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { createdAt: 'desc' }],
    })

    return successResponse(data)
  } catch (error) {
    console.error('Error fetching loan/demat revenue:', error)
    return errorResponse('Failed to fetch revenue', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!canWriteLoanDemat(user)) return errorResponse('Forbidden', 403)

    const body = await request.json()
    const { month, year, amount, vendorId, description, notes } = body
    const m = Number(month)
    const y = Number(year)
    if (!m || m < 1 || m > 12) return errorResponse('Invalid month', 400)
    if (!y || y < 2000) return errorResponse('Invalid year', 400)
    if (!vendorId || typeof vendorId !== 'string') {
      return errorResponse('vendorId is required', 400)
    }

    const vendor = await prisma.loanDematVendor.findFirst({
      where: { id: vendorId, isActive: true },
    })
    if (!vendor) return errorResponse('Vendor not found or inactive', 400)

    const amt = Number(amount) || 0

    const existing = await prisma.departmentRevenue.findFirst({
      where: {
        department: 'LOAN_DEMAT',
        month: m,
        year: y,
        vendorId,
      },
    })

    let row
    if (existing) {
      row = await prisma.departmentRevenue.update({
        where: { id: existing.id },
        data: {
          amount: amt,
          description: description?.trim() || vendor.name,
          notes: notes ?? null,
        },
        include: vendorInclude,
      })
    } else {
      row = await prisma.departmentRevenue.create({
        data: {
          department: 'LOAN_DEMAT',
          month: m,
          year: y,
          amount: amt,
          vendorId,
          description: description?.trim() || vendor.name,
          notes: notes || null,
          createdById: user.id,
        },
        include: vendorInclude,
      })
    }

    return successResponse(row)
  } catch (error) {
    console.error('Error creating revenue:', error)
    return errorResponse('Failed to create revenue', 500)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!canWriteLoanDemat(user)) return errorResponse('Forbidden', 403)

    const body = await request.json()
    const { id, amount, description, notes } = body
    if (!id) return errorResponse('id is required', 400)

    const existing = await prisma.departmentRevenue.findFirst({
      where: { id, department: 'LOAN_DEMAT' },
    })
    if (!existing) return errorResponse('Not found', 404)

    const row = await prisma.departmentRevenue.update({
      where: { id },
      data: {
        ...(amount !== undefined ? { amount: Number(amount) || 0 } : {}),
        ...(description !== undefined ? { description: description?.trim() || null } : {}),
        ...(notes !== undefined ? { notes: notes || null } : {}),
      },
      include: vendorInclude,
    })

    return successResponse(row)
  } catch (error) {
    console.error('Error updating revenue:', error)
    return errorResponse('Failed to update revenue', 500)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!canWriteLoanDemat(user)) return errorResponse('Forbidden', 403)

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return errorResponse('id is required', 400)

    const existing = await prisma.departmentRevenue.findFirst({
      where: { id, department: 'LOAN_DEMAT' },
    })
    if (!existing) return errorResponse('Not found', 404)

    await prisma.departmentRevenue.delete({ where: { id } })
    return successResponse({ ok: true })
  } catch (error) {
    console.error('Error deleting revenue:', error)
    return errorResponse('Failed to delete revenue', 500)
  }
}
