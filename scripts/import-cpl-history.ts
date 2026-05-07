/**
 * Import historical CPL daily spend from the legacy Excel sheets.
 *
 * Phase 1 (default): builds scripts/cpl-mapping-review.csv proposing a DB
 * campaignName for every distinct sheet campaign. Eyeball + fix in Excel.
 * Phase 2 (--apply): reads the (possibly hand-edited) CSV and upserts
 * DailyCampaignSpend rows.
 *
 * Source data: scripts/cpl-backfill-data.json (extracted from the 4 monthly
 * tabs by the python pre-processor; see commit message).
 *
 * Usage:
 *   bun run scripts/import-cpl-history.ts                # Phase 1
 *   bun run scripts/import-cpl-history.ts --apply        # Phase 2 (writes DB)
 *   bun run scripts/import-cpl-history.ts --apply --fix-dec2025
 *     # Re-date the 25 Dec-2025 rows (sheet author typed wrong year for
 *     # "Circumcision-Delhi-CD-1 -January 2026") to Jan 2026 same day.
 *   bun run scripts/import-cpl-history.ts --apply --created-by=cto@mediend.com
 */

import 'dotenv/config'
import { prisma } from '@/lib/prisma'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const ROOT = join(process.cwd(), 'scripts')
const DATA_JSON = join(ROOT, 'cpl-backfill-data.json')
const CSV_PATH = join(ROOT, 'cpl-mapping-review.csv')

const APPLY = process.argv.includes('--apply')
const FIX_DEC = process.argv.includes('--fix-dec2025')
const CREATED_BY_ARG = process.argv.find((a) => a.startsWith('--created-by='))
const CREATED_BY_EMAIL = CREATED_BY_ARG ? CREATED_BY_ARG.split('=')[1] : 'cto@mediend.com'

type SheetRecord = {
  sheetName: string
  sourceCode: string | null
  date: string // YYYY-MM-DD
  spend: number
  sourceSheet: string
}

type DbCampaign = {
  campaignName: string
  source: string | null
  leadCount: number
}

const TREATMENTS = [
  'lipoma',
  'circumcision',
  'gynecomastia',
  'piles',
  'cataract',
  'liposuction',
  'rhinoplasty',
  'lasik',
  'bariatric',
  'hernia',
  'varicose',
  'acl',
  'axillary',
  'allurion',
]

const CITY_ALIASES: Record<string, string> = {
  mumbai: 'mumbai',
  mum: 'mumbai',
  mumabi: 'mumbai',
  pune: 'pune',
  delhi: 'delhi',
  hyd: 'hyd',
  hyderabad: 'hyd',
  bangalore: 'bangalore',
  noida: 'noida',
}

const MONTH_RE =
  /\b(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|jun(e)?|jul(y)?|aug(ust)?|sep(t|tember)?|oct(ober)?|nov(ember)?|dec(ember)?)\s*20\d{2}\b/gi

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function tokens(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
}

/**
 * The last "distinctive" alphanumeric token of a source code — the part that
 * uniquely identifies a campaign (e.g. "Lipos-D2" → "d2", "RM2" → "rm2",
 * "CM4.0" → "cm4", "GP1 &GP1.1" → "gp1"). Skips tokens shorter than 2 chars.
 */
function lastDistinctiveToken(code: string | null): string {
  if (!code) return ''
  const toks = code.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 2)
  return toks.length ? toks[toks.length - 1] : ''
}

const GENERIC_CODE_WORDS = new Set([
  'cir', 'lipo', 'lipos', 'gyno', 'lasik', 'piles', 'pip', 'fb', 'ggl',
  'lipoma', 'mum', 'delhi', 'pune', 'noida', 'google',
])

function extractFeatures(sheetName: string, sourceCode: string | null) {
  const cleaned = sheetName.replace(MONTH_RE, ' ').replace(/\s+/g, ' ').trim()
  const toks = tokens(cleaned)
  const tre = TREATMENTS.find((t) => toks.includes(t)) || (toks.includes('lipo') ? 'liposuction' : null)
  // Some sheets typo "lipma" → lipoma
  const treFinal = tre || (toks.some((t) => t === 'lipma') ? 'lipoma' : null)
  const cityKey = toks.find((t) => CITY_ALIASES[t]) || null
  const city = cityKey ? CITY_ALIASES[cityKey] : null
  const channel: 'google' | 'facebook' | null = toks.includes('google')
    ? 'google'
    : toks.includes('facebook') || toks.includes('fb')
      ? 'facebook'
      : null
  const codeTail = lastDistinctiveToken(sourceCode)
  const codeIsDistinctive = codeTail.length >= 3 && !GENERIC_CODE_WORDS.has(codeTail)
  return {
    treatment: treFinal,
    city,
    channel,
    codeNorm: sourceCode ? norm(sourceCode) : '',
    codeTail,
    codeIsDistinctive,
  }
}

