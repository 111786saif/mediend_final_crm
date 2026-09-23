/**
 * One-time migration: remap lead category and circle from numeric IDs to text.
 * For each lead in Postgres, if category or circle is a numeric string (e.g. "1", "2"),
 * map it to the corresponding text using the code mappings.
 *
 * Usage:
 *   bun run scripts/fix-lead-categories-circles.ts           # Update leads
 *   bun run scripts/fix-lead-categories-circles.ts --dry-run  # Preview changes, no writes
 */

import 'dotenv/config'
import { prisma } from '@/lib/prisma'
import { mapCategoryCode, mapCircleCode } from '@/lib/mysql-code-mappings'

const BATCH_SIZE = 500

function parseArgs(): { dryRun: boolean } {
  const args = process.argv.slice(2)
  return { dryRun: args.includes('--dry-run') }
}

function log(level: 'info' | 'warn', message: string, meta?: Record<string, unknown>) {
  const ts = new Date().toISOString()
  const prefix = `[${ts}] [fix-lead-categories-circles]`
  const extra = meta ? ` ${JSON.stringify(meta)}` : ''
  const fn = level === 'warn' ? console.warn : console.log
  fn(`${prefix} ${message}${extra}`)
}

async function run() {
  const { dryRun } = parseArgs()
  const sep = '='.repeat(64)

  log('info', `Starting fix-lead-categories-circles (dryRun=${dryRun})`)
  console.log(sep)

  const total = await prisma.lead.count()
  log('info', `Leads in Postgres: ${total}`)

  if (total === 0) {
    log('info', 'Nothing to do.')
    await prisma.$disconnect()
    return
  }

  let processed = 0
  let updated = 0
  let cursor: number | undefined

  while (true) {
    const batch = await prisma.lead.findMany({
      select: { id: true, circle: true, category: true },
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
    })

    if (batch.length === 0) break

    const updates: { id: number; circle?: string; category?: string | null }[] = []

    for (const lead of batch) {
      const circleIsNumeric = /^\d+$/.test(String(lead.circle ?? '').trim())
      const categoryIsNumeric = lead.category != null && /^\d+$/.test(String(lead.category).trim())

      if (!circleIsNumeric && !categoryIsNumeric) continue

      const mappedCircle = mapCircleCode(lead.circle)
      const mappedCategory = mapCategoryCode(lead.category)

      const data: { circle?: string; category?: string | null } = {}
      if (circleIsNumeric && mappedCircle) data.circle = mappedCircle
      if (categoryIsNumeric && mappedCategory != null) data.category = mappedCategory

      if (Object.keys(data).length > 0) {
        updates.push({ id: lead.id, ...data })
      }
    }

    if (!dryRun && updates.length > 0) {
      await prisma.$transaction(
        updates.map((u) => {
          const { id, ...data } = u
          return prisma.lead.update({ where: { id }, data })
        })
      )
      updated += updates.length
    } else if (dryRun && updates.length > 0) {
      updated += updates.length
    }

    processed += batch.length
    if (processed % 2000 === 0 || batch.length < BATCH_SIZE) {
      log('info', `Progress: ${processed}/${total} scanned, ${updated} to update`)
    }

    if (batch.length < BATCH_SIZE) break
    cursor = batch[batch.length - 1].id
  }

  console.log(sep)
  log(
    'info',
    dryRun ? `Dry run complete. Would update ${updated} leads.` : `Done. Updated ${updated} leads.`
  )
  console.log(sep)
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[fix-lead-categories-circles] Fatal error:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
