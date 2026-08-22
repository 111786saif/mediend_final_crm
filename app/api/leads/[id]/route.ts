import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { normalizeLeadSexValue } from '@/lib/lead-sex'
import { mapStatusCode, mapSourceCode } from '@/lib/mysql-code-mappings'
import { CaseStage, FlowType, Prisma, PipelineStage } from '@/generated/prisma/client'
import { maskPhoneNumber } from '@/lib/phone-utils'
import { prismaBdEmployeeTeamSelect, toLegacyBdShape } from '@/lib/bd-employee-team'
import { logCrmActivity } from '@/lib/crm-activity'
import { isChurnTriggerStatus, planChurnLeadReassignment } from '@/lib/crm-churn-rules'
import { OPD_SCHEDULED_STATUS } from '@/lib/lead-opd-workflow'
import {
  assertDoctorAvailableOnDate,
  DoctorAvailabilityError,
  normalizeDoctorName,
  parseDoctorAvailabilityDate,
} from '@/lib/doctor-availability'
import {
  isStatusRequiringAgeSex,
  isStatusRequiringCity,
  isStatusRequiringFollowUpDate,
  isStatusRequiringModeOfPayment,
} from '@/lib/lead-status-rules'
import {
  normalizeModeOfPaymentLabel,
  normalizeModeOfPaymentStorageValue,
} from '@/lib/mode-of-payment'
import {
  buildLeadOwnershipTransferUpdate,
  buildLeadOwnershipTransferUpdateForAssigneeManager,
  canUserAddLeadRemarks,
  canUserEditLeadProfile,
  canUserRemoveLeadRemarks,
  canUserReassignLead,
  canUserUpdateLeadStatus,
  canUserViewLeadOwner,
} from '@/lib/lead-ownership'
import { buildEffectiveOpdEntries, getEffectiveOpdCounts } from '@/lib/lead-opd-appointments'
import { leadOpdAppointmentSelect } from '@/lib/lead-opd-records'
import { resolveLeadCity } from '@/lib/lead-display'

