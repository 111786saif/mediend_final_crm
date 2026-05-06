/**
 * Import historical IPD PNL data from CSV into Lead + PLRecord tables.
 *
 * CSV: data/Copy of IPD PNL mediend Master Sheet - ECD(1).csv
 *   ~3,067 rows spanning Oct 2023 – Mar 2026
 *
 * Usage:
 *   bun run scripts/import-ipd-pnl-csv.ts --dry-run
 *   bun run scripts/import-ipd-pnl-csv.ts
 *
 * Docker:
 *   docker compose --profile tools run --rm import-ipd-pnl -- --dry-run
 *   docker compose --profile tools run --rm import-ipd-pnl
 */

import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'
import { parse } from 'csv-parse/sync'
import { prisma } from '@/lib/prisma'
import {
  PipelineStage,
  CaseStage,
  FlowType,
  UserRole,
  type Prisma,
} from '@/generated/prisma/client'

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const DRY_RUN = process.argv.includes('--dry-run')
const CSV_PATH =
  process.argv.find((_, i, a) => a[i - 1] === '--csv')?.trim() ||
  path.resolve(process.cwd(), 'data/Copy of IPD PNL mediend Master Sheet - ECD(1).csv')

const BATCH_SIZE = 500

// ---------------------------------------------------------------------------
// Alias map for known spelling mismatches between CSV and DB
// ---------------------------------------------------------------------------
const BDM_ALIAS_MAP: Record<string, string> = {
  'ayan siddiqui': 'ayan siddhiqui',
  'pankaj pal-ii': 'pankaj pal',
  'vinay kumar gupta': 'vinay gupta',
  'vinay kumar': 'vinay gupta',
  'prince meena': 'prince',
  'ahbab ahmed': 'ahbab',
  'aryan katiyar': 'aryan',
  'mayank pandey': 'mayank',
}

// Names that should NOT be resolved via first-name matching
// (different people who happen to share a first name with a DB user)
const FIRST_NAME_BLOCKLIST = new Set([
  'abhishek',   // Abhishek Rawat/Singh/Thakur != Abhishek Kashyap
  'sumit',      // Sumit Tiwari != Sumit Pal
  'vishal',     // Vishal (alone) could be ambiguous with Vishal upadhyay / vishal Kumar
  'ashish',     // ASHISH/Ashish Yadav != any specific DB user
])

// ---------------------------------------------------------------------------
// Utility: parse month string like "Oct23" -> Date (first of month)
// ---------------------------------------------------------------------------
const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}

function parseMonthStr(s: string): Date | null {
  if (!s || s.trim().length < 4) return null
  const t = s.trim().toLowerCase()
  const monthPart = t.slice(0, 3)
  const yearPart = t.slice(3)
  const monthIdx = MONTH_MAP[monthPart]
  if (monthIdx === undefined) return null
  const year = 2000 + parseInt(yearPart, 10)
  if (isNaN(year)) return null
  return new Date(Date.UTC(year, monthIdx, 1))
}

// ---------------------------------------------------------------------------
// Utility: parse flexible date formats
//   "DD/MM/YYYY", "D-Mon-YYYY", "DD/Mon/YYYY", "M/DD/YYYY" (when day>12)
// ---------------------------------------------------------------------------
const MONTH_NAME_MAP: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

function parseDateFlexible(s: string): Date | null {
  if (!s || !s.trim()) return null
  const t = s.trim()

  // Format: D-Mon-YYYY or DD/Mon/YYYY  (e.g., "1-Sep-2024", "26/Oct/2023")
  const namedMonthMatch = t.match(/^(\d{1,2})[/-]([A-Za-z]{3})[/-](\d{4})$/)
  if (namedMonthMatch) {
    const day = parseInt(namedMonthMatch[1], 10)
    const month = MONTH_NAME_MAP[namedMonthMatch[2].toLowerCase()]
    const year = parseInt(namedMonthMatch[3], 10)
    if (month && !isNaN(day) && !isNaN(year)) {
      return new Date(Date.UTC(year, month - 1, day))
    }
  }

  // Format: DD/MM/YYYY or M/DD/YYYY  (numeric)
  const numericMatch = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (numericMatch) {
    let a = parseInt(numericMatch[1], 10)
    let b = parseInt(numericMatch[2], 10)
    const year = parseInt(numericMatch[3], 10)
    // Disambiguate: if first part > 12, it must be the day (DD/MM) is impossible,
    // so it's actually M/DD/YYYY format
    if (a > 12 && b <= 12) {
      // M/DD doesn't make sense if a>12 either... actually if a>12 and b<=12,
      // this is ambiguous but likely DD/MM since a=day>12
      // Wait: if a > 12, it can't be a month. So a is the day, b is the month → DD/MM/YYYY
      return new Date(Date.UTC(year, b - 1, a))
    }
    // If b > 12, then b can't be a month, so a=month, b=day → M/DD/YYYY
    if (b > 12 && a <= 12) {
      return new Date(Date.UTC(year, a - 1, b))
    }
    // Both <= 12: assume DD/MM/YYYY (Indian standard)
    return new Date(Date.UTC(year, b - 1, a))
  }

  return null
}

