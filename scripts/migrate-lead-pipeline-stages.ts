/**
 * One-time migration script to backfill pipelineStage and conversionDate for existing leads.
 * Re-infers pipelineStage from status (IPD Done/Closed -> COMPLETED, Junk/Lost/etc -> LOST)
 * and sets conversionDate for COMPLETED leads using surgeryDate or ipdAdmissionDate.
 *
 * Run after deploying the mysql-lead-mapper fix. Requires DATABASE_URL in .env.
 * Usage: tsx scripts/migrate-lead-pipeline-stages.ts
 */

import 'dotenv/config'
import { prisma } from '@/lib/prisma'
import { inferPipelineStage } from '@/lib/sync/mysql-lead-mapper'
import { PipelineStage } from '@/generated/prisma/client'

const BATCH_SIZE = 500
const UPDATE_CHUNK_SIZE = 50

async function migrateLeadPipelineStages() {
  const startTime = Date.now()
  console.log('\n' + '='.repeat(60))
  console.log('Migrating lead pipeline stages and conversion dates')
  console.log('='.repeat(60))

  try {
    const totalLeads = await prisma.lead.count()
    console.log(`Total leads in database: ${totalLeads.toLocaleString()}`)

    let processed = 0
    let updated = 0
    const summary = { toCompleted: 0, toLost: 0, toSales: 0, conversionDateSet: 0 }
    let cursor: number | undefined = undefined

    while (true) {
      const leads: Array<{
        id: number
        status: string
        pipelineStage: PipelineStage
        conversionDate: Date | null
        surgeryDate: Date | null
        ipdAdmissionDate: Date | null
        createdDate: Date
      }> = await prisma.lead.findMany({
        take: BATCH_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        select: {
          id: true,
          status: true,
          pipelineStage: true,
          conversionDate: true,
          surgeryDate: true,
          ipdAdmissionDate: true,
          createdDate: true,
        },
        orderBy: { id: 'asc' },
      })

      if (leads.length === 0) break

      const updates: Array<{
        id: number
        pipelineStage: PipelineStage
        conversionDate: Date | null
      }> = []

      for (const lead of leads) {
        const inferredStage = inferPipelineStage(lead.status)
        if (inferredStage === lead.pipelineStage) {
          // No stage change needed, but we might still need to set conversionDate for COMPLETED
          if (inferredStage === PipelineStage.COMPLETED && !lead.conversionDate) {
            const conversionDate =
              lead.surgeryDate ?? lead.ipdAdmissionDate ?? lead.createdDate
            updates.push({
              id: lead.id,
              pipelineStage: inferredStage,
              conversionDate,
            })
            summary.conversionDateSet++
          }
          continue
        }

        let conversionDate: Date | null = null
        if (inferredStage === PipelineStage.COMPLETED) {
          conversionDate =
            lead.surgeryDate ?? lead.ipdAdmissionDate ?? lead.createdDate
          summary.conversionDateSet++
        }
        if (inferredStage === PipelineStage.COMPLETED) summary.toCompleted++
        else if (inferredStage === PipelineStage.LOST) summary.toLost++
        else summary.toSales++

        updates.push({
          id: lead.id,
          pipelineStage: inferredStage,
          conversionDate,
        })
      }

      if (updates.length > 0) {
        for (let i = 0; i < updates.length; i += UPDATE_CHUNK_SIZE) {
          const chunk = updates.slice(i, i + UPDATE_CHUNK_SIZE)
          await prisma.$transaction(
            chunk.map((u) =>
              prisma.lead.update({
                where: { id: u.id },
                data: {
                  pipelineStage: u.pipelineStage,
                  conversionDate: u.conversionDate,
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
    console.log(`Migration completed in ${elapsed}s`)
    console.log(`   Total processed: ${processed.toLocaleString()}`)
    console.log(`   Total updated: ${updated.toLocaleString()}`)
    console.log(`   -> COMPLETED: ${summary.toCompleted}`)
    console.log(`   -> LOST: ${summary.toLost}`)
    console.log(`   -> SALES: ${summary.toSales}`)
    console.log(`   conversionDate set: ${summary.conversionDateSet}`)
    console.log('='.repeat(60) + '\n')
  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

migrateLeadPipelineStages()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
