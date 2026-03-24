import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { canAccessLead, hasPermission } from '@/lib/rbac'
import { getSubordinateUserIdsForLeadAccess } from '@/lib/hierarchy'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { mapStatusCode, mapSourceCode } from '@/lib/mysql-code-mappings'
import { Prisma, PipelineStage } from '@/generated/prisma/client'
import { maskPhoneNumber } from '@/lib/phone-utils'

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
    console.log('[DEBUG] GET /api/leads/[id]', { id, userId: user.id, userRole: user.role, userTeamId: user.teamId })

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
    let bd = null;
    try {
      bd = await prisma.user.findUnique({
        where: { id: lead.bdId },
        include: { team: { include: { salesHead: { select: { id: true, name: true } } } } }
      });
      console.log('[DEBUG] BD relation fetched successfully');
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
        select: { id: true }
      });
      console.log('[DEBUG] dischargeSheet relation fetched successfully');
    } catch (e) {
      console.error('[DEBUG] Error fetching dischargeSheet relation:', e);
    }

    let insuranceInitiateForm = null;
    try {
      insuranceInitiateForm = await (prisma as any).insuranceInitiateForm.findUnique({
        where: { leadId: id },
        select: { id: true }
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
      admissionRecord
    } as any

    console.log('[DEBUG] Full lead object constructed successfully with all relations')

    if (!fullLead) {
      return errorResponse('Failed to load lead relations', 500)
    }

    console.log('[DEBUG] Full lead with relations fetched successfully')

    const subordinateIds = user.role === 'TEAM_LEAD' ? await getSubordinateUserIdsForLeadAccess(user.id) : undefined
    if (!canAccessLead(user, fullLead.bdId, fullLead.bd?.team?.id, subordinateIds)) {
      console.log('[DEBUG] Access denied by canAccessLead', {
        userId: user.id,
        userRole: user.role,
        userTeamId: user.teamId,
        leadBdId: fullLead.bdId,
        leadBdTeamId: fullLead.bd?.team?.id
      })
      return errorResponse('Forbidden', 403)
    }

    // Map status and source codes to text values for display
    // Mask phone number if user is not INSURANCE_HEAD or ADMIN
    const canViewPhone = user.role === 'INSURANCE_HEAD' || user.role === 'ADMIN'
    const mappedLead = {
      ...fullLead,
      status: mapStatusCode(fullLead.status),
      source: fullLead.source ? mapSourceCode(fullLead.source) : fullLead.source,
      phoneNumber: canViewPhone ? fullLead.phoneNumber : (fullLead.phoneNumber ? maskPhoneNumber(fullLead.phoneNumber) : null),
      caseStage: fullLead.caseStage,
    }
    console.log('[DEBUG] Mapping successful')

    return successResponse(mappedLead)
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

    if (!hasPermission(user, 'leads:write')) {
      return errorResponse('Forbidden', 403)
    }

    const { id } = await params
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        bd: {
          include: {
            team: true,
          },
        },
      },
    })

    if (!lead) {
      return errorResponse('Lead not found', 404)
    }

    const subordinateIds = user.role === 'TEAM_LEAD' ? await getSubordinateUserIdsForLeadAccess(user.id) : undefined
    if (!canAccessLead(user, lead.bdId, lead.bd.team?.id, subordinateIds)) {
      return errorResponse('Forbidden', 403)
    }

    const body = await request.json()
    const updateData: Prisma.LeadUpdateInput = {
      updatedBy: { connect: { id: user.id } },
      updatedDate: new Date(),
    }

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
      'patientName',
      'age',
      'sex',
      'phoneNumber',
      'alternateNumber',
      'attendantName',
      'bdId',
      'circle',
      'category',
      'treatment',
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
         
        (updateData as any)[field] = body[field]
      }
    }

    // Handle BD reassignment
    if (body.bdId && body.bdId !== lead.bdId) {
      if (user.role === 'BD' && body.bdId !== user.id) {
        return errorResponse('You can only assign leads to yourself', 403)
      }
      if (user.role === 'TEAM_LEAD' && user.teamId) {
        // Verify new BD is in the same team
        const newBd = await prisma.user.findUnique({
          where: { id: body.bdId },
        })
        if (!newBd || newBd.teamId !== user.teamId) {
          return errorResponse('Can only reassign to BDs in your team', 403)
        }
      }
      updateData.bd = { connect: { id: body.bdId } }
    }

    const updatedLead = await prisma.lead.update({
      where: { id },
      data: updateData,
      include: {
        bd: {
          include: {
            team: true,
          },
        },
        plRecord: true,
      },
    })

    if (body.plRecord && typeof body.plRecord === 'object') {
      const raw = body.plRecord as Record<string, unknown>
      const plData = (raw.update && typeof raw.update === 'object' ? raw.update : raw) as Record<string, unknown>
      const plAllowed = [
        'month', 'admissionDate', 'surgeryDate', 'status', 'paymentType', 'approvedOrCash', 'paymentCollectedAt',
        'managerRole', 'managerName', 'bdmName', 'patientName', 'patientPhone', 'doctorName', 'hospitalName',
        'category', 'treatment', 'circle', 'leadSource',
        'totalAmount', 'billAmount', 'cashPaidByPatient', 'cashOrDedPaid', 'referralAmount', 'cabCharges',
        'implantCost', 'instrumentsCost', 'implantPaidBy', 'instrumentsPaidBy', 'dcCharges', 'doctorCharges',
        'hospitalSharePct', 'hospitalShareAmount', 'mediendSharePct', 'mediendShareAmount', 'mediendNetProfit',
        'finalProfit', 'hospitalPayoutStatus', 'doctorPayoutStatus', 'mediendInvoiceStatus',
        'hospitalAmountPending', 'doctorAmountPending',
        'remarks', 'closedAt',
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
      }
    }

    const leadWithPl = await prisma.lead.findUnique({
      where: { id },
      include: {
        bd: { include: { team: true } },
        plRecord: true,
      },
    })

    return successResponse(leadWithPl || updatedLead, 'Lead updated successfully')
  } catch (error) {
    console.error('Error updating lead:', error)
    return errorResponse('Failed to update lead', 500)
  }
}