// ---------------------------------------------------------------------------
// Utility: parse number (strip commas, handle non-numeric)
// ---------------------------------------------------------------------------
function parseNumber(s: string | undefined | null): number {
  if (!s) return 0
  const cleaned = s.toString().replace(/,/g, '').trim()
  if (!cleaned) return 0
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}

// ---------------------------------------------------------------------------
// Utility: parse percentage (strip %, return null if not a percentage)
// ---------------------------------------------------------------------------
function parsePercent(s: string | undefined | null): number | null {
  if (!s) return null
  const t = s.toString().trim()
  if (!t.includes('%')) return null
  const n = parseFloat(t.replace('%', '').replace(/,/g, '').trim())
  return isNaN(n) ? null : n
}

// ---------------------------------------------------------------------------
// Utility: map payout status text from CSV to DB value
// ---------------------------------------------------------------------------
function mapPayoutStatus(s: string | undefined | null): string | null {
  if (!s) return null
  const t = s.toString().trim().toLowerCase()
  if (t === 'given' || t === 'received' || t === 'paid') return 'PAID'
  if (t === 'pending') return 'PENDING'
  if (t === 'not used' || t === 'not paid' || t === '') return null
  return null
}

// ---------------------------------------------------------------------------
// Utility: map CSV status to pipeline/caseStage
// ---------------------------------------------------------------------------
function mapStatus(csvStatus: string): {
  status: string
  pipelineStage: PipelineStage
  caseStage: CaseStage
  createPL: boolean
} {
  const s = csvStatus.trim()
  if (s === 'IPD Done' || !s) {
    return { status: s || 'IPD Done', pipelineStage: PipelineStage.COMPLETED, caseStage: CaseStage.IPD_DONE, createPL: true }
  }
  if (s === 'Postponed') {
    return { status: 'Postponed', pipelineStage: PipelineStage.LOST, caseStage: CaseStage.NEW_LEAD, createPL: false }
  }
  if (s === 'Canceled') {
    return { status: 'Canceled', pipelineStage: PipelineStage.LOST, caseStage: CaseStage.NEW_LEAD, createPL: false }
  }
  return { status: s, pipelineStage: PipelineStage.COMPLETED, caseStage: CaseStage.IPD_DONE, createPL: true }
}

// ---------------------------------------------------------------------------
// Utility: map payment type to FlowType
// ---------------------------------------------------------------------------
function mapFlowType(payment: string): FlowType {
  const p = payment.trim().toLowerCase()
  if (p === 'cash' || p === 'emi') return FlowType.CASH
  return FlowType.INSURANCE
}

