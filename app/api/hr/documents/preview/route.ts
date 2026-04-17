import { NextRequest } from 'next/server'
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
import { z } from 'zod'

const previewSchema = z.object({
  employeeId: z.string().optional(),
  documentType: z.enum(['OFFER_LETTER', 'INCREMENT_LETTER', 'EXPERIENCE_LETTER', 'RELIEVING_LETTER', 'INTERNSHIP_OFFER_LETTER', 'INTERNSHIP_COMPLETION_LETTER']),
  applicantName: z.string().optional(),
  applicantEmail: z.string().optional(),
  metadata: z.record(z.any()).optional(),
})

/**
 * POST /api/hr/documents/preview
 * Renders the document template HTML without saving to the database.
 */
export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'hrms:employees:write')) return errorResponse('Forbidden', 403)

    const body = await request.json()
    const { employeeId, documentType, applicantName, applicantEmail, metadata } = previewSchema.parse(body)

    let employeeData: {
      name: string
      employeeCode: string
      email: string
      department?: string
      joinDate?: Date | null
      salary?: number | null
      designation?: string
    }

    if ((documentType === 'OFFER_LETTER' || documentType === 'INTERNSHIP_OFFER_LETTER') && !employeeId) {
      if (!applicantName || !applicantEmail) {
        return errorResponse('Applicant name and email are required for offer letters', 400)
      }
      employeeData = {
        name: applicantName,
        employeeCode: 'NEW',
        email: applicantEmail,
      }
    } else {
      if (!employeeId) return errorResponse('Employee is required for this document type', 400)
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: {
          user: { select: { name: true, email: true } },
          department: { select: { name: true } },
        },
      })
      if (!employee) return errorResponse('Employee not found', 404)
      employeeData = {
        name: employee.user.name,
        employeeCode: employee.employeeCode,
        email: employee.user.email,
        department: employee.department?.name,
        joinDate: employee.joinDate,
        salary: employee.salary,
      }
    }

    let htmlContent: string
    switch (documentType) {
      case 'OFFER_LETTER':
        htmlContent = generateOfferLetterHTML(employeeData, metadata)
        break
      case 'INCREMENT_LETTER':
        htmlContent = generateIncrementLetterHTML(employeeData, metadata)
        break
      case 'EXPERIENCE_LETTER':
        htmlContent = generateExperienceLetterHTML(employeeData, metadata)
        break
      case 'RELIEVING_LETTER':
        htmlContent = generateRelievingLetterHTML(employeeData, metadata)
        break
      case 'INTERNSHIP_OFFER_LETTER':
        htmlContent = generateInternshipOfferLetterHTML(employeeData, metadata)
        break
      case 'INTERNSHIP_COMPLETION_LETTER':
        htmlContent = generateInternshipCompletionLetterHTML(employeeData, metadata)
        break
      default:
        return errorResponse('Invalid document type', 400)
    }

    return successResponse({ htmlContent })
  } catch (error) {
    if (error instanceof z.ZodError) return errorResponse('Invalid request data', 400)
    console.error('Error previewing document:', error)
    return errorResponse('Failed to preview document', 500)
  }
}
