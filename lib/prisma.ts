import { PrismaClient } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaAdapter: PrismaPg | undefined
}

// Supabase session poolers allow few concurrent clients (often ~15 total for the project).
// Keep this process to a single connection so Next + Prisma Studio + other apps don't exhaust it.
const poolMax = Math.max(1, Math.min(3, Number(process.env.DATABASE_POOL_MAX) || 1))

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  max: poolMax,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 15_000,
  allowExitOnIdle: true,
})

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'development'
        ? ['error', 'warn']
        : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma