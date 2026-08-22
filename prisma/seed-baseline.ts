/**
 * Baseline reference data required before users/leads are seeded.
 * Idempotent — safe to re-run.
 */
import 'dotenv/config'
import { prisma } from '../lib/prisma'

const LEAVE_TYPES = [
  {
    name: 'CL',
    code: 'CL',
    maxDays: 12,
    monthlyAccrual: 1,
    carryForward: false,
    probationUnlockDays: null as number | null,
  },
  {
    name: 'SL',
    code: 'SL',
    maxDays: 10,
    monthlyAccrual: 0.5,
    carryForward: false,
    probationUnlockDays: null as number | null,
  },
  {
    name: 'EL',
    code: 'EL',
    maxDays: 15,
    monthlyAccrual: 0.5,
    carryForward: true,
    probationUnlockDays: 12,
  },
  {
    name: 'LWB',
    code: 'LWB',
    maxDays: 365,
    monthlyAccrual: 0,
    carryForward: false,
    probationUnlockDays: null as number | null,
  },
] as const

/** HR departments referenced by employee JSON (DEPT column) and sales team rebuild. */
const DEPARTMENTS = [
  'SURGERY SALES',
  'HR',
  'FINANCE & ACCOUNTS',
  'IT',
  'INSURANCE',
  'P/L',
  'DIGITAL MARKETING',
  'COMPLIANCE',
  'LOAN & DEMAT',
  'OUTSTANDING',
  'MD OFFICE',
] as const

async function seedLeaveTypes() {
  for (const lt of LEAVE_TYPES) {
    await prisma.leaveTypeMaster.upsert({
      where: { name: lt.name },
      update: {
        code: lt.code,
        maxDays: lt.maxDays,
        monthlyAccrual: lt.monthlyAccrual,
        carryForward: lt.carryForward,
        probationUnlockDays: lt.probationUnlockDays,
        isActive: true,
      },
      create: {
        name: lt.name,
        code: lt.code,
        maxDays: lt.maxDays,
        monthlyAccrual: lt.monthlyAccrual,
        carryForward: lt.carryForward,
        probationUnlockDays: lt.probationUnlockDays,
        isActive: true,
      },
    })
  }
  console.log(`Leave types: ${LEAVE_TYPES.length} upserted (CL, SL, EL).`)
}

async function seedDepartments() {
  let created = 0
  for (const name of DEPARTMENTS) {
    const existing = await prisma.department.findFirst({ where: { name } })
    if (!existing) {
      await prisma.department.create({ data: { name } })
      created++
    }
  }
  console.log(`Departments: ${created} created, ${DEPARTMENTS.length - created} already existed.`)
}

async function seedPnLConfig() {
  const existing = await prisma.pnLConfig.findUnique({
    where: { key: 'SEAT_COST_PER_EMPLOYEE' },
  })
  if (!existing) {
    await prisma.pnLConfig.create({
      data: { key: 'SEAT_COST_PER_EMPLOYEE', value: 25000 },
    })
    console.log('PnLConfig: SEAT_COST_PER_EMPLOYEE = 25000 created.')
  } else {
    console.log('PnLConfig: SEAT_COST_PER_EMPLOYEE already exists.')
  }
}

async function main() {
  console.log('=== Seeding baseline reference data ===')
  await seedLeaveTypes()
  await seedDepartments()
  await seedPnLConfig()
  console.log('=== Baseline seed complete ===')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
