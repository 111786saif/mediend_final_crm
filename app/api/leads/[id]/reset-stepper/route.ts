import { NextRequest } from 'next/server'
import { z } from 'zod'
import { PreAuthStatus, Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { postCaseChatSystemMessage } from '@/lib/case-chat'
import { canResetStepper } from '@/lib/case-permissions'
import { hasLeadOpdDone, hasLeadOpdScheduled } from '@/lib/lead-opd-workflow'
import {
  buildWorkflowResetTimelineNote,
  getCompletedResetTargets,
  getCurrentWorkflowStep,
  getResetTargetConfig,
  getWorkflowSteps,
  notificationLinkForStep,
  type WorkflowStepExtras,
} from '@/lib/case/workflow-reset'
import { resolveTeamLeadForLeadOwner } from '@/lib/hierarchy'
import { buildLeadOwnershipTransferUpdate } from '@/lib/lead-ownership'

const resetStepperSchema = z.object({
  targetStep: z.number().int().min(1).max(10),
  reason: z.string().min(1, 'Reason is required').max(4000),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()

    const { id: leadId } = await params
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        caseStage: true,
        flowType: true,
        pipelineStage: true,
        status: true,
        opdScheduleDate: true,
        insuranceInitiateForm: { select: { id: true } },
        admissionRecord: { select: { ipdStatus: true } },
      },
    })
    if (!lead) return errorResponse('Lead not found', 404)
    if (!canResetStepper(user as any)) {
      return errorResponse('Only Executive Assistant can reset the workflow stepper', 403)
    }

    const extras: WorkflowStepExtras = {
      hasOpdScheduled: hasLeadOpdScheduled(lead),
      hasOpdDone: hasLeadOpdDone(lead),
      hasInitiateForm: !!lead.insuranceInitiateForm?.id,
      hasIpdMark: !!lead.admissionRecord?.ipdStatus,
    }
    const steps = getWorkflowSteps(lead.flowType)
    const currentStep = getCurrentWorkflowStep(lead.flowType, lead.caseStage, extras)
    const currentDef = steps.find((s) => s.number === currentStep) ?? steps[0]!
    const targets = getCompletedResetTargets(lead.flowType, lead.caseStage, extras)

    return successResponse({
      currentStep: {
        number: currentDef.number,
        label: currentDef.label,
        caseStage: lead.caseStage,
      },
      targets: targets.map((t) => ({
        number: t.number,
        label: t.label,
        shortLabel: t.shortLabel,
        owner: t.owner,
      })),
    })
  } catch (error) {
    console.error('Error loading reset-stepper options:', error)
    return errorResponse('Failed to load reset options', 500)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()

    const { id: leadId } = await params
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return errorResponse('Invalid JSON body', 400)
    }
    const data = resetStepperSchema.parse(body)
    const reason = data.reason.trim()
    if (!reason) return errorResponse('Reason is required', 400)

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        leadRef: true,
        patientName: true,
        bdId: true,
        caseStage: true,
        pipelineStage: true,
        flowType: true,
        status: true,
        opdScheduleDate: true,
        insuranceInitiateForm: { select: { id: true } },
        admissionRecord: { select: { id: true, ipdStatus: true } },
        kypSubmission: { select: { id: true } },
        dischargeSheet: { select: { id: true, plRecordId: true, isFinalized: true } },
        plRecord: {
          select: {
            id: true,
            hospitalPayoutStatus: true,
            doctorPayoutStatus: true,
            mediendInvoiceStatus: true,
          },
        },
        invoiceRequests: { select: { id: true, status: true } },
        doctorPayoffRequests: { select: { id: true, status: true } },
      },
    })

    if (!lead) return errorResponse('Lead not found', 404)
    if (!canResetStepper(user as any)) {
      return errorResponse('Only Executive Assistant can reset the workflow stepper', 403)
    }

    const extras: WorkflowStepExtras = {
      hasOpdScheduled: hasLeadOpdScheduled(lead),
      hasOpdDone: hasLeadOpdDone(lead),
      hasInitiateForm: !!lead.insuranceInitiateForm?.id,
      hasIpdMark: !!lead.admissionRecord?.ipdStatus,
    }
    const steps = getWorkflowSteps(lead.flowType)
    const currentStepNumber = getCurrentWorkflowStep(lead.flowType, lead.caseStage, extras)
    const previousStep =
      steps.find((s) => s.number === currentStepNumber) ?? steps[steps.length - 1]!
    const allowed = getCompletedResetTargets(lead.flowType, lead.caseStage, extras)
    const targetStep = allowed.find((s) => s.number === data.targetStep)
    if (!targetStep) {
      return errorResponse(
        'Invalid reset target. Choose a previously completed workflow step.',
        400,
      )
    }

    const lockReasons: string[] = []
    if (lead.plRecord) {
      const paidStatuses = ['PAID', 'PARTIAL']
      if (lead.plRecord.hospitalPayoutStatus && paidStatuses.includes(lead.plRecord.hospitalPayoutStatus.toUpperCase())) {
        lockReasons.push('hospital payout is not pending')
      }
      if (lead.plRecord.doctorPayoutStatus && paidStatuses.includes(lead.plRecord.doctorPayoutStatus.toUpperCase())) {
        lockReasons.push('doctor payout is not pending')
      }
      if (lead.plRecord.mediendInvoiceStatus && ['SENT', 'PAID'].includes(lead.plRecord.mediendInvoiceStatus.toUpperCase())) {
        lockReasons.push('Mediend invoice is already sent/paid')
      }
    }
    if (lead.invoiceRequests.some((r) => r.status === 'VERIFIED')) {
      lockReasons.push('a verified invoice request exists')
    }
    if (lead.doctorPayoffRequests.some((r) => r.status === 'APPROVED')) {
      lockReasons.push('an approved doctor payoff request exists')
    }
    if (lockReasons.length > 0) {
      return errorResponse(
        `Cannot reset workflow: ${lockReasons.join('; ')}. Resolve finance locks first.`,
        409,
      )
    }

    const config = getResetTargetConfig(lead.flowType, targetStep.number)
    const stepsReverted = Math.max(0, previousStep.number - targetStep.number)
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null
    const userAgent = request.headers.get('user-agent') || null

    // On reset, hand ownership to the Team Lead (ACM counts as TL).
    const previousBdId = lead.bdId
    const teamLead = previousBdId
      ? await resolveTeamLeadForLeadOwner(previousBdId)
      : null
    const nextOwnerUserId =
      teamLead && teamLead.userId !== previousBdId ? teamLead.userId : null

    const timelineNote = buildWorkflowResetTimelineNote({
      fromLabel: previousStep.label,
      toLabel: targetStep.label,
      resetByName: user.name,
      reason,
      reassignedToName: nextOwnerUserId ? teamLead?.name ?? null : null,
    })

    await prisma.$transaction(async (tx) => {
      if (config.clearDischargeAndDownstream) {
        await clearDischargeDownstream(tx, leadId)
      }

      if (config.clearAdmission) {
        await tx.admissionRecord.deleteMany({ where: { leadId } })
      } else if (config.clearIpdMark && lead.admissionRecord) {
        await tx.admissionRecord.update({
          where: { leadId },
          data: {
            ipdStatus: null,
            ipdStatusReason: null,
            newSurgeryDate: null,
            ipdDischargeDate: null,
            ipdStatusNotes: null,
            ipdStatusUpdatedAt: null,
          },
        })
      }

      if (config.clearInitiateForm) {
        await tx.insuranceInitiateForm.deleteMany({ where: { leadId } })
      }

      if (config.clearKyp && lead.kypSubmission) {
        // Discharge already cleared; null any residual FK before deleting KYP.
        await tx.dischargeSheet.updateMany({
          where: { leadId },
          data: { kypSubmissionId: null },
        })
        await tx.kYPSubmission.delete({ where: { id: lead.kypSubmission.id } })
      } else if (config.clearPreAuth && lead.kypSubmission) {
        await tx.preAuthorization.deleteMany({
          where: { kypSubmissionId: lead.kypSubmission.id },
        })
        await tx.kYPSubmission.update({
          where: { id: lead.kypSubmission.id },
          data: {
            prescriptionFileUrl: null,
            diseasePhotos: Prisma.DbNull,
            otherFiles: Prisma.DbNull,
            status: 'KYP_DETAILS_ADDED',
          },
        })
      } else if (lead.kypSubmission && (config.clearPreAuthRaise || config.clearPreAuthApproval)) {
        const kypSubmissionId = lead.kypSubmission.id
        const preAuth = await tx.preAuthorization.findUnique({
          where: { kypSubmissionId },
          select: { id: true },
        })
        if (preAuth) {
          const clearData: Prisma.PreAuthorizationUpdateInput = {}
          if (config.clearPreAuthApproval) {
            Object.assign(clearData, {
              approvalStatus: PreAuthStatus.PENDING,
              approvedAmount: null,
              approvalNotes: null,
              approvedAt: null,
              rejectionReason: null,
              rejectionLetterUrl: null,
              rejectedAt: null,
              handledAt: null,
              handledBy: { disconnect: true },
              holdReason: null,
              heldAt: null,
              heldBy: { disconnect: true },
            })
          }
          if (config.clearPreAuthRaise) {
            Object.assign(clearData, {
              requestedHospitalName: null,
              requestedRoomType: null,
              expectedAdmissionDate: null,
              expectedSurgeryDate: null,
              diseaseDescription: null,
              diseaseImages: Prisma.DbNull,
              investigationFileUrls: Prisma.DbNull,
              prescriptionFiles: Prisma.DbNull,
              notes: null,
              bdSuggestedHospital: null,
              isNewHospitalRequest: false,
              newHospitalPreAuthRaised: false,
              preAuthRaisedAt: null,
              preAuthRaisedBy: { disconnect: true },
              approvalStatus: PreAuthStatus.PENDING,
              approvedAmount: null,
              approvalNotes: null,
              approvedAt: null,
              rejectionReason: null,
              rejectionLetterUrl: null,
              rejectedAt: null,
              handledAt: null,
              handledBy: { disconnect: true },
              holdReason: null,
              heldAt: null,
              heldBy: { disconnect: true },
            })
            await tx.kYPSubmission.update({
              where: { id: kypSubmissionId },
              data: {
                prescriptionFileUrl: null,
                diseasePhotos: Prisma.DbNull,
                otherFiles: Prisma.DbNull,
                status: 'KYP_DETAILS_ADDED',
              },
            })
          }
          await tx.preAuthorization.update({
            where: { kypSubmissionId },
            data: clearData,
          })
        }
      }

      // Drop pending finance side-docs tied to this lead when leaving PL.
      if (config.clearDischargeAndDownstream) {
        await tx.invoiceRequest.deleteMany({
          where: { leadId, status: { in: ['PENDING', 'REJECTED'] } },
        })
        await tx.paymentInstallment.deleteMany({ where: { leadId } })
        await tx.insuranceCase.deleteMany({ where: { leadId } })
      }

      const leadUpdate: Prisma.LeadUpdateInput = {
        caseStage: config.caseStage,
        pipelineStage: config.pipelineStage,
        // Reinstate cases that were marked lost when EA resets the workflow.
        lostReason: null,
        lostAt: null,
        ...(nextOwnerUserId
          ? buildLeadOwnershipTransferUpdate(nextOwnerUserId)
          : {}),
      }
      if (config.clearOpdSchedule) {
        leadUpdate.status = config.resetLeadStatus
        leadUpdate.opdScheduleDate = null
        leadUpdate.opdHospital = null
        leadUpdate.opdDrName = null
        leadUpdate.opdContactNo = null
        leadUpdate.opdCharges = null
        leadUpdate.opdMeeting = null
      } else if (config.resetLeadStatus) {
        leadUpdate.status = config.resetLeadStatus
      }
      if (config.clearAdmission) {
        leadUpdate.ipdDrName = null
        leadUpdate.surgeryDate = null
        leadUpdate.conversionDate = null
      } else if (config.clearDischargeAndDownstream) {
        leadUpdate.conversionDate = null
      }
      await tx.lead.update({
        where: { id: leadId },
        data: leadUpdate,
      })

      await tx.caseStageHistory.create({
        data: {
          leadId,
          fromStage: lead.caseStage,
          toStage: config.caseStage,
          changedById: user.id,
          note: timelineNote,
        },
      })

      await tx.workflowResetLog.create({
        data: {
          leadId,
          patientName: lead.patientName,
          leadRef: lead.leadRef,
          previousStepNumber: previousStep.number,
          previousStepLabel: previousStep.label,
          previousCaseStage: lead.caseStage,
          resetToStepNumber: targetStep.number,
          resetToStepLabel: targetStep.label,
          resetToCaseStage: config.caseStage,
          stepsReverted,
          reason,
          resetById: user.id,
          ipAddress,
          userAgent,
        },
      })
    })

    // The reset is already committed above. Post-commit side effects must not
    // turn a successful reset into a 500 — log and continue if they fail.
    try {
      await postCaseChatSystemMessage(
        leadId,
        `Workflow reset from ${previousStep.label} to ${targetStep.label} by Executive Assistant (${user.name}). Reason: ${reason}`,
      )
    } catch (sideEffectError) {
      console.error('reset-stepper: failed to post case chat message', sideEffectError)
    }

    try {
      await notifyResetRecipients({
        leadId,
        bdId: nextOwnerUserId ?? previousBdId,
        previousBdId: nextOwnerUserId ? previousBdId : null,
        patientName: lead.patientName,
        leadRef: lead.leadRef,
        actorId: user.id,
        actorName: user.name,
        targetStep,
        reason,
        reassignedToTl: !!nextOwnerUserId,
      })
    } catch (sideEffectError) {
      console.error('reset-stepper: failed to notify reset recipients', sideEffectError)
    }

    return successResponse(
      {
        caseStage: config.caseStage,
        pipelineStage: config.pipelineStage,
        resetToStep: targetStep.number,
        stepsReverted,
        reassignedToUserId: nextOwnerUserId,
      },
      nextOwnerUserId
        ? 'Workflow step reset and lead assigned to Team Lead'
        : 'Workflow step reset successfully',
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(
        'Invalid request data: ' + error.errors.map((e) => e.message).join(', '),
        400,
      )
    }
    console.error('Error resetting workflow stepper:', error)
    return errorResponse('Failed to reset workflow step', 500)
  }
}

