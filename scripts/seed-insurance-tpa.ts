/**
 * Seed InsuranceMaster and TPAMaster with standard companies.
 * Upsert-only — existing records are preserved, new ones are added.
 *
 * Run: npx tsx scripts/seed-insurance-tpa.ts
 * Or via Docker: docker compose --profile tools run --rm seed-insurance-tpa
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

const INSURANCE_COMPANIES = [
  'Care Health',
  'New India Assurance',
  'Oriental Insurance',
  'ICICI Lombard',
  'Star Health',
  'Aditya Birla Health',
  'Bajaj Allianz',
  'United India',
  'Acko',
  'Niva Bupa',
  'Zurich Kotak',
  'IndusInd',
  'SBI General',
  'HDFC ERGO',
  'Navi General',
  'Tata AIG',
  'Manipal Cigna',
  'National Insurance',
  'Royal Sundaram',
  'Generali Central India',
  'Universal Sompo',
  'Magma HDI',
  'Go Digit',
  'Zuno',
  'IFFCO Tokio',
  'Chola MS',
  'Liberty General',
]

const TPA_COMPANIES = [
  'Medi Assist',
  'Paramount Health',
  'Vidal Health',
  'Family Health Plan',
  'Health Assist',
  'Raksha Health',
  'Good Health',
  'Health India',
  'MDIndia Health',
  'Volo Health',
  'Health Insurance TPA of India',
  'Genins India',
  'Ericson',
  'Medsave Health',
  'Heritage Health',
  'Park Mediclaim',
]

async function main() {
  console.log(`Seeding ${INSURANCE_COMPANIES.length} insurance companies...`)
  for (const name of INSURANCE_COMPANIES) {
    await prisma.insuranceMaster.upsert({
      where: { name },
      create: { name },
      update: {},
    })
  }

  console.log(`Seeding ${TPA_COMPANIES.length} TPA companies...`)
  for (const name of TPA_COMPANIES) {
    await prisma.tPAMaster.upsert({
      where: { name },
      create: { name },
      update: {},
    })
  }

  console.log('✅ Insurance & TPA seed complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
