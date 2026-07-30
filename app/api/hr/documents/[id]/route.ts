import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { resolveDocumentHtml, wrapEditedBody } from '@/lib/hrms/document-render'
import { z } from 'zod'

const patchSchema = z.object({
  metadata: z.record(z.any()).optional(),
  contentHtml: z.string().optional(),
  /** When true, treat contentHtml as body-only and re-wrap with chrome */
  bodyOnly: z.boolean().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (!hasPermission(user, 'hrms:employees:read')) {
      return errorResponse('Forbidden', 403)
    }

    const { id } = await params

    const document = await prisma.employeeDocument.findUnique({
      where: { id },
      include: {
        employee: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
            department: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    })

    if (!document) {
      return errorResponse('Document not found', 404)
    }

    const employeeData = document.employee
      ? {
          name: document.employee.user.name,
          employeeCode: document.employee.employeeCode,
          email: document.employee.user.email,
          department: document.employee.department?.name,
          joinDate: document.employee.joinDate,
          salary: document.employee.salary,
        }
      : {
          name: document.applicantName || 'Applicant',
          employeeCode: 'NEW',
          email: document.applicantEmail || '',
        }

    const metadata = document.metadata as Record<string, unknown> | null

    let htmlContent = await resolveDocumentHtml({
      documentType: document.documentType,
      contentHtml: document.contentHtml,
      employee: employeeData,
      metadata,
      documentUrl: document.documentUrl,
    })

    if (
      document.documentType === 'OFFER_LETTER' ||
      document.documentType === 'INTERNSHIP_OFFER_LETTER'
    ) {
      htmlContent = htmlContent.replace(
        '<!-- ACK_PLACEHOLDER -->',
        '<br><br><p>Signature: _________________ &nbsp;&nbsp;&nbsp;&nbsp; Date: _________________</p>'
      )
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format')

    if (format === 'html') {
      return new NextResponse(htmlContent, {
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': `attachment; filename="${document.documentType.toLowerCase()}_${document.employee?.employeeCode || 'applicant'}.html"`,
        },
      })
    }

    return successResponse({
      document,
      htmlContent,
    })
  } catch (error) {
    console.error('Error fetching document:', error)
    return errorResponse('Failed to fetch document', 500)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (!hasPermission(user, 'hrms:employees:write')) {
      return errorResponse('Forbidden', 403)
    }

    const { id } = await params

    const document = await prisma.employeeDocument.findUnique({
      where: { id },
    })

    if (!document) {
      return errorResponse('Document not found', 404)
    }

    if (document.acknowledgedAt) {
      return errorResponse('Cannot edit a document that has already been acknowledged by the employee', 400)
    }

    if (document.documentType === 'CUSTOM') {
      return errorResponse('Custom uploaded documents cannot be edited as rich text', 400)
    }

    const body = await request.json()
    const { metadata, contentHtml, bodyOnly } = patchSchema.parse(body)

    if (!metadata && !contentHtml) {
      return errorResponse('metadata or contentHtml is required', 400)
    }

    let nextHtml = contentHtml
    if (contentHtml && bodyOnly) {
      nextHtml = wrapEditedBody(contentHtml, document.documentType)
    } else if (contentHtml && !contentHtml.includes('<!DOCTYPE') && !contentHtml.includes('<html')) {
      // TipTap typically returns body fragments — wrap for consistent view/print
      nextHtml = wrapEditedBody(contentHtml, document.documentType)
    }

    const updated = await prisma.employeeDocument.update({
      where: { id },
      data: {
        ...(metadata ? { metadata } : {}),
        ...(nextHtml ? { contentHtml: nextHtml } : {}),
      },
      include: {
        employee: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
    })

    return successResponse(
      { document: updated, htmlContent: updated.contentHtml },
      'Document updated successfully'
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.errors[0]?.message ?? 'Invalid request', 400)
    }
    console.error('Error updating document:', error)
    return errorResponse('Failed to update document', 500)
  }
}
