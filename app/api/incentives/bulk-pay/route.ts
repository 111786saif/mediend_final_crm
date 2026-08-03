import { NextRequest } from 'next/server'
import { z } from 'zod'
import { EmployeeIncentiveStatus } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
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
    if (!canPayIncentives(user)) return errorResponse('Forbidden: cannot mark incentives as paid', 403)

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

    const invalid = records.filter((r) => r.status !== EmployeeIncentiveStatus.APPROVED)
    if (invalid.length > 0) {
      return errorResponse('Only approved incentives can be marked as paid', 400)
    }

    const updated = await prisma.$transaction(
      records.map((record) =>
        prisma.employeeMonthlyIncentive.update({
          where: { id: record.id },
          data: {
            status: EmployeeIncentiveStatus.PAID,
            updatedByUserId: user.id,
          },
        }),
      ),
    )

    return successResponse({ count: updated.length })
  } catch (error) {
    console.error('Error bulk paying incentives:', error)
    return errorResponse('Failed to mark incentives as paid', 500)
  }
}
