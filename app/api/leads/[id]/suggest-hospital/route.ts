import { leadIdSchema } from '@/lib/lead-id'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { canMutateLead } from '@/lib/lead-access-api'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { postCaseChatSystemMessage } from '@/lib/case-chat'
import { isSalesLeadWorkerRole } from '@/lib/sales-hierarchy-roles'
import { z } from 'zod'
import { CaseStage, Prisma } from '@/generated/prisma/client'

const suggestHospitalSchema = z.object({
  suggestedHospitalName: z.string().min(1, 'Hospital name is required'),
  tpa: z.string().max(500).optional(),
})

/** Minimal lead gate for GET (TPA list): role + mutate access only. */
async function gateSuggestHospitalList(
  user: NonNullable<ReturnType<typeof getSessionFromRequest>>,
  leadId: number
) {
  if (!isSalesLeadWorkerRole(user.role) && user.role !== 'ADMIN') {
    return errorResponse('Forbidden: Only BD or Team Lead can suggest new hospitals', 403)
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, bdId: true },
  })

  if (!lead) {
    return errorResponse('Lead not found', 404)
  }

  if (!(await canMutateLead(user, lead.bdId))) {
    return errorResponse('Forbidden', 403)
  }

  return null
}

/** Active TPAs from TPAMaster for the suggest-hospital flow (same access as POST). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    const { id: rawLeadId } = await params
    const parsedLeadId = leadIdSchema.safeParse(rawLeadId)
    if (!parsedLeadId.success) return errorResponse('Invalid lead ID', 400)
    const leadId = parsedLeadId.data
    const gate = await gateSuggestHospitalList(user, leadId)
    if (gate) {
      return gate
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.trim() || ''

    const where: Prisma.TPAMasterWhereInput = { isActive: true }
    if (search) {
      where.name = { contains: search, mode: 'insensitive' }
    }

    const items = await prisma.tPAMaster.findMany({
      where,
      orderBy: { name: 'asc' },
      take: 200,
      select: { id: true, name: true },
    })

    return successResponse({ items })
  } catch (error) {
    console.error('Error listing TPAs for suggest-hospital:', error)
    return errorResponse('Failed to load TPAs', 500)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    const { id: rawLeadId } = await params
    const parsedLeadId = leadIdSchema.safeParse(rawLeadId)
    if (!parsedLeadId.success) return errorResponse('Invalid lead ID', 400)
    const leadId = parsedLeadId.data
    const body = await request.json()
    const data = suggestHospitalSchema.parse(body)

    if (!isSalesLeadWorkerRole(user.role) && user.role !== 'ADMIN') {
      return errorResponse('Forbidden: Only BD or Team Lead can suggest new hospitals', 403)
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        kypSubmission: true,
      },
    })

    if (!lead) {
      return errorResponse('Lead not found', 404)
    }

    if (!(await canMutateLead(user, lead.bdId))) {
      return errorResponse('Forbidden', 403)
    }

    if (!lead.kypSubmission) {
      return errorResponse('KYP submission not found. Please submit KYP first.', 400)
    }

    const allowedStages: CaseStage[] = [
      CaseStage.HOSPITALS_SUGGESTED,
    ]
    if (!allowedStages.includes(lead.caseStage)) {
      return errorResponse(`Cannot suggest hospital. Current stage: ${lead.caseStage}. Insurance must suggest hospitals first.`, 400)
    }

    const existingPreAuth = await prisma.preAuthorization.findFirst({
      where: { kypSubmissionId: lead.kypSubmission.id },
    })

    if (!existingPreAuth) {
      return errorResponse('Insurance must suggest hospitals before BD can suggest a new one.', 400)
    }

    if (existingPreAuth.preAuthRaisedAt) {
      return errorResponse('Pre-auth already raised for this case', 400)
    }

    // Update pre-auth with the suggested hospital name
    const tpaTrimmed = data.tpa?.trim()
    const preAuth = await prisma.preAuthorization.update({
      where: { kypSubmissionId: lead.kypSubmission.id },
      data: {
        bdSuggestedHospital: data.suggestedHospitalName,
        // We also store who raised it so we can notify them back later
        preAuthRaisedById: user.id,
        ...(tpaTrimmed ? { tpa: tpaTrimmed } : {}),
      },
    })

    await postCaseChatSystemMessage(leadId, `BD suggested a new hospital: ${data.suggestedHospitalName}. Waiting for Insurance to update list.`)

    // Create notifications for Insurance team
    const insuranceUsers = await prisma.user.findMany({
      where: {
        role: 'INSURANCE_HEAD',
      },
    })

    await prisma.notification.createMany({
      data: insuranceUsers.map((insuranceUser) => ({
        userId: insuranceUser.id,
        type: 'HOSPITAL_SUGGESTION_REQUESTED',
        title: 'New Hospital Suggested',
        message: `BD has suggested a new hospital "${data.suggestedHospitalName}" for ${lead.patientName} (${lead.leadRef})`,
        link: `/patient/${leadId}/pre-auth`, // Link to the pre-auth page where insurance can update hospitals
        relatedId: preAuth.id,
      })),
    })

    return successResponse(preAuth, 'Hospital suggestion submitted successfully')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Invalid request data: ' + error.errors.map(e => e.message).join(', '), 400)
    }
    console.error('Error suggesting hospital:', error)
    return errorResponse('Failed to suggest hospital', 500)
  }
}
