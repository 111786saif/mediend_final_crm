import { NextRequest } from 'next/server'
import { NotificationType } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { z } from 'zod'

const bodySchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  normalizeAs: z.enum(['FULL_DAY', 'HALF_DAY']).optional(),
  remarks: z.string().optional(),
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

    if (user.role !== 'MD') {
      return errorResponse('Only MD can use this endpoint', 403)
    }

    const mdEmployee = await prisma.employee.findUnique({
      where: { userId: user.id },
    })

    if (!mdEmployee) {
      return errorResponse('Employee record not found', 404)
    }

    const { id } = await params
    const body = await request.json()
    const { status, normalizeAs, remarks } = bodySchema.parse(body)

    const normalization = await prisma.attendanceNormalization.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            managerId: true,
            employeeCode: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    })

    if (!normalization) {
      return errorResponse('Normalization request not found', 404)
    }

    if (normalization.type !== 'EMPLOYEE_REQUEST') {
      return errorResponse('Only employee-initiated normalization requests can be approved by MD', 400)
    }

    if (normalization.employee.managerId !== mdEmployee.id) {
      return errorResponse('You can only approve normalization requests for your direct reports', 403)
    }

    if (normalization.employee.id === mdEmployee.id) {
      return errorResponse('You cannot approve your own normalization request', 403)
    }

    if (normalization.status !== 'PENDING') {
      return errorResponse('This request is not pending', 400)
    }

    if (normalization.managerApprovedAt) {
      return errorResponse('This request has already been processed', 400)
    }

    if (status === 'APPROVED' && !normalizeAs) {
      return errorResponse('normalizeAs (FULL_DAY or HALF_DAY) is required when approving', 400)
    }

    const updated = await prisma.attendanceNormalization.update({
      where: { id },
      data: {
        status,
        managerApprovedById: mdEmployee.id,
        managerApprovedAt: new Date(),
        normalizeAs: status === 'APPROVED' ? (normalizeAs ?? 'FULL_DAY') : null,
        approvedById: status === 'APPROVED' ? mdEmployee.id : null,
        ...(remarks && { reason: remarks }), // reuse reason field for remarks if provided
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            user: { select: { id: true, name: true, email: true } },
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

    // Notify the employee
    if (updated.employee.user) {
      await prisma.notification.create({
        data: {
          userId: updated.employee.user.id, // userId is on the User table
          type:
            status === 'APPROVED'
              ? NotificationType.NORMALIZATION_APPROVED
              : NotificationType.NORMALIZATION_REJECTED,
          title: status === 'APPROVED' ? 'Normalization Approved' : 'Normalization Rejected',
          message: status === 'APPROVED' 
            ? `Your attendance normalization request for ${updated.date.toISOString().split('T')[0]} has been approved by MD.`
            : `Your attendance normalization request for ${updated.date.toISOString().split('T')[0]} has been rejected by MD.`,
          link: '/employee/attendance',
          relatedId: updated.employee.id,
        },
      })
    }

    return successResponse(
      updated,
      status === 'APPROVED' ? 'Normalization approved successfully' : 'Normalization rejected'
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Invalid request data', 400)
    }
    console.error('Error in MD normalization approval:', error)
    return errorResponse('Failed to update normalization', 500)
  }
}