/** Score how well a DB campaign matches a sheet block. Higher = better. */
function scoreMatch(
  features: ReturnType<typeof extractFeatures>,
  db: DbCampaign,
): { score: number; reason: string } {
  const dbNorm = norm(db.campaignName)
  const dbToks = tokens(db.campaignName)

  // Channel filter
  if (features.channel === 'google' && db.source !== 'Google') return { score: 0, reason: 'channel-mismatch' }
  if (features.channel === 'facebook' && db.source && db.source !== 'Facebook')
    return { score: 0, reason: 'channel-mismatch' }

  let score = 0
  const reasons: string[] = []

  // Treatment match
  if (features.treatment) {
    if (dbToks.some((t) => t === features.treatment)) {
      score += 30
      reasons.push('treatment')
    } else if (features.treatment === 'liposuction' && dbToks.some((t) => t === 'lipo')) {
      score += 30
      reasons.push('lipo')
    } else if (features.treatment === 'lipoma' && dbToks.some((t) => t === 'lipoma')) {
      score += 30
      reasons.push('lipoma')
    } else {
      // Treatment is required — without it, kill the score
      return { score: 0, reason: 'no-treatment' }
    }
  }

  // City match — handle "Delh" typo and "Mumai"/"Mum" aliases in DB
  if (features.city) {
    const cityToken = features.city
    const cityHit =
      dbToks.some((t) => t === cityToken) ||
      (cityToken === 'mumbai' && dbToks.some((t) => t === 'mumai' || t === 'mum')) ||
      (cityToken === 'delhi' && dbToks.some((t) => t === 'delh'))
    if (cityHit) {
      score += 25
      reasons.push('city')
    } else {
      score -= 50 // wrong city is a strong negative
    }
  }

  // Code matching: prefer trailing-token suffix (e.g. "Lipos-D2" → "d2"
  // matches "...lipo-d2" not "...lipo-d1"). Falls back to full-code substring.
  if (features.codeTail && dbNorm.endsWith(features.codeTail)) {
    score += 50
    reasons.push('code-tail')
  } else if (features.codeNorm && features.codeNorm.length >= 2) {
    if (dbNorm.endsWith(features.codeNorm)) {
      score += 50
      reasons.push('code-suffix')
    } else if (dbNorm.includes(features.codeNorm)) {
      score += 20
      reasons.push('code-substr')
    }
  }

  // Channel positive
  if (features.channel === 'google' && db.source === 'Google') {
    score += 15
    reasons.push('google')
  }
  if (features.channel === 'facebook' && db.source === 'Facebook') {
    score += 10
    reasons.push('fb')
  }

  // Tie-break: prefer campaigns with more leads (data is more "real")
  score += Math.min(db.leadCount / 10, 5)

  return { score, reason: reasons.join('+') || 'low' }
}

