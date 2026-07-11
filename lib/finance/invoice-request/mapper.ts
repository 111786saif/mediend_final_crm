import type { InvoiceRequest, Lead, User } from '@/generated/prisma/client'
import type { InvoiceRequestRecord } from '@/lib/finance/invoice-request/types'

export const invoiceRequestInclude = {
  lead: {
    select: {
      id: true,
      leadRef: true,
      patientName: true,
      hospitalName: true,
      treatment: true,
      surgeryDate: true,
    },
  },
  requestedBy: {
    select: { id: true, name: true, email: true },
  },
  reviewedBy: {
    select: { id: true, name: true, email: true },
  },
} as const

type InvoiceRequestWithRelations = InvoiceRequest & {
  lead: Pick<Lead, 'id' | 'leadRef' | 'patientName' | 'hospitalName' | 'treatment' | 'surgeryDate'>
  requestedBy: Pick<User, 'id' | 'name' | 'email'>
  reviewedBy: Pick<User, 'id' | 'name' | 'email'> | null
}

export function mapInvoiceRequest(record: InvoiceRequestWithRelations): InvoiceRequestRecord {
  return {
    id: record.id,
    leadId: record.leadId,
    status: record.status,
    requestRemarks: record.requestRemarks,
    invoiceNumber: record.invoiceNumber,
    invoiceAmount: record.invoiceAmount,
    invoicePdfUrl: record.invoicePdfUrl,
    invoicePdfName: record.invoicePdfName,
    financeRemarks: record.financeRemarks,
    rejectionRemarks: record.rejectionRemarks,
    reviewedAt: record.reviewedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    lead: {
      id: record.lead.id,
      leadRef: record.lead.leadRef,
      patientName: record.lead.patientName,
      hospitalName: record.lead.hospitalName,
      treatment: record.lead.treatment,
      surgeryDate: record.lead.surgeryDate?.toISOString() ?? null,
    },
    requestedBy: record.requestedBy,
    reviewedBy: record.reviewedBy,
  }
}
