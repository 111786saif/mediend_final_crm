import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { resolveDocumentHtml } from '@/lib/hrms/document-render'
import { z } from 'zod'
import { format } from 'date-fns'

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  OFFER_LETTER: 'Offer Letter',
  INCREMENT_LETTER: 'Increment Letter',
  EXPERIENCE_LETTER: 'Experience Letter',
  RELIEVING_LETTER: 'Relieving Letter',
  INTERNSHIP_OFFER_LETTER: 'Internship Offer Letter',
  INTERNSHIP_COMPLETION_LETTER: 'Internship Completion Certificate',
}

const COMPANY_NAME = 'Kundkund Healthcare Private Limited'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token?.trim()) {
      return errorResponse('Token is required', 400)
    }

    const document = await prisma.employeeDocument.findUnique({
      where: { ackToken: token },
      include: {
        employee: {
          include: {
            user: { select: { name: true, email: true } },
            department: { select: { name: true } },
          },
        },
      },
    })

    if (!document) {
      return errorResponse('Invalid or expired token', 404)
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
      generatedAt: document.generatedAt,
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

    return successResponse({
      documentType: document.documentType,
      documentTypeLabel: DOCUMENT_TYPE_LABELS[document.documentType] ?? document.documentType,
      employeeName: document.employee?.user.name || document.applicantName || 'Applicant',
      companyName: COMPANY_NAME,
      generatedAt: document.generatedAt,
      generatedAtFormatted: format(new Date(document.generatedAt), 'do MMMM, yyyy'),
      acknowledgedAt: document.acknowledgedAt,
      acknowledgedAtFormatted: document.acknowledgedAt
        ? format(new Date(document.acknowledgedAt), 'PPp')
        : null,
      htmlContent,
    })
  } catch (error) {
    console.error('Error fetching document for acknowledgement:', error)
    return errorResponse('Failed to fetch document', 500)
  }
}

const postSchema = z.object({
  token: z.string().min(1, 'Token is required'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token } = postSchema.parse(body)

    const document = await prisma.employeeDocument.findUnique({
      where: { ackToken: token },
    })

    if (!document) {
      return errorResponse('Invalid or expired token', 404)
    }

    if (document.acknowledgedAt) {
      return errorResponse('Document has already been acknowledged', 400)
    }

    const forwardedFor = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const acknowledgedIp =
      forwardedFor?.split(',')[0]?.trim() ||
      realIp ||
      request.headers.get('cf-connecting-ip') ||
      null

    await prisma.employeeDocument.update({
      where: { id: document.id },
      data: {
        acknowledgedAt: new Date(),
        acknowledgedIp,
      },
    })

    return successResponse(
      {
        acknowledgedAt: new Date().toISOString(),
        acknowledgedAtFormatted: format(new Date(), 'PPp'),
      },
      'Document acknowledged successfully'
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.errors[0]?.message ?? 'Invalid request', 400)
    }
    console.error('Error acknowledging document:', error)
    return errorResponse('Failed to acknowledge document', 500)
  }
}