function matchSheetToDb(
  sheetName: string,
  sourceCode: string | null,
  candidates: DbCampaign[],
): { dbName: string | null; score: number; reason: string; alts: string[] } {
  const features = extractFeatures(sheetName, sourceCode)

  // If the sheet has a distinctive Facebook-channel code (e.g. "CM3", "VVD1",
  // "Lipos-D2") and no DB campaign carries that code, refuse to fall back to a
  // generic treatment+city match — leave for manual review.
  if (features.codeIsDistinctive && features.channel !== 'google') {
    const hasMatch = candidates.some((c) => {
      const dn = norm(c.campaignName)
      return dn.endsWith(features.codeTail) || (features.codeNorm && dn.endsWith(features.codeNorm))
    })
    if (!hasMatch) {
      return { dbName: null, score: 0, reason: 'distinctive-code-no-db-match', alts: [] }
    }
  }

  const scored = candidates
    .map((c) => ({ c, ...scoreMatch(features, c) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)

  if (!scored.length || scored[0].score < 30) {
    return { dbName: null, score: 0, reason: 'no-match', alts: [] }
  }
  const best = scored[0]
  const alts = scored.slice(1, 4).map((s) => `${s.c.campaignName} (${s.score.toFixed(0)})`)
  return { dbName: best.c.campaignName, score: best.score, reason: best.reason, alts }
}

// ============================================================================
// Phase 1: build mapping CSV
// ============================================================================

async function phase1Build() {
  console.log('Phase 1: building mapping review CSV')
  const records: SheetRecord[] = JSON.parse(readFileSync(DATA_JSON, 'utf-8'))

  // Distinct DB campaigns (within Jan-Apr 2026 window)
  const dbRows = await prisma.lead.groupBy({
    by: ['campaignName', 'source'],
    where: {
      leadEntryDate: { gte: new Date('2026-01-01'), lt: new Date('2026-05-01') },
      campaignName: { not: null },
    },
    _count: { _all: true },
  })
  const dbCampaigns: DbCampaign[] = dbRows.map((r) => ({
    campaignName: r.campaignName as string,
    source: r.source,
    leadCount: r._count._all,
  }))
  console.log(`  loaded ${dbCampaigns.length} distinct DB campaigns`)

  // Group sheet records by sheetName
  const bySheetName = new Map<string, { records: SheetRecord[]; codes: Set<string> }>()
  for (const r of records) {
    const e = bySheetName.get(r.sheetName) || { records: [], codes: new Set<string>() }
    e.records.push(r)
    if (r.sourceCode) e.codes.add(r.sourceCode)
    bySheetName.set(r.sheetName, e)
  }

  // Build CSV — `needs_review` is first so it's the easiest to filter on in Excel.
  const lines: string[] = [
    [
      'needs_review',
      'sheet_name',
      'dominant_source_code',
      'channel_hint',
      'proposed_db_name',
      'db_lead_count',
      'days_with_spend',
      'total_spend',
      'has_dec2025_anomaly',
      'match_reason',
      'match_score',
      'alternatives',
      'action',
    ].join(','),
  ]

  let mapped = 0
  let unmapped = 0
  let totalSpend = 0
  let mappedSpend = 0

  for (const [sheetName, e] of [...bySheetName.entries()].sort()) {
    const dominantCode =
      [...e.codes].sort((a, b) => {
        const ca = e.records.filter((r) => r.sourceCode === a).length
        const cb = e.records.filter((r) => r.sourceCode === b).length
        return cb - ca
      })[0] || null
    const features = extractFeatures(sheetName, dominantCode)
    const match = matchSheetToDb(sheetName, dominantCode, dbCampaigns)
    const dbLeadCount = match.dbName
      ? dbCampaigns.find((c) => c.campaignName === match.dbName)?.leadCount ?? 0
      : 0
    const nonZero = e.records.filter((r) => r.spend > 0)
    const sumSpend = nonZero.reduce((s, r) => s + r.spend, 0)
    const hasDec = e.records.some((r) => r.date.startsWith('2025-12'))

    totalSpend += sumSpend
    if (match.dbName) {
      mapped++
      mappedSpend += sumSpend
    } else {
      unmapped++
    }

    // Flag rows that need human attention:
    //  - YES_FIX  : unmapped with real spend → user must decide (map manually or leave SKIP)
    //  - info     : unmapped but zero spend → harmless, no action needed
    //  - YES_DEC  : mapped but has Dec-2025 anomaly → user should know about --fix-dec2025
    //  - blank    : mapped cleanly, no review needed
    let needsReview = ''
    if (!match.dbName && sumSpend > 0) needsReview = 'YES_FIX'
    else if (!match.dbName && sumSpend === 0) needsReview = 'info'
    else if (hasDec) needsReview = 'YES_DEC'

    lines.push(
      [
        needsReview,
        csvEscape(sheetName),
        csvEscape(dominantCode || ''),
        features.channel || '',
        csvEscape(match.dbName || ''),
        dbLeadCount,
        nonZero.length,
        sumSpend.toFixed(2),
        hasDec ? 'YES' : '',
        match.reason,
        match.score.toFixed(0),
        csvEscape(match.alts.join(' | ')),
        match.dbName ? 'MAP' : 'SKIP',
      ].join(','),
    )
  }

  writeFileSync(CSV_PATH, lines.join('\n') + '\n')

  // Count rows needing attention
  const needsFix = lines.slice(1).filter((l) => l.startsWith('YES_FIX,')).length
  const needsDec = lines.slice(1).filter((l) => l.startsWith('YES_DEC,')).length

  console.log()
  console.log(`  CSV written: ${CSV_PATH}`)
  console.log(`  mapped:   ${mapped} sheet campaigns (₹${mappedSpend.toLocaleString('en-IN', { maximumFractionDigits: 0 })})`)
  console.log(`  unmapped: ${unmapped} sheet campaigns (₹${(totalSpend - mappedSpend).toLocaleString('en-IN', { maximumFractionDigits: 0 })})`)
  console.log()
  console.log(`  needs_review = YES_FIX: ${needsFix}  (unmapped + real spend → look at these)`)
  console.log(`  needs_review = YES_DEC: ${needsDec}  (Dec-2025 date anomaly — pass --fix-dec2025 on apply)`)
  console.log()
  console.log('  Open the CSV in Excel, filter `needs_review = YES_FIX`, then either:')
  console.log('    • fill `proposed_db_name` with a real DB campaign name (it imports), or')
  console.log('    • leave it blank (it skips).')
  console.log('  The `action` column is informational only — a non-empty proposed_db_name always imports.')
  console.log('  Then run with --apply.')
}

function csvEscape(s: string | number): string {
  const v = String(s)
  if (v.includes(',') || v.includes('"') || v.includes('\n')) {
    return '"' + v.replace(/"/g, '""') + '"'
  }
  return v
}

// ============================================================================
// Phase 2: apply mapping → DailyCampaignSpend
// ============================================================================

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let cur: string[] = []
  let buf = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        buf += '"'
        i++
      } else if (c === '"') {
        inQuotes = false
      } else {
        buf += c
      }
    } else {
      if (c === '"') inQuotes = true
      else if (c === ',') {
        cur.push(buf)
        buf = ''
      } else if (c === '\n') {
        cur.push(buf)
        rows.push(cur)
        cur = []
        buf = ''
      } else if (c === '\r') {
        // skip
      } else {
        buf += c
      }
    }
  }
  if (buf || cur.length) {
    cur.push(buf)
    rows.push(cur)
  }
  const [header, ...body] = rows.filter((r) => r.length && r.some((v) => v !== ''))
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])))
}

