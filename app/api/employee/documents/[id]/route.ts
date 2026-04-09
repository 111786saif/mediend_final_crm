import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
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

    const { id } = await params

    // Get employee record for user
    const employee = await prisma.employee.findUnique({
      where: { userId: user.id },
    })

    if (!employee) {
      return errorResponse('Employee record not found', 404)
    }

    // Fetch the document and verify it belongs to the employee
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

    // Verify the document belongs to the requesting user's employee record
    if (document.employeeId !== employee.id) {
      return errorResponse('Forbidden', 403)
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

    if (document.documentType === 'CUSTOM') {
      if (!document.documentUrl) {
        return errorResponse('Document file not available', 404)
      }
      return successResponse({
        document,
        htmlContent: null,
        documentUrl: document.documentUrl,
        isCustom: true,
      })
    }

    const metadata = document.metadata as Record<string, unknown> | null

    let htmlContent: string

    switch (document.documentType) {
      case 'OFFER_LETTER':
        htmlContent = generateOfferLetterHTML(employeeData, metadata || undefined)
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
        break
      case 'INTERNSHIP_COMPLETION_LETTER':
        htmlContent = generateInternshipCompletionLetterHTML(employeeData, metadata || undefined)
        break
      default:
        return errorResponse('Invalid document type', 400)
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

