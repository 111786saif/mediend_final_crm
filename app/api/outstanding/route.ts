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
      // Only show leads that have discharge sheets
      dischargeSheet: { isNot: null },
      // Only show PL or COMPLETED pipeline stages
      pipelineStage: { in: ['PL', 'COMPLETED'] },
    }

    if (startDate || endDate) {
      where.createdDate = {}
      if (startDate) where.createdDate.gte = new Date(startDate)
      if (endDate) where.createdDate.lte = new Date(endDate)
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
            totalAmount: true,
            billAmount: true,
            cashOrDedPaid: true,
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
