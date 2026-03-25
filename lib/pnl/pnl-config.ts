import { prisma } from '@/lib/prisma'

const SEAT_KEY = 'SEAT_COST_PER_EMPLOYEE'

export async function ensureDefaultSeatCostConfig(): Promise<void> {
  const existing = await prisma.pnLConfig.findUnique({ where: { key: SEAT_KEY } })
  if (existing) return
  await prisma.pnLConfig.create({
    data: { key: SEAT_KEY, value: 25000 },
  })
}

export async function getSeatCostPerEmployee(): Promise<number> {
  await ensureDefaultSeatCostConfig()
  const row = await prisma.pnLConfig.findUnique({ where: { key: SEAT_KEY } })
  return row?.value ?? 25000
}
