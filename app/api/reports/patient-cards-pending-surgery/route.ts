import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { Prisma } from '@/generated/prisma/client'
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

export async function GET(request: NextRequest) {
  const user = getSessionFromRequest(request)
  if (!user) return unauthorizedResponse()
  if (!ALLOWED_ROLES.has(user.role)) {
    return errorResponse('Forbidden', 403)
  }

  const { searchParams } = new URL(request.url)
  const months = parseMonths(searchParams.get('months'))
  const teamLeadUserIdParam = searchParams.get('teamLeadUserId')?.trim() || null

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

  const where: Prisma.LeadWhereInput = {
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
    kypSubmission: { is: { OR: monthRanges } },
  }

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

  const now = Date.now()
  const rows: RowResponse[] = limited.map((l) => {
    const uploadedAt = l.kypSubmission?.submittedAt ?? new Date(0)
    const daysSinceUpload = Math.max(
      0,
      Math.floor((now - uploadedAt.getTime()) / (1000 * 60 * 60 * 24))
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
  })
}
