import { Prisma } from '@/generated/prisma/client'

export const leadOpdAppointmentSelect = {
  id: true,
  leadId: true,
  phase: true,
  slot: true,
  status: true,
  hospitalName: true,
  doctorName: true,
  contactNumber: true,
  charges: true,
  scheduleDate: true,
  meetingType: true,
  surgeryAdvised: true,
  surgeryRemarkCode: true,
  reasonNoSurgeryCode: true,
  followUpReasonCode: true,
  implantRequired: true,
  diagnosis: true,
  remarks: true,
  createdById: true,
  updatedById: true,
  createdAt: true,
  updatedAt: true,
  surgeryRemark: {
    select: {
      code: true,
      label: true,
    },
  },
  reasonNoSurgery: {
    select: {
      code: true,
      label: true,
    },
  },
  followUpReason: {
    select: {
      code: true,
      label: true,
    },
  },
  prescriptionImages: {
    orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
    select: {
      id: true,
      fileName: true,
      fileUrl: true,
      storageKey: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.LeadOpdAppointmentSelect

export type LeadOpdAppointmentRecord = Prisma.LeadOpdAppointmentGetPayload<{
  select: typeof leadOpdAppointmentSelect
}>

