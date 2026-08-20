import { NextRequest } from 'next/server'
import { Prisma, CaseStage, PipelineStage } from '@/generated/prisma/client'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getManualLeadAssignableUsersForActor, getLeadTeamLeadIdForAssigneeManager } from '@/lib/lead-ownership'
import {
  CRM_LEAD_STATUS_OPTIONS,
  CRM_MODE_OF_PAYMENT_OPTIONS,
} from '@/lib/lead-status-options'
import {
  normalizeLeadPhoneToLast10,
  recordDuplicateLeadHitByPrimaryPhone,
} from '@/lib/lead-duplicates'
import { isLeadDateAfterToday, LEAD_DATE_FUTURE_ERROR } from '@/lib/lead-date-validation'
import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/rbac'
import { getSessionWithFreshUser } from '@/lib/session'
import { z } from 'zod'

const PIPELINE_MANUAL_CREATE_ROLES = new Set([
  'BD',
  'TEAM_LEAD',
  'ASSISTANT_CATEGORY_MANAGER',
  'CATEGORY_MANAGER',
  'SALES_HEAD',
  'EXECUTIVE_ASSISTANT',
])

const requestSchema = z.object({
  assignToUserId: z.string().trim().min(1, 'Assignee is required'),
  leadDate: z.string().trim().min(1, 'Lead date is required'),
  patientName: z.string().trim().min(1, 'Patient name is required').max(200),
  phoneNumber: z.string().trim().min(1, 'Phone number is required').max(30),
  alternateNumber: z.string().trim().max(30).optional().nullable(),
  patientEmail: z.string().trim().email('Invalid patient email').optional().or(z.literal('')).nullable(),
  age: z.coerce.number().int().min(0).max(120).optional().nullable(),
  sex: z.string().trim().max(50).optional().nullable(),
  profession: z.string().trim().max(200).optional().nullable(),
  circle: z.string().trim().max(100).optional().nullable(),
  category: z.string().trim().max(200).optional().nullable(),
  treatmentMasterId: z.string().trim().optional().nullable(),
  hospitalName: z.string().trim().max(500).optional().nullable(),
  insuranceName: z.string().trim().max(500).optional().nullable(),
  source: z.string().trim().max(200).optional().nullable(),
  leadSource: z.string().trim().max(500).optional().nullable(),
  status: z.string().trim().optional().nullable(),
  modeOfPayment: z.string().trim().optional().nullable(),
  remarks: z.string().trim().optional().nullable(),
})

function normalizeOptionalLeadText(value: unknown) {
  if (value == null) return null
  const normalized = String(value).trim()
  if (!normalized) return null

  const lowered = normalized.toLowerCase()
  if (
    ['not specified', 'n/a', 'na', 'none', 'null', '-', '--', 'tbd', 'unknown'].includes(lowered)
  ) {
    return null
  }

  return normalized
}

function formatMonthName(date: Date) {
  return new Intl.DateTimeFormat('en-US', { month: 'long' }).format(date)
}

