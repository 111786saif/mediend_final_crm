import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { postCaseChatSystemMessage } from '@/lib/case-chat'
import { z } from 'zod'
import { CaseStage, InsuranceType, Prisma } from '@/generated/prisma/client'

const submitKYPSchema = z.object({
  leadId: z.string(),
  patientName: z.string().optional(),
  phone: z.string().optional(),
  age: z.number().optional(),
  dateOfBirth: z.string().optional(),
  sex: z.string().optional(),
  aadhar: z.string().optional(),
  pan: z.string().optional(),
  insuranceCard: z.string().optional(),
  insuranceName: z.string().optional(),
  doctorName: z.string().optional(),
  disease: z.string().optional(),
  insuranceType: z.string().optional(),
  location: z.string().optional(),
  area: z.string().optional(),
  remark: z.string().optional(),
  aadharFileUrl: z.string().optional(),
  panFileUrl: z.string().optional(),
  aadharFiles: z.array(z.object({ name: z.string(), url: z.string() })).optional(),
  panFiles: z.array(z.object({ name: z.string(), url: z.string() })).optional(),
  insuranceCardFileUrl: z.string().optional(),
  insuranceCardFiles: z.array(z.object({ name: z.string(), url: z.string() })).optional(),
  prescriptionFileUrl: z.string().optional(),
  diseasePhotos: z.array(z.object({ name: z.string(), url: z.string() })).optional(),
  patientConsent: z.boolean().optional(),
  otherFiles: z.array(z.object({ name: z.string(), url: z.string() })).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (!hasPermission(user, 'leads:write')) {
      return errorResponse('Forbidden', 403)
    }

    const body = await request.json()
    const data = submitKYPSchema.parse(body)

    // KYP Basic validation
    if (!data.insuranceCardFileUrl?.trim() && (!data.insuranceCardFiles || data.insuranceCardFiles.length === 0)) {
      return errorResponse('Insurance card upload is required', 400)
    }
    if (!data.location?.trim()) {
      return errorResponse('City is required', 400)
    }
    if (!data.area?.trim()) {
      return errorResponse('Area is required', 400)
    }
    if (!data.disease?.trim()) {
      return errorResponse('Disease/Treatment is required', 400)
    }
    if (!data.doctorName?.trim()) {
      return errorResponse('Surgeon/Doctor Name is required', 400)
    }
    if (!data.insuranceType?.trim()) {
      return errorResponse('Insurance Type is required', 400)
    }
    if (!data.dateOfBirth?.trim()) {
      return errorResponse('Date of Birth is required', 400)
    }

    // Check if lead exists and user has access
    const lead = await prisma.lead.findUnique({
      where: { id: data.leadId },
      include: { bd: true },
    })

    if (!lead) {
      return errorResponse('Lead not found', 404)
    }

    // Check if user is the BD assigned to this lead or has TL/admin permissions
    if (lead.bdId !== user.id && user.role !== 'ADMIN' && user.role !== 'TEAM_LEAD' && user.role !== 'SALES_HEAD' && user.role !== 'TESTER') {
      return errorResponse('You do not have permission to submit KYP for this lead', 403)
    }

    const existingKYP = await prisma.kYPSubmission.findUnique({
      where: { leadId: data.leadId },
      include: { lead: { select: { caseStage: true } } },
    })

    if (existingKYP) {
      return errorResponse('KYP submission already exists for this lead', 400)
    }

    const aadharFiles =
      data.aadharFiles && data.aadharFiles.length > 0 ? data.aadharFiles : undefined
    const panFiles = data.panFiles && data.panFiles.length > 0 ? data.panFiles : undefined
    const aadharFileUrl =
      aadharFiles?.[0]?.url ?? data.aadharFileUrl ?? undefined
    const panFileUrl = panFiles?.[0]?.url ?? data.panFileUrl ?? undefined

    // Create KYP submission (assert payload so builds stay valid if TS cache lags `prisma generate`)
    const kypSubmission = await prisma.kYPSubmission.create({
      data: {
        leadId: data.leadId,
        aadhar: data.aadhar,
        pan: data.pan,
        insuranceCard: data.insuranceCard,
        disease: data.disease,
        insuranceType: data.insuranceType as InsuranceType,
        location: data.location ?? undefined,
        area: data.area ?? undefined,
        remark: data.remark,
        aadharFileUrl,
        panFileUrl,
        aadharFiles: aadharFiles ?? undefined,
        panFiles: panFiles ?? undefined,
        insuranceCardFileUrl: data.insuranceCardFileUrl ?? (data.insuranceCardFiles?.[0]?.url || undefined),
        prescriptionFileUrl: data.prescriptionFileUrl,
        diseasePhotos: data.diseasePhotos ?? undefined,
        patientConsent: data.patientConsent ?? false,
        otherFiles: data.otherFiles || data.insuranceCardFiles || [],
        submittedById: user.id,
        status: 'PENDING',
      } as Prisma.KYPSubmissionUncheckedCreateInput,
      include: {
        lead: {
          select: {
            id: true,
            leadRef: true,
            patientName: true,
            caseStage: true,
          },
        },
        submittedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    const targetStage = CaseStage.KYP_BASIC_COMPLETE
    const previousStage = lead.caseStage
    await prisma.lead.update({
      where: { id: data.leadId },
      data: {
        caseStage: targetStage,
        ...(data.patientName?.trim() ? { patientName: data.patientName.trim() } : {}),
        ...(data.phone?.trim() ? { phoneNumber: data.phone.trim() } : {}),
        ...(data.age ? { age: data.age } : {}),
        ...(data.sex?.trim() ? { sex: data.sex.trim() } : {}),
        ...(data.insuranceName?.trim() ? { insuranceName: data.insuranceName.trim() } : {}),
        ...(data.doctorName?.trim() ? { ipdDrName: data.doctorName.trim() } : {}),
        ...(data.dateOfBirth ? { dateOfBirth: new Date(data.dateOfBirth) } : {}),
      },
    })

    await prisma.caseStageHistory.create({
      data: {
        leadId: data.leadId,
        fromStage: previousStage,
        toStage: targetStage,
        changedById: user.id,
        note: 'Card Details submitted',
      },
    })

    await postCaseChatSystemMessage(data.leadId, 'BD submitted Card Details.')

    const insuranceUsers = await prisma.user.findMany({
      where: {
        role: 'INSURANCE_HEAD',
      },
    })

    await prisma.notification.createMany({
      data: insuranceUsers.map((insuranceUser) => ({
        userId: insuranceUser.id,
        type: 'KYP_SUBMITTED',
        title: 'New KYP Submission',
        message: `New KYP submission for ${lead.patientName} (${lead.leadRef})`,
        link: `/insurance/dashboard?kyp=${kypSubmission.id}`,
        relatedId: kypSubmission.id,
      })),
    })

    return successResponse(kypSubmission, 'KYP submitted successfully')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Invalid request data', 400)
    }
    console.error('Error submitting KYP:', error)
    return errorResponse('Failed to submit KYP', 500)
  }
}