function parseFollowUpDateInput(value: unknown) {
  if (value === undefined) return { provided: false, value: undefined as Date | null | undefined }
  if (value === null) return { provided: true, value: null as Date | null }
  if (typeof value !== 'string') return { provided: true, value: 'invalid' as const }

  const trimmed = value.trim()
  if (!trimmed) return { provided: true, value: null as Date | null }

  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T00:00:00`)
    : new Date(trimmed)

  if (Number.isNaN(parsed.getTime())) {
    return { provided: true, value: 'invalid' as const }
  }

  return { provided: true, value: parsed as Date }
}
import { recomputeOutstandingFromInstallments } from '@/lib/pl/installments'

function getStartOfToday() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function normalizeStatusLabel(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase()
}

function resolveCaseStageFromManualStatus(
  status: string | null | undefined,
  flowType: FlowType | null | undefined
): CaseStage | undefined {
  const normalized = normalizeStatusLabel(status)

  if (normalized === 'opd_done' || normalized === 'opd done') {
    return flowType === FlowType.CASH ? CaseStage.CASH_OPD_DONE : CaseStage.OPD_DONE
  }

  if (normalized === 'ipd_done' || normalized === 'ipd done') {
    return flowType === FlowType.CASH ? CaseStage.CASH_IPD_DONE : CaseStage.IPD_DONE
  }

  return undefined
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    const { id } = await params
    console.log('[DEBUG] GET /api/leads/[id]', { id, userId: user.id, userRole: user.role })

    const lead = await prisma.lead.findUnique({
      where: { id },
    })

    if (!lead) {
      console.log('[DEBUG] Lead not found in DB', { id })
      return errorResponse('Lead not found', 404)
    }

    console.log('[DEBUG] Lead found, fetching relations separately', { 
      id: lead.id, 
      patientName: lead.patientName 
    })

    // Fetch relations separately to identify which one is causing the "column not found" error
    let bd = null
    try {
      const bdRow = await prisma.user.findUnique({
        where: { id: lead.bdId },
        select: prismaBdEmployeeTeamSelect,
      })
      bd = toLegacyBdShape(bdRow)
      console.log('[DEBUG] BD relation fetched successfully')
    } catch (e) {
      console.error('[DEBUG] Error fetching BD relation:', e);
    }

    let createdBy = null;
    try {
      createdBy = await prisma.user.findUnique({
        where: { id: lead.createdById },
        select: { id: true, name: true }
      });
      console.log('[DEBUG] createdBy relation fetched successfully');
    } catch (e) {
      console.error('[DEBUG] Error fetching createdBy relation:', e);
    }

    let updatedBy = null;
    try {
      updatedBy = await prisma.user.findUnique({
        where: { id: lead.updatedById },
        select: { id: true, name: true }
      });
      console.log('[DEBUG] updatedBy relation fetched successfully');
    } catch (e) {
      console.error('[DEBUG] Error fetching updatedBy relation:', e);
    }

    let stageEvents: (Prisma.LeadStageEventGetPayload<{
      include: {
        changedBy: {
          select: { id: true, name: true }
        }
      }
    }>)[] = [];
    try {
      stageEvents = await prisma.leadStageEvent.findMany({
        where: { leadId: id },
        include: {
          changedBy: {
            select: { id: true, name: true }
          }
        },
        orderBy: { changedAt: 'desc' }
      });
      console.log('[DEBUG] stageEvents relation fetched successfully');
    } catch (e) {
      console.error('[DEBUG] Error fetching stageEvents relation:', e);
    }

    let kypSubmission = null;
    try {
      kypSubmission = await (prisma as any).kYPSubmission.findUnique({
        where: { leadId: id },
        include: {
          submittedBy: {
            select: { id: true, name: true }
          }
        }
      });
      console.log('[DEBUG] kypSubmission relation fetched successfully');
      
      if (kypSubmission) {
        try {
          const preAuthData = await (prisma as any).preAuthorization.findUnique({
            where: { kypSubmissionId: kypSubmission.id },
            include: {
              handledBy: {
                select: { id: true, name: true }
              },
              preAuthRaisedBy: {
                select: { id: true, name: true }
              },
              heldBy: {
                select: { id: true, name: true }
              },
              suggestedHospitals: true
            }
          });
          (kypSubmission as any).preAuthData = preAuthData;
          console.log('[DEBUG] preAuthData relation fetched successfully');
        } catch (e) {
          console.error('[DEBUG] Error fetching preAuthData relation:', e);
        }
      }
    } catch (e) {
      console.error('[DEBUG] Error fetching kypSubmission relation:', e);
    }

    let insuranceCase = null;
    try {
      insuranceCase = await (prisma as any).insuranceCase.findUnique({
        where: { leadId: id }
      });
      console.log('[DEBUG] insuranceCase relation fetched successfully');
    } catch (e) {
      console.error('[DEBUG] Error fetching insuranceCase relation:', e);
    }

    let plRecord = null;
    try {
      plRecord = await (prisma as any).pLRecord.findUnique({
        where: { leadId: id }
      });
      console.log('[DEBUG] plRecord relation fetched successfully');
    } catch (e) {
      console.error('[DEBUG] Error fetching plRecord relation:', e);
    }

    let dischargeSheet = null;
    try {
      dischargeSheet = await (prisma as any).dischargeSheet.findUnique({
        where: { leadId: id },
      });
      console.log('[DEBUG] dischargeSheet relation fetched successfully');
    } catch (e) {
      console.error('[DEBUG] Error fetching dischargeSheet relation:', e);
    }

    let insuranceInitiateForm = null;
    try {
      insuranceInitiateForm = await (prisma as any).insuranceInitiateForm.findUnique({
        where: { leadId: id },
        select: {
          id: true,
          totalBillAmount: true,
          discount: true,
          otherReductions: true,
          copay: true,
          copayBuffer: true,
          deductible: true,
          exceedsPolicyLimit: true,
          policyDeductibleAmount: true,
          totalAuthorizedAmount: true,
          amountToBePaidByInsurance: true,
          roomCategory: true,
        }
      });
      console.log('[DEBUG] insuranceInitiateForm relation fetched successfully');
    } catch (e) {
      console.error('[DEBUG] Error fetching insuranceInitiateForm relation:', e);
    }

    let admissionRecord = null;
    try {
      admissionRecord = await (prisma as any).admissionRecord.findUnique({
        where: { leadId: id },
        select: {
          id: true,
          admissionDate: true,
          admissionTime: true,
          surgeryDate: true,
          surgeryTime: true,
          admittingHospital: true,
          hospitalAddress: true,
          googleMapLocation: true,
          tpa: true,
          instrument: true,
          implantConsumables: true,
          notes: true,
          ipdStatus: true,
          ipdStatusReason: true,
          ipdStatusNotes: true,
          newSurgeryDate: true,
          ipdDischargeDate: true,
          ipdStatusUpdatedAt: true,
        }
      });
      if (admissionRecord) {
        const r = admissionRecord as any
        r.admissionDate = r.admissionDate?.toISOString?.() ?? r.admissionDate
        r.surgeryDate = r.surgeryDate?.toISOString?.() ?? r.surgeryDate
        r.newSurgeryDate = r.newSurgeryDate?.toISOString?.() ?? r.newSurgeryDate
        r.ipdDischargeDate = r.ipdDischargeDate?.toISOString?.() ?? r.ipdDischargeDate
        r.ipdStatusUpdatedAt = r.ipdStatusUpdatedAt?.toISOString?.() ?? r.ipdStatusUpdatedAt
      }
      console.log('[DEBUG] admissionRecord relation fetched successfully');
    } catch (e) {
      console.error('[DEBUG] Error fetching admissionRecord relation:', e);
    }

    let opdRecordingRelations = null;
    try {
      opdRecordingRelations = await prisma.lead.findUnique({
        where: { id },
        select: {
          opdSurgeryRemark: {
            select: {
              code: true,
              label: true,
            },
          },
          opdReasonNoSurgery: {
            select: {
              code: true,
              label: true,
            },
          },
          opdFollowUpReason: {
            select: {
              code: true,
              label: true,
            },
          },
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
      });
      console.log('[DEBUG] opdRecordingRelations fetched successfully');
    } catch (e) {
      console.error('[DEBUG] Error fetching opdRecordingRelations:', e);
    }

    let opdAppointments: any[] = []
    try {
      opdAppointments = await prisma.leadOpdAppointment.findMany({
        where: { leadId: id },
        orderBy: [{ phase: 'asc' }, { slot: 'asc' }, { scheduleDate: 'asc' }],
        select: leadOpdAppointmentSelect,
      })
      console.log('[DEBUG] opdAppointments fetched successfully')
    } catch (e) {
      console.error('[DEBUG] Error fetching opdAppointments:', e)
    }

    // Resolve hospital name to fetch hospitalShare if the column exists in HospitalMaster
    const pl = (plRecord as Record<string, unknown> | null) ?? {}
    const ds = (dischargeSheet as Record<string, unknown> | null) ?? {}
    const kyp = (kypSubmission as Record<string, unknown> | null) ?? {}
    const preAuth = (kyp.preAuthData as Record<string, unknown> | null) ?? {}
    const preAuthHospital = preAuth.requestedHospitalName as string | null | undefined
    const admission = (admissionRecord as Record<string, unknown> | null) ?? {}

    const resolvedHospitalName =
      pl.hospitalName as string ||
      ds.hospitalName as string ||
      preAuthHospital ||
      admission.admittingHospital as string ||
      lead.hospitalName;

    let hospitalShare = null;
    if (resolvedHospitalName) {
      try {
        const columns: any[] = await prisma.$queryRawUnsafe(
          `SELECT column_name FROM information_schema.columns WHERE LOWER(table_name) = 'hospitalmaster' AND LOWER(column_name) = 'hospitalshare'`
        )
        if (columns.length > 0) {
          const result: any[] = await prisma.$queryRawUnsafe(
            `SELECT "hospitalShare" FROM "HospitalMaster" WHERE name = $1 LIMIT 1`,
            resolvedHospitalName
          )
          if (result.length > 0) {
            hospitalShare = result[0].hospitalShare ?? null
          }
        }
      } catch (e) {
        console.error('[DEBUG] Error querying hospitalShare raw:', e)
      }
    }

    const fullLead = {
      ...lead,
      bd,
      createdBy,
      updatedBy,
      stageEvents,
      kypSubmission,
      insuranceCase,
      plRecord,
      dischargeSheet,
      insuranceInitiateForm,
      admissionRecord,
      opdSurgeryRemark: opdRecordingRelations?.opdSurgeryRemark ?? null,
      opdReasonNoSurgery: opdRecordingRelations?.opdReasonNoSurgery ?? null,
      opdFollowUpReason: opdRecordingRelations?.opdFollowUpReason ?? null,
      opdPrescriptionImages: opdRecordingRelations?.opdPrescriptionImages ?? [],
      opdAppointments,
    } as any

    fullLead.effectiveOpdAppointments = buildEffectiveOpdEntries(fullLead, opdAppointments)
    fullLead.opdCounts = getEffectiveOpdCounts(fullLead.effectiveOpdAppointments)

    console.log('[DEBUG] Full lead object constructed successfully with all relations')

    if (!fullLead) {
      return errorResponse('Failed to load lead relations', 500)
    }

    console.log('[DEBUG] Full lead with relations fetched successfully')

    if (!(await canUserViewLeadOwner(user, fullLead.bdId))) {
      console.log('[DEBUG] Access denied by canAccessLead', {
        userId: user.id,
        userRole: user.role,
        leadBdId: fullLead.bdId,
      })
      return errorResponse('Forbidden', 403)
    }

    // Map status and source codes to text values for display
    // Mask phone number if user is not INSURANCE_HEAD or ADMIN
    const canViewPhone = user.role === 'ADMIN'
    const mappedLead = {
      ...fullLead,
      status: mapStatusCode(fullLead.status),
      source: fullLead.source ? mapSourceCode(fullLead.source) : fullLead.source,
      modeOfPayment: normalizeModeOfPaymentLabel(fullLead.modeOfPayment),
      city: resolveLeadCity(fullLead),
      phoneNumber: canViewPhone ? fullLead.phoneNumber : (fullLead.phoneNumber ? maskPhoneNumber(fullLead.phoneNumber) : null),
      alternateNumber: canViewPhone ? fullLead.alternateNumber : (fullLead.alternateNumber ? maskPhoneNumber(fullLead.alternateNumber) : null),
      caseStage: fullLead.caseStage,
      hospitalShare,
    }
    console.log('[DEBUG] Mapping successful')

    return successResponse(mappedLead, undefined, 'lead')
  } catch (error) {
    console.error('Error fetching lead:', error)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    return errorResponse(`Failed to fetch lead: ${error instanceof Error ? error.message : 'Unknown error'}`, 500)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (user.role !== 'SUPER_ADMIN' && !hasPermission(user, 'leads:write')) {
      return errorResponse('Forbidden', 403)
    }

    const { id } = await params
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        bd: { select: prismaBdEmployeeTeamSelect },
        kypSubmission: {
          select: {
            location: true,
          },
        },
        admissionRecord: {
          select: {
            id: true,
            ipdStatus: true,
            newSurgeryDate: true,
          },
        },
      },
    })

    if (!lead) {
      return errorResponse('Lead not found', 404)
    }

    if (!(await canUserViewLeadOwner(user, lead.bdId))) {
      return errorResponse('Forbidden', 403)
    }

    const body = await request.json()
    const requestedStatus =
      typeof body.status === 'string' && body.status.trim().length > 0
        ? body.status.trim()
        : undefined
    const requestedRemarks =
      body.remarks === undefined
        ? undefined
        : typeof body.remarks === 'string'
          ? body.remarks.trim() || null
          : body.remarks === null
            ? null
            : body.remarks
    const statusChangeRemark =
      typeof body.statusChangeRemark === 'string' ? body.statusChangeRemark.trim() : ''
    const isOpdScheduledStatusChange =
      requestedStatus !== undefined &&
      normalizeStatusLabel(requestedStatus) === normalizeStatusLabel(OPD_SCHEDULED_STATUS)
    const effectiveStatusChangeRemark = isOpdScheduledStatusChange
      ? [`OPD schedule by ${user.name}`, statusChangeRemark].filter(Boolean).join(' | ')
      : statusChangeRemark
    const requireStatusChangeRemark = body.requireStatusChangeRemark === 'true'
    const currentRemarks =
      typeof lead.remarks === 'string' ? lead.remarks.trim() || null : lead.remarks ?? null
    const crmEditFollowUpValidation = body.crmEditFollowUpValidation === 'true'
    const parsedFollowUpDateInput = parseFollowUpDateInput(body.followUpDate)
    const requestedCategory =
      body.category === undefined
        ? undefined
        : typeof body.category === 'string'
          ? body.category.trim() || null
          : body.category === null
            ? null
            : body.category
    const requestedTreatmentMasterId =
      body.treatmentMasterId === undefined
        ? undefined
        : typeof body.treatmentMasterId === 'string'
          ? body.treatmentMasterId.trim() || null
          : body.treatmentMasterId === null
            ? null
            : body.treatmentMasterId
    const updateData: Prisma.LeadUpdateInput = {
      updatedBy: { connect: { id: user.id } },
      updatedDate: new Date(),
    }
    const currentLeadCity =
      typeof lead.kypSubmission?.location === 'string' ? lead.kypSubmission.location.trim() || null : null
    const statusChanged = requestedStatus !== undefined && requestedStatus !== lead.status
    const assigneeChanged = body.bdId !== undefined && body.bdId !== lead.bdId
    const leadProfileChanged =
      (body.patientName !== undefined && body.patientName !== lead.patientName) ||
      (body.whatsapp !== undefined && body.whatsapp !== lead.whatsapp) ||
      (body.city !== undefined &&
        (typeof body.city === 'string' ? body.city.trim() || null : body.city ?? null) !== currentLeadCity) ||
      (requestedCategory !== undefined && requestedCategory !== lead.category) ||
      (
        requestedTreatmentMasterId !== undefined &&
        requestedTreatmentMasterId !== (lead.treatmentMasterId ?? null)
      ) ||
      (body.surgeryDate !== undefined &&
        body.surgeryDate !== (lead.surgeryDate ? lead.surgeryDate.toISOString().slice(0, 10) : null))
    const remarksChanged = requestedRemarks !== undefined && requestedRemarks !== currentRemarks
    const remarksRemoved = remarksChanged && requestedRemarks === null && currentRemarks !== null
    const churnStatusTriggered = statusChanged && isChurnTriggerStatus(requestedStatus)

    if (statusChanged && !(await canUserUpdateLeadStatus(user, lead.bdId))) {
      return errorResponse('You do not have permission to update the lead status', 403)
    }

    if (
      (statusChanged && (requireStatusChangeRemark || effectiveStatusChangeRemark)) ||
      (!statusChanged && effectiveStatusChangeRemark)
    ) {
      if (!(await canUserAddLeadRemarks(user, lead.bdId))) {
      return errorResponse(
        requireStatusChangeRemark
          ? 'You do not have permission to add the required remark for this status change'
          : 'You do not have permission to add a remark for this lead',
        403
      )
      }
    }

    if (leadProfileChanged && !(await canUserEditLeadProfile(user, lead.bdId))) {
      return errorResponse(
        'You do not have permission to edit patient profile details for this lead',
        403
      )
    }

    if (
      remarksChanged &&
      !(
        await (remarksRemoved
          ? canUserRemoveLeadRemarks(user, lead.bdId)
          : canUserAddLeadRemarks(user, lead.bdId))
      )
    ) {
      return errorResponse(
        remarksRemoved
          ? 'You do not have permission to remove remarks for this lead'
          : 'You do not have permission to edit remarks for this lead',
        403
      )
    }

    if (body.patientName !== undefined && String(body.patientName).trim().length === 0) {
      return errorResponse('Patient name is required', 400)
    }

    if (body.age !== undefined && body.age !== null && body.age !== '') {
      const parsedAge = Number(body.age)
      if (!Number.isFinite(parsedAge) || parsedAge < 0) {
        return errorResponse('Age must be a valid number', 400)
      }
    }

    if (body.sex !== undefined && body.sex !== null && body.sex !== '') {
      const normalizedSex = normalizeLeadSexValue(String(body.sex))
      if (!normalizedSex) {
        return errorResponse('Sex must be Male, Female, or Other', 400)
      }
    }

    if (
      requestedCategory !== undefined &&
      requestedCategory !== null &&
      typeof requestedCategory !== 'string'
    ) {
      return errorResponse('Category is invalid', 400)
    }

    if (
      requestedTreatmentMasterId !== undefined &&
      requestedTreatmentMasterId !== null &&
      typeof requestedTreatmentMasterId !== 'string'
    ) {
      return errorResponse('Treatment is invalid', 400)
    }

    if (parsedFollowUpDateInput.value === 'invalid') {
      return errorResponse('Follow-up date is invalid', 400)
    }

    if (
      parsedFollowUpDateInput.provided &&
      parsedFollowUpDateInput.value instanceof Date &&
      parsedFollowUpDateInput.value.getTime() < getStartOfToday().getTime()
    ) {
      return errorResponse('Follow-up date cannot be older than today', 400)
    }

    if (requireStatusChangeRemark && statusChanged && !effectiveStatusChangeRemark) {
      return errorResponse('Remark is required when changing lead status', 400)
    }

    const nextFollowUpDate = parsedFollowUpDateInput.provided
      ? parsedFollowUpDateInput.value
      : lead.followUpDate

    if (
      crmEditFollowUpValidation &&
      statusChanged &&
      isStatusRequiringFollowUpDate(requestedStatus) &&
      !nextFollowUpDate
    ) {
      return errorResponse('Follow-up date is required for this status', 400)
    }

    if (crmEditFollowUpValidation && statusChanged && isStatusRequiringAgeSex(requestedStatus)) {
      const nextAge =
        body.age !== undefined
          ? body.age === null || body.age === ''
            ? null
            : Number(body.age)
          : lead.age
      const nextSex =
        body.sex !== undefined
          ? typeof body.sex === 'string'
            ? normalizeLeadSexValue(body.sex) || null
            : body.sex
          : normalizeLeadSexValue(lead.sex)

      if (!Number.isFinite(nextAge) || Number(nextAge) <= 0) {
        return errorResponse('Age is required for this status', 400)
      }

      if (typeof nextSex !== 'string' || nextSex.trim().length === 0) {
        return errorResponse('Sex is required for this status', 400)
      }
    }

    if (crmEditFollowUpValidation && statusChanged && isStatusRequiringCity(requestedStatus)) {
      const nextCity =
        body.city !== undefined
          ? typeof body.city === 'string'
            ? body.city.trim() || null
            : body.city
          : currentLeadCity || lead.circle

      if (typeof nextCity !== 'string' || nextCity.trim().length === 0) {
        return errorResponse('City is required for this status', 400)
      }
    }

    if (
      crmEditFollowUpValidation &&
      statusChanged &&
      isStatusRequiringModeOfPayment(requestedStatus)
    ) {
      const nextModeOfPayment =
        body.modeOfPayment !== undefined
          ? normalizeModeOfPaymentLabel(body.modeOfPayment)
          : normalizeModeOfPaymentLabel(lead.modeOfPayment)

      if (typeof nextModeOfPayment !== 'string' || nextModeOfPayment.trim().length === 0) {
        return errorResponse('Mode of payment is required for this status', 400)
      }
    }

    if (
      assigneeChanged &&
      !(await canUserReassignLead(user, lead.bdId, String(body.bdId)))
    ) {
      return errorResponse(
        'You can only transfer this lead to an allowed owner for your role',
        403
      )
    }

    let resolvedTreatmentMaster:
      | {
          id: string
          name: string
          category: string
          isActive: boolean
        }
      | null = null

    if (requestedCategory !== undefined && requestedCategory !== null) {
      const categoryMaster = await prisma.treatmentCategoryMaster.findFirst({
        where: {
          name: requestedCategory,
          isActive: true,
        },
        select: { id: true },
      })

      if (!categoryMaster) {
        return errorResponse('Selected category was not found in master data', 400)
      }
    }

    if (
      requestedTreatmentMasterId !== undefined &&
      requestedTreatmentMasterId !== null &&
      requestedTreatmentMasterId !== '__legacy_current_treatment__'
    ) {
      resolvedTreatmentMaster = await prisma.treatmentMaster.findFirst({
        where: {
          id: requestedTreatmentMasterId,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          category: true,
          isActive: true,
        },
      })

      if (!resolvedTreatmentMaster) {
        return errorResponse('Selected treatment was not found in master data', 400)
      }
    }

    if (
      requestedCategory !== undefined &&
      requestedCategory !== null &&
      resolvedTreatmentMaster &&
      resolvedTreatmentMaster.category !== requestedCategory
    ) {
      return errorResponse('Selected treatment does not belong to the selected category', 400)
    }

    const nextOpdDoctorName =
      body.opdDrName !== undefined
        ? normalizeDoctorName(typeof body.opdDrName === 'string' ? body.opdDrName : null)
        : body.surgeonName !== undefined
          ? normalizeDoctorName(typeof body.surgeonName === 'string' ? body.surgeonName : null)
          : normalizeDoctorName(lead.opdDrName || lead.surgeonName)
    const nextOpdScheduleDate =
      body.opdScheduleDate !== undefined
        ? parseDoctorAvailabilityDate(body.opdScheduleDate as string | null, 'OPD schedule date')
        : lead.opdScheduleDate
    const nextIpdDoctorName =
      body.surgeonName !== undefined
        ? normalizeDoctorName(typeof body.surgeonName === 'string' ? body.surgeonName : null)
        : normalizeDoctorName(lead.ipdDrName || lead.surgeonName)
    const nextIpdSurgeryDate =
      body.surgeryDate !== undefined
        ? parseDoctorAvailabilityDate(body.surgeryDate as string | null, 'Surgery date')
        : lead.surgeryDate

    await assertDoctorAvailableOnDate(
      prisma,
      nextOpdDoctorName,
      nextOpdScheduleDate,
      'Selected doctor is on approved leave for this date.'
    )
    await assertDoctorAvailableOnDate(
      prisma,
      nextIpdDoctorName,
      nextIpdSurgeryDate,
      'Selected doctor is on approved leave for this date.'
    )

    // Track stage changes
    if (body.pipelineStage && body.pipelineStage !== lead.pipelineStage) {
      await prisma.leadStageEvent.create({
        data: {
          leadId: lead.id,
          fromStage: lead.pipelineStage,
          toStage: body.pipelineStage as PipelineStage,
          changedById: user.id,
          note: body.stageChangeNote,
        },
      })
      updateData.pipelineStage = body.pipelineStage as PipelineStage
    }

    // Update other fields
    const allowedFields = [
      'status',
      'subStatus',
      'patientName',
      'age',
      'sex',
      'profession',
      'phoneNumber',
      'alternateNumber',
      'whatsapp',
      'attendantName',
      'circle',
      'diseaseDetails',
      'anesthesia',
      'quantityGrade',
      'surgeonName',
      'surgeonType',
      'hospitalName',
      'modeOfPayment',
      'discount',
      'copay',
      'deduction',
      'settledTotal',
      'billAmount',
      'insuranceName',
      'tpa',
      'sumInsured',
      'roomRent',
      'icu',
      'capping',
      'opdHospital',
      'opdDrName',
      'opdContactNo',
      'opdCharges',
      'opdScheduleDate',
      'opdMeeting',
      'arrivalDate',
      'arrivalTime',
      'surgeryDate',
      'operationTime',
      'implantType',
      'implantAmount',
      'instrument',
      'consumables',
      'remarks',
      'source',
      'campaignName',
      'bdeName',
      'conversionDate',
      'mediendProfit',
      'hospitalShare',
      'doctorShare',
      'othersShare',
      'netProfit',
      'ticketSize',
      'flowType',
      'caseStage',
    ] as const

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        let nextValue = body[field]

        if (field === 'age' && (body[field] === null || body[field] === '')) {
          continue
        }

        if (field === 'sex' && typeof body[field] === 'string' && body[field].trim() === '') {
          continue
        }

        if (field === 'surgeryDate' || field === 'opdScheduleDate') {
          nextValue = body[field] ? new Date(String(body[field])) : null
        } else if (field === 'sex' && typeof body[field] === 'string') {
          nextValue = normalizeLeadSexValue(body[field]) || body[field]
        } else if (field === 'modeOfPayment') {
          nextValue = normalizeModeOfPaymentStorageValue(body[field])
        } else if (
          (field === 'patientName' ||
            field === 'profession' ||
            field === 'opdHospital' ||
            field === 'opdDrName' ||
            field === 'opdContactNo' ||
            field === 'whatsapp' ||
            field === 'status' ||
            field === 'remarks') &&
          typeof body[field] === 'string'
        ) {
          const trimmed = body[field].trim()
          nextValue = field === 'remarks' ? trimmed || null : trimmed
        } else {
          nextValue = body[field]
        }

        // Restrict deleting phone numbers
        if ((field === 'phoneNumber' || field === 'alternateNumber') && (body[field] === null || (typeof body[field] === 'string' && body[field].trim() === ''))) {
          continue
        }

        ;(updateData as any)[field] = nextValue
      }
    }

    if (requestedCategory !== undefined || requestedTreatmentMasterId !== undefined) {
      const nextCategory =
        resolvedTreatmentMaster?.category ??
        (requestedCategory !== undefined ? requestedCategory : lead.category ?? null)
      const nextTreatment = resolvedTreatmentMaster?.name ?? (requestedTreatmentMasterId === null ? null : lead.treatment ?? null)

      updateData.category = nextCategory
      updateData.treatment = nextTreatment
      if (requestedTreatmentMasterId !== undefined) {
        updateData.treatmentMaster = resolvedTreatmentMaster
          ? {
              connect: {
                id: resolvedTreatmentMaster.id,
              },
            }
          : {
              disconnect: true,
            }
      }

      if (requestedTreatmentMasterId === null) {
        updateData.treatment = null
      }

      if (requestedCategory === null && requestedTreatmentMasterId == null) {
        updateData.category = null
      }
    }

    if (parsedFollowUpDateInput.provided) {
      updateData.followUpDate = parsedFollowUpDateInput.value
    }

    const autoCaseStageFromStatus = statusChanged
      ? resolveCaseStageFromManualStatus(requestedStatus, lead.flowType)
      : undefined

    if (autoCaseStageFromStatus) {
      updateData.caseStage = autoCaseStageFromStatus
    }

    let churnAutomationResult:
      | Awaited<ReturnType<typeof planChurnLeadReassignment>>
      | null = null

    if (churnStatusTriggered && !assigneeChanged) {
      try {
        churnAutomationResult = await planChurnLeadReassignment(lead.bdId)
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'This lead could not be auto-reassigned for the selected status.'
        return errorResponse(message, 409)
      }
      if (churnAutomationResult) {
        updateData.status = churnAutomationResult.nextStatus
        updateData.followUpDate = churnAutomationResult.followUpDate
        Object.assign(
          updateData,
          buildLeadOwnershipTransferUpdate(
            churnAutomationResult.assignee.userId,
            churnAutomationResult.assignedAt
          )
        )
      }
    }

    // Handle BD reassignment
    if (assigneeChanged && !churnAutomationResult) {
      Object.assign(
        updateData,
        await buildLeadOwnershipTransferUpdateForAssigneeManager(String(body.bdId))
      )
    }

    const nextCaseStage =
      (updateData.caseStage as CaseStage | undefined) ?? lead.caseStage
    const caseStageChanged = nextCaseStage !== lead.caseStage

    const { updatedLead, statusRemarkEntry } = await prisma.$transaction(async (tx) => {
      const updatedLead = await tx.lead.update({
        where: { id },
        data: updateData,
        include: {
          bd: { select: prismaBdEmployeeTeamSelect },
          plRecord: true,
        },
      })

      if (body.city !== undefined) {
        const nextCity =
          typeof body.city === 'string' ? body.city.trim() || null : body.city === null ? null : null

        updateData.circle = nextCity

        const existingKypSubmission = await (tx as any).kYPSubmission.findUnique({
          where: { leadId: id },
          select: { id: true },
        })

        if (existingKypSubmission) {
          await (tx as any).kYPSubmission.update({
            where: { leadId: id },
            data: {
              location: nextCity,
            },
          })
        } else if (nextCity) {
          await (tx as any).kYPSubmission.create({
            data: {
              leadId: id,
              location: nextCity,
              submittedById: user.id,
            },
          })
        }
      }

      if (body.surgeryDate !== undefined) {
        const nextSurgeryDate = body.surgeryDate ? new Date(String(body.surgeryDate)) : null
        
        if (lead.admissionRecord?.id) {
          await (tx as any).admissionRecord.update({
            where: { leadId: id },
            data: {
              surgeryDate: nextSurgeryDate,
              ...(lead.admissionRecord.newSurgeryDate || lead.admissionRecord.ipdStatus === 'POSTPONED'
                ? { newSurgeryDate: nextSurgeryDate }
                : {}),
            },
          })
        }

        await (tx as any).dischargeSheet.updateMany({
          where: { leadId: id },
          data: { surgeryDate: nextSurgeryDate },
        })

        await (tx as any).pLRecord.updateMany({
          where: { leadId: id },
          data: { surgeryDate: nextSurgeryDate },
        })
      }

      const statusRemarkEntry =
        effectiveStatusChangeRemark
          ? await tx.leadRemarkEntry.create({
              data: {
                leadId: lead.id,
                content: effectiveStatusChangeRemark,
                createdById: user.id,
              },
              include: {
                createdBy: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            })
          : null

      if (caseStageChanged) {
        await tx.caseStageHistory.create({
          data: {
            leadId: lead.id,
            fromStage: lead.caseStage,
            toStage: nextCaseStage,
            changedById: user.id,
            note:
              typeof body.stageChangeNote === 'string' && body.stageChangeNote.trim()
                ? body.stageChangeNote.trim()
                : statusChanged
                  ? `Case stage synced from lead status: ${requestedStatus}`
                  : 'Case stage updated from lead edit',
          },
        })
      }

      return { updatedLead, statusRemarkEntry }
    })

    const leadEntityLabel = `${updatedLead.leadRef || lead.leadRef || lead.id} · ${updatedLead.patientName || lead.patientName || 'Lead'}`
    const leadActivityMetadata = {
      leadId: updatedLead.id,
      leadRef: updatedLead.leadRef,
      patientName: updatedLead.patientName,
      previousBdId: lead.bdId,
      nextBdId: updatedLead.bdId,
      previousBdName: lead.bd?.name ?? null,
      nextBdName: updatedLead.bd?.name ?? null,
    }

    const activityLogs: Promise<unknown>[] = []

    if (statusChanged) {
      activityLogs.push(
        logCrmActivity({
          action: 'CRM_LEAD_STATUS_CHANGED',
          entityType: 'CRM_LEAD',
          entityId: updatedLead.id,
          entityLabel: leadEntityLabel,
          actorUserId: user.id,
          actorRole: user.role,
          request,
          summary: `Changed lead status for ${leadEntityLabel} from ${lead.status || '—'} to ${updatedLead.status || '—'}`,
          metadata: {
            ...leadActivityMetadata,
            previousStatus: lead.status,
            nextStatus: updatedLead.status,
            churnAutomation: churnAutomationResult
              ? {
                  scopeType: churnAutomationResult.rule.scopeType,
                  behavior: churnAutomationResult.rule.behavior,
                  assignedToUserId: churnAutomationResult.assignee.userId,
                  assignedToName: churnAutomationResult.assignee.name,
                  followUpDate: churnAutomationResult.followUpDate,
                }
              : null,
          },
        })
      )
    }

    if (statusRemarkEntry) {
      activityLogs.push(
        logCrmActivity({
          action: 'CRM_LEAD_REMARK_ADDED',
          entityType: 'CRM_LEAD_REMARK',
          entityId: lead.id,
          entityLabel: leadEntityLabel,
          actorUserId: user.id,
          actorRole: user.role,
          request,
          summary: `Added a lead remark for ${leadEntityLabel}`,
          metadata: {
            ...leadActivityMetadata,
            remarkId: statusRemarkEntry.id,
            remarkContent: statusRemarkEntry.content,
          },
        })
      )
    }

    if (assigneeChanged || churnAutomationResult) {
      activityLogs.push(
        logCrmActivity({
          action: 'CRM_LEAD_REASSIGNED',
          entityType: 'CRM_LEAD',
          entityId: updatedLead.id,
          entityLabel: leadEntityLabel,
          actorUserId: user.id,
          actorRole: user.role,
          request,
          summary: `Reassigned lead ${leadEntityLabel} from ${lead.bd?.name ?? 'Unassigned'} to ${updatedLead.bd?.name ?? 'Unassigned'}`,
          metadata: {
            ...leadActivityMetadata,
            automatic: Boolean(churnAutomationResult),
            previousAssignedDate: lead.assignedDate,
            nextAssignedDate: updatedLead.assignedDate,
          },
        })
      )
    }

    if (leadProfileChanged) {
      activityLogs.push(
        logCrmActivity({
          action: 'CRM_LEAD_PROFILE_UPDATED',
          entityType: 'CRM_LEAD',
          entityId: updatedLead.id,
          entityLabel: leadEntityLabel,
          actorUserId: user.id,
          actorRole: user.role,
          request,
          summary: `Updated lead profile details for ${leadEntityLabel}`,
          metadata: {
            ...leadActivityMetadata,
            previousPatientName: lead.patientName,
            nextPatientName: updatedLead.patientName,
            previousWhatsapp: lead.whatsapp,
            nextWhatsapp: updatedLead.whatsapp,
            previousSurgeryDate: lead.surgeryDate,
            nextSurgeryDate: updatedLead.surgeryDate,
          },
        })
      )
    }

    if (remarksChanged) {
      activityLogs.push(
        logCrmActivity({
          action: 'CRM_LEAD_REMARK_UPDATED',
          entityType: 'CRM_LEAD_REMARK',
          entityId: updatedLead.id,
          entityLabel: leadEntityLabel,
          actorUserId: user.id,
          actorRole: user.role,
          request,
          summary: `Updated lead remarks for ${leadEntityLabel}`,
          metadata: {
            ...leadActivityMetadata,
            previousRemarks: lead.remarks,
            nextRemarks: updatedLead.remarks,
          },
        })
      )
    }

    if (body.pipelineStage && body.pipelineStage !== lead.pipelineStage) {
      activityLogs.push(
        logCrmActivity({
          action: 'CRM_LEAD_STAGE_CHANGED',
          entityType: 'CRM_LEAD',
          entityId: updatedLead.id,
          entityLabel: leadEntityLabel,
          actorUserId: user.id,
          actorRole: user.role,
          request,
          summary: `Moved lead ${leadEntityLabel} from ${lead.pipelineStage} to ${updatedLead.pipelineStage}`,
          metadata: {
            ...leadActivityMetadata,
            previousPipelineStage: lead.pipelineStage,
            nextPipelineStage: updatedLead.pipelineStage,
            stageChangeNote:
              typeof body.stageChangeNote === 'string' ? body.stageChangeNote.trim() || null : null,
          },
        })
      )
    }

    if (activityLogs.length > 0) {
      await Promise.all(activityLogs)
    }

    if (body.plRecord && typeof body.plRecord === 'object') {
      const raw = body.plRecord as Record<string, unknown>
      const plData = (raw.update && typeof raw.update === 'object' ? raw.update : raw) as Record<string, unknown>
      const plAllowed = [
        'month', 'admissionDate', 'surgeryDate', 'status', 'paymentType', 'approvedOrCash', 'paymentCollectedAt',
        'cashCollectedBy',
        'managerRole', 'managerName', 'bdmName', 'patientName', 'patientPhone', 'doctorName', 'hospitalName',
        'category', 'treatment', 'circle', 'leadSource',
        'totalAmount', 'billAmount', 'cashPaidByPatient', 'cashOrDedPaid', 'referralAmount', 'cabCharges',
        'implantCost', 'instrumentsCost', 'implantPaidBy', 'instrumentsPaidBy', 'dcCharges', 'doctorCharges',
        'hospitalSharePct', 'hospitalShareAmount', 'mediendSharePct', 'mediendShareAmount', 'mediendNetProfit',
        'finalProfit', 'hospitalPayoutStatus', 'doctorPayoutStatus', 'mediendInvoiceStatus',
        'hospitalAmountPending', 'doctorAmountPending',
        'remarks', 'doctorRemarks', 'costBreakdownRemarks', 'closedAt',
        'outstandingStatus',
      ]
      const plUpdate: Record<string, unknown> = {}
      for (const key of plAllowed) {
        if (plData[key] !== undefined) {
          const v = plData[key]
          if (key === 'month' || key === 'admissionDate' || key === 'surgeryDate' || key === 'closedAt') {
            plUpdate[key] = v ? new Date(v as string) : null
          } else {
            plUpdate[key] = v
          }
        }
      }
      if (Object.keys(plUpdate).length > 0) {
        await prisma.pLRecord.upsert({
          where: { leadId: id },
          create: {
            leadId: id,
            ...(plUpdate as any),
          },
          update: plUpdate as any,
        })
        await recomputeOutstandingFromInstallments(id)
      }

      // Mirror deduction + remarks fields onto DischargeSheet so the read-time
      // resolver (which prefers DischargeSheet for these) stays in sync.
      const dsMirrorFields = [
        'cashOrDedPaid',
        'doctorRemarks',
        'costBreakdownRemarks',
      ] as const
      const dsMirror: Record<string, unknown> = {}
      for (const key of dsMirrorFields) {
        if (plData[key] !== undefined) dsMirror[key] = plData[key]
      }
      if (plData.deductionAmount !== undefined) dsMirror.deductionAmount = plData.deductionAmount
      if (plData.waivedOffAmount !== undefined) dsMirror.waivedOffAmount = plData.waivedOffAmount
      if (plData.actualFinalAmount !== undefined) {
        dsMirror.actualFinalAmount = parseFloat(plData.actualFinalAmount as string) || 0
      }
      if (plData.collectedByHospital !== undefined) {
        dsMirror.collectedByHospital = parseFloat(plData.collectedByHospital as string) || 0
      }
      if (plData.collectedByMediend !== undefined) {
        dsMirror.collectedByMediend = parseFloat(plData.collectedByMediend as string) || 0
      }
      if (Object.keys(dsMirror).length > 0) {
        await prisma.dischargeSheet.updateMany({
          where: { leadId: id },
          data: dsMirror as any,
        })
      }

      const leadMirror: Record<string, unknown> = {}
      if (plData.collectedByHospital !== undefined) {
        leadMirror.collectedByHospital = parseFloat(plData.collectedByHospital as string) || 0
      }
      if (plData.collectedByMediend !== undefined) {
        leadMirror.collectedByMediend = parseFloat(plData.collectedByMediend as string) || 0
      }
      if (Object.keys(leadMirror).length > 0) {
        await prisma.lead.update({
          where: { id: id },
          data: leadMirror as any,
        })
      }
    }

    const leadWithPl = await prisma.lead.findUnique({
      where: { id },
      include: {
        bd: { select: prismaBdEmployeeTeamSelect },
        plRecord: true,
      },
    })

    const payload = leadWithPl || updatedLead
    const mappedBase =
      payload && payload.bd
        ? { ...payload, bd: toLegacyBdShape(payload.bd) }
        : payload
    const mapped = mappedBase
      ? {
          ...mappedBase,
          modeOfPayment: normalizeModeOfPaymentLabel(mappedBase.modeOfPayment),
          city:
            body.city !== undefined
              ? typeof body.city === 'string'
                ? body.city.trim() || null
                : null
              : resolveLeadCity(lead),
        }
      : mappedBase
    const responsePayload = churnAutomationResult
      ? {
          ...mapped,
          churnAutomation: {
            scopeType: churnAutomationResult.rule.scopeType,
            behavior: churnAutomationResult.rule.behavior,
            assignedTo: {
              userId: churnAutomationResult.assignee.userId,
              name: churnAutomationResult.assignee.name,
              employeeCode: churnAutomationResult.assignee.employeeCode,
            },
            teamLead: churnAutomationResult.teamLead,
            followUpDate: churnAutomationResult.followUpDate,
            nextStatus: churnAutomationResult.nextStatus,
          },
        }
      : mapped

    return successResponse(responsePayload, 'Lead updated successfully')
  } catch (error) {
    if (error instanceof DoctorAvailabilityError) {
      return errorResponse(error.message, error.status)
    }
    console.error('Error updating lead:', error)
    const message = error instanceof Error ? error.message : 'Failed to update lead'
    return errorResponse(message, 500)
  }
}
