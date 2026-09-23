/**
 * One-off import of historical compliance feedback from the team's Excel sheet
 * (Sheet1) into ComplianceCall rows.
 *
 * Matching:
 *   - Last 10 digits of phone (Excel col C) → Lead.phoneNumber (last 10 digits)
 *   - Confirms with token overlap on patient name (Excel col B vs Lead.patientName)
 *
 * Write rules:
 *   - If a ComplianceCall exists for the lead, only fields currently NULL are filled
 *     (existing answers are NEVER overwritten).
 *   - If no ComplianceCall exists, a PENDING row is created with the imported fields.
 *   - `satisfaction` is auto-derived from "Overall Experience" text when unambiguous.
 *
 * Dry-run by default. Pass `--commit` to actually write.
 *
 * Usage:
 *   bun run scripts/import-compliance-feedback.ts                          # dry run, default file
 *   bun run scripts/import-compliance-feedback.ts --commit                  # write
 *   bun run scripts/import-compliance-feedback.ts "C:/path/to/file.xlsx"    # custom file
 *   bun run scripts/import-compliance-feedback.ts "C:/path/to/file.xlsx" --commit
 */

import 'dotenv/config'
import { readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import {
  ComplianceCallStatus,
  SatisfactionLevel,
  type ConcernCategory,
} from '@/generated/prisma/client'

const DEFAULT_FILE = 'C:/Users/DHRUV/Downloads/Feedback sheet 2026 Jan.xlsx'

const args = process.argv.slice(2)
const COMMIT = args.includes('--commit')
const FILE = args.find((a) => !a.startsWith('--')) ?? DEFAULT_FILE

// Column index → ComplianceCall field name. (Sheet1 row 0 is the header.)
const COL_INDEX = {
  patientName: 1, // B
  phone: 2, // C
  problemDuringSurgery: 14, // O
  problemAfterSurgery: 15, // P
  commitmentStatus: 16, // Q
  doctorBehaviour: 17, // R
  hospitalStaffBehaviour: 18, // S
  paymentQuery: 19, // T
  referralConfirmation: 20, // U
  referralName: 21, // V
  referralContact: 22, // W
  bdmBehaviour: 23, // X
  mediendService: 24, // Y
  overallExperience: 25, // Z
  additionalRemark: 26, // AA
  concernResolved: 27, // AB
  opdStatus: 28, // AC
  opdMode: 29, // AD
} as const

type FeedbackKey = Exclude<keyof typeof COL_INDEX, 'patientName' | 'phone'>

const FEEDBACK_KEYS: FeedbackKey[] = [
  'problemDuringSurgery',
  'problemAfterSurgery',
  'commitmentStatus',
  'doctorBehaviour',
  'hospitalStaffBehaviour',
  'paymentQuery',
  'referralConfirmation',
  'referralName',
  'referralContact',
  'bdmBehaviour',
  'mediendService',
  'overallExperience',
  'additionalRemark',
  'concernResolved',
  'opdStatus',
  'opdMode',
]

function clean(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  if (!s) return null
  return s
}

function normPhone(p: unknown): string | null {
  if (p == null) return null
  const digits = String(p).replace(/\D/g, '')
  if (digits.length < 10) return null
  return digits.slice(-10)
}

function nameTokens(name: string | null | undefined): Set<string> {
  if (!name) return new Set()
  return new Set(
    String(name)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 3),
  )
}

function nameMatches(excelName: string, leadName: string): boolean {
  const a = nameTokens(excelName)
  const b = nameTokens(leadName)
  if (a.size === 0 || b.size === 0) return true
  for (const t of a) if (b.has(t)) return true
  return false
}

function deriveSatisfaction(overall: string | null): SatisfactionLevel | null {
  if (!overall) return null
  const t = overall.toLowerCase()
  if (/\bnot\s+satisfied\b/.test(t)) return SatisfactionLevel.NOT_SATISFIED
  if (/\bsatisfied\b/.test(t)) return SatisfactionLevel.SATISFIED
  return null
}

