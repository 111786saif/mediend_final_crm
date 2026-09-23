import 'dotenv/config'
import { prisma } from '@/lib/prisma'
import { normalizeSourceForDb, mapTreatmentCode } from '@/lib/mysql-code-mappings'

/**
 * One-time migration script to fix existing leads that have numeric source/treatment values.
 * Run this after the mapper was updated to use mapSourceCode/mapTreatmentCode.
 * 
 * Usage: tsx scripts/fix-existing-lead-mappings.ts
 */

const BATCH_SIZE = 1000
const UPDATE_CHUNK_SIZE = 50 // smaller transactions to avoid long-running transactions

async function fixLeadMappings() {
  const startTime = Date.now()
  console.log('\n' + '='.repeat(60))
  console.log('🔧 Fixing existing lead source/treatment mappings')
  console.log('='.repeat(60))

  try {
    // Get total count
    const totalLeads = await prisma.lead.count()
    console.log(`📊 Total leads in database: ${totalLeads.toLocaleString()}`)

    let processed = 0
    let updated = 0
    let cursor: number | undefined = undefined

    while (true) {
      // Fetch batch using cursor pagination
      const leads: Array<{ id: number; source: string | null; treatment: string | null }> =
        await prisma.lead.findMany({
          take: BATCH_SIZE,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
          select: {
            id: true,
            source: true,
            treatment: true,
          },
          orderBy: { id: 'asc' },
        })

      if (leads.length === 0) break

      // Process each lead
      const updates: Array<{ id: number; source: string | null; treatment: string | null }> = []

      for (const lead of leads) {
        let needsUpdate = false
        let newSource = lead.source
        let newTreatment = lead.treatment

        // Fix source: lookup-based only (source 1–23, campaign legacy 58, status legacy 25/27/28 → Unknown).
        // Do NOT treat unknown numerics as treatment IDs — CRM lead.Source is ~98% clean.
        if (lead.source != null && String(lead.source).trim() !== '') {
          const resolved = normalizeSourceForDb(lead.source)
          if (resolved !== null && resolved !== lead.source) {
            newSource = resolved
            needsUpdate = true
          }
        }

        // Fix treatment if it's a numeric code
        if (lead.treatment != null && String(lead.treatment).trim() !== '' && /^\d+$/.test(String(lead.treatment).trim())) {
          const mapped = mapTreatmentCode(lead.treatment)
          if (mapped !== lead.treatment) {
            newTreatment = mapped
            needsUpdate = true
          }
        }

        if (needsUpdate) {
          updates.push({
            id: lead.id,
            source: newSource,
            treatment: newTreatment,
          })
        }
      }

      // Batch update in small chunks to stay under Prisma transaction timeout
      if (updates.length > 0) {
        for (let i = 0; i < updates.length; i += UPDATE_CHUNK_SIZE) {
          const chunk = updates.slice(i, i + UPDATE_CHUNK_SIZE)
          await prisma.$transaction(
            chunk.map((u) =>
              prisma.lead.update({
                where: { id: u.id },
                data: {
                  source: u.source,
                  treatment: u.treatment,
                },
              })
            )
          )
          updated += chunk.length
        }
      }

      processed += leads.length
      cursor = leads[leads.length - 1].id

      const progress = ((processed / totalLeads) * 100).toFixed(1)
      console.log(
        `   Processed: ${processed.toLocaleString()}/${totalLeads.toLocaleString()} (${progress}%) | Updated: ${updated.toLocaleString()}`
      )

      if (leads.length < BATCH_SIZE) break
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log('\n' + '='.repeat(60))
    console.log(`✅ Migration completed in ${elapsed}s`)
    console.log(`   Total processed: ${processed.toLocaleString()}`)
    console.log(`   Total updated: ${updated.toLocaleString()}`)
    console.log(`   Unchanged: ${(processed - updated).toLocaleString()}`)
    console.log('='.repeat(60) + '\n')
  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

fixLeadMappings()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
