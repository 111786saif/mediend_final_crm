export type InstallmentVerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED'
export type InstallmentRecipient = 'HOSPITAL' | 'DOCTOR' | 'MEDIEND'
export type InstallmentMode = 'CASH' | 'UPI' | 'NEFT' | 'RTGS' | 'CHEQUE' | 'CARD' | 'OTHER'

export const INSTALLMENT_VERIFICATION_LABEL: Record<InstallmentVerificationStatus, string> = {
  PENDING: 'Pending',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
}

export interface FinancePaymentInstallmentRecord {
  id: string
  leadId: string
  recipient: InstallmentRecipient
  amount: number
  paidOn: string
  mode: InstallmentMode | null
  reference: string | null
  notes: string | null
  verificationStatus: InstallmentVerificationStatus
  verifiedAt: string | null
  rejectionRemarks: string | null
  createdAt: string
  lead: {
    id: string
    leadRef: string | null
    patientName: string | null
    hospitalName: string | null
  }
  recordedBy: { id: string; name: string }
  verifiedBy: { id: string; name: string } | null
}
