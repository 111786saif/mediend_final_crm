import { PrismaClient } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaAdapter: PrismaPg | undefined
}

const adapter =
  globalForPrisma.prismaAdapter ??
  new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    max: Math.max(1, Number(process.env.DATABASE_POOL_MAX) || 1),
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prismaAdapter = adapter

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'development'
        ? process.env.DISABLE_QUERY_LOGS === 'true'
          ? ['error', 'warn']
          : ['query', 'error', 'warn']
        : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma