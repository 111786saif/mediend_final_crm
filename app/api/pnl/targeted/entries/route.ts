import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { canWritePnl } from '@/lib/pnl/auth-pnl'
import { PNL_DEPARTMENT_KEYS, TARGET_PNL_SOURCE_KEYS } from '@/lib/pnl/constants'

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!canWritePnl(user)) return errorResponse('Forbidden', 403)

    const body = await request.json()
    const { departmentKey, sourceKey, month, year, amount, notes } = body

    if (!departmentKey || !(PNL_DEPARTMENT_KEYS as readonly string[]).includes(departmentKey)) {
      return errorResponse('Invalid departmentKey', 400)
    }
    if (!sourceKey || !(TARGET_PNL_SOURCE_KEYS as readonly string[]).includes(sourceKey)) {
      return errorResponse('Invalid sourceKey', 400)
    }

    const m = Number(month)
    const y = Number(year)
    if (!m || m < 1 || m > 12) return errorResponse('Invalid month', 400)
    if (!y || y < 2000) return errorResponse('Invalid year', 400)

    const row = await prisma.targetPnLEntry.upsert({
      where: {
        departmentKey_sourceKey_month_year: {
          departmentKey,
          sourceKey,
          month: m,
          year: y,
        },
      },
      create: {
        departmentKey,
        sourceKey,
        month: m,
        year: y,
        amount: Number(amount) || 0,
        notes: notes || null,
        createdById: user.id,
      },
      update: {
        amount: Number(amount) || 0,
        notes: notes || null,
      },
    })

    return successResponse(row)
  } catch (error) {
    console.error('Error saving targeted PnL entry:', error)
    return errorResponse('Failed to save targeted entry', 500)
  }
}
