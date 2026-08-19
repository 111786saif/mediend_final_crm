/**
 * Backfill Lead.followUpDate and Lead.modeOfPayment from a legacy CSV export.
 *
 * CSV columns (header row required). Supported formats:
 *   id, Follow-up_Date, Mode_Of_Payment
 *   id, Patient_Name, Patient_Number, Follow-up_Date, Mode_Of_Payment  (legacy)
 *
 * The `id` column maps to Lead.leadRef (not the Prisma cuid).
 *
 * Usage:
 *   bun run scripts/import-leads-followup-mop-csv.ts --dry-run
 *   bun run scripts/import-leads-followup-mop-csv.ts
 *   bun run scripts/import-leads-followup-mop-csv.ts --csv ../leads_export.csv --overwrite
 *   bun run scripts/import-leads-followup-mop-csv.ts --follow-up-only --overwrite
 *
 * Docker (on workspace server — copy CSV to data/leads_export.csv first):
 *   docker compose --profile tools run --rm import-leads-followup-mop -- --dry-run
 *   docker compose --profile tools run --rm import-leads-followup-mop
 *   docker compose --profile tools run --rm import-leads-followup-mop -- --follow-up-only --overwrite
 *
 * End-to-end (CRM MySQL server -> workspace server, no laptop copy):
 *   1. On CRM server: scripts/export-leads-followup-mop-csv.sh /root/leads_export.csv
 *   2. CRM -> workspace: scp /root/leads_export.csv root@WORKSPACE_IP:/root/mediend.workspace/data/leads_export.csv
 *   3. On workspace: git pull && docker compose --profile tools run --rm import-leads-followup-mop -- --follow-up-only --overwrite --dry-run
 */

import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'
import { prisma } from '@/lib/prisma'
import { normalizeModeOfPaymentStorageValue } from '@/lib/mode-of-payment'

const DRY_RUN = process.argv.includes('--dry-run')
const OVERWRITE = process.argv.includes('--overwrite')
const FOLLOW_UP_ONLY = process.argv.includes('--follow-up-only')
const BATCH_SIZE = 500

function resolveCsvPath(): string {
  const fromArg = process.argv.find((_, index, args) => args[index - 1] === '--csv')?.trim()
  if (fromArg) return path.resolve(fromArg)

  const candidates = [
    path.resolve(process.cwd(), 'data/leads_export.csv'),
    path.resolve(process.cwd(), '../leads_export.csv'),
  ]

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0]!
}

const CSV_PATH = resolveCsvPath()

type ParsedCsvRow = {
  leadRef: string
  followUpDate: Date | null
  modeOfPayment: string | null
}

function isCsvNull(value: string | undefined | null) {
  if (value == null) return true
  const trimmed = value.trim()
  return trimmed.length === 0 || trimmed.toUpperCase() === 'NULL'
}

function parseCsvDate(value: string | undefined | null): Date | null {
  if (isCsvNull(value)) return null

  const trimmed = value!.trim()
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed)
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch
    return new Date(`${year}-${month}-${day}T00:00:00.000Z`)
  }

  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function parseCsvModeOfPayment(value: string | undefined | null): string | null {
  if (isCsvNull(value)) return null
  return normalizeModeOfPaymentStorageValue(value!.trim())
}

// Legacy format: id,<name>,<phone>,Follow-up_Date,Mode_Of_Payment
const LEGACY_CSV_LINE = /^(\d+),(?:.*?,){2}([^,]+),([^,\r\n]+)\s*$/

// Preferred export format (no patient name/phone): id,Follow-up_Date,Mode_Of_Payment
const MINIMAL_CSV_LINE = /^(\d+),([^,]+),([^,\r\n]+)\s*$/

function parseLooseCsvLine(line: string): ParsedCsvRow | null | 'skip' {
  const trimmed = line.trim().replace(/^\uFEFF/, '')
  if (!trimmed || /^id,/i.test(trimmed)) return 'skip'

  const minimal = MINIMAL_CSV_LINE.exec(trimmed)
  if (minimal) {
    const field2 = minimal[2]!.trim()
    if (/^\d{4}-\d{2}-\d{2}|^NULL$/i.test(field2)) {
      const leadRef = minimal[1]!.trim()
      const followUpDate = parseCsvDate(minimal[2])
      const modeOfPayment = parseCsvModeOfPayment(minimal[3])
      if (!followUpDate && !modeOfPayment) return 'skip'
      return { leadRef, followUpDate, modeOfPayment }
    }
  }

  const legacy = LEGACY_CSV_LINE.exec(trimmed)
  if (!legacy) return null

  const leadRef = legacy[1]!.trim()
  const followUpDate = parseCsvDate(legacy[2])
  const modeOfPayment = parseCsvModeOfPayment(legacy[3])

  if (!followUpDate && !modeOfPayment) return 'skip'

  return { leadRef, followUpDate, modeOfPayment }
}

