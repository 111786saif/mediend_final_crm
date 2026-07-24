import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  DEFAULT_TEMPLATE_BODIES,
  DOCUMENT_TEMPLATE_NAMES,
} from '@/lib/hrms/document-default-templates'

const TEMPLATE_TYPES = Object.keys(DEFAULT_TEMPLATE_BODIES)

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'hrms:employees:read')) return errorResponse('Forbidden', 403)

    const rows = await prisma.documentTemplate.findMany({
      orderBy: { name: 'asc' },
    })

    const byType = new Map(rows.map((r) => [r.documentType, r]))
    const templates = TEMPLATE_TYPES.map((documentType) => {
      const existing = byType.get(documentType as any)
      return {
        id: existing?.id ?? null,
        documentType,
        name: existing?.name ?? DOCUMENT_TEMPLATE_NAMES[documentType] ?? documentType,
        contentHtml: existing?.contentHtml ?? DEFAULT_TEMPLATE_BODIES[documentType] ?? '',
        updatedAt: existing?.updatedAt ?? null,
      }
    })

    return successResponse({ templates })
  } catch (error) {
    console.error('Error listing document templates:', error)
    return errorResponse('Failed to list templates', 500)
  }
}