async function clearDischargeDownstream(
  tx: Prisma.TransactionClient,
  leadId: string,
) {
  await tx.outstandingCase.deleteMany({ where: { leadId } })
  await tx.complianceCall.deleteMany({ where: { leadId } })

  const sheet = await tx.dischargeSheet.findUnique({
    where: { leadId },
    select: { id: true, plRecordId: true },
  })
  if (sheet?.plRecordId) {
    await tx.dischargeSheet.update({
      where: { id: sheet.id },
      data: { plRecordId: null },
    })
  }
  await tx.pLRecord.deleteMany({ where: { leadId } })
  await tx.dischargeSheet.deleteMany({ where: { leadId } })
}

async function notifyResetRecipients(args: {
  leadId: string
  bdId: string | null
  previousBdId?: string | null
  patientName: string
  leadRef: string
  actorId: string
  actorName: string
  targetStep: { number: number; label: string; owner: 'BD' | 'INSURANCE' }
  reason: string
  reassignedToTl?: boolean
}) {
  const recipients = new Set<string>()
  if (args.bdId) recipients.add(args.bdId)
  if (args.previousBdId) recipients.add(args.previousBdId)

  if (args.targetStep.owner === 'INSURANCE') {
    const insuranceUsers = await prisma.user.findMany({
      where: { role: { in: ['INSURANCE_HEAD'] } },
      select: { id: true },
    })
    insuranceUsers.forEach((u) => recipients.add(u.id))
  }

  recipients.delete(args.actorId)
  if (recipients.size === 0) return

  const link = notificationLinkForStep(args.leadId, args.targetStep as any)
  const reassignNote = args.reassignedToTl
    ? ' Lead was reassigned to the Team Lead.'
    : ''
  await prisma.notification.createMany({
    data: Array.from(recipients).map((userId) => ({
      userId,
      type: 'WORKFLOW_RESET' as const,
      title: 'Case workflow reset',
      message: `${args.actorName} reset ${args.patientName} (${args.leadRef}) to step "${args.targetStep.label}". Reason: ${args.reason}.${reassignNote}`,
      link,
      relatedId: args.leadId,
    })),
  })
}
