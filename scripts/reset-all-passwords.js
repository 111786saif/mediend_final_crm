/**
 * Reset every user's password to the same value.
 *
 * Usage (server):
 *   docker compose --profile tools run --rm reset-all-passwords
 *   docker compose --profile tools run --rm reset-all-passwords MyTempPass123
 *
 * Default password: 12345678
 */
import bcrypt from 'bcryptjs'
import { PrismaClient } from '../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function main() {
  const password = process.argv[2] || '12345678'
  const passwordHash = await bcrypt.hash(password, 10)

  const result = await prisma.user.updateMany({
    data: { passwordHash },
  })

  console.log(`Password reset successful for ${result.count} users.`)
  console.log(`New password for all accounts: ${password}`)
  console.log('Users should change their password after first login.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
