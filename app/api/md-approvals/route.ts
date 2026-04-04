import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { hasFeaturePermission } from '@/lib/permissions'
import { sendAuthkeyTemplate } from '@/lib/whatsapp/authkey'
import { z } from 'zod'
import { MDApprovalStatus, type Prisma } from '@/generated/prisma/client'

const attachmentSchema = z.object({
  name: z.string(),
  url: z.string(),
  type: z.string(),
})

const createSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  amount: z.number().optional().nullable(),
  attachments: z.array(attachmentSchema).optional(),
})

const MD_APPROVAL_WHATSAPP_MOBILE = '9582895954'
const MD_APPROVAL_WHATSAPP_TEMPLATE_ID = '29363'

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()

    const canRequest = await hasFeaturePermission(user.id, 'md_approval_request')
    if (!canRequest) {
      return errorResponse('You do not have permission to request MD approval', 403)
    }

    const body = await request.json()
    const { title, description, amount, attachments } = createSchema.parse(body)

    const approval = await prisma.mDApprovalRequest.create({
      data: {
        title,
        description: description ?? undefined,
        amount: amount ?? undefined,
        attachments: attachments ?? undefined,
        requestedById: user.id,
      },
      include: {
        requestedBy: { select: { id: true, name: true } },
      },
    })

    // Notify MD users
    const mdUsers = await prisma.user.findMany({
      where: { role: 'MD' },
      select: { id: true },
    })
    if (mdUsers.length > 0) {
      await prisma.notification.createMany({
        data: mdUsers.map((m) => ({
          userId: m.id,
          type: 'MD_APPROVAL_REQUESTED',
          title: 'MD Approval Requested',
          message: `${user.name}: ${title}`,
          link: '/md/md-approvals',
          relatedId: approval.id,
        })),
      })
    }

    // Non-blocking WhatsApp ping for MD approvals.
    // This should never fail request creation.
    void sendAuthkeyTemplate({
      mobile: MD_APPROVAL_WHATSAPP_MOBILE,
      wid: MD_APPROVAL_WHATSAPP_TEMPLATE_ID,
      param1: user.name,
    }).catch((err) => {
      console.error('Failed to send MD approval WhatsApp notification:', err)
    })

    return successResponse(approval, 'Request submitted successfully')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.errors[0].message, 400)
    }
    console.error('Error creating MD approval request:', error)
    return errorResponse('Failed to create request', 500)
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const financePending = searchParams.get('financePending') === 'true'
    const financeHistory = searchParams.get('financeHistory') === 'true'

    const isMD = user.role === 'MD' || user.role === 'ADMIN'
    const isEA = user.role === 'EXECUTIVE_ASSISTANT'
    const isFinance = user.role === 'FINANCE_HEAD'

    const where: Prisma.MDApprovalRequestWhereInput = {}
    if (financePending && isFinance) {
      where.status = MDApprovalStatus.APPROVED
      where.amount = { not: null }
      where.financeAcknowledged = false
    } else if (financeHistory && isFinance) {
      where.status = MDApprovalStatus.APPROVED
      where.amount = { not: null }
      where.financeAcknowledged = true
    } else if (status && status in MDApprovalStatus) {
      where.status = status as (typeof MDApprovalStatus)[keyof typeof MDApprovalStatus]
    }

    if (isEA) {
      // EA sees approvals from their direct reports only
      const eaEmployee = await prisma.employee.findUnique({
        where: { userId: user.id },
        select: { subordinates: { select: { userId: true } } },
      })
      const subordinateUserIds = eaEmployee?.subordinates.map((s) => s.userId) ?? []
      where.requestedById = { in: [user.id, ...subordinateUserIds] }
    } else if (!isMD && !(isFinance && (financePending || financeHistory))) {
      where.requestedById = user.id
    }

    const requests = await prisma.mDApprovalRequest.findMany({
      where,
      include: {
        requestedBy: { select: { id: true, name: true, email: true } },
        respondedBy: { select: { id: true, name: true } },
        financeAcknowledgedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return successResponse(requests)
  } catch (error) {
    console.error('Error fetching MD approvals:', error)
    return errorResponse('Failed to fetch requests', 500)
  }
}
