import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { canAccessLead, hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { mapStatusCode, mapSourceCode } from '@/lib/mysql-code-mappings'
import { FlowType, Prisma, PipelineStage } from '@/generated/prisma/client'
import { maskPhoneNumber } from '@/lib/phone-utils'
import { last10DigitsFromStored } from '@/lib/phone-search'
import { getTeamLeadLeadAccessBdUserIds } from '@/lib/hierarchy'

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (!hasPermission(user, 'leads:read')) {
      return errorResponse('Forbidden', 403)
    }

    const { searchParams } = new URL(request.url)
    const pipelineStage = searchParams.get('pipelineStage')
    const status = searchParams.get('status')
    const bdId = searchParams.get('bdId')
    // const teamId = searchParams.get('teamId')
    const circle = searchParams.get('circle')
    const hospitalName = searchParams.get('hospitalName')
    const treatment = searchParams.get('treatment')
    const source = searchParams.get('source')
    const campaignName = searchParams.get('campaignName')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const dateField = searchParams.get('dateField')
    const caseStage = searchParams.get('caseStage')
    const limit = searchParams.get('limit')

    const where: Prisma.LeadWhereInput = {}
    let subordinateUserIds: string[] | undefined

    // Role-based filtering
    if (user.role === 'BD') {
      where.bdId = user.id
    } else if (user.role === 'TEAM_LEAD') {
      subordinateUserIds = await getTeamLeadLeadAccessBdUserIds(user.id)
      where.bdId = { in: [user.id, ...subordinateUserIds] }
    }
    // Note: INSURANCE_HEAD can access all leads via canAccessLead, so we don't filter by bdId

    // For insurance users: show leads with KYP (insurance flow), insurance-related stages, or any cash flow lead (for cash cases page)
    if (user.role === 'INSURANCE_HEAD') {
      where.OR = [
        { kypSubmission: { isNot: null } },
        { caseStage: { in: ['KYP_PENDING', 'KYP_COMPLETE', 'PREAUTH_RAISED', 'PREAUTH_COMPLETE', 'INITIATED', 'ADMITTED', 'DISCHARGED', 'IPD_DONE'] } },
        { flowType: FlowType.CASH },
      ]
    }

    // Support comma-separated pipeline stages (e.g. PL,COMPLETED for PL dashboard)
    if (pipelineStage) {
      const stages = pipelineStage.split(',').map((s) => s.trim()).filter(Boolean)
      const validStages = stages.filter((s) =>
        ['SALES', 'INSURANCE', 'PL', 'COMPLETED', 'LOST'].includes(s)
      ) as PipelineStage[]
      if (validStages.length === 1) {
        where.pipelineStage = validStages[0]
      } else if (validStages.length > 1) {
        where.pipelineStage = { in: validStages }
      }
    }
    if (status) where.status = status
    if (caseStage) {
      const stages = caseStage.split(',').map((s) => s.trim()).filter(Boolean)
      if (stages.length === 1) {
        where.caseStage = stages[0]
      } else if (stages.length > 1) {
        where.caseStage = { in: stages }
      }
    }
    if (bdId) where.bdId = bdId
    if (circle) where.circle = circle
    if (hospitalName) where.hospitalName = { contains: hospitalName, mode: 'insensitive' }
    if (treatment) where.treatment = { contains: treatment, mode: 'insensitive' }
    if (source) where.source = source
    if (campaignName) where.campaignName = campaignName

    // Activity-month filter (Insurance dashboard default view):
    // Match leads that have AT LEAST ONE caseStageHistory row whose changedAt
    // falls inside the given month. This captures KYP submit, hospitals
    // suggested, pre-auth raised/approved, admitted, IPD done, mark-discharged
    // — i.e. cases that actually moved this month, ignoring lead creation date.
    const activityMonthParam = searchParams.get('activityMonth')
    const activityYearParam = searchParams.get('activityYear')
    if (activityMonthParam && activityYearParam) {
      const m = parseInt(activityMonthParam, 10)
      const y = parseInt(activityYearParam, 10)
      if (!Number.isNaN(m) && !Number.isNaN(y) && m >= 1 && m <= 12) {
        const monthStart = new Date(y, m - 1, 1)
        const monthEnd = new Date(y, m, 1)
        where.caseStageHistory = {
          some: { changedAt: { gte: monthStart, lt: monthEnd } },
        }
      }
    }

    if (startDate || endDate) {
      const range: Prisma.DateTimeFilter = {}
      if (startDate) range.gte = new Date(startDate)
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        range.lte = end
      }
      if (dateField === 'surgery') {
        const surgeryOr: Prisma.LeadWhereInput[] = [
          { surgeryDate: range },
          { plRecord: { surgeryDate: range } },
        ]
        if (where.OR) {
          const insuranceOr = where.OR
          delete where.OR
          where.AND = [{ OR: insuranceOr }, { OR: surgeryOr }]
        } else {
          where.OR = surgeryOr
        }
      } else {
        where.createdDate = range
      }
    }

    const view = searchParams.get('view')

    const isPipelineView = view === 'pipeline'

    const phoneSearchParam = searchParams.get('phoneSearch')
    const phoneLast10 =
      phoneSearchParam && /^\d{10}$/.test(phoneSearchParam) ? phoneSearchParam : null

    let finalWhere: Prisma.LeadWhereInput = where
    if (phoneLast10) {
      finalWhere = {
        AND: [
          where,
          {
            OR: [
              { phoneNumber: { contains: phoneLast10 } },
              { alternateNumber: { contains: phoneLast10 } },
            ],
          },
        ],
      }
    }

    const pipelineSelect = {
      id: true,
      leadRef: true,
      patientName: true,
      age: true,
      dateOfBirth: true,
      sex: true,
      treatment: true,
      category: true,
      status: true,
      caseStage: true,
      pipelineStage: true,
      bdId: true,
      circle: true,
      campaignName: true,
      leadEntryDate: true,
      assignedDate: true,
      createdDate: true,
      updatedDate: true,
      hospitalName: true,
      ipdDrName: true,
      surgeonName: true,
      source: true,
      netProfit: true,
      surgeryDate: true,
      flowType: true,
      bd: {
        select: {
          id: true,
          name: true,
          employee: { select: { team: { select: { id: true } } } },
        },
      },
      kypSubmission: {
        select: {
          id: true,
          status: true,
          updatedAt: true,
          preAuthData: {
            select: {
              updatedAt: true,
              requestedHospitalName: true,
              hospitalNameSuggestion: true,
              hospitalSuggestions: true,
              suggestedHospitals: { select: { hospitalName: true, suggestedDoctor: true } },
              queries: {
                select: { updatedAt: true },
                orderBy: { updatedAt: 'desc' },
                take: 1,
              },
            },
          },
        },
      },
      insuranceInitiateForm: { select: { updatedAt: true } },
      admissionRecord: { select: { ipdStatusUpdatedAt: true, initiatedAt: true } },
      dischargeSheet: { select: { updatedAt: true } },
      plRecord: { select: { bdmName: true, updatedAt: true } },
      caseStageHistory: {
        select: { changedAt: true },
        orderBy: { changedAt: 'desc' },
        take: 1,
      },
      caseChatMessages: {
        select: { createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      ...(phoneLast10 ? { phoneNumber: true, alternateNumber: true } : {}),
    } satisfies Prisma.LeadSelect

    const fullInclude = {
      bd: {
        select: {
          id: true,
          name: true,
          email: true,
          employee: {
            select: {
              team: {
                select: {
                  id: true,
                  name: true,
                  teamLead: { select: { user: { select: { name: true } } } },
                  department: { select: { head: { select: { name: true } } } },
                },
              },
            },
          },
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
        },
      },
      kypSubmission: {
        select: {
          id: true,
          status: true,
          submittedAt: true,
          updatedAt: true,
          preAuthData: {
            select: {
              id: true,
              requestedHospitalName: true,
              requestedRoomType: true,
              bdSuggestedHospital: true,
              diseaseDescription: true,
              diseaseImages: true,
              preAuthRaisedAt: true,
              sumInsured: true,
              balanceInsured: true,
              roomRent: true,
              capping: true,
              copay: true,
              icu: true,
              insurance: true,
              tpa: true,
              hospitalNameSuggestion: true,
              hospitalSuggestions: true,
              roomTypes: true,
              handledAt: true,
              approvalStatus: true,
              rejectionReason: true,
              suggestedHospitals: true,
              updatedAt: true,
              queries: {
                select: { updatedAt: true },
                orderBy: { updatedAt: 'desc' },
                take: 1,
              },
              handledBy: {
                select: {
                  id: true,
                  name: true,
                },
              },
              preAuthRaisedBy: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
      admissionRecord: {
        select: {
          id: true,
          admissionDate: true,
          surgeryDate: true,
          admittingHospital: true,
          ipdStatus: true,
          ipdStatusUpdatedAt: true,
          initiatedAt: true,
        },
      },
      insuranceInitiateForm: {
        select: {
          id: true,
          updatedAt: true,
        },
      },
      caseStageHistory: {
        select: { changedAt: true },
        orderBy: { changedAt: 'desc' },
        take: 1,
      },
      caseChatMessages: {
        select: { createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      dischargeSheet: {
        select: {
          id: true,
          plRecordId: true,
          month: true,
          admissionDate: true,
          surgeryDate: true,
          dischargeDate: true,
          status: true,
          paymentType: true,
          approvedOrCash: true,
          managerName: true,
          managerRole: true,
          bdmName: true,
          patientName: true,
          doctorName: true,
          hospitalName: true,
          category: true,
          treatment: true,
          circle: true,
          leadSource: true,
          totalFinalBill: true,
          finalApprovedAmount: true,
          deductionAmount: true,
          waivedOffAmount: true,
          totalAmount: true,
          billAmount: true,
          cashOrDedPaid: true,
          mediendShareAmount: true,
          hospitalShareAmount: true,
          dischargeSummaryUrl: true,
          finalBillUrl: true,
          settlementLetterUrl: true,
          otNotesUrl: true,
          remarks: true,
          doctorRemarks: true,
          costBreakdownRemarks: true,
          roomRentAmount: true,
          pharmacyAmount: true,
          investigationAmount: true,
          consumablesAmount: true,
          implantsAmount: true,
          instrumentsAmount: true,
          isFinalized: true,
          markedAt: true,
          finalizedAt: true,
          updatedAt: true,
        },
      },
      plRecord: true,
    } satisfies Prisma.LeadInclude

    const maxLimit = limit ? Math.min(parseInt(limit, 10), 500) : undefined

    const leads = isPipelineView
      ? await prisma.lead.findMany({
          where: finalWhere,
          select: pipelineSelect,
          orderBy: {
            createdDate: 'desc',
          },
          ...(maxLimit ? { take: maxLimit } : {}),
        })
      : await prisma.lead.findMany({
          where: finalWhere,
          include: fullInclude,
          orderBy: {
            createdDate: 'desc',
          },
          ...(maxLimit ? { take: maxLimit } : {}),
        })

    // Filter leads based on access control
    let accessibleLeads = leads.filter((lead) =>
      canAccessLead(user, lead.bdId, subordinateUserIds)
    )

    if (phoneLast10) {
      accessibleLeads = accessibleLeads.filter((lead) => {
        const p = last10DigitsFromStored(lead.phoneNumber)
        const a = last10DigitsFromStored(lead.alternateNumber)
        return p === phoneLast10 || a === phoneLast10
      })
    }

    // Debug logging for insurance users
    if (user.role === 'INSURANCE_HEAD') {
      console.log(`[Insurance Dashboard] Total leads fetched: ${leads.length}`)
      console.log(`[Insurance Dashboard] Accessible leads: ${accessibleLeads.length}`)
      console.log(`[Insurance Dashboard] Leads with KYP: ${accessibleLeads.filter(l => l.kypSubmission).length}`)
      console.log(`[Insurance Dashboard] Leads by caseStage:`, accessibleLeads.reduce((acc, l) => {
        acc[l.caseStage] = (acc[l.caseStage] || 0) + 1
        return acc
      }, {} as Record<string, number>))
    }

    // Map status and source codes to text values for display
    // Mask phone numbers if user is not INSURANCE_HEAD or ADMIN
    const canViewPhone = user.role === 'ADMIN'
    const mappedLeads = accessibleLeads.map((lead) => {
      const base = {
        ...lead,
        status: mapStatusCode(lead.status),
        source: lead.source ? mapSourceCode(lead.source) : lead.source,
      }
      if (isPipelineView) {
        const rest = { ...base } as Record<string, unknown>
        delete rest.phoneNumber
        delete rest.alternateNumber
        return rest as typeof base
      }
      return {
        ...base,
        phoneNumber: canViewPhone ? lead.phoneNumber : (lead.phoneNumber ? maskPhoneNumber(lead.phoneNumber) : null),
      }
    })

    return successResponse(mappedLeads)
  } catch (error) {
    console.error('Error fetching leads:', error)
    return errorResponse('Failed to fetch leads', 500)
  }
}

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
    const {
      leadRef,
      patientName,
      age,
      sex,
      phoneNumber,
      alternateNumber,
      attendantName,
      bdId,
      status,
      circle,
      category,
      treatment,
      hospitalName,
      source,
      campaignName,
      remarks,
    } = body

    // Validate BD assignment
    if (user.role === 'BD' && bdId !== user.id) {
      return errorResponse('You can only assign leads to yourself', 403)
    }

    const lead = await prisma.lead.create({
      data: {
        leadRef: leadRef || `LEAD-${Date.now()}`,
        patientName,
        age: parseInt(age),
        sex,
        phoneNumber,
        alternateNumber,
        attendantName,
        bdId: bdId || user.id,
        status: status || 'Hot Lead',
        pipelineStage: 'SALES',
        circle: circle || 'Unknown',
        category,
        treatment,
        hospitalName,
        source,
        campaignName,
        remarks,
        createdById: user.id,
        updatedById: user.id,
      },
      include: {
        bd: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return successResponse(lead, 'Lead created successfully')
  } catch (error) {
    console.error('Error creating lead:', error)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return errorResponse('Lead reference already exists', 400)
    }
    return errorResponse('Failed to create lead', 500)
  }
}

