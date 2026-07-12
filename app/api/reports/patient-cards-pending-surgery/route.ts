import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { Prisma } from '@/generated/prisma/client'
import { CaseStage } from '@/generated/prisma/enums'
import {
  getTeamLeadLeadAccessBdUserIds,
  getManagerGroups,
} from '@/lib/hierarchy'

const ALLOWED_ROLES = new Set([
  'TEAM_LEAD',
  'SALES_HEAD',
  'EXECUTIVE_ASSISTANT',
  'MD',
  'ADMIN',
  'TESTER',
])

const HARD_CAP = 5000

type DayBucketParam = 'all' | '30' | '60' | '90'

type RowResponse = {
  id: string
  leadRef: string
  patientName: string
  phoneNumber: string
  caseStage: string
  pipelineStage: string
  hospitalName: string
  treatment: string | null
  uploadDate: string
  daysSinceUpload: number
  bdmId: string
  bdmName: string
  teamLeadId: string | null
  teamLeadName: string | null
}

type GroupResponse = {
  teamLeadId: string
  teamLeadName: string
  count: number
}

type BucketCounts = {
  all: number
  d30: number
  d60: number
  d90: number
}

type MonthRange = { key: string; start: Date; end: Date }

function monthRange(year: number, monthIdx: number): MonthRange {
  const start = new Date(year, monthIdx, 1, 0, 0, 0, 0)
  const end = new Date(year, monthIdx + 1, 0, 23, 59, 59, 999)
  return {
    key: `${year}-${String(monthIdx + 1).padStart(2, '0')}`,
    start,
    end,
  }
}

function defaultMonths(): MonthRange[] {
  const year = new Date().getFullYear()
  // Apr (idx 3) and May (idx 4)
  return [monthRange(year, 3), monthRange(year, 4)]
}

function parseMonths(raw: string | null): MonthRange[] {
  if (!raw) return defaultMonths()
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const ranges: MonthRange[] = []
  for (const p of parts) {
    const m = /^(\d{4})-(\d{1,2})$/.exec(p)
    if (!m) continue
    const y = Number(m[1])
    const mo = Number(m[2]) - 1
    if (Number.isNaN(y) || mo < 0 || mo > 11) continue
    ranges.push(monthRange(y, mo))
  }
  return ranges.length ? ranges : defaultMonths()
}

function parseBucket(raw: string | null): DayBucketParam {
  if (raw === '30' || raw === '60' || raw === '90') return raw
  return 'all'
}

function parseStage(raw: string | null): CaseStage | null {
  if (!raw || raw === 'all') return null
  return (Object.values(CaseStage) as string[]).includes(raw) ? (raw as CaseStage) : null
}

/** Returns the KYPSubmission.submittedAt condition for a given days-since-upload bucket. */
function bucketDateWhere(bucket: DayBucketParam, now: Date): Prisma.KYPSubmissionWhereInput | null {
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000)
  if (bucket === '30') return { submittedAt: { lte: daysAgo(30), gt: daysAgo(60) } }
  if (bucket === '60') return { submittedAt: { lte: daysAgo(60), gt: daysAgo(90) } }
  if (bucket === '90') return { submittedAt: { lte: daysAgo(90) } }
  return null
}

