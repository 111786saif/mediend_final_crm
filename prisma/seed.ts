import { PrismaClient } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'
import pkg from 'pg'

const { Pool } = pkg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

const adapter = new PrismaPg(pool)

const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Starting database seed...')

  // Create default admin user
  const adminEmail = 'admin@mediend.com'
  const adminPassword = 'Admin@123' // Change this in production!
  
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  })

  if (existingAdmin) {
    console.log('✅ Admin user already exists')
  } else {
    const passwordHash = await bcrypt.hash(adminPassword, 10)
    
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        name: 'System Admin',
        role: 'ADMIN',
      },
    })
    
    console.log('✅ Created admin user:')
    console.log(`   Email: ${adminEmail}`)
    console.log(`   Password: ${adminPassword}`)
    console.log('   ⚠️  Please change the password after first login!')
  }

  // Create a Sales Head user
  const salesHeadEmail = 'saleshead@mediend.com'
  const salesHeadPassword = 'SalesHead@123'
  
  const existingSalesHead = await prisma.user.findUnique({
    where: { email: salesHeadEmail },
  })

  if (!existingSalesHead) {
    const passwordHash = await bcrypt.hash(salesHeadPassword, 10)
    
    await prisma.user.create({
      data: {
        email: salesHeadEmail,
        passwordHash,
        name: 'Sales Head',
        role: 'SALES_HEAD',
      },
    })
    
    console.log('✅ Created Sales Head user:')
    console.log(`   Email: ${salesHeadEmail}`)
    console.log(`   Password: ${salesHeadPassword}`)
  }

  // Create a sample BD user
  const bdEmail = 'bd@mediend.com'
  const bdPassword = 'BD@123'
  
  const existingBD = await prisma.user.findUnique({
    where: { email: bdEmail },
  })

  if (!existingBD) {
    const passwordHash = await bcrypt.hash(bdPassword, 10)
    
    await prisma.user.create({
      data: {
        email: bdEmail,
        passwordHash,
        name: 'Sample BD',
        role: 'BD',
      },
    })
    
    console.log('✅ Created BD user:')
    console.log(`   Email: ${bdEmail}`)
    console.log(`   Password: ${bdPassword}`)
  }

  // Create Leave Types Master
  const leaveTypes = [
    { name: 'Casual', maxDays: 12 },
    { name: 'Paid', maxDays: 15 },
    { name: 'Sick', maxDays: 10 },
  ]

  for (const leaveType of leaveTypes) {
    const existing = await prisma.leaveTypeMaster.findUnique({
      where: { name: leaveType.name },
    })

    if (!existing) {
      await prisma.leaveTypeMaster.create({
        data: leaveType,
      })
      console.log(`✅ Created leave type: ${leaveType.name} (${leaveType.maxDays} days)`)
    } else {
      console.log(`ℹ️  Leave type already exists: ${leaveType.name}`)
    }
  }

  console.log('\n🎉 Seed completed successfully!')
  console.log('\n📝 Default Users Created:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Admin:')
  console.log(`  Email: ${adminEmail}`)
  console.log(`  Password: ${adminPassword}`)
  console.log('\nSales Head:')
  console.log(`  Email: ${salesHeadEmail}`)
  console.log(`  Password: ${salesHeadPassword}`)
  console.log('\nBD:')
  console.log(`  Email: ${bdEmail}`)
  console.log(`  Password: ${bdPassword}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('\n⚠️  IMPORTANT: Change all passwords after first login!')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

