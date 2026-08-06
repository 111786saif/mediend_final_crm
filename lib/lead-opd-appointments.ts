import { CaseStage, FlowType, LeadOpdPhase, LeadOpdStatus } from '@/generated/prisma/enums'
import { hasLeadOpdDone, isOpdDoneStatus } from '@/lib/lead-opd-workflow'

export const LEGACY_LEAD_OPD_ID_PREFIX = 'legacy-opd:'

export type EffectiveOpdImage = {
  id: string
  fileName: string
  fileUrl: string
  storageKey?: string | null
  sortOrder?: number | null
}

export type EffectiveOpdMasterOption = {
  code?: string | null
  label?: string | null
} | null

export type EffectiveOpdEntry = {
  id: string
  leadId: string
  source: 'legacy' | 'record'
  phase: LeadOpdPhase
  slot: 1 | 2
  status: LeadOpdStatus
  hospitalName: string | null
  doctorName: string | null
  contactNumber: string | null
  charges: number | null
  scheduleDate: Date | string | null
  meetingType: number | null
  surgeryAdvised: string | null
  surgeryRemark: EffectiveOpdMasterOption
  surgeryRemarkCode: string | null
  reasonNoSurgery: EffectiveOpdMasterOption
  reasonNoSurgeryCode: string | null
  followUpReason: EffectiveOpdMasterOption
  followUpReasonCode: string | null
  implantRequired: boolean | null
  diagnosis: string | null
  remarks: string | null
  prescriptionImages: EffectiveOpdImage[]
  createdAt?: Date | string | null
  updatedAt?: Date | string | null
  isFirstEffectivePreOpd: boolean
  editableByBd: boolean
}

type LegacyLeadOpdSource = {
  id: string
  caseStage?: CaseStage | null
  flowType?: FlowType | null
  status?: string | null
  hospitalName?: string | null
  surgeonName?: string | null
  remarks?: string | null
  diseaseDetails?: string | null
  opdHospital?: string | null
  opdDrName?: string | null
  opdContactNo?: string | null
  opdCharges?: number | null
  opdScheduleDate?: Date | string | null
  opdMeeting?: number | null
  opdSurgeryAdvised?: string | null
  opdImplantRequired?: boolean | null
  opdDiagnosis?: string | null
  opdSurgeryRemark?: EffectiveOpdMasterOption
  opdSurgeryRemarkCode?: string | null
  opdReasonNoSurgery?: EffectiveOpdMasterOption
  opdReasonNoSurgeryCode?: string | null
  opdFollowUpReason?: EffectiveOpdMasterOption
  opdFollowUpReasonCode?: string | null
  opdPrescriptionImages?: EffectiveOpdImage[] | null
}

type RealLeadOpdSource = {
  id: string
  leadId: string
  phase: LeadOpdPhase
  slot: number
  status: LeadOpdStatus
  hospitalName?: string | null
  doctorName?: string | null
  contactNumber?: string | null
  charges?: number | null
  scheduleDate?: Date | string | null
  meetingType?: number | null
  surgeryAdvised?: string | null
  surgeryRemark?: EffectiveOpdMasterOption
  surgeryRemarkCode?: string | null
  reasonNoSurgery?: EffectiveOpdMasterOption
  reasonNoSurgeryCode?: string | null
  followUpReason?: EffectiveOpdMasterOption
  followUpReasonCode?: string | null
  implantRequired?: boolean | null
  diagnosis?: string | null
  remarks?: string | null
  prescriptionImages?: EffectiveOpdImage[] | null
  createdAt?: Date | string | null
  updatedAt?: Date | string | null
}

export function makeLegacyLeadOpdId(leadId: string) {
  return `${LEGACY_LEAD_OPD_ID_PREFIX}${leadId}`
}

export function isLegacyLeadOpdId(value: string) {
  return value.startsWith(LEGACY_LEAD_OPD_ID_PREFIX)
}

