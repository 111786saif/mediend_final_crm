'use client'

export type DoctorAdminMasterType =
  | 'implants'
  | 'surgery-remarks'
  | 'reason-no-surgery'
  | 'follow-up-reasons'

export interface DoctorAdminMasterRecord {
  id: string
  code?: string | null
  name?: string | null
  label?: string | null
  category?: string | null
  manufacturer?: string | null
  unitCost?: number | null
  description?: string | null
  usageCount?: number
  displayOrder?: number
  isActive: boolean
  createdAt: string | Date
  updatedAt: string | Date
}

export interface DoctorAdminDoctor {
  id: string
  name: string
  category: string | null
  treatment: string | null
  isActive: boolean
}

export interface DoctorAdminLeaveItem {
  id: string
  doctor: {
    id: string
    name: string
    category: string | null
  }
  startDate: string | Date
  endDate: string | Date
  reason: string | null
  status: string
  reviewedBy?: {
    id: string
    name: string
    email: string
  } | null
  reviewedAt?: string | Date | null
  reviewNotes?: string | null
  createdAt: string | Date
  updatedAt: string | Date
}

export interface DoctorAdminCabItem {
  id: string
  doctor: {
    id: string
    name: string
    category: string | null
  }
  pickup: string
  drop: string
  pickupLat?: number | null
  pickupLng?: number | null
  dropLat?: number | null
  dropLng?: number | null
  scheduledFor: string | Date
  status: string
  reviewNotes?: string | null
  vendorName?: string | null
  vendorPhone?: string | null
  createdAt: string | Date
  updatedAt: string | Date
}

export interface DoctorAdminMonitoringItem {
  id: string
  leadRef: string
  patientName: string
  phoneNumber: string
  whatsapp?: string | null
  appointmentType: 'opd' | 'ipd'
  doctorName: string
  hospitalName: string
  category?: string | null
  treatment?: string | null
  appointmentDate?: string | Date | null
  statusKey: string
  statusLabel: string
  followUpDate?: string | Date | null
  surgeryDate?: string | Date | null
  admissionDate?: string | Date | null
}

export interface DoctorAdminPipelineCard {
  id: string
  leadRef: string
  patientName: string
  doctorName: string
  hospitalName: string
  date?: string | Date | null
  paymentType?: string | null
  followUpDate?: string | Date | null
  status?: string | null
  remarks?: string | null
  tag?: string | null
  daysSinceAdvised?: number | null
}

export interface DoctorAdminIpdItem {
  id: string
  leadRef: string
  patientName: string
  doctorName: string
  hospitalName: string
  admissionDate?: string | Date | null
  otDate?: string | Date | null
  coordinatorName?: string | null
  teamMemberName?: string | null
  implant?: string | null
  status: 'active' | 'discharge_queue' | 'completed' | 'no_show' | 'cancelled'
  statusReason?: string | null
  dischargeDate?: string | Date | null
}
