import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  DEFAULT_TEMPLATE_BODIES,
  DOCUMENT_TEMPLATE_NAMES,
} from '@/lib/hrms/document-default-templates'
import { z } from 'zod'
import { DocumentType } from '@/generated/prisma/client'

const VALID_TYPES = Object.keys(DEFAULT_TEMPLATE_BODIES)

const putSchema = z.object({
  contentHtml: z.string().min(1, 'contentHtml is required'),
  name: z.string().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentType: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'hrms:employees:read')) return errorResponse('Forbidden', 403)

    const { documentType } = await params
    if (!VALID_TYPES.includes(documentType)) {
      return errorResponse('Invalid document type', 400)
    }

    const existing = await prisma.documentTemplate.findUnique({
      where: { documentType: documentType as DocumentType },
    })

    return successResponse({
      template: {
        id: existing?.id ?? null,
        documentType,
        name: existing?.name ?? DOCUMENT_TEMPLATE_NAMES[documentType] ?? documentType,
        contentHtml: existing?.contentHtml ?? DEFAULT_TEMPLATE_BODIES[documentType] ?? '',
        updatedAt: existing?.updatedAt ?? null,
      },
    })
  } catch (error) {
    console.error('Error fetching document template:', error)
    return errorResponse('Failed to fetch template', 500)
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ documentType: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'hrms:employees:write')) return errorResponse('Forbidden', 403)

    const { documentType } = await params
    if (!VALID_TYPES.includes(documentType)) {
      return errorResponse('Invalid document type', 400)
    }

    const body = await request.json()
    const { contentHtml, name } = putSchema.parse(body)
    const templateName = name || DOCUMENT_TEMPLATE_NAMES[documentType] || documentType

    const template = await prisma.documentTemplate.upsert({
      where: { documentType: documentType as DocumentType },
      create: {
        documentType: documentType as DocumentType,
        name: templateName,
        contentHtml,
      },
      update: {
        contentHtml,
        ...(name ? { name } : {}),
      },
    })

    return successResponse({ template }, 'Template saved')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.errors[0]?.message ?? 'Invalid request', 400)
    }
    console.error('Error saving document template:', error)
    return errorResponse('Failed to save template', 500)
  }
}
