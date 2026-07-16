import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { initializeLeaveBalances } from '@/lib/hrms/leave-balance-utils'
import { z } from 'zod'

const approveSchema = z.object({
  employeeIds: z.array(z.string()).optional(),
  approveAll: z.boolean().optional(),
}).refine(
  (data) => data.approveAll === true || (data.employeeIds && data.employeeIds.length > 0),
  { message: 'Provide employeeIds or set approveAll to true' }
)

/**
 * POST /api/hr/onboarding/approve
 * Approve one or more employees (or all pending approval).
 */
export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()

    if (!hasPermission(user, 'hrms:employees:write')) {
      return errorResponse('Forbidden', 403)
    }

    const body = await request.json()
    const data = approveSchema.parse(body)

    const where = data.approveAll
      ? { onboardingStatus: 'PENDING_APPROVAL' as const }
      : {
          id: { in: data.employeeIds! },
          onboardingStatus: 'PENDING_APPROVAL' as const,
        }

    const pending = await prisma.employee.findMany({
      where,
      select: {
        id: true,
        userId: true,
        user: { select: { id: true, name: true } },
        leaveBalances: { select: { id: true }, take: 1 },
      },
    })

    if (pending.length === 0) {
      return errorResponse('No employees pending approval matched your request', 400)
    }

    const now = new Date()
    await prisma.employee.updateMany({
      where: { id: { in: pending.map((p) => p.id) } },
      data: {
        onboardingStatus: 'APPROVED',
        onboardingApprovedAt: now,
        onboardingApprovedById: user.id,
      },
    })

    for (const emp of pending) {
      if (emp.leaveBalances.length === 0) {
        try {
          await initializeLeaveBalances(emp.id)
        } catch (err) {
          console.error(`Failed to initialize leave balances for ${emp.id}:`, err)
        }
      }
    }

    try {
      await prisma.notification.createMany({
        data: pending.map((emp) => ({
          userId: emp.userId,
          type: 'ONBOARDING_APPROVED' as const,
          title: 'Welcome aboard!',
          message: 'HR has approved your onboarding. You can now use Mediend Workspace normally.',
          link: '/home',
        })),
      })
    } catch (notifErr) {
      console.error('Failed to notify employees of onboarding approval:', notifErr)
    }

    return successResponse({
      approved: pending.map((p) => ({
        employeeId: p.id,
        userId: p.userId,
        name: p.user.name,
      })),
      count: pending.length,
    }, `Approved ${pending.length} employee${pending.length === 1 ? '' : 's'}`)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.errors.map((e) => e.message).join(', '), 400)
    }
    console.error('Error approving onboarding:', error)
    return errorResponse('Failed to approve onboarding', 500)
  }
}