function readCsvRows(): { rows: ParsedCsvRow[]; skippedMalformedLines: number; skippedEmptyLines: number } {
  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`CSV not found: ${CSV_PATH}`)
  }

  const parsed: ParsedCsvRow[] = []
  let skippedMalformedLines = 0
  let skippedEmptyLines = 0

  for (const line of fs.readFileSync(CSV_PATH, 'utf8').split(/\r?\n/)) {
    const row = parseLooseCsvLine(line)
    if (row === 'skip') {
      skippedEmptyLines += 1
      continue
    }
    if (row === null) {
      skippedMalformedLines += 1
      continue
    }
    parsed.push(row)
  }

  return { rows: parsed, skippedMalformedLines, skippedEmptyLines }
}

function datesEqual(left: Date | null | undefined, right: Date | null | undefined) {
  if (!left && !right) return true
  if (!left || !right) return false
  return left.getTime() === right.getTime()
}

function modeOfPaymentEqual(left: string | null | undefined, right: string | null | undefined) {
  const normalizedLeft = left?.trim() ?? null
  const normalizedRight = right?.trim() ?? null
  return normalizedLeft === normalizedRight
}

async function importLeadFollowupMopCsv() {
  console.log(`CSV: ${CSV_PATH}`)
  console.log(
    `Mode: ${DRY_RUN ? 'DRY RUN' : 'APPLY'}${OVERWRITE ? ' (overwrite existing values)' : ' (fill missing only)'}${FOLLOW_UP_ONLY ? ' [follow-up date only]' : ''}`
  )

  const { rows, skippedMalformedLines, skippedEmptyLines } = readCsvRows()
  console.log(`Parsed ${rows.length} CSV rows with follow-up date and/or mode of payment`)
  console.log(`Skipped ${skippedEmptyLines} rows with no follow-up date or MOP in CSV`)
  if (skippedMalformedLines > 0) {
    console.log(`Skipped ${skippedMalformedLines} malformed CSV lines`)
  }

  const stats = {
    batches: 0,
    matched: 0,
    notFound: 0,
    updatedFollowUpDate: 0,
    updatedModeOfPayment: 0,
    skippedExistingFollowUpDate: 0,
    skippedExistingModeOfPayment: 0,
    unchanged: 0,
  }

  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    const batch = rows.slice(offset, offset + BATCH_SIZE)
    stats.batches += 1

    const leadRefs = batch.map((row) => row.leadRef)
    const existingLeads = await prisma.lead.findMany({
      where: { leadRef: { in: leadRefs } },
      select: {
        id: true,
        leadRef: true,
        followUpDate: true,
        modeOfPayment: true,
      },
    })

    const leadByRef = new Map(existingLeads.map((lead) => [lead.leadRef, lead]))
    const updates: Array<{
      id: string
      leadRef: string
      data: {
        followUpDate?: Date
        modeOfPayment?: string
      }
    }> = []

    for (const row of batch) {
      const lead = leadByRef.get(row.leadRef)
      if (!lead) {
        stats.notFound += 1
        continue
      }

      stats.matched += 1

      const data: { followUpDate?: Date; modeOfPayment?: string } = {}

      if (row.followUpDate) {
        if (!OVERWRITE && lead.followUpDate) {
          stats.skippedExistingFollowUpDate += 1
        } else if (!datesEqual(lead.followUpDate, row.followUpDate)) {
          data.followUpDate = row.followUpDate
          stats.updatedFollowUpDate += 1
        }
      }

      if (!FOLLOW_UP_ONLY && row.modeOfPayment) {
        if (!OVERWRITE && lead.modeOfPayment && lead.modeOfPayment.trim().length > 0) {
          stats.skippedExistingModeOfPayment += 1
        } else if (!modeOfPaymentEqual(lead.modeOfPayment, row.modeOfPayment)) {
          data.modeOfPayment = row.modeOfPayment
          stats.updatedModeOfPayment += 1
        }
      }

      if (Object.keys(data).length === 0) {
        stats.unchanged += 1
        continue
      }

      updates.push({ id: lead.id, leadRef: lead.leadRef, data })
    }

    if (!DRY_RUN && updates.length > 0) {
      await prisma.$transaction(
        updates.map((update) =>
          prisma.lead.update({
            where: { id: update.id },
            data: update.data,
          })
        )
      )
    }

    if (stats.batches % 10 === 0 || offset + BATCH_SIZE >= rows.length) {
      console.log(
        `Progress ${Math.min(offset + BATCH_SIZE, rows.length)}/${rows.length} — matched ${stats.matched}, not found ${stats.notFound}, follow-up updates ${stats.updatedFollowUpDate}, mop updates ${stats.updatedModeOfPayment}`
      )
    }
  }

  console.log('\n=== Summary ===')
  console.log(JSON.stringify(stats, null, 2))

  if (DRY_RUN) {
    console.log('\nDry run complete. Re-run without --dry-run to apply changes.')
  } else {
    const [withFollowUp, withMop] = await Promise.all([
      prisma.lead.count({ where: { followUpDate: { not: null } } }),
      prisma.lead.count({
        where: {
          AND: [{ modeOfPayment: { not: null } }, { NOT: { modeOfPayment: '' } }],
        },
      }),
    ])
    console.log(`\nPost-import counts: followUpDate=${withFollowUp}, modeOfPayment=${withMop}`)
  }
}

importLeadFollowupMopCsv()
  .catch((error) => {
    console.error('Import failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
