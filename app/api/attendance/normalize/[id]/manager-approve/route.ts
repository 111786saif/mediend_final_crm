import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { z } from 'zod'

const bodySchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  normalizeAs: z.enum(['FULL_DAY', 'HALF_DAY']).optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    const manager = await prisma.employee.findUnique({
      where: { userId: user.id },
    })

    if (!manager) {
      return errorResponse('Employee record not found', 404)
    }

    const { id } = await params
    const body = await request.json()
    const { status, normalizeAs } = bodySchema.parse(body)

    const normalization = await prisma.attendanceNormalization.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            managerId: true,
            user: { select: { name: true } },
          },
        },
      },
    })

    if (!normalization) {
      return errorResponse('Normalization request not found', 404)
    }

    if (normalization.type !== 'EMPLOYEE_REQUEST') {
      return errorResponse('Only employee-initiated normalization requests can be approved by manager', 400)
    }

    if (normalization.employee.managerId !== manager.id) {
      return errorResponse('You can only approve normalization requests for your direct reports', 403)
    }

    if (normalization.employee.id === manager.id) {
      return errorResponse('You cannot approve your own normalization request', 403)
    }

    if (normalization.status !== 'PENDING') {
      return errorResponse('This request is not pending', 400)
    }

    if (normalization.managerApprovedAt) {
      return errorResponse('This request has already been processed by manager', 400)
    }

    if (status === 'APPROVED' && !normalizeAs) {
      return errorResponse('normalizeAs (FULL_DAY or HALF_DAY) is required when approving', 400)
    }

    const updated = await prisma.attendanceNormalization.update({
      where: { id },
      data:
        status === 'APPROVED'
          ? {
              managerApprovedById: manager.id,
              managerApprovedAt: new Date(),
              normalizeAs: normalizeAs ?? 'FULL_DAY',
            }
          : {
              status: 'REJECTED',
            },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            user: { select: { name: true, email: true } },
          },
        },
        requestedBy: {
          select: {
            id: true,
            user: { select: { name: true } },
          },
        },
      },
    })

    if (status === 'APPROVED') {
      const hrHeads = await prisma.user.findMany({
        where: { role: 'HR_HEAD' },
        select: { id: true },
      })
      const empName = normalization.employee.user?.name ?? 'An employee'
      if (hrHeads.length > 0) {
        await prisma.notification.createMany({
          data: hrHeads.map((h) => ({
            userId: h.id,
            type: 'NORMALIZATION_REQUESTED',
            title: 'Normalization Request',
            message: `${empName} has requested attendance normalization (manager approved)`,
            link: '/hr/attendance-leaves?tab=normalizations',
            relatedId: normalization.employee.id,
          })),
        })
      }
    }

    return successResponse(
      updated,
      status === 'APPROVED'
        ? 'Normalization request approved. Pending HR approval.'
        : 'Normalization request rejected'
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Invalid request data', 400)
    }
    console.error('Error in manager approve:', error)
    return errorResponse('Failed to update normalization', 500)
  }
}
