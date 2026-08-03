import { NextRequest } from 'next/server'
import { z } from 'zod'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  ingestManualMySQLLeadRecords,
  parseManualMySQLLeadCsv,
} from '@/lib/manual-mysql-lead-ingestion'
import { getSessionWithFreshUser } from '@/lib/session'

const formSchema = z.object({
  mode: z.literal('form'),
  row: z.record(z.string(), z.unknown()),
})

const csvSchema = z.object({
  mode: z.literal('csv'),
  csvText: z.string().min(1, 'CSV content is required'),
})

const requestSchema = z.union([formSchema, csvSchema])

function isSuperAdmin(role: string | null | undefined) {
  return role === 'SUPER_ADMIN'
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getSessionWithFreshUser()
    if (!currentUser) {
      return unauthorizedResponse()
    }

    if (!isSuperAdmin(String(currentUser.role))) {
      return errorResponse('Forbidden', 403)
    }

    const parsed = requestSchema.safeParse(await request.json())
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message ?? 'Invalid request', 400)
    }

    const records =
      parsed.data.mode === 'form'
        ? [parsed.data.row]
        : parseManualMySQLLeadCsv(parsed.data.csvText)

    const result = await ingestManualMySQLLeadRecords(records)

    return successResponse(
      result,
      `Imported ${result.processedCount} lead${result.processedCount === 1 ? '' : 's'}`
    )
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to import manual leads',
      400
    )
  }
}
