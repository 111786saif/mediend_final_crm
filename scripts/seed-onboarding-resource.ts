import 'dotenv/config'
import { prisma } from '../lib/prisma'
import { SubjectType, PermissionLevel } from '../generated/prisma/client'

/**
 * Upsert hrm.onboarding resource and grant it to roles that already have hrm.people_org
 * (or ADMIN/TESTER via hrm parent). Safe to run repeatedly.
 */
async function main() {
  const hrm = await prisma.resource.findUnique({ where: { key: 'hrm' } })
  if (!hrm) {
    console.error('Parent resource "hrm" not found. Run seed:rbac first.')
    process.exit(1)
  }

  const resource = await prisma.resource.upsert({
    where: { key: 'hrm.onboarding' },
    create: {
      key: 'hrm.onboarding',
      label: 'Onboarding',
      type: 'SECTION',
      parentId: hrm.id,
      sortOrder: 3,
      isActive: true,
    },
    update: {
      label: 'Onboarding',
      parentId: hrm.id,
      sortOrder: 3,
      isActive: true,
    },
  })
  console.log('Resource ready:', resource.key, resource.id)

  const granter =
    (await prisma.user.findFirst({ where: { role: 'MD' }, select: { id: true }, orderBy: { createdAt: 'asc' } })) ??
    (await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true }, orderBy: { createdAt: 'asc' } }))

  if (!granter) {
    console.error('No MD/ADMIN user to use as grantedBy')
    process.exit(1)
  }

  const roles = [
    'MD',
    'ADMIN',
    'TESTER',
    'HR_HEAD',
    'EXECUTIVE_ASSISTANT',
    'IT_HEAD',
    'FINANCE_HEAD',
  ] as const

  for (const role of roles) {
    const existing = await prisma.permissionAssignment.findFirst({
      where: {
        subjectType: SubjectType.ROLE,
        role,
        resourceId: resource.id,
      },
    })
    if (existing) {
      console.log(`Already assigned to ${role}`)
      continue
    }
    await prisma.permissionAssignment.create({
      data: {
        subjectType: SubjectType.ROLE,
        role,
        resourceId: resource.id,
        permissionLevel: PermissionLevel.FULL_ACCESS,
        canGrant: role === 'MD' || role === 'ADMIN',
        grantedById: granter.id,
      },
    })
    console.log(`Granted to ${role}`)
  }

  console.log('Done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
