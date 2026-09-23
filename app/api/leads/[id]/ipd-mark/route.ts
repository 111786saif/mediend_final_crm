import { leadIdSchema } from '@/lib/lead-id'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PipelineStage } from '@/generated/prisma/client'
import { getSessionFromRequest } from '@/lib/session'
import { canMutateLead } from '@/lib/lead-access-api'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { postCaseChatSystemMessage } from '@/lib/case-chat'
import { isSalesLeadWorkerRole } from '@/lib/sales-hierarchy-roles'
import { z } from 'zod'
import { CaseStage } from '@/generated/prisma/client'

const ipdMarkSchema = z.object({
  status: z.enum(['ADMITTED_DONE', 'IPD_DONE', 'POSTPONED', 'CANCELLED']),
  reason: z.string().optional(),
  newSurgeryDate: z.string().optional(),
  surgeryDate: z.string().optional(),
  notes: z.string().optional(),
  patientName: z.string().optional(),
  aadharDocumentUrl: z.string().optional(),
  aadharFiles: z
    .array(z.object({ name: z.string(), url: z.string() }))
    .optional(),
})

const IPD_PATIENT_DETAIL_STATUSES = new Set(['ADMITTED_DONE', 'IPD_DONE'])

async function persistIpdMarkPatientDetails(
  leadId: number,
  userId: string,
  patientName: string,
  aadharDocumentUrl: string | null,
  aadharFiles: { name: string; url: string }[]
) {
  await prisma.lead.update({
    where: { id: leadId },
    data: { patientName: patientName.trim() },
  })

  if (!aadharDocumentUrl) {
    return
  }

  const aadharPayload = {
    aadharFileUrl: aadharDocumentUrl,
    aadharFiles,
  }

  const existing = await prisma.kYPSubmission.findUnique({ where: { leadId } })
  if (existing) {
    await prisma.kYPSubmission.update({
      where: { leadId },
      data: aadharPayload,
    })
    return
  }

  await prisma.kYPSubmission.create({
    data: {
      leadId,
      submittedById: userId,
      status: 'PENDING',
      ...aadharPayload,
    },
  })
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

    if (
      !isSalesLeadWorkerRole(user.role) &&
      user.role !== 'EXECUTIVE_ASSISTANT' &&
      user.role !== 'ADMIN'
    ) {
      return errorResponse('Forbidden: Only BD / TL / EA can mark IPD status', 403)
    }

    const { id: rawLeadId } = await params
    const parsedLeadId = leadIdSchema.safeParse(rawLeadId)
    if (!parsedLeadId.success) return errorResponse('Invalid lead ID', 400)
    const leadId = parsedLeadId.data
    const body = await request.json()
    const data = ipdMarkSchema.parse(body)

    // Check if lead exists
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        admissionRecord: true,
      },
    })

    if (!lead) {
      return errorResponse('Lead not found', 404)
    }

    if (!(await canMutateLead(user, lead.bdId))) {
      return errorResponse('Forbidden', 403)
    }

    const isCashFlow = lead.flowType === 'CASH'
    const allowedStages: CaseStage[] = isCashFlow
      ? [CaseStage.CASH_APPROVED, CaseStage.CASH_IPD_SUBMITTED]
      : [CaseStage.INITIATED, CaseStage.ADMITTED]

    if (!allowedStages.includes(lead.caseStage)) {
      return errorResponse(`Cannot mark IPD status. Current stage: ${lead.caseStage}.`, 400)
    }

    if (!lead.admissionRecord) {
      return errorResponse('Admission record not found', 400)
    }

    // Validate conditional fields based on status
    if (IPD_PATIENT_DETAIL_STATUSES.has(data.status)) {
      if (!data.patientName?.trim()) {
        return errorResponse('Patient name is required when marking IPD', 400)
      }
      const requireAadharDocument =
        data.status === 'ADMITTED_DONE' || (data.status === 'IPD_DONE' && !isCashFlow)
      const primaryUrl =
        data.aadharDocumentUrl?.trim() ||
        data.aadharFiles?.find((f) => f.url.trim())?.url.trim()
      if (requireAadharDocument && !primaryUrl) {
        return errorResponse('Aadhaar document upload is required when marking IPD', 400)
      }
    }

    if (data.status === 'IPD_DONE') {
      if (!data.surgeryDate?.trim()) {
        return errorResponse('Surgery date is required when marking surgery done', 400)
      }
    }

    if (data.status === 'POSTPONED') {
      if (!data.reason?.trim()) {
        return errorResponse('Reason is required for postponed status', 400)
      }
      if (!data.newSurgeryDate?.trim()) {
        return errorResponse('New surgery date is required for postponed status', 400)
      }
    }

    if (data.status === 'CANCELLED') {
      if (!data.reason?.trim()) {
        return errorResponse('Reason is required for cancelled status', 400)
      }
    }

    if (IPD_PATIENT_DETAIL_STATUSES.has(data.status)) {
      const primaryUrl =
        data.aadharDocumentUrl?.trim() ||
        data.aadharFiles?.find((f) => f.url.trim())?.url.trim()
      const files =
        data.aadharFiles && data.aadharFiles.length > 0
          ? data.aadharFiles
          : primaryUrl
            ? [{ name: 'Aadhaar', url: primaryUrl }]
            : []
      if (primaryUrl && data.patientName?.trim()) {
        await persistIpdMarkPatientDetails(leadId, user.id, data.patientName.trim(), primaryUrl, files)
      } else if (data.patientName?.trim()) {
        await persistIpdMarkPatientDetails(leadId, user.id, data.patientName.trim(), null, [])
      }
    }

    // Update admission record with IPD status
    const updateData: Record<string, any> = {
      ipdStatus: data.status,
      ipdStatusReason: data.reason?.trim() || undefined,
      ipdStatusUpdatedAt: new Date(),
      ipdStatusNotes: data.notes?.trim() || undefined,
    }

    if (data.status === 'POSTPONED' && data.newSurgeryDate) {
      updateData.newSurgeryDate = new Date(data.newSurgeryDate)
    }

    const admission = await prisma.admissionRecord.update({
      where: { leadId },
      data: updateData,
    })

    // Update case stage based on status and flow type.
    // IPD_DONE is the new "handoff to Insurance for discharge" trigger — for
    // insurance flow it advances the case stage to IPD_DONE; Insurance then
    // creates the discharge sheet which advances it to DISCHARGED.
    const leadUpdateData: Record<string, any> = {}
    let toStage: CaseStage = lead.caseStage

    if (isCashFlow) {
      if (data.status === 'IPD_DONE') {
        toStage = CaseStage.CASH_IPD_DONE
        leadUpdateData.caseStage = CaseStage.CASH_IPD_DONE
        leadUpdateData.status = 'IPD Done'
        const surgeryDate = data.surgeryDate ? new Date(data.surgeryDate) : new Date()
        leadUpdateData.surgeryDate = surgeryDate
        leadUpdateData.pipelineStage = 'PL' satisfies PipelineStage
        leadUpdateData.conversionDate = surgeryDate
      }
    } else {
      if (data.status === 'IPD_DONE') {
        toStage = CaseStage.IPD_DONE
        leadUpdateData.caseStage = CaseStage.IPD_DONE
        leadUpdateData.status = 'IPD Done'
        const surgeryDate = data.surgeryDate ? new Date(data.surgeryDate) : new Date()
        leadUpdateData.surgeryDate = surgeryDate
        leadUpdateData.pipelineStage = 'PL' satisfies PipelineStage
        leadUpdateData.conversionDate = surgeryDate
      } else if (data.status === 'ADMITTED_DONE') {
        toStage = CaseStage.ADMITTED
        leadUpdateData.caseStage = CaseStage.ADMITTED
      }
    }

    if (Object.keys(leadUpdateData).length > 0) {
      await prisma.lead.update({
        where: { id: leadId },
        data: leadUpdateData,
      })
    }

    // Create stage history entry (only if stage changed)
    if (toStage !== lead.caseStage) {
      await prisma.caseStageHistory.create({
        data: {
          leadId,
          fromStage: lead.caseStage,
          toStage,
          changedById: user.id,
          note: `IPD status: ${data.status}${data.reason ? ` - ${data.reason}` : ''}`,
        },
      })
    }

    // Post case chat message
    const statusMessages: Record<string, string> = {
      ADMITTED_DONE: 'Patient admitted.',
      IPD_DONE: 'Surgery done. Insurance can now fill the discharge sheet.',
      POSTPONED: `Surgery postponed - ${data.reason || 'No reason provided'}. New surgery date: ${data.newSurgeryDate}`,
      CANCELLED: `Case cancelled - ${data.reason || 'No reason provided'}`,
    }

    await postCaseChatSystemMessage(leadId, `BD marked IPD status: ${statusMessages[data.status]}`)

    // Notify Insurance team. When IPD_DONE is marked, route Insurance Heads
    // straight to the discharge form — the lead is now in their queue.
    const insuranceUsers = await prisma.user.findMany({
      where: {
        role: 'INSURANCE_HEAD',
      },
    })

    const titleMap: Record<string, string> = {
      ADMITTED_DONE: 'Patient Admitted',
      IPD_DONE: 'Ready for Discharge Sheet',
      POSTPONED: 'Surgery Postponed',
      CANCELLED: 'Case Cancelled',
    }

    const messageMap: Record<string, string> = {
      ADMITTED_DONE: `IPD status updated for ${lead.patientName} (${lead.leadRef}): ADMITTED_DONE`,
      IPD_DONE: `${lead.patientName} (${lead.leadRef}) — surgery done, please fill the discharge sheet`,
      POSTPONED: `IPD status updated for ${lead.patientName} (${lead.leadRef}): POSTPONED`,
      CANCELLED: `IPD status updated for ${lead.patientName} (${lead.leadRef}): CANCELLED`,
    }

    await prisma.notification.createMany({
      data: insuranceUsers.map((insuranceUser) => ({
        userId: insuranceUser.id,
        type: 'INITIATED', // Using INITIATED as a fallback since IPD_MARKED is not in enum
        title: titleMap[data.status],
        message: messageMap[data.status],
        link: data.status === 'IPD_DONE' ? `/patient/${leadId}/discharge` : `/patient/${leadId}`,
        relatedId: admission.id,
      })),
    })

    return successResponse(admission, `IPD status marked as ${data.status} successfully`)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Invalid request data: ' + error.errors.map(e => e.message).join(', '), 400)
    }
    console.error('Error marking IPD status:', error)
    return errorResponse('Failed to mark IPD status', 500)
  }
}
