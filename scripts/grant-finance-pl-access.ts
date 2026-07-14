import 'dotenv/config'
import { prisma } from '../lib/prisma'
import { SubjectType, PermissionLevel } from '../generated/prisma/client'

const ROLE = 'FINANCE_HEAD'
const PREFIXES = [
  'insurance_pl.pl_outstanding',
  'insurance_pl.doctor_list',
  'insurance_pl.hospital_list',
]

async function main() {
  const granter =
    (await prisma.user.findFirst({
      where: { role: 'MD' },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    })) ??
    (await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    })) ??
    (await prisma.user.findFirst({
      where: { role: 'FINANCE_HEAD' },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    }))

  if (!granter) {
    throw new Error('No MD/ADMIN/FINANCE_HEAD user found to use as grantedBy')
  }

  const resources = await prisma.resource.findMany({
    where: {
      isActive: true,
      OR: PREFIXES.flatMap((p) => [{ key: p }, { key: { startsWith: p + '.' } }]),
    },
    select: { id: true, key: true },
  })

  console.log('Matched resources:', resources.length)
  if (resources.length === 0) {
    throw new Error('No resources found — seed resources first')
  }

  let created = 0
  let updated = 0
  let skipped = 0

  for (const res of resources) {
    const existing = await prisma.permissionAssignment.findFirst({
      where: { subjectType: SubjectType.ROLE, role: ROLE, resourceId: res.id },
    })

    if (existing) {
      if (existing.permissionLevel === PermissionLevel.NONE) {
        await prisma.permissionAssignment.update({
          where: { id: existing.id },
          data: {
            permissionLevel: PermissionLevel.FULL_ACCESS,
            canGrant: false,
            grantedById: granter.id,
          },
        })
        updated++
      } else {
        skipped++
      }
      continue
    }

    await prisma.permissionAssignment.create({
      data: {
        subjectType: SubjectType.ROLE,
        role: ROLE,
        resourceId: res.id,
        permissionLevel: PermissionLevel.FULL_ACCESS,
        canGrant: false,
        grantedById: granter.id,
      },
    })
    created++
  }

  console.log({ role: ROLE, created, updated, skipped, totalMatched: resources.length })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