export function getLeadIdFromLegacyLeadOpdId(value: string) {
  return isLegacyLeadOpdId(value) ? value.slice(LEGACY_LEAD_OPD_ID_PREFIX.length) : null
}

export function hasLegacyLeadOpdData(lead: LegacyLeadOpdSource) {
  return Boolean(
    lead.opdHospital ||
      lead.opdDrName ||
      lead.opdContactNo ||
      lead.opdScheduleDate ||
      (typeof lead.opdCharges === 'number' && lead.opdCharges > 0) ||
      (typeof lead.opdMeeting === 'number' && lead.opdMeeting > 0) ||
      lead.opdSurgeryAdvised ||
      lead.opdDiagnosis ||
      lead.opdSurgeryRemark?.label ||
      lead.opdReasonNoSurgery?.label ||
      lead.opdFollowUpReason?.label ||
      typeof lead.opdImplantRequired === 'boolean' ||
      (lead.opdPrescriptionImages?.length ?? 0) > 0
  )
}

function getLegacyLeadOpdStatus(lead: LegacyLeadOpdSource): LeadOpdStatus {
  if (hasLeadOpdDone(lead)) {
    return LeadOpdStatus.DONE
  }

  if (isOpdDoneStatus(lead.status)) {
    return LeadOpdStatus.DONE
  }

  return LeadOpdStatus.SCHEDULED
}

function toEntrySlot(value: number | null | undefined): 1 | 2 {
  return value === 2 ? 2 : 1
}

function normalizeImages(images: EffectiveOpdImage[] | null | undefined) {
  return (images ?? []).map((image, index) => ({
    id: image.id || `image-${index + 1}`,
    fileName: image.fileName,
    fileUrl: image.fileUrl,
    storageKey: image.storageKey ?? null,
    sortOrder: image.sortOrder ?? index,
  }))
}

function mapLegacyLeadOpdToEntry(lead: LegacyLeadOpdSource): EffectiveOpdEntry | null {
  if (!hasLegacyLeadOpdData(lead)) {
    return null
  }

  const status = getLegacyLeadOpdStatus(lead)

  return {
    id: makeLegacyLeadOpdId(lead.id),
    leadId: lead.id,
    source: 'legacy',
    phase: LeadOpdPhase.PRE,
    slot: 1,
    status,
    hospitalName: lead.opdHospital ?? lead.hospitalName ?? null,
    doctorName: lead.opdDrName ?? lead.surgeonName ?? null,
    contactNumber: lead.opdContactNo ?? null,
    charges: lead.opdCharges ?? null,
    scheduleDate: lead.opdScheduleDate ?? null,
    meetingType: lead.opdMeeting ?? null,
    surgeryAdvised: lead.opdSurgeryAdvised ?? null,
    surgeryRemark: lead.opdSurgeryRemark ?? null,
    surgeryRemarkCode: lead.opdSurgeryRemarkCode ?? lead.opdSurgeryRemark?.code ?? null,
    reasonNoSurgery: lead.opdReasonNoSurgery ?? null,
    reasonNoSurgeryCode:
      lead.opdReasonNoSurgeryCode ?? lead.opdReasonNoSurgery?.code ?? null,
    followUpReason: lead.opdFollowUpReason ?? null,
    followUpReasonCode:
      lead.opdFollowUpReasonCode ?? lead.opdFollowUpReason?.code ?? null,
    implantRequired: lead.opdImplantRequired ?? null,
    diagnosis: lead.opdDiagnosis ?? lead.diseaseDetails ?? null,
    remarks: null,
    prescriptionImages: normalizeImages(lead.opdPrescriptionImages),
    createdAt: null,
    updatedAt: null,
    isFirstEffectivePreOpd: false,
    editableByBd: status !== LeadOpdStatus.DONE,
  }
}

