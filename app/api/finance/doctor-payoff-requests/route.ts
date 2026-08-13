import { NextRequest } from 'next/server'
import { z } from 'zod'
import { DoctorPayoffRequestStatus, Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasEffectivePlOrFinanceRead, hasEffectivePlOrFinanceWrite } from '@/lib/rbac-new'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  doctorPayoffInclude,
  logDoctorPayoffActivity,
  mapDoctorPayoffRequest,
} from '@/lib/finance/doctor-payoff/mapper'

const createSchema = z.object({
  doctorName: z.string().min(1).max(500),
  hospitalName: z.string().max(500).optional().nullable(),
  leadId: z.string().min(1).optional().nullable(),
  leadIds: z.array(z.string().min(1)).optional(),
  requestAmount: z.number().positive(),
  requestRemarks: z.string().max(10000).optional().nullable(),
  attachments: z
    .array(
      z.object({
        name: z.string().min(1),
        url: z.string().min(1),
        type: z.string().optional(),
      })
    )
    .optional(),
})

const statusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'ALL']).optional()

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!(await hasEffectivePlOrFinanceRead(user))) return errorResponse('Forbidden', 403)

    const { searchParams } = new URL(request.url)
    const statusParam = searchParams.get('status') ?? 'PENDING'
    const search = searchParams.get('search')?.trim()
    const doctorName = searchParams.get('doctorName')?.trim()
    const latestPerLead = searchParams.get('latestPerLead') === 'true'
    const parsedStatus = statusSchema.safeParse(statusParam)

    if (!parsedStatus.success) {
      return errorResponse('Invalid status filter', 400)
    }

    const where: Prisma.DoctorPayoffRequestWhereInput = {}
    if (parsedStatus.data && parsedStatus.data !== 'ALL') {
      where.status = parsedStatus.data as DoctorPayoffRequestStatus
    }
    if (doctorName) where.doctorName = doctorName
    if (search) {
      where.OR = [
        { doctorName: { contains: search, mode: 'insensitive' } },
        { hospitalName: { contains: search, mode: 'insensitive' } },
        { requestRemarks: { contains: search, mode: 'insensitive' } },
        { lead: { leadRef: { contains: search, mode: 'insensitive' } } },
        { lead: { patientName: { contains: search, mode: 'insensitive' } } },
      ]
    }

    // Finance module sees all; PL callers on doctor page may filter by doctorName
    if (!(await hasEffectivePlOrFinanceRead(user)) && !doctorName) {
      where.requestedById = user.id
    }

    const requests = await prisma.doctorPayoffRequest.findMany({
      where,
      include: doctorPayoffInclude,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    })

    let mapped = requests.map(mapDoctorPayoffRequest)

    if (latestPerLead) {
      const byLead = new Map<string, (typeof mapped)[number]>()
      for (const req of mapped) {
        const ids = req.leadIds.length ? req.leadIds : req.leadId ? [req.leadId] : []
        for (const leadId of ids) {
          if (!byLead.has(leadId)) {
            byLead.set(leadId, { ...req, leadId })
          }
        }
      }
      mapped = Array.from(byLead.values())
    }

    return successResponse({
      requests: mapped,
      total: mapped.length,
    })
  } catch (error) {
    console.error('Error fetching doctor payoff requests:', error)
    return errorResponse('Failed to fetch doctor payoff requests', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    // Creating a payoff request is a PL outstanding action; Finance only uploads/approves
    if (!(await hasEffectivePlOrFinanceWrite(user))) {
      return errorResponse('Forbidden', 403)
    }

    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message ?? 'Invalid request body', 400)
    }

    const leadIds = Array.from(
      new Set(
        [
          ...(parsed.data.leadIds ?? []),
          ...(parsed.data.leadId ? [parsed.data.leadId] : []),
        ].filter(Boolean)
      )
    )

    let hospitalName = parsed.data.hospitalName?.trim() || null
    let primaryLeadId = parsed.data.leadId ?? leadIds[0] ?? null

    if (primaryLeadId) {
      const lead = await prisma.lead.findUnique({
        where: { id: primaryLeadId },
        select: { id: true, hospitalName: true },
      })
      if (!lead) return errorResponse('Lead not found', 404)
      if (!hospitalName) hospitalName = lead.hospitalName ?? null
    }

    const created = await prisma.doctorPayoffRequest.create({
      data: {
        doctorName: parsed.data.doctorName.trim(),
        hospitalName,
        leadId: primaryLeadId,
        leadIds: leadIds.length ? leadIds : Prisma.JsonNull,
        requestAmount: parsed.data.requestAmount,
        requestRemarks: parsed.data.requestRemarks?.trim() || null,
        attachments: parsed.data.attachments?.length
          ? parsed.data.attachments
          : Prisma.JsonNull,
        requestedById: user.id,
      },
      include: doctorPayoffInclude,
    })

    await logDoctorPayoffActivity(prisma, {
      requestId: created.id,
      action: 'SUBMITTED',
      message: `Doctor payoff request submitted for ${created.doctorName} (${created.requestAmount.toLocaleString('en-IN')})`,
      remarks: created.requestRemarks,
      actorId: user.id,
    })

    return successResponse(mapDoctorPayoffRequest(created), 'Doctor payoff request submitted')
  } catch (error) {
    console.error('Error creating doctor payoff request:', error)
    return errorResponse('Failed to create doctor payoff request', 500)
  }
}