export async function GET(request: NextRequest) {
  const user = getSessionFromRequest(request)
  if (!user) return unauthorizedResponse()
  if (!ALLOWED_ROLES.has(user.role)) {
    return errorResponse('Forbidden', 403)
  }

  const { searchParams } = new URL(request.url)
  const months = parseMonths(searchParams.get('months'))
  const teamLeadUserIdParam = searchParams.get('teamLeadUserId')?.trim() || null
  const bucket = parseBucket(searchParams.get('bucket'))
  const stage = parseStage(searchParams.get('caseStage'))
  const now = new Date()

  // Build BD scope
  let bdScope: Prisma.LeadWhereInput = {}
  if (user.role === 'TEAM_LEAD') {
    const subIds = await getTeamLeadLeadAccessBdUserIds(user.id)
    bdScope = { bdId: { in: [user.id, ...subIds] } }
  } else if (teamLeadUserIdParam) {
    // SALES_HEAD / EA / MD / ADMIN narrowing by a chosen team lead
    const groups = await getManagerGroups()
    const chosen = groups.find((g) => g.managerUserId === teamLeadUserIdParam)
    if (chosen) {
      const ids = [chosen.managerUserId, ...chosen.subordinates.map((s) => s.userId)]
      bdScope = { bdId: { in: ids } }
    }
  }

  const monthRanges = months.map((m) => ({ submittedAt: { gte: m.start, lte: m.end } }))

  // Base scope shared by rows, bucket counts, and stage options: pending surgery + bd scope + month window.
  // Does NOT include the stage or bucket filters, so it can be reused to compute those independently.
  const pendingWhereBase: Prisma.LeadWhereInput = {
    surgeryDate: null,
    AND: [
      {
        OR: [
          { plRecord: { is: null } },
          { plRecord: { surgeryDate: null } },
        ],
      },
      bdScope,
    ],
  }

  function whereFor(opts: { bucket: DayBucketParam; stage: CaseStage | null }): Prisma.LeadWhereInput {
    const kypConditions: Prisma.KYPSubmissionWhereInput[] = [{ OR: monthRanges }]
    const bucketCond = bucketDateWhere(opts.bucket, now)
    if (bucketCond) kypConditions.push(bucketCond)
    return {
      ...pendingWhereBase,
      ...(opts.stage ? { caseStage: opts.stage } : {}),
      kypSubmission: { is: { AND: kypConditions } },
    }
  }

  // Distinct case stages available in the current month/team window (ignores stage & bucket filters
  // themselves, so the dropdown options stay stable while narrowing by either).
  const stageRows = await prisma.lead.findMany({
    where: whereFor({ bucket: 'all', stage: null }),
    select: { caseStage: true },
    distinct: ['caseStage'],
  })
  const stageOptions = stageRows.map((r) => r.caseStage).sort()

  // Bucket counts respect the stage filter (if any) but not the bucket itself, so all four cards
  // stay accurate no matter which bucket is currently selected.
  const [allCount, d30Count, d60Count, d90Count] = await Promise.all([
    prisma.lead.count({ where: whereFor({ bucket: 'all', stage }) }),
    prisma.lead.count({ where: whereFor({ bucket: '30', stage }) }),
    prisma.lead.count({ where: whereFor({ bucket: '60', stage }) }),
    prisma.lead.count({ where: whereFor({ bucket: '90', stage }) }),
  ])
  const bucketCounts: BucketCounts = { all: allCount, d30: d30Count, d60: d60Count, d90: d90Count }

  const where = whereFor({ bucket, stage })

  const leads = await prisma.lead.findMany({
    where,
    select: {
      id: true,
      leadRef: true,
      patientName: true,
      phoneNumber: true,
      caseStage: true,
      pipelineStage: true,
      hospitalName: true,
      treatment: true,
      bdId: true,
      bd: {
        select: {
          id: true,
          name: true,
          employee: {
            select: {
              manager: {
                select: {
                  userId: true,
                  user: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      },
      kypSubmission: { select: { submittedAt: true } },
    },
    orderBy: { kypSubmission: { submittedAt: 'desc' } },
    take: HARD_CAP + 1,
  })

  const truncated = leads.length > HARD_CAP
  const limited = truncated ? leads.slice(0, HARD_CAP) : leads

  // Build a TL lookup from manager groups so we don't blindly trust single-hop bd.employee.manager
  // (which could be CM/ACM in some teams). Map bdUserId -> { tlUserId, tlName }.
  const showGroups = user.role !== 'TEAM_LEAD'
  const tlByBdUserId = new Map<string, { tlUserId: string; tlName: string }>()
  if (showGroups) {
    const groups = await getManagerGroups()
    for (const g of groups) {
      if (g.managerRole !== 'TEAM_LEAD') continue
      for (const s of g.subordinates) {
        tlByBdUserId.set(s.userId, { tlUserId: g.managerUserId, tlName: g.managerName })
      }
    }
  }

  const nowMs = now.getTime()
  const rows: RowResponse[] = limited.map((l) => {
    const uploadedAt = l.kypSubmission?.submittedAt ?? new Date(0)
    const daysSinceUpload = Math.max(
      0,
      Math.floor((nowMs - uploadedAt.getTime()) / (1000 * 60 * 60 * 24))
    )
    // Prefer manager-group mapping (TEAM_LEAD only); fall back to direct manager join
    const tlFromGroup = tlByBdUserId.get(l.bdId)
    const tlFallback = l.bd?.employee?.manager
      ? {
          tlUserId: l.bd.employee.manager.userId,
          tlName: l.bd.employee.manager.user?.name ?? '',
        }
      : null
    const tl = tlFromGroup ?? tlFallback
    return {
      id: l.id,
      leadRef: l.leadRef,
      patientName: l.patientName,
      phoneNumber: l.phoneNumber,
      caseStage: l.caseStage,
      pipelineStage: l.pipelineStage,
      hospitalName: l.hospitalName,
      treatment: l.treatment,
      uploadDate: uploadedAt.toISOString(),
      daysSinceUpload,
      bdmId: l.bdId,
      bdmName: l.bd?.name ?? '',
      teamLeadId: tl?.tlUserId ?? null,
      teamLeadName: tl?.tlName ?? null,
    }
  })

  let groups: GroupResponse[] | undefined
  if (showGroups) {
    const counts = new Map<string, { name: string; count: number }>()
    for (const r of rows) {
      if (!r.teamLeadId) continue
      const existing = counts.get(r.teamLeadId)
      if (existing) existing.count += 1
      else counts.set(r.teamLeadId, { name: r.teamLeadName ?? '', count: 1 })
    }
    groups = Array.from(counts.entries())
      .map(([teamLeadId, v]) => ({ teamLeadId, teamLeadName: v.name, count: v.count }))
      .sort((a, b) => b.count - a.count)
  }

  return successResponse({
    rows,
    groups,
    months: months.map((m) => m.key),
    truncated,
    bucketCounts,
    stageOptions,
  })
}