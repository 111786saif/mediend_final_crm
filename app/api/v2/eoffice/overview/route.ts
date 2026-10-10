import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

const allowedRoles = new Set(['SUPER_ADMIN', 'ADMIN', 'MD'])

type CountRow = { count: bigint | number }
type DocumentRow = {
  id: number
  documentNumber: string
  title: string
  documentType: string
  status: string
  updatedAt: Date
  folderName: string | null
}

export async function GET(request: NextRequest) {
  const user = getSessionFromRequest(request)
  if (!user) return unauthorizedResponse()
  if (!allowedRoles.has(user.role)) return errorResponse('Forbidden', 403)

  try {
    const [documents, folders, workflows, providers, connectors, recentDocuments] = await Promise.all([
      prisma.$queryRaw<CountRow[]>`SELECT count(*) AS count FROM crm_v2."DmsDocument" WHERE archived_at IS NULL`,
      prisma.$queryRaw<CountRow[]>`SELECT count(*) AS count FROM crm_v2."DmsFolder" WHERE is_archived = false`,
      prisma.$queryRaw<CountRow[]>`SELECT count(*) AS count FROM crm_v2."DmsWorkflow" WHERE is_enabled = true`,
      prisma.$queryRaw<CountRow[]>`SELECT count(*) AS count FROM crm_v2."StorageProvider" WHERE is_enabled = true`,
      prisma.$queryRaw<CountRow[]>`SELECT count(*) AS count FROM crm_v2."Connector" WHERE is_enabled = true`,
      prisma.$queryRaw<DocumentRow[]>`
        SELECT d.id, d.document_number AS "documentNumber", d.title,
               d.document_type AS "documentType", d.status, d.updated_at AS "updatedAt",
               f.name AS "folderName"
        FROM crm_v2."DmsDocument" d
        LEFT JOIN crm_v2."DmsFolder" f ON f.id = d.folder_id
        WHERE d.archived_at IS NULL
        ORDER BY d.updated_at DESC
        LIMIT 12
      `,
    ])

    const number = (row: CountRow[]) => Number(row[0]?.count ?? 0)
    return successResponse({
      counts: {
        documents: number(documents), folders: number(folders), workflows: number(workflows),
        activeProviders: number(providers), activeConnectors: number(connectors),
      },
      recentDocuments,
    })
  } catch (error) {
    console.error('eOffice overview failed', error)
    return errorResponse('Unable to load eOffice data', 500)
  }
}