function mapRealLeadOpdToEntry(opd: RealLeadOpdSource): EffectiveOpdEntry {
  return {
    id: opd.id,
    leadId: opd.leadId,
    source: 'record',
    phase: opd.phase,
    slot: toEntrySlot(opd.slot),
    status: opd.status,
    hospitalName: opd.hospitalName ?? null,
    doctorName: opd.doctorName ?? null,
    contactNumber: opd.contactNumber ?? null,
    charges: opd.charges ?? null,
    scheduleDate: opd.scheduleDate ?? null,
    meetingType: opd.meetingType ?? null,
    surgeryAdvised: opd.surgeryAdvised ?? null,
    surgeryRemark: opd.surgeryRemark ?? null,
    surgeryRemarkCode: opd.surgeryRemarkCode ?? opd.surgeryRemark?.code ?? null,
    reasonNoSurgery: opd.reasonNoSurgery ?? null,
    reasonNoSurgeryCode: opd.reasonNoSurgeryCode ?? opd.reasonNoSurgery?.code ?? null,
    followUpReason: opd.followUpReason ?? null,
    followUpReasonCode: opd.followUpReasonCode ?? opd.followUpReason?.code ?? null,
    implantRequired: opd.implantRequired ?? null,
    diagnosis: opd.diagnosis ?? null,
    remarks: opd.remarks ?? null,
    prescriptionImages: normalizeImages(opd.prescriptionImages),
    createdAt: opd.createdAt ?? null,
    updatedAt: opd.updatedAt ?? null,
    isFirstEffectivePreOpd: false,
    editableByBd: opd.status !== LeadOpdStatus.DONE,
  }
}

function opdEntrySort(left: EffectiveOpdEntry, right: EffectiveOpdEntry) {
  if (left.phase !== right.phase) {
    return left.phase === LeadOpdPhase.PRE ? -1 : 1
  }

  if (left.slot !== right.slot) {
    return left.slot - right.slot
  }

  const leftTime = left.scheduleDate ? new Date(left.scheduleDate).getTime() : 0
  const rightTime = right.scheduleDate ? new Date(right.scheduleDate).getTime() : 0
  return leftTime - rightTime
}

function isPrimaryPreOpdEntry(entry: EffectiveOpdEntry) {
  return entry.phase === LeadOpdPhase.PRE && entry.status !== LeadOpdStatus.CANCELLED
}

export function buildEffectiveOpdEntries(
  lead: LegacyLeadOpdSource,
  opdAppointments: RealLeadOpdSource[]
): EffectiveOpdEntry[] {
  const entries = opdAppointments.map(mapRealLeadOpdToEntry)
  const legacyEntry = mapLegacyLeadOpdToEntry(lead)

  if (legacyEntry) {
    entries.push(legacyEntry)
  }

  const sorted = entries.sort(opdEntrySort)
  const firstPreIndex = sorted.findIndex(isPrimaryPreOpdEntry)

  if (firstPreIndex >= 0) {
    sorted[firstPreIndex] = {
      ...sorted[firstPreIndex],
      isFirstEffectivePreOpd: true,
    }
  }

  return sorted
}

export function getEffectiveOpdCounts(entries: EffectiveOpdEntry[]) {
  let pre = 0
  let post = 0

  for (const entry of entries) {
    if (entry.phase === LeadOpdPhase.PRE) {
      pre += 1
    } else {
      post += 1
    }
  }

  return { pre, post }
}

export function getFirstEffectivePreOpd(entries: EffectiveOpdEntry[]) {
  return entries.find(isPrimaryPreOpdEntry) ?? null
}

export function getOpdEntriesByPhase(
  entries: EffectiveOpdEntry[],
  phase: LeadOpdPhase
) {
  return entries.filter((entry) => entry.phase === phase)
}

export function getNextAvailableOpdSlot(
  entries: EffectiveOpdEntry[],
  phase: LeadOpdPhase
): 1 | 2 | null {
  const phaseEntries = getOpdEntriesByPhase(entries, phase)
  if (phaseEntries.length >= 2) {
    return null
  }

  const occupied = new Set(phaseEntries.map((entry) => entry.slot))
  return occupied.has(1) ? 2 : 1
}