async function phase2Apply() {
  console.log('Phase 2: applying mapping → DailyCampaignSpend')
  if (!existsSync(CSV_PATH)) {
    console.error(`  CSV not found: ${CSV_PATH}`)
    console.error('  Run without --apply first to generate it.')
    process.exit(1)
  }
  const records: SheetRecord[] = JSON.parse(readFileSync(DATA_JSON, 'utf-8'))
  const csvRows = parseCsv(readFileSync(CSV_PATH, 'utf-8'))

  // sheet_name → db_name (or null to skip).
  // Rule: a non-empty `proposed_db_name` always wins; an empty one means skip.
  // The `action` column is informational only — overwriting `proposed_db_name`
  // with a name is enough to map a row, even if action still says SKIP.
  const mapping = new Map<string, string | null>()
  for (const row of csvRows) {
    const dbName = (row.proposed_db_name || '').trim()
    mapping.set(row.sheet_name, dbName || null)
  }

  // Resolve creator
  const creator = await prisma.user.findUnique({ where: { email: CREATED_BY_EMAIL } })
  if (!creator) {
    console.error(`  User not found: ${CREATED_BY_EMAIL}`)
    process.exit(1)
  }
  console.log(`  createdBy = ${creator.name} <${creator.email}>`)

  // Group sheet records → (db_name, date) → summed spend
  const buckets = new Map<string, { campaignName: string; date: string; spend: number }>()
  let skipped = 0
  let zeroSkipped = 0
  let dec2025Fixed = 0

  for (const r of records) {
    const dbName = mapping.get(r.sheetName)
    if (dbName === undefined) {
      console.warn(`  WARN: sheet name not in CSV: ${r.sheetName}`)
      continue
    }
    if (dbName === null) {
      skipped++
      continue
    }
    if (r.spend <= 0) {
      zeroSkipped++
      continue
    }
    let date = r.date
    if (FIX_DEC && date.startsWith('2025-12')) {
      // Re-date to Jan 2026 same day
      date = '2026-01-' + date.slice(8)
      dec2025Fixed++
    }
    const key = `${dbName}|${date}`
    const e = buckets.get(key) || { campaignName: dbName, date, spend: 0 }
    e.spend += r.spend
    buckets.set(key, e)
  }

  console.log(`  buckets: ${buckets.size}, skipped sheet rows: ${skipped}, zero-spend skipped: ${zeroSkipped}, dec2025 re-dated: ${dec2025Fixed}`)

  // Upsert in batches
  let upserted = 0
  const entries = [...buckets.values()]
  for (const e of entries) {
    await prisma.dailyCampaignSpend.upsert({
      where: { campaignName_date: { campaignName: e.campaignName, date: new Date(e.date + 'T00:00:00.000Z') } },
      create: {
        campaignName: e.campaignName,
        date: new Date(e.date + 'T00:00:00.000Z'),
        spend: Math.round(e.spend * 100) / 100,
        createdById: creator.id,
      },
      update: { spend: Math.round(e.spend * 100) / 100 },
    })
    upserted++
    if (upserted % 200 === 0) console.log(`  ... ${upserted}/${entries.length}`)
  }

  console.log(`  done. upserted ${upserted} DailyCampaignSpend rows.`)
}

async function main() {
  if (APPLY) await phase2Apply()
  else await phase1Build()
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
