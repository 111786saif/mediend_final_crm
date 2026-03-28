import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { applyLeaveBalanceBaseline } from '@/lib/hrms/apply-leave-balance-baseline'
import { z } from 'zod'

const patchSchema = z.object({
  balances: z.object({
    CL: z.number().min(0).optional(),
    SL: z.number().min(0).optional(),
    EL: z.number().min(0).optional(),
  }),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    // HR must use leave-balance edit requests; MD/Admin may still apply directly when needed.
    if (user.role !== 'MD' && user.role !== 'ADMIN') {
      return errorResponse(
        'Direct balance updates are restricted to MD/Admin. Submit a request from HR Leave balances.',
        403
      )
    }

    const { employeeId } = await params
    const body = await request.json()
    const { balances } = patchSchema.parse(body)

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { user: { select: { name: true } } },
    })
    if (!employee) return errorResponse('Employee not found', 404)

    const partial: Partial<{ CL: number; SL: number; EL: number }> = {}
    for (const k of ['CL', 'SL', 'EL'] as const) {
      const v = balances[k]
      if (v != null) partial[k] = Math.round(v * 2) / 2
    }
    if (Object.keys(partial).length === 0) {
      return errorResponse('Provide at least one of CL, SL, EL', 400)
    }
    await applyLeaveBalanceBaseline(prisma, employeeId, partial)

    return successResponse({ message: 'Balances updated' })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return errorResponse(`Invalid request: ${e.errors.map((x) => x.message).join(', ')}`, 400)
    }
    console.error('Error updating leave balances:', e)
    return errorResponse('Failed to update balances', 500)
  }
}