// ---------------------------------------------------------------------------
// Utility: slugify name for email
// ---------------------------------------------------------------------------
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('\n' + '='.repeat(60))
  console.log(`Importing IPD PNL CSV (${DRY_RUN ? 'DRY RUN' : 'LIVE'})`)
  console.log('='.repeat(60))

  // ---- Phase 0: Read & parse CSV ----
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV file not found: ${CSV_PATH}`)
    process.exit(1)
  }

  console.log(`\nCSV path: ${CSV_PATH}`)
  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8')
  // Strip BOM if present
  const content = csvContent.charCodeAt(0) === 0xfeff ? csvContent.slice(1) : csvContent

  const allRows: string[][] = parse(content, {
    relax_column_count: true,
    skip_empty_lines: false,
  })

  console.log(`Total parsed rows: ${allRows.length}`)

  // Skip 3 header rows (spacer, categories, column names)
  const dataRows = allRows.slice(3)

  // Filter out rows with no Appointment ID
  const validRows = dataRows.filter((row) => row[4] && row[4].trim())
  const skippedNoId = dataRows.length - validRows.length

  // Status distribution
  const statusCounts: Record<string, number> = {}
  for (const row of validRows) {
    const s = row[16]?.trim() || '(empty)'
    statusCounts[s] = (statusCounts[s] || 0) + 1
  }

  console.log(`Data rows: ${dataRows.length}, Valid (with Appointment ID): ${validRows.length}, Skipped (no ID): ${skippedNoId}`)
  console.log('Status distribution:', statusCounts)

  // ---- Phase 1: BDM Name Resolution ----
  console.log('\n--- Phase 1: BDM Name Resolution ---')

  const allUsers = await prisma.user.findMany({
    select: { id: true, name: true, role: true, email: true },
  })

  // Build lookup maps
  const exactNameMap = new Map<string, { id: string; name: string }>()
  const firstNameMap = new Map<string, { id: string; name: string }[]>()
  for (const u of allUsers) {
    const lower = u.name.trim().toLowerCase()
    exactNameMap.set(lower, { id: u.id, name: u.name })
    const firstName = lower.split(/\s+/)[0]
    if (firstName.length >= 3) {
      const arr = firstNameMap.get(firstName) || []
      arr.push({ id: u.id, name: u.name })
      firstNameMap.set(firstName, arr)
    }
  }

  // Collect unique BDM names from CSV
  const uniqueBdmNames = new Set<string>()
  for (const row of validRows) {
    const bdm = row[3]?.trim()
    if (bdm) uniqueBdmNames.add(bdm)
  }

  // Resolve each BDM name
  const bdmResolutionMap = new Map<string, string>() // csvName -> userId
  const stubsToCreate: { csvName: string; slug: string }[] = []
  let matchedExact = 0
  let matchedFirstName = 0
  let matchedAlias = 0

  for (const csvName of uniqueBdmNames) {
    const lower = csvName.toLowerCase().trim()

    // 1. Exact match
    const exact = exactNameMap.get(lower)
    if (exact) {
      bdmResolutionMap.set(csvName, exact.id)
      matchedExact++
      continue
    }

    // 2. Alias map
    const aliasTarget = BDM_ALIAS_MAP[lower]
    if (aliasTarget) {
      const aliasUser = exactNameMap.get(aliasTarget)
      if (aliasUser) {
        bdmResolutionMap.set(csvName, aliasUser.id)
        matchedAlias++
        continue
      }
    }

    // 3. First-name match (only if unambiguous and not blocklisted)
    const firstName = lower.split(/\s+/)[0]
    if (!FIRST_NAME_BLOCKLIST.has(firstName)) {
      const firstNameMatches = firstNameMap.get(firstName)
      if (firstNameMatches && firstNameMatches.length === 1) {
        bdmResolutionMap.set(csvName, firstNameMatches[0].id)
        matchedFirstName++
        continue
      }
    }

    // 4. Needs stub
    stubsToCreate.push({ csvName, slug: slugify(csvName) })
  }

  console.log(`  Users in DB: ${allUsers.length}`)
  console.log(`  Unique BDM names in CSV: ${uniqueBdmNames.size}`)
  console.log(`  Matched (exact): ${matchedExact}`)
  console.log(`  Matched (alias): ${matchedAlias}`)
  console.log(`  Matched (first-name): ${matchedFirstName}`)
  console.log(`  Stubs to create: ${stubsToCreate.length}`)

  if (stubsToCreate.length > 0) {
    console.log('  Stub users:')
    for (const s of stubsToCreate) {
      console.log(`    "${s.csvName}" -> ${s.slug}@legacy-import.mediend.com`)
    }
  }

  // Create stub users
  if (!DRY_RUN && stubsToCreate.length > 0) {
    console.log('\n  Creating stub BD users...')
    // Hash a placeholder password (bcrypt is available via Bun)
    const BunGlobal = (globalThis as Record<string, unknown>).Bun as
      | { password: { hash: (pw: string, algo: string) => Promise<string> } }
      | undefined
    const placeholderHash = BunGlobal
      ? await BunGlobal.password.hash('disabled-legacy-account', 'bcrypt')
      : '$2b$10$placeholder000000000000000000000000000000000000'

    for (const s of stubsToCreate) {
      const email = `${s.slug}@legacy-import.mediend.com`
      // Check if stub already exists (re-run safety)
      const existing = await prisma.user.findUnique({ where: { email } })
      if (existing) {
        bdmResolutionMap.set(s.csvName, existing.id)
        continue
      }
      const created = await prisma.user.create({
        data: {
          email,
          name: s.csvName,
          passwordHash: placeholderHash,
          role: UserRole.BD,
        },
      })
      bdmResolutionMap.set(s.csvName, created.id)
      console.log(`    Created: ${s.csvName} (${email}) -> ${created.id}`)
    }
  } else if (DRY_RUN && stubsToCreate.length > 0) {
    // In dry run, assign a placeholder ID
    for (const s of stubsToCreate) {
      bdmResolutionMap.set(s.csvName, `STUB_${s.slug}`)
    }
  }

  // Check for any rows whose BDM couldn't be resolved at all
  let unmatchedRows = 0
  // Fallback: use "Unknown Employee" if it exists
  const fallbackUser = allUsers.find(
    (u) => u.name === 'Unknown Employee' || u.email === 'unknown@mediend.com'
  )

  // ---- Phase 2: Batch Import ----
  console.log('\n--- Phase 2: Batch Import ---')
  const startTime = Date.now()
  let createdLeads = 0
  let createdPLs = 0
  let errors = 0
  const totalBatches = Math.ceil(validRows.length / BATCH_SIZE)

  for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
    const batchStart = batchIdx * BATCH_SIZE
    const batchEnd = Math.min(batchStart + BATCH_SIZE, validRows.length)
    const batch = validRows.slice(batchStart, batchEnd)

    console.log(`\n  Batch ${batchIdx + 1}/${totalBatches}: rows ${batchStart + 1}-${batchEnd}`)

    // Build Lead payloads
    const leadPayloads: Prisma.LeadUncheckedCreateInput[] = []
    const plCandidates: { leadRef: string; row: string[] }[] = []

    for (const row of batch) {
      try {
        const leadRef = row[4].trim()
        const bdmName = row[3]?.trim() || ''
        const statusInfo = mapStatus(row[16] || '')

        // Resolve BD user
        let bdId = bdmResolutionMap.get(bdmName)
        if (!bdId) {
          bdId = fallbackUser?.id
          if (!bdId) {
            unmatchedRows++
            continue
          }
        }

        const surgeryDate = parseDateFlexible(row[13])
        const leadEntryDate = parseDateFlexible(row[1])
        const arrivalDate = parseDateFlexible(row[12])
        const monthDate = parseMonthStr(row[0])

        const leadPayload: Prisma.LeadUncheckedCreateInput = {
          leadRef,
          patientName: row[6]?.trim() || 'Unknown',
          age: 0,
          sex: 'Unknown',
          phoneNumber: row[5]?.trim() || 'N/A',
          bdId,
          status: statusInfo.status,
          pipelineStage: statusInfo.pipelineStage,
          caseStage: statusInfo.caseStage,
          circle: row[9]?.trim() || 'Unknown',
          category: row[7]?.trim() || null,
          treatment: row[8]?.trim() || null,
          surgeonName: row[10]?.trim() || null,
          hospitalName: row[11]?.trim() || 'Unknown',
          flowType: mapFlowType(row[15] || ''),
          modeOfPayment: row[15]?.trim() || null,
          billAmount: parseNumber(row[20]),
          insuranceName: row[23]?.trim() || null,
          tpa: row[24]?.trim() || null,
          arrivalDate,
          surgeryDate,
          conversionDate: statusInfo.createPL ? surgeryDate : null,
          source: row[26]?.trim() || null,
          leadEntryDate,
          month: row[0]?.trim() || null,
          settledTotal: parseNumber(row[17]),
          deduction: parseNumber(row[18]),
          ticketSize: parseNumber(row[19]),
          implantAmount: parseNumber(row[34]),
          hospitalShare: parseNumber(row[28]),
          doctorShare: parseNumber(row[29]),
          mediendProfit: parseNumber(row[44]),
          netProfit: parseNumber(row[46]),
          createdById: bdId,
          updatedById: bdId,
          createdDate: leadEntryDate || monthDate || new Date(),
        }

        leadPayloads.push(leadPayload)

        if (statusInfo.createPL) {
          plCandidates.push({ leadRef, row })
        }
      } catch (err) {
        errors++
        console.error(`    Error building row ${row[4]}: ${err}`)
      }
    }

    if (DRY_RUN) {
      console.log(`    Would create ${leadPayloads.length} leads, ${plCandidates.length} PL records`)
      createdLeads += leadPayloads.length
      createdPLs += plCandidates.length
      continue
    }

    // Create Leads
    if (leadPayloads.length > 0) {
      try {
        const result = await prisma.lead.createMany({
          data: leadPayloads,
          skipDuplicates: true,
        })
        createdLeads += result.count
        console.log(`    Created ${result.count} leads`)
      } catch (err) {
        errors++
        console.error(`    Error creating leads batch: ${err}`)
        continue
      }
    }

    // Fetch back Lead IDs for PLRecord creation
    if (plCandidates.length > 0) {
      const plLeadRefs = plCandidates.map((c) => c.leadRef)
      const createdLeadMap = new Map<string, string>()

      const fetchedLeads = await prisma.lead.findMany({
        where: { leadRef: { in: plLeadRefs } },
        select: { id: true, leadRef: true },
      })
      for (const l of fetchedLeads) {
        createdLeadMap.set(l.leadRef, l.id)
      }

      // Check which leads already have PLRecords (re-run safety)
      const leadIdsForPL = fetchedLeads.map((l) => l.id)
      const existingPLs = await prisma.pLRecord.findMany({
        where: { leadId: { in: leadIdsForPL } },
        select: { leadId: true },
      })
      const existingPLSet = new Set(existingPLs.map((p) => p.leadId))

      // Build PL payloads
      const plPayloads: Prisma.PLRecordUncheckedCreateInput[] = []

      for (const { leadRef, row } of plCandidates) {
        const leadId = createdLeadMap.get(leadRef)
        if (!leadId || existingPLSet.has(leadId)) continue

        const bdmName = row[3]?.trim() || ''
        const bdId = bdmResolutionMap.get(bdmName) || fallbackUser?.id
        const surgeryDate = parseDateFlexible(row[13])
        const arrivalDate = parseDateFlexible(row[12])
        const monthDate = parseMonthStr(row[0])

        plPayloads.push({
          leadId,
          month: monthDate,
          admissionDate: arrivalDate,
          surgeryDate,
          status: row[16]?.trim() || 'IPD Done',
          paymentType: row[15]?.trim() || null,
          approvedOrCash: row[17]?.trim() || null,
          paymentCollectedAt: row[21]?.trim() || null,
          managerRole: row[2]?.trim() || null,
          managerName: row[2]?.trim() || null,
          bdmName,
          patientName: row[6]?.trim() || null,
          patientPhone: row[5]?.trim() || null,
          doctorName: row[10]?.trim() || null,
          hospitalName: row[11]?.trim() || null,
          category: row[7]?.trim() || null,
          treatment: row[8]?.trim() || null,
          circle: row[9]?.trim() || null,
          leadSource: row[26]?.trim() || null,
          totalAmount: parseNumber(row[17]),
          billAmount: parseNumber(row[20]),
          cashOrDedPaid: parseNumber(row[18]),
          referralAmount: parseNumber(row[40]),
          cabCharges: parseNumber(row[37]),
          implantCost: parseNumber(row[34]),
          instrumentsCost: parseNumber(row[31]),
          dcCharges: parseNumber(row[33]),
          doctorCharges: parseNumber(row[29]),
          hospitalSharePct: parsePercent(row[27]),
          hospitalShareAmount: parseNumber(row[28]),
          mediendSharePct: parsePercent(row[43]),
          mediendShareAmount: parseNumber(row[44]),
          mediendNetProfit: parseNumber(row[46]),
          finalProfit: parseNumber(row[46]),
          doctorPayoutStatus: mapPayoutStatus(row[30]) || 'PENDING',
          mediendInvoiceStatus: mapPayoutStatus(row[45]) || 'PENDING',
          hospitalPayoutStatus: 'PENDING',
          handledById: bdId || undefined,
        })
      }

      if (plPayloads.length > 0) {
        try {
          const result = await prisma.pLRecord.createMany({
            data: plPayloads,
            skipDuplicates: true,
          })
          createdPLs += result.count
          console.log(`    Created ${result.count} PL records`)
        } catch (err) {
          errors++
          console.error(`    Error creating PL records batch: ${err}`)
        }
      }
    }
  }

  // ---- Phase 3: Summary ----
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log('\n' + '-'.repeat(60))
  console.log(`Done in ${elapsed}s`)
  console.log(`  Total valid rows:   ${validRows.length}`)
  console.log(`  Skipped (no ID):    ${skippedNoId}`)
  console.log(`  Created leads:      ${createdLeads}`)
  console.log(`  Created PL records: ${createdPLs}`)
  console.log(`  Stubs created:      ${stubsToCreate.length}`)
  console.log(`  Unmatched rows:     ${unmatchedRows}`)
  console.log(`  Errors:             ${errors}`)
  console.log(DRY_RUN ? '(dry run - no writes performed)' : '(writes committed)')
  console.log('='.repeat(60) + '\n')
}

main()
  .then(() => prisma.$disconnect().then(() => process.exit(0)))
  .catch((err) => {
    console.error('Fatal error:', err)
    prisma.$disconnect().then(() => process.exit(1))
  })
