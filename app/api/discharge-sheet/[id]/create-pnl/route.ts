import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { LEAD_HYDRATE_INCLUDE, buildPlRecordPayload } from '@/lib/pl/hydrate-pl-record'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    // Only PL team or Insurance team can create PNL from discharge sheet
    if (user.role !== 'PL_HEAD' && user.role !== 'INSURANCE_HEAD' && user.role !== 'ADMIN') {
      return errorResponse('Forbidden: Only PL or Insurance team can create PNL records', 403)
    }

    const { id } = await params

    // Find discharge sheet (+ lead with full hydrate include)
    const dischargeSheet = await prisma.dischargeSheet.findUnique({
      where: { id },
      include: {
        lead: { include: LEAD_HYDRATE_INCLUDE },
      },
    })

    if (!dischargeSheet) {
      return errorResponse('Discharge sheet not found', 404)
    }

    // Check if PNL record already exists
    const existingPL = await prisma.pLRecord.findUnique({
      where: { leadId: dischargeSheet.leadId },
    })

    if (existingPL) {
      return errorResponse('PNL record already exists for this lead', 400)
    }

    // Create PNL record from discharge sheet + lead data
    const plRecord = await prisma.pLRecord.create({
      data: buildPlRecordPayload({
        lead: dischargeSheet.lead,
        dischargeSheet,
        userId: user.id,
      }),
      include: {
        lead: {
          select: {
            id: true,
            leadRef: true,
            patientName: true,
          },
        },
        handledBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    // Link discharge sheet to PNL record
    await prisma.dischargeSheet.update({
      where: { id },
      data: {
        plRecord: {
          connect: { id: plRecord.id },
        },
      },
    })

    // Update lead pipeline stage to PL
    await prisma.lead.update({
      where: { id: dischargeSheet.leadId },
      data: {
        pipelineStage: 'PL',
      },
    })

    return successResponse(plRecord, 'PNL record created successfully from discharge sheet')
  } catch (error) {
    console.error('Error creating PNL from discharge sheet:', error)
    return errorResponse('Failed to create PNL record', 500)
  }
}
