/**
 * Seed CRM circles and OPD doctor-admin dropdown masters.
 * Run: bun run prisma/seed-crm-opd-masters.ts
 */
import { PrismaClient } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pkg from 'pg'

const { Pool } = pkg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const CIRCLE_NAMES = [
  'Default',
  'Mumbai',
  'Pune',
  'Delhi',
  'Noida',
  'Gurugram',
  'Bangalore',
  'Faridabad',
  'Ghaziabad',
  'Nagpur',
  'Others',
  'Hyderabad',
  'Lucknow',
  'KOLKATA',
  'Chandigarh',
  'Jaipur',
  'Agra',
  'Ranchi',
  'Patna',
  'Chennai',
  'Thane',
  'Indore',
  'Nasik',
  'Agra',
] as const

const SURGERY_REMARKS = [
  {
    code: 'budget_constraint',
    label: 'Budget Might be a Constraint',
    displayOrder: 0,
  },
  {
    code: 'high_intent',
    label: 'High Intent Patient — Patient wants surgery now',
    displayOrder: 1,
  },
  {
    code: 'low_intent',
    label: 'Low Intent (medicine/need time/avoiding surgery/2nd opinion)',
    displayOrder: 2,
  },
  {
    code: 'others',
    label: 'Others',
    displayOrder: 3,
  },
] as const

const REASONS_NO_SURGERY = [
  {
    code: 'not_a_candidate',
    label: 'Not a Candidate',
    displayOrder: 0,
  },
  {
    code: 'investigation_required',
    label: 'Investigation Required',
    displayOrder: 1,
  },
  {
    code: 'on_medication',
    label: 'On Medication for now',
    displayOrder: 2,
  },
  {
    code: 'others',
    label: 'Others',
    displayOrder: 3,
  },
] as const

const FOLLOW_UP_REASONS = [
  {
    code: 'follow_up_after_investigation',
    label: 'Follow Up after Investigation',
    displayOrder: 0,
  },
  {
    code: 'follow_up_for_another_opd',
    label: 'Follow Up for another OPD',
    displayOrder: 1,
  },
  {
    code: 'follow_up_after_medication',
    label: 'Follow Up after Medication',
    displayOrder: 2,
  },
  {
    code: 'others',
    label: 'Others',
    displayOrder: 3,
  },
] as const

function uniqueNames(values: readonly string[]) {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(trimmed)
  }

  return result
}

async function seedCircles() {
  const circleNames = uniqueNames(CIRCLE_NAMES)

  for (const name of circleNames) {
    await prisma.crmCampaignCircle.upsert({
      where: { name },
      create: {
        name,
        isActive: true,
      },
      update: {
        isActive: true,
      },
    })
  }

  console.log(`✅ Seeded ${circleNames.length} circles`)
}

async function seedSurgeryRemarks() {
  for (const item of SURGERY_REMARKS) {
    await prisma.surgeryRemarkMaster.upsert({
      where: { code: item.code },
      create: {
        code: item.code,
        label: item.label,
        displayOrder: item.displayOrder,
        isActive: true,
      },
      update: {
        label: item.label,
        displayOrder: item.displayOrder,
        isActive: true,
      },
    })
  }

  console.log(`✅ Seeded ${SURGERY_REMARKS.length} surgery remarks`)
}

async function seedReasonsNoSurgery() {
  for (const item of REASONS_NO_SURGERY) {
    await prisma.reasonNoSurgeryMaster.upsert({
      where: { code: item.code },
      create: {
        code: item.code,
        label: item.label,
        displayOrder: item.displayOrder,
        isActive: true,
      },
      update: {
        label: item.label,
        displayOrder: item.displayOrder,
        isActive: true,
      },
    })
  }

  console.log(`✅ Seeded ${REASONS_NO_SURGERY.length} no-surgery reasons`)
}

async function seedFollowUpReasons() {
  for (const item of FOLLOW_UP_REASONS) {
    await prisma.followUpReasonMaster.upsert({
      where: { code: item.code },
      create: {
        code: item.code,
        label: item.label,
        displayOrder: item.displayOrder,
        isActive: true,
      },
      update: {
        label: item.label,
        displayOrder: item.displayOrder,
        isActive: true,
      },
    })
  }

  console.log(`✅ Seeded ${FOLLOW_UP_REASONS.length} follow-up reasons`)
}

async function main() {
  console.log('🌱 Starting CRM/OPD master seed...\n')

  await seedCircles()
  await seedSurgeryRemarks()
  await seedReasonsNoSurgery()
  await seedFollowUpReasons()

  console.log('\n🎉 CRM/OPD master seed completed successfully.')
}

main()
  .catch((error) => {
    console.error('❌ CRM/OPD master seed failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
