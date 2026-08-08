import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { recomputeOutstandingFromInstallments } from '@/lib/pl/installments'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'pl:write')) return errorResponse('Forbidden', 403)

    const { id } = await params
    const row = await prisma.paymentInstallment.findUnique({ where: { id }, select: { leadId: true } })
    if (!row) return errorResponse('Installment not found', 404)

    await prisma.paymentInstallment.delete({ where: { id } })
    if (row.leadId) {
      await recomputeOutstandingFromInstallments(row.leadId)
    }

    return successResponse({ id }, 'Installment deleted')
  } catch (error) {
    console.error('Error deleting installment:', error)
    return errorResponse('Failed to delete installment', 500)
  }
}