interface ExcelRow {
  rowIndex: number
  patientName: string | null
  phone: string | null
  fields: Record<FeedbackKey, string | null>
}

function readSheet(path: string): ExcelRow[] {
  const buf = readFileSync(path)
  const wb = XLSX.read(buf, { type: 'buffer' })
  const sheet = wb.Sheets[wb.SheetNames[0]] // Sheet1
  if (!sheet) throw new Error(`No first sheet in ${path}`)

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  })

  const out: ExcelRow[] = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const patientName = clean(r[COL_INDEX.patientName])
    const phone = normPhone(r[COL_INDEX.phone])
    if (!patientName && !phone) continue

    const fields = {} as Record<FeedbackKey, string | null>
    for (const k of FEEDBACK_KEYS) {
      fields[k] = clean(r[COL_INDEX[k]])
    }
    out.push({ rowIndex: i + 1, patientName, phone, fields })
  }
  return out
}

async function main() {
  console.log('='.repeat(60))
  console.log('Compliance feedback Excel import')
  console.log('  file  :', FILE)
  console.log('  mode  :', COMMIT ? 'COMMIT — writes to DB' : 'DRY RUN — no writes')
  console.log('='.repeat(60))

  const rows = readSheet(FILE)
  console.log(`\nLoaded ${rows.length} non-empty rows from Sheet1\n`)

  // Build phone → leads map. We pull all leads and bucket by last-10-digits of
  // their phoneNumber. Cheap (~100k rows tops) and avoids per-row queries.
  const leads = await prisma.lead.findMany({
    select: { id: true, patientName: true, phoneNumber: true },
  })
  const byPhone = new Map<string, { id: number; patientName: string; phoneNumber: string }[]>()
  for (const l of leads) {
    const p = normPhone(l.phoneNumber)
    if (!p) continue
    const arr = byPhone.get(p) ?? []
    arr.push(l)
    byPhone.set(p, arr)
  }
  console.log(`Indexed ${leads.length} leads (${byPhone.size} unique phones)`)

  // Batch-load every existing compliance call once, keyed by leadId. Avoids
  // 500 round-trips during the per-row decisions below.
  let existingByLeadId: Map<number, Awaited<ReturnType<typeof prisma.complianceCall.findUnique>>>
  try {
    const existingCalls = await prisma.complianceCall.findMany()
    existingByLeadId = new Map(existingCalls.map((c) => [c.leadId, c]))
    console.log(`Indexed ${existingCalls.length} existing ComplianceCall rows\n`)
  } catch (e) {
    if (e instanceof Error && /ComplianceCall.*does not exist/i.test(e.message)) {
      console.error(
        '\nThe `ComplianceCall` table is missing in the connected database.\n' +
          'Apply these migrations first, then re-run:\n' +
          '  • prisma/migrations/20260418140000_add_compliance_call\n' +
          '  • prisma/migrations/20260509000000_add_compliance_feedback_fields\n',
      )
      process.exit(1)
    }
    throw e
  }

  let matched = 0
  let skippedNoPhone = 0
  let skippedNoMatch = 0
  let skippedNameMismatch = 0
  let skippedAmbiguous = 0
  let skippedNoFields = 0
  let inserted = 0
  let updated = 0
  let updatedFieldCount = 0
  const skips: string[] = []

  for (const row of rows) {
    if (!row.phone) {
      skippedNoPhone++
      skips.push(`row ${row.rowIndex} "${row.patientName}" — no usable phone`)
      continue
    }
    const candidates = byPhone.get(row.phone)
    if (!candidates || candidates.length === 0) {
      skippedNoMatch++
      continue
    }
    const matches = candidates.filter((c) =>
      nameMatches(row.patientName ?? '', c.patientName),
    )
    if (matches.length === 0) {
      skippedNameMismatch++
      skips.push(
        `row ${row.rowIndex} "${row.patientName}" / ${row.phone} → phone hits ${candidates
          .map((c) => `"${c.patientName}"`)
          .join(', ')} but no name overlap`,
      )
      continue
    }
    if (matches.length > 1) {
      skippedAmbiguous++
      skips.push(
        `row ${row.rowIndex} "${row.patientName}" / ${row.phone} → ambiguous, ${matches.length} leads share this phone & name`,
      )
      continue
    }
    const lead = matches[0]
    matched++

    const incoming = row.fields
    const hasAnyFieldValue = Object.values(incoming).some((v) => v != null)
    const derivedSatisfaction = deriveSatisfaction(incoming.overallExperience)

    if (!hasAnyFieldValue && !derivedSatisfaction) {
      skippedNoFields++
      continue
    }

    const existing = existingByLeadId.get(lead.id) ?? null

    if (!existing) {
      // Create PENDING call with imported data.
      const data: Record<string, unknown> = {
        leadId: lead.id,
        status: ComplianceCallStatus.PENDING,
        concernCategories: [] as ConcernCategory[],
      }
      for (const k of FEEDBACK_KEYS) {
        if (incoming[k] != null) data[k] = incoming[k]
      }
      if (derivedSatisfaction) data.satisfaction = derivedSatisfaction

      const filled = Object.keys(data).length - 3 // minus leadId/status/concernCategories
      console.log(
        `+ INSERT  lead ${lead.id}  ${lead.patientName.padEnd(30).slice(0, 30)}  +${filled} field(s)`,
      )
      if (COMMIT) {
        await prisma.complianceCall.create({
          data: data as Parameters<typeof prisma.complianceCall.create>[0]['data'],
        })
      }
      inserted++
      updatedFieldCount += filled
      continue
    }

    // Existing — only fill currently-NULL columns. Never overwrite.
    const patch: Record<string, unknown> = {}
    for (const k of FEEDBACK_KEYS) {
      if (incoming[k] != null && (existing as Record<string, unknown>)[k] == null) {
        patch[k] = incoming[k]
      }
    }
    if (derivedSatisfaction && existing.satisfaction == null) {
      patch.satisfaction = derivedSatisfaction
    }

    const fieldCount = Object.keys(patch).length
    if (fieldCount === 0) continue

    console.log(
      `~ UPDATE  call ${existing.id.slice(0, 8)}…  ${lead.patientName.padEnd(30).slice(0, 30)}  +${fieldCount} field(s)`,
    )
    if (COMMIT) {
      await prisma.complianceCall.update({ where: { id: existing.id }, data: patch })
    }
    updated++
    updatedFieldCount += fieldCount
  }

  console.log('\n' + '='.repeat(60))
  console.log('Summary')
  console.log('='.repeat(60))
  console.log(`  Excel rows processed       : ${rows.length}`)
  console.log(`  Matched to a lead          : ${matched}`)
  console.log(`  → would INSERT new call    : ${inserted}`)
  console.log(`  → would UPDATE existing    : ${updated}`)
  console.log(`  → fields filled in total   : ${updatedFieldCount}`)
  console.log(`  Skipped — no phone in row  : ${skippedNoPhone}`)
  console.log(`  Skipped — phone not in DB  : ${skippedNoMatch}`)
  console.log(`  Skipped — name mismatch    : ${skippedNameMismatch}`)
  console.log(`  Skipped — ambiguous match  : ${skippedAmbiguous}`)
  console.log(`  Skipped — no field values  : ${skippedNoFields}`)

  if (skips.length > 0) {
    console.log('\nSkip details (first 20):')
    for (const s of skips.slice(0, 20)) console.log('  •', s)
    if (skips.length > 20) console.log(`  … and ${skips.length - 20} more`)
  }

  if (!COMMIT) {
    console.log('\nDRY RUN — no changes written. Re-run with --commit to apply.')
  } else {
    console.log('\nDone. Changes committed.')
  }
}

main()
  .catch((e) => {
    console.error('\nFAILED:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
