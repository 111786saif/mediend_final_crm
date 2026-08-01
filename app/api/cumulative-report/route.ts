import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  buildEmptyCumulativeReportManualPayload,
  buildManualPayloadFromEdits,
  mergeConcernCategoryFromStored,
  mergePatientSummaryFromStored,
  serializeManualPayloadForDb,
} from '@/lib/cumulative-report-manual'
import {
  CUMULATIVE_CONCERN_CATEGORY_ORDER,
  emptyCumulativeKpiCounts,
  type CumulativeConcernCategoryKey,
  type CumulativeKpiCounts,
} from '@/lib/cumulative-report-monthly-shared'

function parseYear(searchParams: URLSearchParams): number {
  const yearParam = searchParams.get('year')
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear()
  if (!Number.isFinite(year) || year < 2000 || year > 3000) {
    throw new Error('Invalid year')
  }
  return year
}

const kpiCountsSchema = z.object({
  totalSurgeries: z.number().int().min(0),
  mediendManaged: z.number().int().min(0),
  offlineBusiness: z.number().int().min(0),
  connectedCalls: z.number().int().min(0),
  callsNotConnected: z.number().int().min(0),
  patientSatisfied: z.number().int().min(0),
  patientNotSatisfied: z.number().int().min(0),
})

const saveSchema = z.object({
  year: z.number().int().min(2000).max(3000),
  patientCountsByMonth: z.record(z.string(), kpiCountsSchema),
  concernCountsByCategory: z.record(
    z.enum([
      'BD',
      'PAYMENT',
      'NO_UPDATE_FOLLOWUP',
      'SURGERY_RELATED',
      'DOCTOR',
      'HOSPITAL_STAFF',
      'CAB_PAYMENT',
      'OTHERS',
    ]),
    z.array(z.number().int().min(0)).length(12),
  ),
})

async function loadManualReport(year: number) {
  const entry = await prisma.cumulativeReportManualEntry.findUnique({
    where: { year },
  })

  if (!entry) {
    return buildEmptyCumulativeReportManualPayload(year)
  }

  const patientSummary = mergePatientSummaryFromStored(year, entry.patientSummary)
  const concernCategory = mergeConcernCategoryFromStored(
    year,
    entry.concernCategory,
    patientSummary,
  )

  return { year, patientSummary, concernCategory }
}

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'compliance:read')) return errorResponse('Forbidden', 403)

    const { searchParams } = new URL(request.url)
    const year = parseYear(searchParams)
    const payload = await loadManualReport(year)

    return successResponse(payload)
  } catch (error) {
    console.error('Error fetching cumulative report:', error)
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to fetch cumulative report',
      500,
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'compliance:write')) return errorResponse('Forbidden', 403)

    const body = await request.json()
    const parsed = saveSchema.parse(body)

    const empty = buildEmptyCumulativeReportManualPayload(parsed.year)
    const patientCountsByMonth: Record<string, CumulativeKpiCounts> = Object.fromEntries(
      empty.patientSummary.map((month) => [
        month.monthKey,
        parsed.patientCountsByMonth[month.monthKey] ?? emptyCumulativeKpiCounts(),
      ]),
    )

    const concernCountsByCategory = Object.fromEntries(
      CUMULATIVE_CONCERN_CATEGORY_ORDER.map((key) => [
        key,
        parsed.concernCountsByCategory[key] ?? Array.from({ length: 12 }, () => 0),
      ]),
    ) as Record<CumulativeConcernCategoryKey, number[]>

    const payload = buildManualPayloadFromEdits(
      parsed.year,
      patientCountsByMonth,
      concernCountsByCategory,
    )
    const serialized = serializeManualPayloadForDb(payload)

    await prisma.cumulativeReportManualEntry.upsert({
      where: { year: parsed.year },
      create: {
        year: parsed.year,
        patientSummary: serialized.patientSummary,
        concernCategory: serialized.concernCategory,
        updatedByUserId: user.id,
      },
      update: {
        patientSummary: serialized.patientSummary,
        concernCategory: serialized.concernCategory,
        updatedByUserId: user.id,
      },
    })

    return successResponse(payload)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(
        'Invalid request data: ' + error.errors.map((e) => e.message).join(', '),
        400,
      )
    }
    console.error('Error saving cumulative report:', error)
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to save cumulative report',
      500,
    )
  }
}