function buildManualLeadRef() {
  return `ML-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getSessionWithFreshUser()
    if (!currentUser) {
      return unauthorizedResponse()
    }

    if (!PIPELINE_MANUAL_CREATE_ROLES.has(String(currentUser.role)) || !hasPermission(currentUser, 'leads:write')) {
      return errorResponse('Forbidden', 403)
    }

    const parsed = requestSchema.safeParse(await request.json())
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message ?? 'Invalid request', 400)
    }

    const assignableUsers = await getManualLeadAssignableUsersForActor(currentUser)
    const assignee = assignableUsers.find((item) => item.id === parsed.data.assignToUserId)
    if (!assignee) {
      return errorResponse('Selected assignee is not allowed', 403)
    }

    const leadDate = new Date(parsed.data.leadDate)
    if (Number.isNaN(leadDate.getTime())) {
      return errorResponse('Lead date is invalid', 400)
    }

    if (isLeadDateAfterToday(leadDate)) {
      return errorResponse(LEAD_DATE_FUTURE_ERROR, 400)
    }

    const normalizedPhone = normalizeLeadPhoneToLast10(parsed.data.phoneNumber)
    if (!normalizedPhone) {
      return errorResponse('Phone number must contain at least 10 digits', 400)
    }

    const duplicateLead = await recordDuplicateLeadHitByPrimaryPhone(normalizedPhone)
    if (duplicateLead) {
      return errorResponse(
        `Duplicate lead detected for this phone number. Existing lead: ${duplicateLead.leadRef}. Duplicate count: ${duplicateLead.duplCount}`,
        409,
      )
    }

    const normalizedStatus = normalizeOptionalLeadText(parsed.data.status) ?? 'New Lead'
    if (!CRM_LEAD_STATUS_OPTIONS.includes(normalizedStatus)) {
      return errorResponse('Please select a valid lead status', 400)
    }

    const normalizedModeOfPayment = normalizeOptionalLeadText(parsed.data.modeOfPayment)
    if (
      normalizedModeOfPayment &&
      !CRM_MODE_OF_PAYMENT_OPTIONS.includes(normalizedModeOfPayment as (typeof CRM_MODE_OF_PAYMENT_OPTIONS)[number])
    ) {
      return errorResponse('Please select a valid mode of payment', 400)
    }

    const normalizedTreatmentMasterId = normalizeOptionalLeadText(parsed.data.treatmentMasterId)
    const treatmentMaster = normalizedTreatmentMasterId
      ? await prisma.treatmentMaster.findUnique({
          where: { id: normalizedTreatmentMasterId },
          select: {
            id: true,
            name: true,
            category: true,
          },
        })
      : null

    if (normalizedTreatmentMasterId && !treatmentMaster) {
      return errorResponse('Selected treatment was not found', 400)
    }

    const teamLeadId = await getLeadTeamLeadIdForAssigneeManager(assignee.id)
    const assignedAt = new Date()
    const lead = await prisma.lead.create({
      data: {
        leadRef: buildManualLeadRef(),
        patientName: parsed.data.patientName.trim(),
        age: parsed.data.age ?? 0,
        sex: normalizeOptionalLeadText(parsed.data.sex) ?? 'Not Specified',
        phoneNumber: parsed.data.phoneNumber.trim(),
        alternateNumber: normalizeOptionalLeadText(parsed.data.alternateNumber),
        bdId: assignee.id,
        bdeName: assignee.name,
        status: normalizedStatus,
        pipelineStage: PipelineStage.SALES,
        caseStage: CaseStage.NEW_LEAD,
        circle: normalizeOptionalLeadText(parsed.data.circle) ?? 'Unknown',
        category:
          normalizeOptionalLeadText(parsed.data.category) ??
          normalizeOptionalLeadText(treatmentMaster?.category) ??
          null,
        treatment: normalizeOptionalLeadText(treatmentMaster?.name) ?? null,
        treatmentMasterId: treatmentMaster?.id ?? null,
        hospitalName: normalizeOptionalLeadText(parsed.data.hospitalName) ?? 'Not Specified',
        source: normalizeOptionalLeadText(parsed.data.source),
        campaignName: normalizeOptionalLeadText(parsed.data.leadSource),
        remarks: normalizeOptionalLeadText(parsed.data.remarks),
        duplCount: 0,
        createdById: currentUser.id,
        updatedById: currentUser.id,
        createdDate: leadDate,
        assignedDate: assignedAt,
        leadEntryDate: leadDate,
        month: formatMonthName(leadDate),
        patientEmail: normalizeOptionalLeadText(parsed.data.patientEmail),
        insuranceName: normalizeOptionalLeadText(parsed.data.insuranceName),
        profession: normalizeOptionalLeadText(parsed.data.profession),
        modeOfPayment: normalizedModeOfPayment,
        teamLeadId,
      },
      select: {
        id: true,
        leadRef: true,
      },
    })

    return successResponse(lead, 'Lead created successfully')
  } catch (error) {
    console.error('Error creating pipeline manual lead:', error)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return errorResponse('Lead reference already exists', 400)
    }
    return errorResponse('Failed to create manual lead', 500)
  }
}
