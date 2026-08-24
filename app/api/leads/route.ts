import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  getVisibleLatestLeadRemark,
  getVisibleLeadRemarksFallbackContent,
} from '@/lib/lead-remark-visibility'
import { mapStatusCode, mapSourceCode } from '@/lib/mysql-code-mappings'
import { FlowType, Prisma, PipelineStage, CaseStage } from '@/generated/prisma/client'
import { getCampaignCircleNames, getCampaignForWebhook } from '@/lib/crm-campaigns'
import { normalizeModeOfPaymentLabel } from '@/lib/mode-of-payment'
import { maskPhoneNumber } from '@/lib/phone-utils'
import { last10DigitsFromStored } from '@/lib/phone-search'
import { getLeadVisibilityScopeUserIds } from '@/lib/lead-ownership'
import {
  DUPLICATE_LEAD_STATUS,
  normalizeLeadPhoneToLast10,
  recordDuplicateLeadHitByPrimaryPhone,
} from '@/lib/lead-duplicates'
import { isLeadRefUniqueViolation, withGeneratedManualLeadRef } from '@/lib/manual-lead-ref'

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

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (user.role !== 'SUPER_ADMIN' && !hasPermission(user, 'leads:read')) {
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
    const scopedUserIds = await getLeadVisibilityScopeUserIds(user)

    if (Array.isArray(scopedUserIds)) {
      if (scopedUserIds.length === 0) {
        return successResponse([])
      }
      where.bdId = { in: scopedUserIds }
    }

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
      const stages = caseStage.split(',').map((s) => s.trim()).filter(Boolean) as CaseStage[]
      if (stages.length === 1) {
        where.caseStage = stages[0]
      } else if (stages.length > 1) {
        where.caseStage = { in: stages }
      }
    }
    if (bdId) {
      if (Array.isArray(scopedUserIds) && !scopedUserIds.includes(bdId)) {
        return successResponse([])
      }
      where.bdId = bdId
    }
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
          { admissionRecord: { is: { surgeryDate: range } } },
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

    const filtersParam = searchParams.get('filters')
    if (filtersParam) {
      try {
        const parsedFilters = JSON.parse(filtersParam)
        if (Array.isArray(parsedFilters)) {
          const filterConditions: Prisma.LeadWhereInput[] = []

          for (const f of parsedFilters) {
            const { field, value } = f
            if (!field || value === undefined || value === null) continue

            // ── multiSelect / in ─────────────────────────────────────────
            if (field === 'bdm') {
              if (Array.isArray(value) && value.length > 0) {
                filterConditions.push({
                  OR: [
                    { plRecord: { bdmName: { in: value } } },
                    { dischargeSheet: { bdmName: { in: value } } },
                    { bd: { name: { in: value } } },
                  ],
                })
              }
            } else if (field === 'leadRef') {
              if (Array.isArray(value) && value.length > 0) {
                filterConditions.push({ leadRef: { in: value } })
              }
            } else if (field === 'hospital') {
              if (Array.isArray(value) && value.length > 0) {
                filterConditions.push({
                  OR: [
                    { hospitalName: { in: value } },
                    { plRecord: { hospitalName: { in: value } } },
                    { dischargeSheet: { hospitalName: { in: value } } },
                  ],
                })
              }
            } else if (field === 'doctor') {
              if (Array.isArray(value) && value.length > 0) {
                filterConditions.push({
                  OR: [
                    { plRecord: { doctorName: { in: value } } },
                    { dischargeSheet: { doctorName: { in: value } } },
                  ],
                })
              }
            } else if (field === 'manager') {
              if (Array.isArray(value) && value.length > 0) {
                filterConditions.push({
                  OR: [
                    { plRecord: { managerName: { in: value } } },
                    { dischargeSheet: { managerName: { in: value } } },
                  ],
                })
              }
            } else if (field === 'outstandingStatus') {
              if (Array.isArray(value) && value.length > 0) {
                filterConditions.push({
                  plRecord: { outstandingStatus: { in: value } },
                })
              }
            } else if (field === 'category') {
              if (Array.isArray(value) && value.length > 0) {
                filterConditions.push({
                  OR: [
                    { category: { in: value } },
                    { plRecord: { category: { in: value } } },
                    { dischargeSheet: { category: { in: value } } },
                  ],
                })
              }
            } else if (field === 'circle') {
              if (Array.isArray(value) && value.length > 0) {
                filterConditions.push({
                  OR: [
                    { circle: { in: value } },
                    { plRecord: { circle: { in: value } } },
                    { dischargeSheet: { circle: { in: value } } },
                  ],
                })
              }
            } else if (field === 'paymentType') {
              if (Array.isArray(value) && value.length > 0) {
                filterConditions.push({
                  OR: [
                    { plRecord: { paymentType: { in: value } } },
                    { dischargeSheet: { paymentType: { in: value } } },
                  ],
                })
              }
            } else if (field === 'hospPayout') {
              if (Array.isArray(value) && value.length > 0) {
                filterConditions.push({
                  plRecord: { hospitalPayoutStatus: { in: value } },
                })
              }
            } else if (field === 'docPayout') {
              if (Array.isArray(value) && value.length > 0) {
                filterConditions.push({
                  plRecord: { doctorPayoutStatus: { in: value } },
                })
              }
            } else if (field === 'invoice') {
              if (Array.isArray(value) && value.length > 0) {
                filterConditions.push({
                  plRecord: { mediendInvoiceStatus: { in: value } },
                })
              }

            // ── search / contains or in ──────────────────────────────────
            } else if (field === 'treatment') {
              if (Array.isArray(value) && value.length > 0) {
                filterConditions.push({
                  OR: [
                    { treatment: { in: value } },
                    { plRecord: { treatment: { in: value } } },
                    { dischargeSheet: { treatment: { in: value } } },
                  ],
                })
              } else if (typeof value === 'string' && value.trim()) {
                filterConditions.push({
                  OR: [
                    { treatment: { contains: value.trim(), mode: 'insensitive' } },
                    { plRecord: { treatment: { contains: value.trim(), mode: 'insensitive' } } },
                    { dischargeSheet: { treatment: { contains: value.trim(), mode: 'insensitive' } } },
                  ],
                })
              }
            } else if (field === 'patient') {
              if (Array.isArray(value) && value.length > 0) {
                filterConditions.push({
                  OR: [
                    { patientName: { in: value } },
                    { plRecord: { patientName: { in: value } } },
                    { dischargeSheet: { patientName: { in: value } } },
                  ],
                })
              } else if (typeof value === 'string' && value.trim()) {
                filterConditions.push({
                  OR: [
                    { patientName: { contains: value.trim(), mode: 'insensitive' } },
                    { plRecord: { patientName: { contains: value.trim(), mode: 'insensitive' } } },
                    { dischargeSheet: { patientName: { contains: value.trim(), mode: 'insensitive' } } },
                  ],
                })
              }
            } else if (field === 'subStatus') {
              if (Array.isArray(value) && value.length > 0) {
                const query = value[0]
                if (typeof query === 'string' && query.trim()) {
                  filterConditions.push({
                    subStatus: { contains: query.trim(), mode: 'insensitive' },
                  })
                }
              } else if (typeof value === 'string' && value.trim()) {
                filterConditions.push({
                  subStatus: { contains: value.trim(), mode: 'insensitive' },
                })
              }

            // ── dateRange / between ──────────────────────────────────────
            } else if (field === 'date') {
              if (Array.isArray(value) && value.length === 2 && value[0]) {
                const from = new Date(value[0])
                const to = new Date(value[1] || value[0])
                to.setHours(23, 59, 59, 999)
                filterConditions.push({
                  OR: [
                    { leadEntryDate: { gte: from, lte: to } },
                    { createdDate: { gte: from, lte: to } },
                  ],
                })
              }

            // ── dateRange / between ──────────────────────────────────────
            } else if (field === 'admissionDate') {
              // value is [fromIso, toIso] from ColumnFilter dateRange
              if (Array.isArray(value) && value.length === 2 && value[0]) {
                const from = new Date(value[0])
                const to = new Date(value[1] || value[0])
                to.setHours(23, 59, 59, 999)
                filterConditions.push({
                  OR: [
                    { plRecord: { admissionDate: { gte: from, lte: to } } },
                    { admissionRecord: { is: { admissionDate: { gte: from, lte: to } } } },
                  ],
                })
              }
            } else if (field === 'surgeryDate') {
              if (Array.isArray(value) && value.length === 2 && value[0]) {
                const from = new Date(value[0])
                const to = new Date(value[1] || value[0])
                to.setHours(23, 59, 59, 999)
                filterConditions.push({
                  OR: [
                    { plRecord: { surgeryDate: { gte: from, lte: to } } },
                    { surgeryDate: { gte: from, lte: to } },
                    { admissionRecord: { is: { surgeryDate: { gte: from, lte: to } } } },
                  ],
                })
              }

            // ── numberRange / between ────────────────────────────────────
            } else if (field === 'totalBill') {
              // value is { min, max } from ColumnFilter numberRange
              const { min, max } = value as { min: number | null; max: number | null }
              const range: Prisma.FloatFilter = {}
              if (min != null) range.gte = min
              if (max != null) range.lte = max
              if (Object.keys(range).length > 0) {
                filterConditions.push({ plRecord: { billAmount: range } })
              }
            } else if (field === 'approvedAmount') {
              const { min, max } = value as { min: number | null; max: number | null }
              const range: Prisma.FloatFilter = {}
              if (min != null) range.gte = min
              if (max != null) range.lte = max
              if (Object.keys(range).length > 0) {
                filterConditions.push({ plRecord: { totalAmount: range } })
              }
            } else if (field === 'hospitalShareAmt') {
              const { min, max } = value as { min: number | null; max: number | null }
              const range: Prisma.FloatFilter = {}
              if (min != null) range.gte = min
              if (max != null) range.lte = max
              if (Object.keys(range).length > 0) {
                filterConditions.push({ plRecord: { hospitalShareAmount: range } })
              }
            } else if (field === 'doctorCharges') {
              const { min, max } = value as { min: number | null; max: number | null }
              const range: Prisma.FloatFilter = {}
              if (min != null) range.gte = min
              if (max != null) range.lte = max
              if (Object.keys(range).length > 0) {
                // doctorCharges lives on DischargeSheet (insurance) and DischargeSheet (cash)
                filterConditions.push({ dischargeSheet: { doctorCharges: range } })
              }
            } else if (field === 'netProfit') {
              const { min, max } = value as { min: number | null; max: number | null }
              const range: Prisma.FloatFilter = {}
              if (min != null) range.gte = min
              if (max != null) range.lte = max
              if (Object.keys(range).length > 0) {
                filterConditions.push({
                  OR: [
                    { plRecord: { finalProfit: range } },
                    { plRecord: { mediendNetProfit: range } },
                  ],
                })
              }
            }
          }

          if (filterConditions.length > 0) {
            finalWhere = {
              AND: [finalWhere, ...filterConditions],
            }
          }
        }
      } catch (err) {
        console.error('Error parsing filters query param:', err)
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
      subStatus: true,
      caseStage: true,
      pipelineStage: true,
      bdId: true,
      circle: true,
      campaignName: true,
      leadEntryDate: true,
      assignedDate: true,
      createdDate: true,
      updatedDate: true,
      removeRemarks: true,
      remarksClearedAt: true,
      hospitalName: true,
      remarks: true,
      leadRemarkEntries: {
        select: {
          id: true,
          content: true,
          createdAt: true,
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      ipdDrName: true,
      surgeonName: true,
      source: true,
      netProfit: true,
      surgeryDate: true,
      opdScheduleDate: true,
      flowType: true,
      atsAmount: true,
      atsStatus: true,
      bd: {
        select: {
          id: true,
          name: true,
          employee: { select: { team: { select: { id: true } } } },
        },
      },
      phoneNumber: true,
      insuranceName: true,
      tpa: true,
      kypSubmission: {
        select: {
          id: true,
          status: true,
          updatedAt: true,
          submittedAt: true,
          insuranceType: true,
          location: true,
          preAuthData: {
            select: {
              updatedAt: true,
              requestedHospitalName: true,
              hospitalNameSuggestion: true,
              hospitalSuggestions: true,
              insurance: true,
              tpa: true,
            },
          },
        },
      },
      ipdPotentialDate: true,
      ipdPotentialMarkedAt: true,
      insuranceInitiateForm: { select: { updatedAt: true } },
      admissionRecord: { select: { ipdStatus: true, ipdStatusReason: true, ipdStatusUpdatedAt: true, initiatedAt: true, surgeryDate: true } },
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
          role: true,
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
              manager: {
                select: {
                  user: { select: { id: true, name: true } },
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
          finalApprovedUrl: true,
          deductionReceiptUrl: true,
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

    const maxLimit = limit ? Math.min(parseInt(limit, 10), 500) : (isPipelineView ? 50000 : 8000)

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

    let accessibleLeads: any[] = leads

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
      const latestRemark = isPipelineView
        ? getVisibleLatestLeadRemark(lead, lead.leadRemarkEntries, user.role) ?? null
        : undefined
      const base = {
        ...lead,
        latestRemark,
        remarks: isPipelineView ? getVisibleLeadRemarksFallbackContent(lead, lead.remarks, user.role) : lead.remarks,
        status: mapStatusCode(lead.status),
        source: lead.source ? mapSourceCode(lead.source) : lead.source,
        modeOfPayment: normalizeModeOfPaymentLabel(lead.modeOfPayment),
      }
      delete (base as Record<string, unknown>).leadRemarkEntries
      if (isPipelineView) {
        const rest = { ...base } as Record<string, unknown>
        delete rest.phoneNumber
        delete rest.alternateNumber
        return rest as typeof base
      }
      return {
        ...base,
        phoneNumber: canViewPhone ? lead.phoneNumber : (lead.phoneNumber ? maskPhoneNumber(lead.phoneNumber) : null),
        alternateNumber: canViewPhone ? lead.alternateNumber : (lead.alternateNumber ? maskPhoneNumber(lead.alternateNumber) : null),
      }
    })

    return successResponse(mappedLeads, undefined, 'lead')
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
      treatmentMasterId,
      hospitalName,
      source,
      campaignId,
      campaignName,
      remarks,
    } = body

    // Validate BD assignment
    if (user.role === 'BD' && bdId !== user.id) {
      return errorResponse('You can only assign leads to yourself', 403)
    }

    const normalizedPhone = normalizeLeadPhoneToLast10(phoneNumber)
    if (!normalizedPhone) {
      return errorResponse('Phone number must contain at least 10 digits', 400)
    }

    const duplicateLead = await recordDuplicateLeadHitByPrimaryPhone(normalizedPhone)
    const normalizedCampaignId = normalizeOptionalLeadText(campaignId)
    const campaign = normalizedCampaignId
      ? await getCampaignForWebhook(normalizedCampaignId)
      : null
    const campaignCircles = getCampaignCircleNames(campaign)

    const explicitCircle = normalizeOptionalLeadText(circle)
    const explicitCategory = normalizeOptionalLeadText(category)
    const explicitTreatment = normalizeOptionalLeadText(treatment)
    const explicitTreatmentMasterId = normalizeOptionalLeadText(treatmentMasterId)

    const finalCircle =
      explicitCircle ??
      (campaign ? (campaignCircles.length === 1 ? campaignCircles[0] : '') : 'Unknown')
    const finalCategory = explicitCategory ?? campaign?.category ?? null
    const finalTreatment = explicitTreatment ?? campaign?.treatment ?? null
    const finalTreatmentMasterId =
      explicitTreatmentMasterId ??
      (finalTreatment && campaign?.treatment && finalTreatment === campaign.treatment
        ? campaign.treatmentMasterId ?? null
        : null)
    const finalSource = campaign
      ? normalizeOptionalLeadText(campaign.source?.name) ?? normalizeOptionalLeadText(source)
      : normalizeOptionalLeadText(source)
    const finalCampaignName = campaign
      ? normalizeOptionalLeadText(campaign.leadSource?.name) ??
        normalizeOptionalLeadText(campaign.displayName) ??
        normalizeOptionalLeadText(campaignName)
      : normalizeOptionalLeadText(campaignName)

    const effectiveStatus = duplicateLead ? DUPLICATE_LEAD_STATUS : (status || 'Hot Lead')

    const buildLeadData = (resolvedLeadRef: string) => ({
      leadRef: resolvedLeadRef,
      patientName,
      age: parseInt(age),
      sex,
      phoneNumber,
      alternateNumber,
      attendantName,
      bdId: bdId || user.id,
      status: effectiveStatus,
      pipelineStage: PipelineStage.SALES,
      circle: finalCircle,
      category: finalCategory,
      treatment: finalTreatment,
      treatmentMasterId: finalTreatmentMasterId,
      hospitalName,
      source: finalSource,
      campaignId: normalizedCampaignId,
      campaignName: finalCampaignName,
      remarks,
      duplCount: 0,
      createdById: user.id,
      updatedById: user.id,
    });

    const lead = leadRef
      ? await prisma.lead.create({
          data: buildLeadData(leadRef),
          include: {
            bd: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        })
      : await withGeneratedManualLeadRef((generatedLeadRef) =>
          prisma.lead.create({
            data: buildLeadData(generatedLeadRef),
            include: {
              bd: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          })
        );

    return successResponse(
      lead,
      duplicateLead ? 'Duplicate lead created successfully' : 'Lead created successfully',
      'lead'
    )
  } catch (error) {
    console.error('Error creating lead:', error)
    if (isLeadRefUniqueViolation(error)) {
      return errorResponse('Lead reference already exists', 400)
    }
    return errorResponse('Failed to create lead', 500)
  }
}
