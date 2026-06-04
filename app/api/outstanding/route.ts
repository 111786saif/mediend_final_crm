import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { Prisma } from '@/generated/prisma/client'

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (!hasPermission(user, 'pl:read')) {
      return errorResponse('Forbidden', 403)
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const where: Prisma.LeadWhereInput = {
      pipelineStage: { in: ['PL', 'COMPLETED'] },
    }

    if (startDate || endDate) {
      const dischargeRange: Prisma.DateTimeFilter = {}
      if (startDate) dischargeRange.gte = new Date(startDate)
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        dischargeRange.lte = end
      }
      where.dischargeSheet = { dischargeDate: dischargeRange }
    } else {
      where.dischargeSheet = { isNot: null }
    }

    const leads = await prisma.lead.findMany({
      where,
      include: {
        bd: {
          select: {
            name: true,
            employee: {
              select: {
                team: {
                  select: {
                    id: true,
                    teamLead: { select: { user: { select: { name: true } } } },
                    department: { select: { head: { select: { name: true } } } },
                  },
                },
              },
            },
          },
        },
        admissionRecord: {
          select: {
            admissionDate: true,
            surgeryDate: true,
          },
        },
        dischargeSheet: {
          select: {
            id: true,
            month: true,
            admissionDate: true,
            surgeryDate: true,
            dischargeDate: true,
            status: true,
            paymentType: true,
            approvedOrCash: true,
            managerName: true,
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
            doctorRemarks: true,
            costBreakdownRemarks: true,
            dischargeSummaryUrl: true,
            finalBillUrl: true,
            settlementLetterUrl: true,
            otNotesUrl: true,
            isFinalized: true,
            markedAt: true,
            finalizedAt: true,
            remarks: true,
            roomRentAmount: true,
            pharmacyAmount: true,
            investigationAmount: true,
            consumablesAmount: true,
            implantsAmount: true,
            instrumentsAmount: true,
          },
        },
        plRecord: {
          select: {
            hospitalPayoutStatus: true,
            doctorPayoutStatus: true,
            mediendInvoiceStatus: true,
            hospitalAmountPending: true,
            doctorAmountPending: true,
            month: true,
            admissionDate: true,
            surgeryDate: true,
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
            billAmount: true,
            totalAmount: true,
            cashOrDedPaid: true,
            finalProfit: true,
            mediendNetProfit: true,
            mediendShareAmount: true,
            hospitalShareAmount: true,
            doctorCharges: true,
            doctorRemarks: true,
            costBreakdownRemarks: true,
          },
        },
        kypSubmission: {
          select: {
            preAuthData: {
              select: {
                requestedHospitalName: true,
                suggestedHospitals: {
                  select: {
                    hospitalName: true,
                    suggestedDoctor: true,
                  },
                },
              },
            },
          },
        },
        outstandingCase: {
          select: {
            paymentReceived: true,
            remark2: true,
          },
        },
      },
      orderBy: {
        createdDate: 'desc',
      },
      take: 1000,
    })

    const mapped = leads.map((lead) => {
      const bd = lead.bd
        ? {
            name: lead.bd.name,
            team: lead.bd.employee?.team ?? null,
          }
        : lead.bd
      return { ...lead, bd }
    })

    return successResponse(mapped)
  } catch (error) {
    console.error('Error fetching outstanding records:', error)
    return errorResponse('Failed to fetch outstanding records', 500)
  }
}
