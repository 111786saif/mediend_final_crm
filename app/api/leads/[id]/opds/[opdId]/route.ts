import { NextRequest } from 'next/server'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getEffectiveOpdCounts } from '@/lib/lead-opd-appointments'
import { canUserEditLeadProfile } from '@/lib/lead-ownership'
import { LeadOpdMutationError, mutateLeadOpd } from '@/lib/lead-opd-mutations'
import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/rbac'
import { getSessionFromRequest } from '@/lib/session'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; opdId: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (user.role !== 'SUPER_ADMIN' && !hasPermission(user, 'leads:write')) {
      return errorResponse('Forbidden', 403)
    }

    const { id, opdId } = await params
    const lead = await prisma.lead.findUnique({
      where: { id },
      select: { id: true, bdId: true },
    })
    if (!lead) return errorResponse('Lead not found', 404)
    if (!(await canUserEditLeadProfile(user, lead.bdId))) {
      return errorResponse('Forbidden', 403)
    }

    const body = await request.json()
    const result = await mutateLeadOpd({
      leadId: id,
      actorUserId: user.id,
      actorName: user.name,
      appointmentId: opdId,
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
      surgeryAdvised: body.surgeryAdvised,
      surgeryRemarkCode: body.surgeryRemarksType ?? body.surgeryRemarkCode,
      reasonNoSurgeryCode: body.reasonNoSurgery ?? body.reasonForNoSurgery,
      followUpReasonCode: body.followUpReason,
      implantRequired:
        typeof body.implantRequired === 'boolean' || body.implantRequired === null
          ? body.implantRequired
          : undefined,
      diagnosis: body.diagnosis,
      remarks: body.remarks,
      followUpDate: body.followUpDate,
      prescriptionImages: Array.isArray(body.prescriptionImages) ? body.prescriptionImages : undefined,
      markDone: body.markDone === true || body.markOpdDone === true,
      cancel: body.cancel === true,
    })

    return successResponse(
      {
        items: result.effectiveOpdAppointments,
        opdCounts: getEffectiveOpdCounts(result.effectiveOpdAppointments),
      },
      'OPD updated'
    )
  } catch (error) {
    if (error instanceof LeadOpdMutationError) {
      return errorResponse(error.message, error.status)
    }
    console.error('[PATCH /api/leads/[id]/opds/[opdId]]', error)
    return errorResponse('Failed to update OPD', 500)
  }
}
