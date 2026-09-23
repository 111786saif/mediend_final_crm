/**
 * Backfill old CRM leads into COMPLETED pipeline and tag them as historical.
 *
 * Usage:
 *   bun run backfill:old-crm-leads -- --before 2026-07-01 --dry-run
 *   bun run backfill:old-crm-leads -- --before 2026-07-01
 */

import 'dotenv/config'
import { PipelineStage } from '@/generated/prisma/client'
import { normalizeLeadStatus } from '@/lib/pipeline-lead-buckets'
import { prisma } from '@/lib/prisma'

const BATCH_SIZE = 500
const UPDATE_CHUNK_SIZE = 50
const DRY_RUN = process.argv.includes('--dry-run')

function getArgValue(flag: string) {
  const index = process.argv.indexOf(flag)
  if (index === -1) return null
  return process.argv[index + 1] ?? null
}

function parseBeforeDate() {
  const raw = getArgValue('--before') ?? process.argv[2] ?? null
  if (!raw || raw.startsWith('--')) {
    throw new Error('Missing required date. Use --before YYYY-MM-DD')
  }

  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T00:00:00.000Z`)
    : new Date(raw)

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: ${raw}`)
  }

  return parsed
}

function resolveLeadCutoffDate(lead: {
  leadEntryDate: Date | null
  createdDate: Date | null
}) {
  return lead.leadEntryDate ?? lead.createdDate
}

async function main() {
  const beforeDate = parseBeforeDate()
  const startedAt = Date.now()

  console.log('')
  console.log('='.repeat(72))
  console.log(`Backfill old CRM leads (${DRY_RUN ? 'DRY RUN' : 'LIVE'})`)
  console.log(`Cutoff date: ${beforeDate.toISOString().slice(0, 10)} (exclusive)`)
  console.log('='.repeat(72))

  let cursor: number | undefined
  let scanned = 0
  let matched = 0
  let updated = 0

  while (true) {
    const leads = await prisma.lead.findMany({
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      where: {
        OR: [
          { leadEntryDate: { lt: beforeDate } },
          { leadEntryDate: null, createdDate: { lt: beforeDate } },
        ],
      },
      select: {
        id: true,
        leadRef: true,
        status: true,
        pipelineStage: true,
        isOldCrmLead: true,
        leadEntryDate: true,
        createdDate: true,
      },
    })

    if (leads.length === 0) break
    cursor = leads[leads.length - 1].id
    scanned += leads.length

    const targets = leads
      .filter((lead) => {
        const effectiveDate = resolveLeadCutoffDate(lead)
        if (!effectiveDate || effectiveDate.getTime() >= beforeDate.getTime()) {
          return false
        }

        return normalizeLeadStatus(lead.status) === 'IPD Done'
      })
      .filter(
        (lead) =>
          lead.pipelineStage !== PipelineStage.COMPLETED ||
          !lead.isOldCrmLead
      )
      .map((lead) => ({
        id: lead.id,
        leadRef: lead.leadRef,
        data: {
          pipelineStage: PipelineStage.COMPLETED,
          isOldCrmLead: true,
        },
      }))

    matched += targets.length

    if (DRY_RUN) {
      for (const lead of targets) {
        console.log(`[DRY] ${lead.leadRef} -> COMPLETED + Old CRM Lead tag`)
      }
    } else {
      for (let i = 0; i < targets.length; i += UPDATE_CHUNK_SIZE) {
        const chunk = targets.slice(i, i + UPDATE_CHUNK_SIZE)
        await prisma.$transaction(
          chunk.map((lead) =>
            prisma.lead.update({
              where: { id: lead.id },
              data: lead.data,
            })
          )
        )
        updated += chunk.length
      }
    }

    console.log(
      `  progress: scanned=${scanned} matched=${matched} updated=${DRY_RUN ? 0 : updated}`
    )

    if (leads.length < BATCH_SIZE) break
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log('')
  console.log('-'.repeat(72))
  console.log(`Done in ${elapsed}s`)
  console.log(`  scanned: ${scanned}`)
  console.log(`  matched: ${matched}`)
  console.log(`  updated: ${DRY_RUN ? 0 : updated}`)
  console.log(DRY_RUN ? '  no writes were performed' : '  changes committed')
  console.log('='.repeat(72))
  console.log('')
}

main()
  .catch((error) => {
    console.error('Fatal:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
