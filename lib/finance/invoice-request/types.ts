export type InvoiceRequestStatus = 'PENDING' | 'VERIFIED' | 'REJECTED'

export const INVOICE_REQUEST_STATUS_LABEL: Record<InvoiceRequestStatus, string> = {
  PENDING: 'Pending',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
}

export interface InvoiceRequestLeadSummary {
  id: string
  leadRef: string
  patientName: string
  hospitalName: string
  treatment: string | null
  surgeryDate: string | null
}

export interface InvoiceRequestUserSummary {
  id: string
  name: string
  email: string
}

export interface InvoiceRequestRecord {
  id: string
  leadId: string
  status: InvoiceRequestStatus
  requestRemarks: string | null
  invoiceNumber: string | null
  invoiceAmount: number | null
  invoicePdfUrl: string | null
  invoicePdfName: string | null
  financeRemarks: string | null
  rejectionRemarks: string | null
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
  lead: InvoiceRequestLeadSummary
  requestedBy: InvoiceRequestUserSummary
  reviewedBy: InvoiceRequestUserSummary | null
}

export interface InvoiceRequestListResponse {
  requests: InvoiceRequestRecord[]
  total: number
}
