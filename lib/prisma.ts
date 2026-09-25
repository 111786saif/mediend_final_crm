import { PrismaClient } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaAdapter: PrismaPg | undefined
}

// Default to 20 concurrent connections. Override via DATABASE_POOL_MAX env var.
const poolMax = Math.max(1, Math.min(20, Number(process.env.DATABASE_POOL_MAX) || 20))

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