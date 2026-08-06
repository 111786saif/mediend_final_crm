import { prisma } from '@/lib/prisma'

function normalizeSubStatusText(value: string) {
  const normalized = value.trim()
  return normalized ? normalized.slice(0, 25) : null
}

export async function resolveInboundSubStatus(
  value: string | number | null | undefined
) {
  if (value === null || value === undefined) return null

  if (typeof value === 'number' && Number.isInteger(value)) {
    const match = await prisma.crmSubStatusMaster.findFirst({
      where: {
        key: value,
        isActive: true,
      },
      select: {
        value: true,
      },
    })

    return normalizeSubStatusText(match?.value ?? String(value))
  }

  const normalized = String(value).trim()
  if (!normalized) return null

  if (/^\d+$/.test(normalized)) {
    const parsed = Number.parseInt(normalized, 10)
    if (Number.isInteger(parsed)) {
      const match = await prisma.crmSubStatusMaster.findFirst({
        where: {
          key: parsed,
          isActive: true,
        },
        select: {
          value: true,
        },
      })

      return normalizeSubStatusText(match?.value ?? normalized)
    }
  }

  return normalizeSubStatusText(normalized)
}
