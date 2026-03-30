import { NextRequest } from 'next/server'
import { NotificationType } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { z } from 'zod'

const bodySchema = z
  .object({
    status: z.enum(['APPROVED', 'REJECTED']),
    normalizeAs: z.enum(['FULL_DAY', 'HALF_DAY']).optional(),
    remarks: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status === 'REJECTED') {
      const r = (data.remarks ?? '').trim()
      if (r.length < 15) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Rejection reason must be at least 15 characters',
          path: ['remarks'],
        })
      }
    }
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
    const parsed = bodySchema.parse(body)
    const { status, normalizeAs, remarks } = parsed
    const rejectionRemarks = status === 'REJECTED' ? (remarks ?? '').trim() : null

    const normalization = await prisma.attendanceNormalization.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            managerId: true,
            employeeCode: true,
            userId: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    })

    if (!normalization) {
      return errorResponse('Normalization request not found', 404)
    }

    if (normalization.employee.id === mdEmployee.id) {
      return errorResponse('You cannot approve your own normalization request', 403)
    }

    if (normalization.status !== 'PENDING') {
      return errorResponse('This request is not pending', 400)
    }

    if (normalization.type !== 'MANAGER' && normalization.type !== 'EMPLOYEE_REQUEST') {
      return errorResponse('Unsupported normalization type', 400)
    }

    const isDirectReportFirstStep =
      normalization.type === 'EMPLOYEE_REQUEST' &&
      !normalization.managerApprovedAt &&
      normalization.employee.managerId === mdEmployee.id

    const isDirectReportFinalStep =
      normalization.employee.managerId === mdEmployee.id &&
      (normalization.type === 'MANAGER' ||
        (normalization.type === 'EMPLOYEE_REQUEST' && normalization.managerApprovedAt != null))

    if (!isDirectReportFirstStep && !isDirectReportFinalStep) {
      return errorResponse('You cannot approve this normalization request', 403)
    }

    let resolvedNormalizeAs: 'FULL_DAY' | 'HALF_DAY' | null = null
    if (status === 'APPROVED') {
      const fromRecord =
        normalization.normalizeAs === 'HALF_DAY' || normalization.normalizeAs === 'FULL_DAY'
          ? normalization.normalizeAs
          : null
      resolvedNormalizeAs = normalizeAs ?? fromRecord
      if (!resolvedNormalizeAs) {
        return errorResponse('normalizeAs (FULL_DAY or HALF_DAY) is required when approving', 400)
      }
    }

    const updated = await prisma.attendanceNormalization.update({
      where: { id },
      data: isDirectReportFirstStep
        ? status === 'REJECTED'
          ? {
              status: 'REJECTED',
              hrRejectionReason: rejectionRemarks,
              normalizeAs: null,
              approvedById: null,
            }
          : {
              status,
              managerApprovedById: mdEmployee.id,
              managerApprovedAt: new Date(),
              normalizeAs: resolvedNormalizeAs,
              approvedById: mdEmployee.id,
              hrRejectionReason: null,
            }
        : {
            status,
            approvedById: status === 'APPROVED' ? mdEmployee.id : null,
            hrRejectionReason: status === 'REJECTED' ? rejectionRemarks : null,
            normalizeAs: resolvedNormalizeAs,
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

    if (updated.employee.user) {
      const dateStr = updated.date.toISOString().split('T')[0]
      await prisma.notification.create({
        data: {
          userId: updated.employee.user.id,
          type:
            status === 'APPROVED'
              ? NotificationType.NORMALIZATION_APPROVED
              : NotificationType.NORMALIZATION_REJECTED,
          title: status === 'APPROVED' ? 'Normalization Approved' : 'Normalization Rejected',
          message:
            status === 'APPROVED'
              ? `Your attendance normalization request for ${dateStr} has been approved by MD.`
              : `Your attendance normalization request for ${dateStr} has been rejected by MD.`,
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
      return errorResponse(error.issues[0]?.message ?? 'Invalid request data', 400)
    }
    console.error('Error in MD normalization approval:', error)
    return errorResponse('Failed to update normalization', 500)
  }
}
