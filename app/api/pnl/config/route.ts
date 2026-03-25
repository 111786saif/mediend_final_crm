import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { canReadPnl, canWritePnl } from '@/lib/pnl/auth-pnl'
import { ensureDefaultSeatCostConfig } from '@/lib/pnl/pnl-config'

const SEAT_KEY = 'SEAT_COST_PER_EMPLOYEE'

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!canReadPnl(user)) return errorResponse('Forbidden', 403)

    await ensureDefaultSeatCostConfig()
    const row = await prisma.pnLConfig.findUnique({ where: { key: SEAT_KEY } })
    return successResponse({ seatCostPerEmployee: row?.value ?? 25000 })
  } catch (error) {
    console.error('pnl config GET', error)
    return errorResponse('Failed to load config', 500)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!canWritePnl(user)) return errorResponse('Forbidden', 403)

    const body = await request.json().catch(() => ({}))
    const v = Number(body.seatCostPerEmployee)
    if (!Number.isFinite(v) || v < 0) return errorResponse('Invalid seatCostPerEmployee', 400)

    await ensureDefaultSeatCostConfig()
    const row = await prisma.pnLConfig.upsert({
      where: { key: SEAT_KEY },
      create: { key: SEAT_KEY, value: v },
      update: { value: v },
    })

    return successResponse({ seatCostPerEmployee: row.value })
  } catch (error) {
    console.error('pnl config PATCH', error)
    return errorResponse('Failed to update config', 500)
  }
}
