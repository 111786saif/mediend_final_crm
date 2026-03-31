import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { canReadLoanDemat, canWriteLoanDemat } from '@/lib/pnl/auth-pnl'

const createSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  sortOrder: z.number().int().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!canReadLoanDemat(user)) return errorResponse('Forbidden', 403)

    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('activeOnly') !== 'false'

    const vendors = await prisma.loanDematVendor.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })

    return successResponse(vendors)
  } catch (error) {
    console.error('Error listing loan-demat vendors:', error)
    return errorResponse('Failed to list vendors', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!canWriteLoanDemat(user)) return errorResponse('Forbidden', 403)

    const body = await request.json()
    const data = createSchema.parse(body)

    const maxSort = await prisma.loanDematVendor.aggregate({ _max: { sortOrder: true } })
    const sortOrder = data.sortOrder ?? (maxSort._max.sortOrder ?? 0) + 1

    const vendor = await prisma.loanDematVendor.create({
      data: {
        name: data.name,
        sortOrder,
      },
    })

    return successResponse(vendor)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.errors[0]?.message || 'Invalid input', 400)
    }
    console.error('Error creating vendor:', error)
    return errorResponse('Failed to create vendor', 500)
  }
}
