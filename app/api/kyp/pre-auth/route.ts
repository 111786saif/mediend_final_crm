import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { postCaseChatSystemMessage } from '@/lib/case-chat'
import { z } from 'zod'
import { CaseStage } from '@/generated/prisma/client'

const roomTypeSchema = z.object({
  name: z.string().min(1),
  rent: z.string(),
})

const hospitalSuggestionSchema = z.object({
  hospitalName: z.string().min(1),
  tentativeBill: z.number().optional(),
  roomRentGeneral: z.number().optional(),
  roomRentSingle: z.number().optional(),
  roomRentDeluxe: z.number().optional(),
  roomRentSemiPrivate: z.number().optional(),
  notes: z.string().optional(),
  suggestedDoctor: z.string().optional(),
})

const preAuthSchema = z.object({
  kypSubmissionId: z.string(),
  sumInsured: z.string().optional(),
  balanceInsured: z.string().optional(),
  roomRent: z.string().optional(),
  capping: z.string().optional(),
  copay: z.string().optional(),
  icu: z.string().optional(),
  hospitalNameSuggestion: z.string().optional(),
  hospitalSuggestions: z.array(z.string()).optional(),
  roomTypes: z.array(roomTypeSchema).optional(),
  insurance: z.string().optional(),
  insuranceName: z.string().optional(),
  tpa: z.string().optional(),
  hospitals: z.array(hospitalSuggestionSchema).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (user.role !== 'INSURANCE' && user.role !== 'INSURANCE_HEAD' && user.role !== 'ADMIN' && user.role !== 'TESTER') {
      return errorResponse('Forbidden', 403)
    }

    const body = await request.json()
    const data = preAuthSchema.parse(body)

    const kypSubmission = await prisma.kYPSubmission.findUnique({
      where: { id: data.kypSubmissionId },
      include: {
        lead: {
          select: {
            id: true,
            leadRef: true,
            patientName: true,
            bdId: true,
            caseStage: true,
          },
        },
        preAuthData: { include: { suggestedHospitals: true } },
      },
    })

    if (!kypSubmission) {
      return errorResponse('KYP submission not found', 404)
    }

    const { caseStage } = kypSubmission.lead

    // Flow: Insurance suggests hospitals (KYP_BASIC_COMPLETE) → HOSPITALS_SUGGESTED
    if (caseStage === CaseStage.KYP_BASIC_COMPLETE) {
      if (!data.sumInsured?.trim()) {
        return errorResponse('Sum insured is required', 400)
      }
      if (!data.balanceInsured?.trim()) {
        return errorResponse('Balance sum insured is required', 400)
      }
      if (!data.copay?.trim()) {
        return errorResponse('Copay is required', 400)
      }
      if (!data.hospitals?.length) {
        return errorResponse('At least one hospital suggestion is required', 400)
      }

      const preAuth = await prisma.preAuthorization.upsert({
        where: { kypSubmissionId: data.kypSubmissionId },
        create: {
          kypSubmissionId: data.kypSubmissionId,
          sumInsured: data.sumInsured,
          balanceInsured: data.balanceInsured?.trim() || undefined,
          copay: data.copay?.trim() || undefined,
          capping: data.capping?.trim() || undefined,
          insurance: data.insuranceName?.trim() || undefined,
          tpa: data.tpa?.trim() || undefined,
          handledById: user.id,
          handledAt: new Date(),
        },
        update: {
          sumInsured: data.sumInsured,
          balanceInsured: data.balanceInsured?.trim() || undefined,
          copay: data.copay?.trim() || undefined,
          capping: data.capping?.trim() || undefined,
          insurance: data.insuranceName?.trim() || undefined,
          tpa: data.tpa?.trim() || undefined,
          handledById: user.id,
          handledAt: new Date(),
        },
      })

      await prisma.hospitalSuggestion.deleteMany({ where: { preAuthId: preAuth.id } })
      for (const h of data.hospitals) {
        await prisma.hospitalSuggestion.create({
          data: {
            preAuthId: preAuth.id,
            hospitalName: h.hospitalName.trim(),
            tentativeBill: h.tentativeBill ?? undefined,
            roomRentGeneral: h.roomRentGeneral ?? undefined,
            roomRentSingle: h.roomRentSingle ?? undefined,
            roomRentDeluxe: h.roomRentDeluxe ?? undefined,
            roomRentSemiPrivate: h.roomRentSemiPrivate ?? undefined,
            notes: h.notes ?? undefined,
            suggestedDoctor: h.suggestedDoctor ?? undefined,
          },
        })
      }

      await prisma.kYPSubmission.update({
        where: { id: data.kypSubmissionId },
        data: { status: 'KYP_DETAILS_ADDED' },
      })

      await prisma.lead.update({
        where: { id: kypSubmission.lead.id },
        data: {
          caseStage: CaseStage.HOSPITALS_SUGGESTED,
          pipelineStage: 'INSURANCE',
          ...(data.insuranceName?.trim() ? { insuranceName: data.insuranceName.trim() } : {}),
        },
      })

      await prisma.caseStageHistory.create({
        data: {
          leadId: kypSubmission.lead.id,
          fromStage: CaseStage.KYP_BASIC_COMPLETE,
          toStage: CaseStage.HOSPITALS_SUGGESTED,
          changedById: user.id,
          note: `Insurance suggested hospitals. BD can now choose and raise pre-auth.`,
        },
      })

      await postCaseChatSystemMessage(kypSubmission.lead.id, `Insurance suggested ${data.hospitals.length} hospital(s). BD can now choose and raise pre-auth.`)

      await prisma.notification.create({
        data: {
          userId: kypSubmission.submittedById,
          type: 'KYP_SUBMITTED',
          title: 'Hospital suggestions added',
          message: `Insurance has suggested hospitals for ${kypSubmission.lead.patientName} (${kypSubmission.lead.leadRef}). You can now raise pre-auth.`,
          link: `/patient/${kypSubmission.lead.id}/pre-auth`,
          relatedId: kypSubmission.id,
        },
      })

      return successResponse(preAuth, 'Hospital suggestions saved. BD can now raise pre-auth.')
    }

    // Flow 1.5: Insurance suggests/modifies hospitals on pre-auth page
    if (data.hospitals && data.hospitals.length > 0) {
      if (!data.sumInsured?.trim()) {
        return errorResponse('Sum insured is required when suggesting hospitals', 400)
      }

      // If we are updating hospitals, we should ensure the stage is HOSPITALS_SUGGESTED
      // This is important if the case was already in PREAUTH_RAISED (e.g. BD selected a hospital, but Insurance is now changing the options)
      // We want to force the BD to re-select from the new list.
      if (caseStage !== CaseStage.HOSPITALS_SUGGESTED) {
        await prisma.lead.update({
          where: { id: kypSubmission.lead.id },
          data: {
            caseStage: CaseStage.HOSPITALS_SUGGESTED,
          },
        })

        await prisma.caseStageHistory.create({
          data: {
            leadId: kypSubmission.lead.id,
            fromStage: caseStage,
            toStage: CaseStage.HOSPITALS_SUGGESTED,
            changedById: user.id,
            note: 'Insurance updated hospital suggestions - reverting stage to allow BD re-selection',
          },
        })
      }

      const preAuth = await prisma.preAuthorization.upsert({
        where: { kypSubmissionId: data.kypSubmissionId },
        create: {
          kypSubmissionId: data.kypSubmissionId,
          sumInsured: data.sumInsured,
          balanceInsured: data.balanceInsured?.trim() || undefined,
          copay: data.copay?.trim() || undefined,
          capping: data.capping?.trim() || undefined,
          insurance: data.insuranceName?.trim() || undefined,
          tpa: data.tpa?.trim() || undefined,
          handledById: user.id,
          handledAt: new Date(),
          bdSuggestedHospital: null, // Clear any pending suggestion
          preAuthRaisedAt: null, // Clear raised status so BD can raise again
        },
        update: {
          sumInsured: data.sumInsured,
          balanceInsured: data.balanceInsured?.trim() || undefined,
          copay: data.copay?.trim() || undefined,
          capping: data.capping?.trim() || undefined,
          insurance: data.insuranceName?.trim() || undefined,
          tpa: data.tpa?.trim() || undefined,
          handledById: user.id,
          handledAt: new Date(),
          bdSuggestedHospital: null, // Clear any pending suggestion
          preAuthRaisedAt: null, // Clear raised status so BD can raise again
        },
      })

      // Delete existing hospital suggestions and create new ones
      await prisma.hospitalSuggestion.deleteMany({ where: { preAuthId: preAuth.id } })
      for (const h of data.hospitals) {
        await prisma.hospitalSuggestion.create({
          data: {
            preAuthId: preAuth.id,
            hospitalName: h.hospitalName.trim(),
            tentativeBill: h.tentativeBill ?? undefined,
            roomRentGeneral: h.roomRentGeneral ?? undefined,
            roomRentSingle: h.roomRentSingle ?? undefined,
            roomRentDeluxe: h.roomRentDeluxe ?? undefined,
            roomRentSemiPrivate: h.roomRentSemiPrivate ?? undefined,
            notes: h.notes ?? undefined,
            suggestedDoctor: h.suggestedDoctor ?? undefined,
          },
        })
      }

      // Sync insurance name to Lead so it updates everywhere (patient page, pre-auth overview)
      if (data.insuranceName !== undefined) {
        await prisma.lead.update({
          where: { id: kypSubmission.lead.id },
          data: {
            insuranceName: data.insuranceName?.trim() || null,
          },
        })
      }

      // Notify BD if this was in response to a suggestion or just an update
      const notifyUserId = preAuth.preAuthRaisedById || kypSubmission.submittedById
      if (notifyUserId) {
        await prisma.notification.create({
          data: {
            userId: notifyUserId,
            type: 'KYP_SUBMITTED', // Re-using type as it's a hospital update
            title: 'Hospital suggestions updated',
            message: `Insurance has updated hospital suggestions for ${kypSubmission.lead.patientName} (${kypSubmission.lead.leadRef}).`,
            link: `/patient/${kypSubmission.lead.id}/pre-auth`,
            relatedId: kypSubmission.id,
          },
        })
      }
      
      await postCaseChatSystemMessage(kypSubmission.lead.id, `Insurance updated hospital suggestions.`)

      return successResponse(preAuth, `Hospital suggestions ${kypSubmission.preAuthData ? 'updated' : 'saved'} successfully`)
    }

    // Flow 2: Insurance completes pre-auth after BD raised (PREAUTH_RAISED) → PREAUTH_COMPLETE
    if (caseStage === CaseStage.PREAUTH_RAISED) {
      if (!kypSubmission.preAuthData) {
        return errorResponse('Pre-auth record not found. BD must raise pre-auth first.', 400)
      }

      const updatePayload = {
        sumInsured: data.sumInsured,
        balanceInsured: data.balanceInsured,
        roomRent: data.roomRent,
        capping: data.capping?.trim() || undefined,
        copay: data.copay,
        icu: data.icu,
        hospitalNameSuggestion: data.hospitalNameSuggestion,
        hospitalSuggestions: data.hospitalSuggestions ?? undefined,
        roomTypes: data.roomTypes ?? undefined,
        insurance: data.insurance,
        tpa: data.tpa,
        handledById: user.id,
        handledAt: new Date(),
      }

      const preAuth = await prisma.preAuthorization.update({
        where: { kypSubmissionId: data.kypSubmissionId },
        data: updatePayload,
      })

      await prisma.kYPSubmission.update({
        where: { id: data.kypSubmissionId },
        data: { status: 'PRE_AUTH_COMPLETE' },
      })

      // Set lead.ipdDrName from selected hospital's suggestedDoctor when pre-auth is completed
      const selectedHospitalName = data.hospitalNameSuggestion?.trim() || kypSubmission.preAuthData?.requestedHospitalName?.trim()
      const selectedHospital = selectedHospitalName && kypSubmission.preAuthData?.suggestedHospitals
        ? kypSubmission.preAuthData.suggestedHospitals.find(
            (h) => h.hospitalName.trim().toLowerCase() === selectedHospitalName.toLowerCase()
          )
        : null
      const ipdDrNameFromPreAuth = selectedHospital?.suggestedDoctor?.trim() || null

      await prisma.lead.update({
        where: { id: kypSubmission.lead.id },
        data: {
          caseStage: CaseStage.PREAUTH_COMPLETE,
          ...(ipdDrNameFromPreAuth ? { ipdDrName: ipdDrNameFromPreAuth } : {}),
        },
      })

      await prisma.caseStageHistory.create({
        data: {
          leadId: kypSubmission.lead.id,
          fromStage: CaseStage.PREAUTH_RAISED,
          toStage: CaseStage.PREAUTH_COMPLETE,
          changedById: user.id,
          note: 'Pre-authorization completed by Insurance',
        },
      })

      await postCaseChatSystemMessage(kypSubmission.lead.id, 'Insurance completed pre-auth. BD can now mark patient admitted.')

      await prisma.notification.create({
        data: {
          userId: kypSubmission.submittedById,
          type: 'PRE_AUTH_COMPLETE',
          title: 'Pre-Authorization Complete',
          message: `Pre-authorization completed for ${kypSubmission.lead.patientName} (${kypSubmission.lead.leadRef})`,
          link: `/bd/kyp?kyp=${kypSubmission.id}`,
          relatedId: kypSubmission.id,
        },
      })

      return successResponse(preAuth, 'Pre-authorization completed successfully')
    }

    return errorResponse(
      `Cannot update pre-auth. Current stage: ${caseStage}. ` +
        'Insurance can suggest hospitals at KYP_BASIC_COMPLETE stage, or complete pre-auth after BD has raised.',
      400
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Invalid request data', 400)
    }
    console.error('Error submitting pre-auth:', error)
    return errorResponse('Failed to submit pre-authorization', 500)
  }
}
