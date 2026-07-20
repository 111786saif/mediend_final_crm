import { Prisma } from '@/generated/prisma/client'
import { DoctorAppSessionUser } from '@/lib/doctor-app/auth'
import {
  getDoctorAppContext,
  getDoctorScopedLeadWhere,
} from '@/lib/doctor-app/context'
import { prisma } from '@/lib/prisma'

const patientHistoryLeadSelect = {
  id: true,
  leadRef: true,
  patientName: true,
  age: true,
  sex: true,
  phoneNumber: true,
  alternateNumber: true,
  whatsapp: true,
  circle: true,
  category: true,
  treatment: true,
  hospitalName: true,
  status: true,
  caseStage: true,
  flowType: true,
  remarks: true,
  createdDate: true,
  updatedDate: true,
  followUpDate: true,
  opdScheduleDate: true,
  surgeryDate: true,
  callNotes: {
    orderBy: { createdAt: 'desc' as const },
    select: {
      id: true,
      content: true,
      createdAt: true,
      createdBy: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
  caseStageHistory: {
    orderBy: { changedAt: 'desc' as const },
    select: {
      id: true,
      fromStage: true,
      toStage: true,
      note: true,
      changedAt: true,
      changedBy: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
  admissionRecord: {
    select: {
      id: true,
      admissionDate: true,
      admissionTime: true,
      admittingHospital: true,
      surgeryDate: true,
      surgeryTime: true,
      ipdStatus: true,
      ipdStatusReason: true,
      ipdDischargeDate: true,
      ipdStatusNotes: true,
      initiatedAt: true,
      notes: true,
    },
  },
  kypSubmission: {
    select: {
      id: true,
      status: true,
      remark: true,
      submittedAt: true,
      preAuthData: {
        select: {
          id: true,
          requestedHospitalName: true,
          preAuthRaisedAt: true,
          expectedAdmissionDate: true,
          expectedSurgeryDate: true,
          notes: true,
        },
      },
    },
  },
  dischargeSheet: {
    select: {
      id: true,
      dischargeDate: true,
      status: true,
      doctorRemarks: true,
      markedAt: true,
      finalizedAt: true,
      isFinalized: true,
      createdAt: true,
    },
  },
  plRecord: {
    select: {
      id: true,
      outstandingStatus: true,
      doctorAmountPending: true,
      hospitalAmountPending: true,
      closedAt: true,
      createdAt: true,
      remarks: true,
    },
  },
} satisfies Prisma.LeadSelect

type PatientHistoryLead = Prisma.LeadGetPayload<{
  select: typeof patientHistoryLeadSelect
}>

type PatientHistoryItem = {
  id: string
  type: string
  title: string
  description: string | null
  date: Date
  meta: Record<string, unknown>
}

export class DoctorAppPatientError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'DoctorAppPatientError'
    this.status = status
  }
}

function mapTimeline(lead: PatientHistoryLead) {
  const items: PatientHistoryItem[] = [
    {
      id: `lead:${lead.id}`,
      type: 'lead_created',
      title: 'Lead created',
      description: lead.remarks || `Patient ${lead.patientName} was added to CRM`,
      date: lead.createdDate,
      meta: {
        status: lead.status,
        caseStage: lead.caseStage,
        flowType: lead.flowType,
      },
    },
    ...lead.callNotes.map(note => ({
      id: `call-note:${note.id}`,
      type: 'call_note',
      title: 'Call note',
      description: note.content,
      date: note.createdAt,
      meta: {
        createdBy: note.createdBy?.name || null,
      },
    })),
    ...lead.caseStageHistory.map(event => ({
      id: `stage:${event.id}`,
      type: 'case_stage',
      title: 'Case stage changed',
      description: event.note || `${event.fromStage || 'UNKNOWN'} -> ${event.toStage}`,
      date: event.changedAt,
      meta: {
        fromStage: event.fromStage,
        toStage: event.toStage,
        changedBy: event.changedBy?.name || null,
      },
    })),
  ]

  if (lead.kypSubmission) {
    items.push({
      id: `kyp:${lead.kypSubmission.id}`,
      type: 'kyp',
      title: 'KYP submitted',
      description: lead.kypSubmission.remark || `KYP status: ${lead.kypSubmission.status}`,
      date: lead.kypSubmission.submittedAt,
      meta: {
        status: lead.kypSubmission.status,
      },
    })

    if (lead.kypSubmission.preAuthData?.preAuthRaisedAt) {
      items.push({
        id: `preauth:${lead.kypSubmission.preAuthData.id}`,
        type: 'preauth',
        title: 'Pre-auth raised',
        description:
          lead.kypSubmission.preAuthData.notes ||
          lead.kypSubmission.preAuthData.requestedHospitalName ||
          'Pre-auth workflow updated',
        date: lead.kypSubmission.preAuthData.preAuthRaisedAt,
        meta: {
          requestedHospitalName: lead.kypSubmission.preAuthData.requestedHospitalName,
          expectedAdmissionDate: lead.kypSubmission.preAuthData.expectedAdmissionDate,
          expectedSurgeryDate: lead.kypSubmission.preAuthData.expectedSurgeryDate,
        },
      })
    }
  }

  if (lead.admissionRecord) {
    items.push({
      id: `admission:${lead.admissionRecord.id}`,
      type: 'admission',
      title: 'Admission record updated',
      description:
        lead.admissionRecord.notes ||
        lead.admissionRecord.ipdStatusNotes ||
        lead.admissionRecord.admittingHospital,
      date: lead.admissionRecord.initiatedAt,
      meta: {
        admissionDate: lead.admissionRecord.admissionDate,
        surgeryDate: lead.admissionRecord.surgeryDate,
        ipdStatus: lead.admissionRecord.ipdStatus,
        ipdStatusReason: lead.admissionRecord.ipdStatusReason,
      },
    })
  }

  if (lead.dischargeSheet) {
    items.push({
      id: `discharge:${lead.dischargeSheet.id}`,
      type: 'discharge',
      title: 'Discharge updated',
      description:
        lead.dischargeSheet.doctorRemarks ||
        (lead.dischargeSheet.isFinalized ? 'Discharge finalized' : 'Discharge marked'),
      date:
        lead.dischargeSheet.finalizedAt ||
        lead.dischargeSheet.markedAt ||
        lead.dischargeSheet.dischargeDate ||
        lead.dischargeSheet.createdAt,
      meta: {
        dischargeDate: lead.dischargeSheet.dischargeDate,
        status: lead.dischargeSheet.status,
        isFinalized: lead.dischargeSheet.isFinalized,
      },
    })
  }

  if (lead.plRecord) {
    items.push({
      id: `pl:${lead.plRecord.id}`,
      type: 'pl',
      title: 'P&L workflow updated',
      description: lead.plRecord.remarks || `Outstanding status: ${lead.plRecord.outstandingStatus}`,
      date: lead.plRecord.closedAt || lead.plRecord.createdAt,
      meta: {
        outstandingStatus: lead.plRecord.outstandingStatus,
        doctorAmountPending: lead.plRecord.doctorAmountPending,
        hospitalAmountPending: lead.plRecord.hospitalAmountPending,
      },
    })
  }

  return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export async function getDoctorPatientHistory(user: DoctorAppSessionUser, leadId: string) {
  const context = await getDoctorAppContext(user)

  const lead = await prisma.lead.findFirst({
    where: {
      id: leadId,
      AND: [getDoctorScopedLeadWhere(context.doctorName)],
    },
    select: patientHistoryLeadSelect,
  })

  if (!lead) {
    throw new DoctorAppPatientError('Patient history not found', 404)
  }

  return {
    patient: {
      id: lead.id,
      leadRef: lead.leadRef,
      name: lead.patientName,
      age: lead.age,
      sex: lead.sex,
      phoneNumber: lead.phoneNumber,
      alternateNumber: lead.alternateNumber,
      whatsapp: lead.whatsapp,
      circle: lead.circle,
      category: lead.category,
      treatment: lead.treatment,
      hospitalName: lead.hospitalName,
      status: lead.status,
      caseStage: lead.caseStage,
      flowType: lead.flowType,
    },
    history: mapTimeline(lead),
  }
}
