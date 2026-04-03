import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { 
  generateOfferLetterHTML, 
  generateIncrementLetterHTML, 
  generateExperienceLetterHTML, 
  generateRelievingLetterHTML 
} from '@/lib/hrms/document-templates'
import { z } from 'zod'
import { DocumentType } from '@/generated/prisma/client'

const generateDocumentSchema = z.object({
  employeeId: z.string().optional(),
  documentType: z.enum(['OFFER_LETTER', 'INCREMENT_LETTER', 'EXPERIENCE_LETTER', 'RELIEVING_LETTER']),
  applicantName: z.string().optional(),
  applicantEmail: z.string().optional(),
  metadata: z.record(z.any()).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (!hasPermission(user, 'hrms:employees:write')) {
      return errorResponse('Forbidden', 403)
    }

    const body = await request.json()
    const { employeeId, documentType, applicantName, applicantEmail, metadata } = generateDocumentSchema.parse(body)

    let employeeData: {
      name: string
      employeeCode: string
      email: string
      department?: string
      joinDate?: Date | null
      salary?: number | null
      designation?: string
    }

    // For offer letters, applicant details can be provided directly (no employee needed)
    if (documentType === 'OFFER_LETTER' && !employeeId) {
      if (!applicantName || !applicantEmail) {
        return errorResponse('Applicant name and email are required for offer letters', 400)
      }
      employeeData = {
        name: applicantName,
        employeeCode: 'NEW',
        email: applicantEmail,
      }
    } else {
      if (!employeeId) {
        return errorResponse('Employee is required for this document type', 400)
      }
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: {
          user: { select: { name: true, email: true } },
          department: { select: { name: true } },
        },
      })
      if (!employee) {
        return errorResponse('Employee not found', 404)
      }
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
      default:
        return errorResponse('Invalid document type', 400)
    }

    // Save document record
    const document = await prisma.employeeDocument.create({
      data: {
        employeeId: employeeId || null,
        applicantName: !employeeId ? applicantName : null,
        applicantEmail: !employeeId ? applicantEmail : null,
        documentType: documentType as DocumentType,
        metadata: metadata || {},
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

    return successResponse({
      document,
      htmlContent,
    }, 'Document generated successfully')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Invalid request data', 400)
    }
    console.error('Error generating document:', error)
    return errorResponse('Failed to generate document', 500)
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (!hasPermission(user, 'hrms:employees:read')) {
      return errorResponse('Forbidden', 403)
    }

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')

    const where = employeeId ? { employeeId } : {}

    const documents = await prisma.employeeDocument.findMany({
      where,
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
      orderBy: {
        generatedAt: 'desc',
      },
    })

    return successResponse(documents)
  } catch (error) {
    console.error('Error fetching documents:', error)
    return errorResponse('Failed to fetch documents', 500)
  }
}

