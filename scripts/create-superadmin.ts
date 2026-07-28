import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'

async function main() {
  const email = process.argv[2]?.toLowerCase().trim()
  const password = process.argv[3]
  const name = process.argv[4]?.trim() || 'Super Admin'

  if (!email || !password) {
    console.error(
      'Usage: bun run create:superadmin <email> <password> [name]'
    )
    process.exit(1)
  }

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set.')
    process.exit(1)
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  })

  try {
    const passwordHash = await bcrypt.hash(password, 10)

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name,
        role: 'SUPER_ADMIN',
        passwordHash,
      },
      create: {
        email,
        name,
        role: 'SUPER_ADMIN',
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    })

    console.log('Super admin is ready:')
    console.log(`  ID:    ${user.id}`)
    console.log(`  Name:  ${user.name}`)
    console.log(`  Email: ${user.email}`)
    console.log(`  Role:  ${user.role}`)
    console.log('  Password updated: yes')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error('Failed to create super admin:', error)
  process.exit(1)
})
