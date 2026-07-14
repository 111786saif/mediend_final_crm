import type { Prisma } from '@/generated/prisma/client'
import type {
  DoctorPayoffAttachment,
  DoctorPayoffRequestRecord,
  DoctorPayoffRequestStatus,
} from '@/lib/finance/doctor-payoff/types'

export const doctorPayoffInclude = {
  requestedBy: { select: { id: true, name: true, email: true } },
  reviewedBy: { select: { id: true, name: true, email: true } },
  lead: { select: { id: true, leadRef: true, patientName: true, hospitalName: true } },
} satisfies Prisma.DoctorPayoffRequestInclude

type DoctorPayoffWithRelations = Prisma.DoctorPayoffRequestGetPayload<{
  include: typeof doctorPayoffInclude
}>

function parseLeadIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string' && v.length > 0)
}

function parseAttachments(value: unknown): DoctorPayoffAttachment[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      if (typeof row.name !== 'string' || typeof row.url !== 'string') return null
      return {
        name: row.name,
        url: row.url,
        type: typeof row.type === 'string' ? row.type : undefined,
      }
    })
    .filter((v): v is DoctorPayoffAttachment => !!v)
}

export function mapDoctorPayoffRequest(row: DoctorPayoffWithRelations): DoctorPayoffRequestRecord {
  const leadIds = parseLeadIds(row.leadIds)
  return {
    id: row.id,
    doctorName: row.doctorName,
    hospitalName: row.hospitalName ?? row.lead?.hospitalName ?? null,
    leadId: row.leadId,
    leadIds: leadIds.length ? leadIds : row.leadId ? [row.leadId] : [],
    requestAmount: row.requestAmount,
    requestRemarks: row.requestRemarks,
    financeRemarks: row.financeRemarks,
    rejectionRemarks: row.rejectionRemarks,
    attachments: parseAttachments(row.attachments),
    verificationDocUrl: row.verificationDocUrl ?? null,
    verificationDocName: row.verificationDocName ?? null,
    status: row.status as DoctorPayoffRequestStatus,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    requestedBy: row.requestedBy,
    reviewedBy: row.reviewedBy,
    leadRef: row.lead?.leadRef ?? null,
    patientName: row.lead?.patientName ?? null,
  }
}

export async function logDoctorPayoffActivity(
  prisma: {
    doctorPayoffRequestActivity: {
      create: (args: {
        data: {
          requestId: string
          action: string
          message: string
          remarks?: string | null
          actorId: string
        }
      }) => Promise<unknown>
    }
  },
  data: {
    requestId: string
    action: string
    message: string
    remarks?: string | null
    actorId: string
  }
) {
  await prisma.doctorPayoffRequestActivity.create({
    data: {
      requestId: data.requestId,
      action: data.action,
      message: data.message,
      remarks: data.remarks ?? null,
      actorId: data.actorId,
    },
  })
}
