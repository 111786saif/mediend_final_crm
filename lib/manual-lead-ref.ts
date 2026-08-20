import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'

const MANUAL_LEAD_REF_REGEX = '^M[0-9]+$'
const MANUAL_LEAD_REF_MIN_WIDTH = 6

export function isLeadRefUniqueViolation(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    Array.isArray(error.meta?.target) &&
    error.meta.target.includes('leadRef')
  )
}

export async function generateNextManualLeadRef() {
  const rows = await prisma.$queryRaw<Array<{ leadRef: string }>>(Prisma.sql`
    SELECT "leadRef"
    FROM "Lead"
    WHERE "leadRef" ~ ${MANUAL_LEAD_REF_REGEX}
    ORDER BY LENGTH("leadRef") DESC, "leadRef" DESC
    LIMIT 1
  `)

  const latestLeadRef = rows[0]?.leadRef ?? null
  const currentNumber = latestLeadRef ? Number.parseInt(latestLeadRef.slice(1), 10) : 0
  const nextNumber = Number.isFinite(currentNumber) ? currentNumber + 1 : 1

  return `M${String(nextNumber).padStart(MANUAL_LEAD_REF_MIN_WIDTH, '0')}`
}

export async function withGeneratedManualLeadRef<T>(
  createLead: (leadRef: string) => Promise<T>,
  maxAttempts: number = 5
): Promise<T> {
  let lastError: unknown = null

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const leadRef = await generateNextManualLeadRef()

    try {
      return await createLead(leadRef)
    } catch (error) {
      if (!isLeadRefUniqueViolation(error)) {
        throw error
      }

      lastError = error
    }
  }

  throw lastError ?? new Error('Failed to generate a unique manual lead reference')
}
