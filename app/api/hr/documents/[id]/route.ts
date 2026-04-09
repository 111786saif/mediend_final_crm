import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  generateOfferLetterHTML,
  generateIncrementLetterHTML,
  generateExperienceLetterHTML,
  generateRelievingLetterHTML,
  generateInternshipOfferLetterHTML,
  generateInternshipCompletionLetterHTML,
} from '@/lib/hrms/document-templates'

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

    let htmlContent: string

    switch (document.documentType) {
      case 'OFFER_LETTER':
        htmlContent = generateOfferLetterHTML(employeeData, metadata || undefined)
        htmlContent = htmlContent.replace(
          '<!-- ACK_PLACEHOLDER -->',
          '<br><br><p>Signature: _________________ &nbsp;&nbsp;&nbsp;&nbsp; Date: _________________</p>'
        )
        break
      case 'INCREMENT_LETTER':
        htmlContent = generateIncrementLetterHTML(employeeData, metadata || undefined)
        break
      case 'EXPERIENCE_LETTER':
        htmlContent = generateExperienceLetterHTML(employeeData, metadata || undefined)
        break
      case 'RELIEVING_LETTER':
        htmlContent = generateRelievingLetterHTML(employeeData, metadata || undefined)
        break
      case 'INTERNSHIP_OFFER_LETTER':
        htmlContent = generateInternshipOfferLetterHTML(employeeData, metadata || undefined)
        htmlContent = htmlContent.replace(
          '<!-- ACK_PLACEHOLDER -->',
          '<br><br><p>Signature: _________________ &nbsp;&nbsp;&nbsp;&nbsp; Date: _________________</p>'
        )
        break
      case 'INTERNSHIP_COMPLETION_LETTER':
        htmlContent = generateInternshipCompletionLetterHTML(employeeData, metadata || undefined)
        break
      case 'CUSTOM':
        // CUSTOM documents are uploaded files; view page will show link/embed
        htmlContent = document.documentUrl
          ? `<div style="padding:2rem;text-align:center;"><p>Uploaded document.</p><p><a href="${document.documentUrl}" target="_blank" rel="noopener noreferrer">Open document</a></p></div>`
          : '<div style="padding:2rem;text-align:center;"><p>No file linked to this document.</p></div>'
        break
      default:
        return errorResponse('Invalid document type', 400)
    }

    // Check if HTML download is requested
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

