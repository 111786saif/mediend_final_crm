import { NextRequest } from 'next/server'
import { z } from 'zod'
import { SalesTeamCostEntryType, UserRole } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { canReceiveIncentive, type SalesTeamCostRoleType } from '@/lib/sales-team-cost/types'

function toRoleType(role: UserRole): SalesTeamCostRoleType | null {
  switch (role) {
    case UserRole.SALES_HEAD:
      return 'salesHead'
    case UserRole.CATEGORY_MANAGER:
    case UserRole.ASSISTANT_CATEGORY_MANAGER:
      return 'catManager'
    case UserRole.TEAM_LEAD:
      return 'tl'
    case UserRole.BD:
      return 'bd'
    default:
      return null
  }
}

const schema = z.object({
  employeeId: z.string().min(1),
  entryType: z.enum(['INCENTIVE', 'SEATING', 'MISC']),
  amount: z.number().positive(),
  entryDate: z.string().min(1),
  note: z.string().max(2000).nullable().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'finance:write')) return errorResponse('Forbidden', 403)

    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(parsed.error.errors[0]?.message ?? 'Invalid input', 400)
    }

    const employee = await prisma.employee.findUnique({
      where: { id: parsed.data.employeeId },
      select: { id: true, user: { select: { role: true } } },
    })
    if (!employee) return errorResponse('Employee not found', 404)

    const roleType = toRoleType(employee.user.role)
    if (!roleType) return errorResponse('Employee is not part of the sales cost hierarchy', 400)

    if (parsed.data.entryType === 'INCENTIVE' && !canReceiveIncentive(roleType)) {
      return errorResponse('Incentives can only be added for Sales Head', 400)
    }

    const entryTypeMap: Record<'INCENTIVE' | 'SEATING' | 'MISC', SalesTeamCostEntryType> = {
      INCENTIVE: SalesTeamCostEntryType.INCENTIVE,
      SEATING: SalesTeamCostEntryType.SEATING,
      MISC: SalesTeamCostEntryType.MISC,
    }

    const entry = await prisma.salesTeamCostEntry.create({
      data: {
        employeeId: parsed.data.employeeId,
        entryType: entryTypeMap[parsed.data.entryType],
        amount: parsed.data.amount,
        entryDate: new Date(parsed.data.entryDate),
        note: parsed.data.note?.trim() || null,
        addedByUserId: user.id,
      },
      include: {
        addedBy: { select: { name: true } },
      },
    })

    return successResponse({
      id: entry.id,
      amount: entry.amount,
      date: entry.entryDate.toISOString().slice(0, 10),
      note: entry.note,
      addedBy: entry.addedBy.name,
      addedAt: entry.createdAt.toISOString(),
      entryType: entry.entryType,
    })
  } catch (error) {
    console.error('Error creating sales team cost entry:', error)
    const message =
      error instanceof Error && error.message.includes('SalesTeamCostEntryType')
        ? 'Cost entry type not supported. Restart the dev server after running npx prisma generate.'
        : 'Failed to save entry'
    return errorResponse(message, 500)
  }
}
