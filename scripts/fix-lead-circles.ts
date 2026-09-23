/**
 * One-time migration: set lead circles in Postgres from MySQL.
 * For each lead, reads the Circle column from the MySQL `lead` table and updates Postgres.
 * Circle is stored as-is from MySQL (e.g. "PUNE", "Mumbai").
 *
 * Usage:
 *   bun run scripts/fix-lead-circles.ts           # Update leads where Postgres circle differs from MySQL
 *   bun run scripts/fix-lead-circles.ts --dry-run # Preview changes, no writes
 */

import 'dotenv/config'
import { prisma } from '@/lib/prisma'
import { queryMySQL, closeMySQLPool, testMySQLConnection } from '@/lib/mysql-source-client'

const BATCH_SIZE = 500

function parseArgs(): { dryRun: boolean } {
  const args = process.argv.slice(2)
  return { dryRun: args.includes('--dry-run') }
}

function log(level: 'info' | 'warn', message: string, meta?: Record<string, unknown>) {
  const ts = new Date().toISOString()
  const prefix = `[${ts}] [fix-lead-circles]`
  const extra = meta ? ` ${JSON.stringify(meta)}` : ''
  const fn = level === 'warn' ? console.warn : console.log
  fn(`${prefix} ${message}${extra}`)
}

async function run() {
  const { dryRun } = parseArgs()
  const sep = '='.repeat(64)

  log('info', `Starting fix-lead-circles from MySQL (dryRun=${dryRun})`)
  console.log(sep)

  const connected = await testMySQLConnection()
  if (!connected) {
    log('warn', 'MySQL not available; cannot fix circles from DB.')
    await prisma.$disconnect()
    process.exit(1)
  }

  const total = await prisma.lead.count()
  log('info', `Leads in Postgres: ${total}`)

  if (total === 0) {
    log('info', 'Nothing to do.')
    await closeMySQLPool()
    await prisma.$disconnect()
    return
  }

  let processed = 0
  let updated = 0
  let cursor: number | undefined

  while (true) {
    const batch = await prisma.lead.findMany({
      select: { id: true, leadRef: true, circle: true },
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
    })

    if (batch.length === 0) break

    const leadRefs = batch.map((l) => parseInt(l.leadRef, 10)).filter((n) => !isNaN(n))
    if (leadRefs.length === 0) {
      processed += batch.length
      if (batch.length < BATCH_SIZE) break
      cursor = batch[batch.length - 1].id
      continue
    }

    const placeholders = leadRefs.map(() => '?').join(',')
    const mysqlRows = await queryMySQL<{ id: number; Circle: string | null }>(
      `SELECT id, \`Circle\` FROM lead WHERE id IN (${placeholders})`,
      leadRefs
    )
    const mysqlCircleByRef = new Map(mysqlRows.map((r) => [String(r.id), r.Circle != null ? String(r.Circle).trim() : '']))

    const updates: { id: number; circle: string }[] = []
    for (const lead of batch) {
      const newCircle = mysqlCircleByRef.get(lead.leadRef) ?? ''
      if (lead.circle === newCircle) continue
      updates.push({ id: lead.id, circle: newCircle })
    }

    if (!dryRun && updates.length > 0) {
      await prisma.$transaction(
        updates.map((u) => prisma.lead.update({ where: { id: u.id }, data: { circle: u.circle } }))
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
  log('info', dryRun ? `Dry run complete. Would update ${updated} leads.` : `Done. Updated ${updated} leads from MySQL.`)
  console.log(sep)
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[fix-lead-circles] Fatal error:', err)
    process.exit(1)
  })
  .finally(async () => {
    await closeMySQLPool()
    await prisma.$disconnect()
  })
