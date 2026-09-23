/**
 * Script to process pending incoming leads
 * 
 * Usage:
 *   npx tsx process-incoming-leads.ts                    # Process leads (fails if BD users missing)
 *   npx tsx process-incoming-leads.ts --auto-create-bd    # Auto-create missing BD users
 *   npx tsx process-incoming-leads.ts -a                 # Short form
 */

import 'dotenv/config'
import { processAllPendingLeads } from './lib/process-incoming-leads'
import { prisma } from './lib/prisma'

async function main() {
  // Check for auto-create flag
  const autoCreateBD = process.argv.includes('--auto-create-bd') || process.argv.includes('-a')
  
  if (autoCreateBD) {
    console.log('⚠️  Auto-create mode enabled: Missing BD users will be created automatically\n')
  }

  console.log('Processing pending incoming leads...\n')

  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.error('❌ Error: DATABASE_URL environment variable is not set.')
    console.error('   Please make sure you have a .env file with DATABASE_URL configured.')
    process.exit(1)
  }

  try {
    // Test database connection
    await prisma.$connect()
    console.log('✅ Database connection established\n')

    const results = await processAllPendingLeads(autoCreateBD)

    console.log(`\n✅ Processing Complete:`)
    console.log(`   - Processed: ${results.processed}`)
    console.log(`   - Failed: ${results.failed}`)
    console.log(`   - Total: ${results.processed + results.failed}\n`)

    if (results.results.length > 0) {
      console.log('Results:')
      results.results.forEach((result, index) => {
        const status = result.success ? '✅' : '❌'
        console.log(`   ${status} Lead ${index + 1} (${String(result.id)}...): ${result.success ? 'Success' : result.error}`)
      })
    }

    if (results.failed > 0) {
      console.log('\n⚠️  Some leads failed to process. Check the errors above.')
      await prisma.$disconnect()
      process.exit(1)
    } else {
      console.log('\n✨ All leads processed successfully!')
      await prisma.$disconnect()
      process.exit(0)
    }
  } catch (error) {
    console.error('❌ Error processing leads:', error)
    await prisma.$disconnect()
    process.exit(1)
  }
}

main()

