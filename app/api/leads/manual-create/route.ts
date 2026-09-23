import { NextRequest } from 'next/server'
import { CaseStage, PipelineStage } from '@/generated/prisma/client'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getManualLeadAssignableUsersForActor, getLeadTeamLeadIdForAssigneeManager } from '@/lib/lead-ownership'
import { CRM_MODE_OF_PAYMENT_OPTIONS } from '@/lib/lead-status-options'
import {
  DUPLICATE_LEAD_STATUS,
  normalizeLeadPhoneToLast10,
  recordDuplicateLeadHitByPrimaryPhone,
} from '@/lib/lead-duplicates'
import { isLeadDateAfterToday, LEAD_DATE_FUTURE_ERROR } from '@/lib/lead-date-validation'
import { isLeadRefUniqueViolation, withGeneratedManualLeadRef } from '@/lib/manual-lead-ref'
import { createLeadAssignedNotification } from '@/lib/lead-notifications'
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

    const explicitTreatment = normalizeOptionalLeadText(treatmentMaster?.name) ?? null

    const duplicateLead = await recordDuplicateLeadHitByPrimaryPhone(normalizedPhone, explicitTreatment)
    const normalizedStatus = normalizeOptionalLeadText(parsed.data.status) ?? 'New Leads'
    const selectedStatus = duplicateLead ? null : await prisma.leadStatus.findFirst({
      where: { status: { equals: normalizedStatus, mode: 'insensitive' }, isActive: true },
      select: { id: true, status: true },
    })
    if (!duplicateLead && !selectedStatus) {
      return errorResponse('Please select a valid lead status', 400)
    }
    const duplicateStatus = duplicateLead ? await prisma.leadStatus.findFirst({
      where: { status: DUPLICATE_LEAD_STATUS, isActive: true },
      select: { id: true, status: true },
    }) : null
    if (duplicateLead && !duplicateStatus) {
      return errorResponse('Duplicate lead status is not configured', 500)
    }
    const effectiveStatus = duplicateStatus?.status ?? selectedStatus?.status

    const normalizedModeOfPayment = normalizeOptionalLeadText(parsed.data.modeOfPayment)
    if (
      normalizedModeOfPayment &&
      !CRM_MODE_OF_PAYMENT_OPTIONS.includes(normalizedModeOfPayment as (typeof CRM_MODE_OF_PAYMENT_OPTIONS)[number])
    ) {
      return errorResponse('Please select a valid mode of payment', 400)
    }

    const teamLeadId = await getLeadTeamLeadIdForAssigneeManager(assignee.id)
    const assignedAt = new Date()
    const initialRemarks = normalizeOptionalLeadText(parsed.data.remarks)
    const buildLeadData = (generatedLeadRef: string) => ({
      leadRef: generatedLeadRef,
      patientName: parsed.data.patientName.trim(),
      age: parsed.data.age ?? 0,
      sex: normalizeOptionalLeadText(parsed.data.sex) ?? 'Not Specified',
      phoneNumber: parsed.data.phoneNumber.trim(),
      alternateNumber: normalizeOptionalLeadText(parsed.data.alternateNumber),
      bdId: assignee.id,
      bdeName: assignee.name,
      status: effectiveStatus!,
      statusId: duplicateStatus?.id ?? selectedStatus?.id,
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
      remarks: initialRemarks,
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
    });

    const lead = await withGeneratedManualLeadRef((generatedLeadRef) =>
      prisma.$transaction(async (tx) => {
        const createdLead = await tx.lead.create({
          data: buildLeadData(generatedLeadRef),
          select: {
            id: true,
            leadRef: true,
          },
        })

        if (initialRemarks) {
          await tx.leadRemarkEntry.create({
            data: {
              leadId: createdLead.id,
              content: initialRemarks,
              createdById: currentUser.id,
            },
          })
        }

        return createdLead
      })
    );

    await createLeadAssignedNotification({
      userId: assignee.id,
      patientName: parsed.data.patientName,
      leadRef: lead.leadRef,
      leadId: lead.id,
      actorUserId: currentUser.id,
    })

    return successResponse(
      lead,
      duplicateLead ? 'Duplicate lead created successfully' : 'Lead created successfully'
    )
  } catch (error) {
    console.error('Error creating pipeline manual lead:', error)
    if (isLeadRefUniqueViolation(error)) {
      return errorResponse('Lead reference already exists', 400)
    }
    return errorResponse('Failed to create manual lead', 500)
  }
}
