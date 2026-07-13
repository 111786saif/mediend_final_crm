export type DoctorPayoffRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export const DOCTOR_PAYOFF_STATUS_LABEL: Record<DoctorPayoffRequestStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
}

export interface DoctorPayoffAttachment {
  name: string
  url: string
  type?: string
}

export interface DoctorPayoffUserSummary {
  id: string
  name: string
  email: string
}

export interface DoctorPayoffRequestRecord {
  id: string
  doctorName: string
  hospitalName: string | null
  leadId: string | null
  leadIds: string[]
  requestAmount: number
  requestRemarks: string | null
  financeRemarks: string | null
  rejectionRemarks: string | null
  attachments: DoctorPayoffAttachment[]
  verificationDocUrl: string | null
  verificationDocName: string | null
  status: DoctorPayoffRequestStatus
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
  requestedBy: DoctorPayoffUserSummary
  reviewedBy: DoctorPayoffUserSummary | null
  leadRef: string | null
  patientName: string | null
}

export interface DoctorPayoffListResponse {
  requests: DoctorPayoffRequestRecord[]
  total: number
}

export interface RequestActivityItem {
  id: string
  requestId: string
  action: string
  message: string
  remarks: string | null
  createdAt: string
  actor: DoctorPayoffUserSummary
  meta?: {
    doctorName?: string | null
    hospitalName?: string | null
    amount?: number | null
    status?: string | null
  }
}
