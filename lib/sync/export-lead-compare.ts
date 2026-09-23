import * as fs from 'node:fs'
import * as path from 'node:path'
import { Prisma } from '@/generated/prisma/client'
import * as XLSX from 'xlsx'
import type { ReadonlyWorkspacePrisma } from '@/lib/sync/old-workspace-sync'

export type LeadCompareRow = {
  leadRef: string
  patientName: string | null
  phoneNumber: string | null
  status: string | null
  pipelineStage: string | null
  caseStage: string | null
  circle: string | null
  category: string | null
  treatment: string | null
  campaignName: string | null
  source: string | null
  flowType: string | null
  bdName: string | null
  bdEmail: string | null
  bdeName: string | null
  teamLeadId: string | null
  tlName: string | null
  assignedDate: string | null
  leadEntryDate: string | null
  updatedDate: string | null
  remarks: string | null
}

const LEAD_FIELDS = [
  'leadRef',
  'patientName',
  'phoneNumber',
  'status',
  'pipelineStage',
  'caseStage',
  'circle',
  'category',
  'treatment',
  'campaignName',
  'source',
  'flowType',
  'bdeName',
  'teamLeadId',
  'assignedDate',
  'leadEntryDate',
  'updatedDate',
  'remarks',
] as const

function formatCell(value: unknown): string | null {
  if (value == null) return null
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

function mapRawRow(row: Record<string, unknown>): LeadCompareRow {
  return {
    leadRef: String(row.leadRef ?? ''),
    patientName: formatCell(row.patientName),
    phoneNumber: formatCell(row.phoneNumber),
    status: formatCell(row.status),
    pipelineStage: formatCell(row.pipelineStage),
    caseStage: formatCell(row.caseStage),
    circle: formatCell(row.circle),
    category: formatCell(row.category),
    treatment: formatCell(row.treatment),
    campaignName: formatCell(row.campaignName),
    source: formatCell(row.source),
    flowType: formatCell(row.flowType),
    bdName: formatCell(row.bdName),
    bdEmail: formatCell(row.bdEmail),
    bdeName: formatCell(row.bdeName),
    teamLeadId: formatCell(row.teamLeadId),
    tlName: formatCell(row.tlName),
    assignedDate: formatCell(row.assignedDate),
    leadEntryDate: formatCell(row.leadEntryDate),
    updatedDate: formatCell(row.updatedDate),
    remarks: formatCell(row.remarks),
  }
}

function rowToSheetObject(row: LeadCompareRow): Record<string, string | null> {
  return {
    'Lead ID (leadRef)': row.leadRef,
    'Patient Name': row.patientName,
    Phone: row.phoneNumber,
    Status: row.status,
    'Pipeline Stage': row.pipelineStage,
    'Case Stage': row.caseStage,
    Circle: row.circle,
    Category: row.category,
    Treatment: row.treatment,
    Campaign: row.campaignName,
    Source: row.source,
    'Flow Type': row.flowType,
    'BD Name': row.bdName,
    'BD Email': row.bdEmail,
    'BD Number (bdeName)': row.bdeName,
    'TL ID (teamLeadId)': row.teamLeadId,
    'TL Name': row.tlName,
    'Assigned Date': row.assignedDate,
    'Lead Entry Date': row.leadEntryDate,
    'Updated At': row.updatedDate,
    Remarks: row.remarks,
  }
}

async function getLeadColumns(db: ReadonlyWorkspacePrisma): Promise<Set<string>> {
  const rows = await db.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Lead'
  `
  return new Set(rows.map((r) => r.column_name))
}

/** Fetch lead snapshot rows with BD/TL names for a set of leadRefs. */
export async function fetchLeadCompareRows(
  db: ReadonlyWorkspacePrisma,
  leadRefs: string[]
): Promise<Map<string, LeadCompareRow>> {
  const result = new Map<string, LeadCompareRow>()
  if (leadRefs.length === 0) return result

  const available = await getLeadColumns(db)
  const leadSelect = LEAD_FIELDS.filter((f) => available.has(f))
    .map((f) => `l."${f}"`)
    .join(', ')

  const chunkSize = 400
  for (let i = 0; i < leadRefs.length; i += chunkSize) {
    const chunk = leadRefs.slice(i, i + chunkSize)
    const rows = await db.$queryRaw<Array<Record<string, unknown>>>(
      Prisma.sql`
        SELECT
          ${Prisma.raw(leadSelect || 'l."leadRef"')},
          bd."name" AS "bdName",
          bd."email" AS "bdEmail",
          tl_user."name" AS "tlName"
        FROM "Lead" l
        LEFT JOIN "User" bd ON bd."id" = l."bdId"
        LEFT JOIN "Employee" e_tl ON e_tl."bdNumber" = l."teamLeadId"
        LEFT JOIN "User" tl_user ON tl_user."id" = e_tl."userId"
        WHERE l."leadRef" IN (${Prisma.join(chunk.map((ref) => Prisma.sql`${ref}`))})
        ORDER BY l."leadRef"
      `
    )

    for (const row of rows) {
      const mapped = mapRawRow(row)
      if (mapped.leadRef) result.set(mapped.leadRef, mapped)
    }
  }

  return result
}

function yesNoMatch(a: string | null, b: string | null): string {
  if (a == null && b == null) return 'Yes'
  return a === b ? 'Yes' : 'No'
}

export function buildComparisonRows(
  leadRefs: string[],
  oldRows: Map<string, LeadCompareRow>,
  newRows: Map<string, LeadCompareRow>
): Record<string, string | null>[] {
  return leadRefs.map((leadRef) => {
    const oldRow = oldRows.get(leadRef)
    const newRow = newRows.get(leadRef)

    return {
      'Lead ID (leadRef)': leadRef,
      'Patient Name (Old)': oldRow?.patientName ?? null,
      'On Old Workspace': oldRow ? 'Yes' : 'No',
      'On New Workspace': newRow ? 'Yes' : 'No',
      'Old Status': oldRow?.status ?? null,
      'New Status': newRow?.status ?? null,
      'Status Match': yesNoMatch(oldRow?.status ?? null, newRow?.status ?? null),
      'Old Pipeline Stage': oldRow?.pipelineStage ?? null,
      'New Pipeline Stage': newRow?.pipelineStage ?? null,
      'Pipeline Match': yesNoMatch(oldRow?.pipelineStage ?? null, newRow?.pipelineStage ?? null),
      'Old Case Stage': oldRow?.caseStage ?? null,
      'New Case Stage': newRow?.caseStage ?? null,
      'Case Stage Match': yesNoMatch(oldRow?.caseStage ?? null, newRow?.caseStage ?? null),
      'Old BD Name': oldRow?.bdName ?? null,
      'New BD Name': newRow?.bdName ?? null,
      'BD Match': yesNoMatch(oldRow?.bdName ?? null, newRow?.bdName ?? null),
      'Old TL Name': oldRow?.tlName ?? oldRow?.teamLeadId ?? null,
      'New TL Name': newRow?.tlName ?? newRow?.teamLeadId ?? null,
      'Old Updated At': oldRow?.updatedDate ?? null,
      'New Updated At': newRow?.updatedDate ?? null,
      'Updated Match': yesNoMatch(oldRow?.updatedDate ?? null, newRow?.updatedDate ?? null),
      'Old Remarks (truncated)': oldRow?.remarks?.slice(0, 200) ?? null,
      'New Remarks (truncated)': newRow?.remarks?.slice(0, 200) ?? null,
      'Overall Match':
        oldRow &&
        newRow &&
        oldRow.status === newRow.status &&
        oldRow.pipelineStage === newRow.pipelineStage &&
        oldRow.caseStage === newRow.caseStage &&
        oldRow.bdName === newRow.bdName
          ? 'Yes'
          : oldRow && !newRow
            ? 'Missing on New'
            : !oldRow && newRow
              ? 'Missing on Old'
              : 'Mismatch',
    }
  })
}

export function writeLeadCompareWorkbook(
  outputPath: string,
  leadRefs: string[],
  oldRows: Map<string, LeadCompareRow>,
  newRows: Map<string, LeadCompareRow>
): void {
  const workbook = XLSX.utils.book_new()

  const oldSheet = XLSX.utils.json_to_sheet(
    leadRefs
      .map((ref) => oldRows.get(ref))
      .filter((row): row is LeadCompareRow => !!row)
      .map(rowToSheetObject)
  )
  XLSX.utils.book_append_sheet(workbook, oldSheet, 'Old Workspace (Original)')

  const newSheet = XLSX.utils.json_to_sheet(
    leadRefs
      .map((ref) => newRows.get(ref))
      .filter((row): row is LeadCompareRow => !!row)
      .map(rowToSheetObject)
  )
  XLSX.utils.book_append_sheet(workbook, newSheet, 'New Workspace (Current)')

  const comparisonSheet = XLSX.utils.json_to_sheet(buildComparisonRows(leadRefs, oldRows, newRows))
  XLSX.utils.book_append_sheet(workbook, comparisonSheet, 'Comparison')

  const summary = [
    { Metric: 'Total leads in activity range', Value: String(leadRefs.length) },
    { Metric: 'Present on old workspace', Value: String(oldRows.size) },
    { Metric: 'Present on new workspace', Value: String(newRows.size) },
    {
      Metric: 'Missing on new (skipped by sync)',
      Value: String(leadRefs.filter((ref) => oldRows.has(ref) && !newRows.has(ref)).length),
    },
    {
      Metric: 'Status mismatches',
      Value: String(
        leadRefs.filter((ref) => {
          const o = oldRows.get(ref)
          const n = newRows.get(ref)
          return o && n && o.status !== n.status
        }).length
      ),
    },
    {
      Metric: 'Case stage mismatches',
      Value: String(
        leadRefs.filter((ref) => {
          const o = oldRows.get(ref)
          const n = newRows.get(ref)
          return o && n && o.caseStage !== n.caseStage
        }).length
      ),
    },
    {
      Metric: 'BD name mismatches',
      Value: String(
        leadRefs.filter((ref) => {
          const o = oldRows.get(ref)
          const n = newRows.get(ref)
          return o && n && o.bdName !== n.bdName
        }).length
      ),
    },
  ]
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summary), 'Summary')

  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  XLSX.writeFile(workbook, outputPath)
}
