import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { resolveDocumentHtml } from '@/lib/hrms/document-render'
import { sendDocumentEmail } from '@/lib/resend'
import { z } from 'zod'

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  OFFER_LETTER: 'Offer Letter',
  INCREMENT_LETTER: 'Increment Letter',
  EXPERIENCE_LETTER: 'Experience Letter',
  RELIEVING_LETTER: 'Relieving Letter',
  INTERNSHIP_OFFER_LETTER: 'Internship Offer Letter',
  INTERNSHIP_COMPLETION_LETTER: 'Internship Completion Certificate',
}

const emailSchema = z.object({
  email: z.string().email('Valid email is required'),
})

export async function POST(
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

    const body = await request.json()
    const { email } = emailSchema.parse(body)

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

    if (document.documentType === 'CUSTOM') {
      return errorResponse('Custom uploaded documents cannot be emailed as HTML', 400)
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
          email: document.applicantEmail || email,
        }

    const metadata = document.metadata as Record<string, unknown> | null

    let htmlContent = await resolveDocumentHtml({
      documentType: document.documentType,
      contentHtml: document.contentHtml,
      employee: employeeData,
      metadata,
      documentUrl: document.documentUrl,
    })

    let ackToken: string | null = null

    if (
      document.documentType === 'OFFER_LETTER' ||
      document.documentType === 'INTERNSHIP_OFFER_LETTER'
    ) {
      ackToken = crypto.randomUUID()
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.mediend.com'
      const ackUrl = `${baseUrl}/documents/acknowledge?token=${ackToken}`
      const label =
        document.documentType === 'INTERNSHIP_OFFER_LETTER' ? 'internship offer' : 'offer'
      const ackSection = `
    <br><br>
    <p style="margin: 20px 0; font-size: 14px;">To acknowledge and accept this ${label} online, click the button below:</p>
    <p style="margin: 16px 0;">
      <a href="${ackUrl}" style="display: inline-block; padding: 12px 24px; background: #1a365d; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">I Acknowledge & Accept</a>
    </p>
    <p style="margin: 12px 0; font-size: 12px; color: #666;">Or copy this link: ${ackUrl}</p>
    `
      htmlContent = htmlContent.replace('<!-- ACK_PLACEHOLDER -->', ackSection)
    }

    if (ackToken) {
      await prisma.employeeDocument.update({
        where: { id },
        data: { ackToken },
      })
    }

    const subjectLabel = DOCUMENT_TYPE_LABELS[document.documentType] ?? document.documentType
    const subject = `Your ${subjectLabel} - Kundkund Healthcare Private Limited`

    const result = await sendDocumentEmail(email, subject, htmlContent)

    if (!result.success) {
      return errorResponse(result.error ?? 'Failed to send email', 500)
    }

    return successResponse({ sent: true }, 'Email sent successfully')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.errors[0]?.message ?? 'Invalid request', 400)
    }
    console.error('Error sending document email:', error)
    return errorResponse('Failed to send email', 500)
  }
}
