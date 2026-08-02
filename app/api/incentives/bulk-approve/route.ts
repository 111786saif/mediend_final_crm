import { NextRequest } from 'next/server'
import { z } from 'zod'
import { EmployeeIncentiveStatus, Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  canApproveIncentives,
  canPayIncentives,
  canReadIncentives,
} from '@/lib/incentives/permissions'

const bulkSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
})

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!canReadIncentives(user)) return errorResponse('Forbidden', 403)
    if (!canApproveIncentives(user)) return errorResponse('Forbidden: cannot approve incentives', 403)

    const body = await request.json()
    const parsed = bulkSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(parsed.error.errors[0]?.message ?? 'Invalid input', 400)
    }

    const records = await prisma.employeeMonthlyIncentive.findMany({
      where: { id: { in: parsed.data.ids } },
      select: { id: true, status: true },
    })

    if (records.length !== parsed.data.ids.length) {
      return errorResponse('One or more incentive records were not found', 404)
    }

    const invalid = records.filter((r) => r.status !== EmployeeIncentiveStatus.PENDING)
    if (invalid.length > 0) {
      return errorResponse('Only pending incentives can be approved', 400)
    }

    const updated = await prisma.$transaction(
      records.map((record) =>
        prisma.employeeMonthlyIncentive.update({
          where: { id: record.id },
          data: {
            status: EmployeeIncentiveStatus.APPROVED,
            updatedByUserId: user.id,
          },
        }),
      ),
    )

    return successResponse({ count: updated.length })
  } catch (error) {
    console.error('Error bulk approving incentives:', error)
    return errorResponse('Failed to approve incentives', 500)
  }
}
