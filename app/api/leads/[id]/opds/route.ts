import { NextRequest } from 'next/server'
import { LeadOpdPhase } from '@/generated/prisma/client'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { buildEffectiveOpdEntries, getEffectiveOpdCounts } from '@/lib/lead-opd-appointments'
import { canUserEditLeadProfile, canUserViewLeadOwner } from '@/lib/lead-ownership'
import { mutateLeadOpd, LeadOpdMutationError } from '@/lib/lead-opd-mutations'
import { leadOpdAppointmentSelect } from '@/lib/lead-opd-records'
import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/rbac'
import { getSessionFromRequest } from '@/lib/session'

function normalizePhase(value: unknown) {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toUpperCase()
  if (normalized === 'PRE') return LeadOpdPhase.PRE
  if (normalized === 'POST') return LeadOpdPhase.POST
  return null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (user.role !== 'SUPER_ADMIN' && !hasPermission(user, 'leads:read')) {
      return errorResponse('Forbidden', 403)
    }

    const { id } = await params
    const lead = await prisma.lead.findUnique({
      where: { id },
      select: {
        id: true,
        bdId: true,
        caseStage: true,
        flowType: true,
        status: true,
        hospitalName: true,
        surgeonName: true,
        diseaseDetails: true,
        remarks: true,
        opdHospital: true,
        opdDrName: true,
        opdContactNo: true,
        opdCharges: true,
        opdScheduleDate: true,
        opdMeeting: true,
        opdSurgeryAdvised: true,
        opdSurgeryRemarkCode: true,
        opdReasonNoSurgeryCode: true,
        opdFollowUpReasonCode: true,
        opdImplantRequired: true,
        opdDiagnosis: true,
        opdSurgeryRemark: { select: { code: true, label: true } },
        opdReasonNoSurgery: { select: { code: true, label: true } },
        opdFollowUpReason: { select: { code: true, label: true } },
        opdPrescriptionImages: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            fileName: true,
            fileUrl: true,
            storageKey: true,
            sortOrder: true,
          },
        },
      },
    })

    if (!lead) return errorResponse('Lead not found', 404)
    if (!(await canUserViewLeadOwner(user, lead.bdId))) {
      return errorResponse('Forbidden', 403)
    }

    const appointments = await prisma.leadOpdAppointment.findMany({
      where: { leadId: id },
      orderBy: [{ phase: 'asc' }, { slot: 'asc' }, { scheduleDate: 'asc' }],
      select: leadOpdAppointmentSelect,
    })
    const effective = buildEffectiveOpdEntries(lead, appointments)

    return successResponse({
      items: effective,
      opdCounts: getEffectiveOpdCounts(effective),
    })
  } catch (error) {
    console.error('[GET /api/leads/[id]/opds]', error)
    return errorResponse('Failed to fetch OPDs', 500)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (user.role !== 'SUPER_ADMIN' && !hasPermission(user, 'leads:write')) {
      return errorResponse('Forbidden', 403)
    }

    const { id } = await params
    const lead = await prisma.lead.findUnique({
      where: { id },
      select: { id: true, bdId: true },
    })

    if (!lead) return errorResponse('Lead not found', 404)
    if (!(await canUserEditLeadProfile(user, lead.bdId))) {
      return errorResponse('Forbidden', 403)
    }

    const body = await request.json()
    const phase = normalizePhase(body.phase)
    if (!phase) {
      return errorResponse('Phase must be PRE or POST', 400)
    }

    const result = await mutateLeadOpd({
      leadId: id,
      actorUserId: user.id,
      actorName: user.name,
      actorRole: user.role,
      phase,
      hospitalName: typeof body.opdHospital === 'string' ? body.opdHospital : body.hospitalName,
      doctorName: typeof body.opdDrName === 'string' ? body.opdDrName : body.doctorName,
      contactNumber:
        typeof body.opdContactNo === 'string' ? body.opdContactNo : body.contactNumber,
      charges:
        body.opdCharges === undefined || body.opdCharges === null || body.opdCharges === ''
          ? undefined
          : Number(body.opdCharges),
      scheduleDate:
        typeof body.opdScheduleDate === 'string' ? body.opdScheduleDate : body.scheduleDate,
      meetingType:
        body.opdMeeting === undefined || body.opdMeeting === null || body.opdMeeting === ''
          ? undefined
          : Number(body.opdMeeting),
    })

    return successResponse(
      {
        items: result.effectiveOpdAppointments,
        opdCounts: getEffectiveOpdCounts(result.effectiveOpdAppointments),
      },
      'OPD created'
    )
  } catch (error) {
    if (error instanceof LeadOpdMutationError) {
      return errorResponse(error.message, error.status)
    }
    console.error('[POST /api/leads/[id]/opds]', error)
    return errorResponse('Failed to save OPD', 500)
  }
}
