import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { canWriteLoanDemat } from '@/lib/pnl/auth-pnl'

const patchSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
})

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!canWriteLoanDemat(user)) return errorResponse('Forbidden', 403)

    const { id } = await context.params
    const body = await request.json()
    const data = patchSchema.parse(body)

    const existing = await prisma.loanDematVendor.findUnique({ where: { id } })
    if (!existing) return errorResponse('Vendor not found', 404)

    const vendor = await prisma.loanDematVendor.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
      },
    })

    return successResponse(vendor)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.errors[0]?.message || 'Invalid input', 400)
    }
    console.error('Error updating vendor:', error)
    return errorResponse('Failed to update vendor', 500)
  }
}
