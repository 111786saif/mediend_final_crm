import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { buildComplianceCallWhere } from '@/lib/compliance-query'

const PAGE_SIZE = 20

const DISCHARGED_STAGES = [
  'DISCHARGED',
  'CASH_DISCHARGED',
  'PL_PENDING',
  'OUTSTANDING',
  'IPD_DONE',
] as const

async function backfillComplianceCalls() {
  const orphans = await prisma.lead.findMany({
    where: {
      caseStage: { in: DISCHARGED_STAGES as unknown as Prisma.EnumCaseStageFilter['in'] },
      complianceCall: null,
    },
    select: { id: true },
  })
  if (orphans.length === 0) return
  await prisma.complianceCall.createMany({
    data: orphans.map((l) => ({ leadId: l.id })),
    skipDuplicates: true,
  })
}

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'compliance:read')) return errorResponse('Forbidden', 403)

    // Lazy backfill: auto-create PENDING ComplianceCall for any discharged lead missing one.
    // Covers leads discharged before the compliance feature shipped.
    await backfillComplianceCalls()

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const satisfaction = searchParams.get('satisfaction')
    const ratingParam = searchParams.get('rating')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    // Accepts the current dischargeStart/dischargeEnd params plus older names
    // from the earlier admission/surgery-based filter.
    const dischargeStart =
      searchParams.get('dischargeStart') ??
      searchParams.get('caseStart') ??
      searchParams.get('surgeryStart')
    const dischargeEnd =
      searchParams.get('dischargeEnd') ??
      searchParams.get('caseEnd') ??
      searchParams.get('surgeryEnd')
    const q = searchParams.get('q')?.trim() ?? ''
    const hospitalName = searchParams.get('hospitalName')?.trim() ?? ''
    const surgeonName = searchParams.get('surgeonName')?.trim() ?? ''
    const bdId = searchParams.get('bdId')?.trim() ?? ''
    const circle = searchParams.get('circle')?.trim() ?? ''
    const treatment = searchParams.get('treatment')?.trim() ?? ''
    const sort = searchParams.get('sort') ?? 'recent'
    const cursor = searchParams.get('cursor')
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : PAGE_SIZE

    const where = buildComplianceCallWhere({
      status,
      satisfaction,
      rating: ratingParam ? parseInt(ratingParam, 10) : null,
      startDate,
      endDate,
      dischargeStart,
      dischargeEnd,
      hospitalName,
      surgeonName,
      bdId,
      circle,
      treatment,
      q,
    })

    let orderBy: Prisma.ComplianceCallOrderByWithRelationInput[]
    switch (sort) {
      case 'highest':
        orderBy = [{ rating: 'desc' }, { completedAt: 'desc' }]
        break
      case 'lowest':
        orderBy = [{ rating: 'asc' }, { completedAt: 'desc' }]
        break
      case 'pending':
        // status=PENDING first, then most recent
        orderBy = [{ status: 'asc' }, { createdAt: 'desc' }]
        break
      case 'recent':
        orderBy = [{ completedAt: 'desc' }, { createdAt: 'desc' }]
        break
      case 'discharge':
      default:
        // Default worklist order: most recent discharge first. Records without a
        // discharge sheet (e.g. IPD_DONE) sink to the bottom. The id tiebreaker
        // keeps cursor pagination deterministic.
        orderBy = [
          { lead: { dischargeSheet: { dischargeDate: { sort: 'desc', nulls: 'last' } } } },
          { completedAt: 'desc' },
          { id: 'desc' },
        ]
        break
    }

    const calls = await prisma.complianceCall.findMany({
      where,
      orderBy,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        lead: {
          select: {
            id: true,
            leadRef: true,
            patientName: true,
            phoneNumber: true,
            treatment: true,
            hospitalName: true,
            surgeonName: true,
            ipdDrName: true,
            surgeryDate: true,
            caseStage: true,
            flowType: true,
            bd: { select: { id: true, name: true } },
            dischargeSheet: {
              select: {
                id: true,
                dischargeDate: true,
                bdmName: true,
                managerName: true,
                doctorName: true,
                hospitalName: true,
              },
            },
            kypSubmission: {
              select: {
                preAuthData: {
                  select: {
                    requestedHospitalName: true,
                    suggestedHospitals: true,
                  },
                },
              },
            },
            plRecord: { select: { hospitalName: true, doctorName: true } },
          },
        },
        calledBy: { select: { id: true, name: true } },
      },
    })

    const hasMore = calls.length > limit
    const items = hasMore ? calls.slice(0, limit) : calls
    const nextCursor = hasMore ? items[items.length - 1].id : null

    return successResponse({ calls: items, nextCursor })
  } catch (error) {
    console.error('Error fetching compliance calls:', error)
    return errorResponse('Failed to fetch compliance calls', 500)
  }
}
