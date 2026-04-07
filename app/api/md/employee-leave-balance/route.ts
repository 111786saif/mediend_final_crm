import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

/**
 * GET /api/md/employee-leave-balance?employeeId=xxx
 * Fetch leave balance for any single employee. MD/ADMIN only.
 */
export async function GET(request: NextRequest) {
  const user = getSessionFromRequest(request)
  if (!user) return unauthorizedResponse()
  if (user.role !== 'MD' && user.role !== 'ADMIN') {
    return errorResponse('Forbidden', 403)
  }

  const { searchParams } = new URL(request.url)
  const employeeId = searchParams.get('employeeId')
  if (!employeeId) return errorResponse('employeeId is required', 400)

  const emp = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      user: { select: { name: true, email: true } },
    },
  })

  if (!emp) return errorResponse('Employee not found', 404)

  const balances = await prisma.leaveBalance.findMany({
    where: { employeeId },
    include: {
      leaveType: { select: { id: true, name: true } },
    },
  })

  return successResponse({
    balance: {
      employeeId: emp.id,
      employeeName: emp.user.name,
      employeeEmail: emp.user.email,
      balances: balances.map((b) => ({
        leaveTypeId: b.leaveType.id,
        leaveTypeName: b.leaveType.name,
        allocated: b.allocated,
        used: b.used,
        remaining: b.remaining,
      })),
    },
  })
}
