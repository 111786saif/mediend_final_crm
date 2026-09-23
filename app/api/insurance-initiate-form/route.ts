import { optionalLeadId } from '@/lib/lead-id'
import { leadIdSchema } from '@/lib/lead-id'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { hasPermission } from '@/lib/rbac'
import { z } from 'zod'
import { CaseStage } from '@/generated/prisma/client'

const createInsuranceInitiateFormSchema = z.object({
  leadId: leadIdSchema,
  totalBillAmount: z.number().default(0),
  discount: z.number().default(0),
  otherReductions: z.number().default(0),
  copay: z.number().nullable().optional(),
  copayBuffer: z.number().default(0),
  deductible: z.number().default(0),
  exceedsPolicyLimit: z.string().optional(),
  policyDeductibleAmount: z.number().default(0),
  totalAuthorizedAmount: z.number().default(0),
  amountToBePaidByInsurance: z.number().default(0),
  roomCategory: z.string().optional(),
  initialApprovalByHospitalUrl: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    // Only Insurance team can create initiate form
    if (!hasPermission(user, 'insurance:write')) {
      return errorResponse('Forbidden: Only Insurance team can create initiate form', 403)
    }

    const body = await request.json()
    const data = createInsuranceInitiateFormSchema.parse(body)

    // Check if lead exists and is in correct stage
    const lead = await prisma.lead.findUnique({
      where: { id: data.leadId },
      select: {
        id: true,
        caseStage: true,
        insuranceInitiateForm: true,
      },
    })

    if (!lead) {
      return errorResponse('Lead not found', 404)
    }

    // Allow initiate form from PREAUTH_RAISED onwards (form is filled before or after approval)
    const allowedStages: CaseStage[] = [
      CaseStage.PREAUTH_RAISED,
      CaseStage.PREAUTH_COMPLETE,
      CaseStage.INITIATED,
      CaseStage.ADMITTED,
      CaseStage.DISCHARGED,
      CaseStage.IPD_DONE,
    ]
    if (!allowedStages.includes(lead.caseStage)) {
      return errorResponse(
        `Cannot create initiate form at stage: ${lead.caseStage}. Pre-auth must be raised first.`,
        400
      )
    }

    // Check if form already exists
    if (lead.insuranceInitiateForm) {
      return errorResponse('Initiate form already exists for this lead. Use PATCH to update.', 400)
    }

    // Create the initiate form
    const initiateForm = await prisma.insuranceInitiateForm.create({
      data: {
        leadId: data.leadId,
        totalBillAmount: data.totalBillAmount,
        discount: data.discount,
        otherReductions: data.otherReductions,
        copay: data.copay,
        copayBuffer: data.copayBuffer,
        deductible: data.deductible,
        exceedsPolicyLimit: data.exceedsPolicyLimit,
        policyDeductibleAmount: data.policyDeductibleAmount,
        totalAuthorizedAmount: data.totalAuthorizedAmount,
        amountToBePaidByInsurance: data.amountToBePaidByInsurance,
        roomCategory: data.roomCategory,
        initialApprovalByHospitalUrl: data.initialApprovalByHospitalUrl,
        createdById: user.id,
      },
    })

    return successResponse(
      { initiateForm },
      'Insurance initiate form created successfully'
    )
  } catch (error) {
    console.error('Error creating insurance initiate form:', error)
    if (error instanceof z.ZodError) {
      return errorResponse(`Validation error: ${error.errors.map((e) => e.message).join(', ')}`, 400)
    }
    return errorResponse('Failed to create insurance initiate form', 500)
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    const { searchParams } = new URL(request.url)
    const leadId = optionalLeadId(searchParams.get('leadId'))

    if (!leadId) {
      return errorResponse('leadId is required', 400)
    }

    const initiateForm = await prisma.insuranceInitiateForm.findUnique({
      where: { leadId },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    if (!initiateForm) {
      return successResponse({ initiateForm: null }, 'Initiate form not found')
    }

    return successResponse({ initiateForm }, 'Initiate form retrieved successfully')
  } catch (error) {
    console.error('Error fetching insurance initiate form:', error)
    return errorResponse('Failed to fetch insurance initiate form', 500)
  }
}
