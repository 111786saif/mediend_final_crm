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

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const leadId = searchParams.get('leadId')

    const where: Prisma.KYPSubmissionWhereInput = {}

    // Filter by role
    if (user.role === 'BD' || user.role === 'TEAM_LEAD' || user.role === 'SALES_HEAD' || user.role === 'TESTER') {
      // Sales team sees their own submissions OR submissions for their leads
      delete where.submittedById; // Remove the strict check
      where.OR = [
        { submittedById: user.id },
        { lead: { bdId: user.id } }
      ];
      
      // If status is provided, use it (for follow-up view)
      if (status) {
        where.status = status as any
      }
    } else if (user.role === 'INSURANCE_HEAD') {
      // Insurance sees: PENDING (add details), KYP_DETAILS_ADDED, PRE_AUTH_COMPLETE, follow-up states
      if (status) {
        where.status = status as any
      } else {
        where.status = {
          in: ['PENDING', 'KYP_DETAILS_ADDED', 'PRE_AUTH_COMPLETE', 'FOLLOW_UP_COMPLETE', 'COMPLETED'],
        }
      }
    } else if (user.role !== 'ADMIN') {
      return errorResponse('Forbidden', 403)
    }

    // Admin can filter by status if provided
    if (user.role === 'ADMIN' && status) {
      where.status = status as any
    }

    if (leadId) {
      where.leadId = leadId
    }

    const kypSubmissions = await (prisma as any).kYPSubmission.findMany({
      where,
      include: {
        lead: {
          select: {
            id: true,
            leadRef: true,
            patientName: true,
            phoneNumber: true,
            circle: true,
            hospitalName: true,
            caseStage: true,
            surgeonName: true,
            ipdDrName: true,
            insuranceName: true,
            bd: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        submittedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        submittedAt: 'desc',
      },
    })

    // Fetch preAuthData separately to identify which relation is causing the error
    const submissionsWithPreAuth = await Promise.all(kypSubmissions.map(async (kyp: any) => {
      try {
        const preAuthData = await (prisma as any).preAuthorization.findUnique({
          where: { kypSubmissionId: kyp.id },
          include: {
            suggestedHospitals: true,
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
        });
        return { ...kyp, preAuthData };
      } catch (e) {
        console.error(`Error fetching preAuthData for KYP ${kyp.id}:`, e);
        return kyp;
      }
    }));

    return successResponse(submissionsWithPreAuth)
  } catch (error) {
    console.error('Error fetching KYP submissions:', error)
    return errorResponse('Failed to fetch KYP submissions', 500)
  }
}
