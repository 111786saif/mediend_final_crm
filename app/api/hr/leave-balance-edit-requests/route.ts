import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getComputedBalancesForEmployee } from '@/lib/hrms/leave-policy-calculator'
import { z } from 'zod'

const postSchema = z.object({
  employeeId: z.string().min(1),
  balances: z.object({
    CL: z.number().min(0),
    SL: z.number().min(0),
    EL: z.number().min(0),
  }),
  reason: z.string().max(2000).optional().nullable(),
})

function remainingByName(balances: Awaited<ReturnType<typeof getComputedBalancesForEmployee>>, code: string) {
  const b = balances.find((x) => x.leaveTypeName === code)
  return b?.remaining ?? 0
}

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'hrms:leaves:write')) {
      return errorResponse('Forbidden', 403)
    }

    const body = await request.json()
    const { employeeId, balances, reason } = postSchema.parse(body)

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { user: { select: { name: true } } },
    })
    if (!employee) return errorResponse('Employee not found', 404)

    const existingPending = await prisma.leaveBalanceEditRequest.findFirst({
      where: { employeeId, status: 'PENDING' },
    })
    if (existingPending) {
      return errorResponse(
        'This employee already has a pending leave balance change request. Wait for MD approval or rejection.',
        409
      )
    }

    const computed = await getComputedBalancesForEmployee(employeeId)
    const prevCL = remainingByName(computed, 'CL')
    const prevSL = remainingByName(computed, 'SL')
    const prevEL = remainingByName(computed, 'EL')

    const proposedCL = Math.round(balances.CL * 2) / 2
    const proposedSL = Math.round(balances.SL * 2) / 2
    const proposedEL = Math.round(balances.EL * 2) / 2

    const row = await prisma.leaveBalanceEditRequest.create({
      data: {
        employeeId,
        requestedByUserId: user.id,
        prevCL,
        prevSL,
        prevEL,
        proposedCL,
        proposedSL,
        proposedEL,
        reason: reason?.trim() || null,
      },
    })

    const mdUsers = await prisma.user.findMany({
      where: { role: 'MD' },
      select: { id: true },
    })
    await Promise.all(
      mdUsers.map((u) =>
        prisma.notification.create({
          data: {
            userId: u.id,
            type: 'LEAVE_BALANCE_EDIT_REQUESTED',
            title: 'Leave balance change requested',
            message: `HR requested baseline CL/SL/EL update for ${employee.user.name} (${employee.employeeCode}).`,
            link: '/md/leave-balances',
            relatedId: row.id,
          },
        })
      )
    )

    return successResponse({ id: row.id, message: 'Request submitted for MD approval' })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return errorResponse(`Invalid request: ${e.errors.map((x) => x.message).join(', ')}`, 400)
    }
    console.error('leave-balance-edit-requests POST:', e)
    return errorResponse('Failed to submit request', 500)
  }
}
