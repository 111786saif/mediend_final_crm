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
 * Notifies the new hire + broadcasts a company-wide welcome (with photo via relatedId).
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
        department: { select: { name: true } },
        user: {
          select: {
            id: true,
            name: true,
            profilePicture: true,
          },
        },
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
      // Notify the new hires themselves
      await prisma.notification.createMany({
        data: pending.map((emp) => ({
          userId: emp.userId,
          type: 'ONBOARDING_APPROVED' as const,
          title: 'Welcome aboard!',
          message: 'HR has approved your onboarding. You can now use Mediend Workspace normally.',
          link: '/home',
          relatedId: emp.id,
        })),
      })

      // Company-wide welcome for every other active user
      const recipients = await prisma.user.findMany({
        where: {
          id: { notIn: pending.map((p) => p.userId) },
          OR: [
            { employee: null },
            { employee: { status: { notIn: ['TERMINATED', 'ABSCONDED'] } } },
          ],
        },
        select: { id: true },
      })

      if (recipients.length > 0) {
        const welcomeRows = pending.flatMap((emp) => {
          const dept = emp.department?.name
          const message = dept
            ? `Please welcome ${emp.user.name} to the ${dept} team!`
            : `Please welcome ${emp.user.name} to Mediend!`
          return recipients.map((r) => ({
            userId: r.id,
            type: 'NEW_HIRE_WELCOME' as const,
            title: `Welcome ${emp.user.name}!`,
            message,
            link: '/home',
            relatedId: emp.userId,
          }))
        })

        // Batch insert in chunks to avoid oversized payloads
        const chunkSize = 500
        for (let i = 0; i < welcomeRows.length; i += chunkSize) {
          await prisma.notification.createMany({
            data: welcomeRows.slice(i, i + chunkSize),
          })
        }
      }
    } catch (notifErr) {
      console.error('Failed to send onboarding / new-hire notifications:', notifErr)
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
